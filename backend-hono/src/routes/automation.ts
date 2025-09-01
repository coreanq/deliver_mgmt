import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { UnifiedUserService } from '../services/unifiedUserService';
import type { Env, ApiResponse, AutomationRule, AutomationTriggerEvent, Variables } from '../types';

const automation = new Hono<{ Bindings: Env; Variables: Variables }>();

// UnifiedUserService 전역 설정
automation.use('*', async (c, next) => {
  c.set('unifiedUserService', new UnifiedUserService(c.env));
  await next();
});

// 구조적 개선: 임시 세션 관리 함수 제거됨
// sessionId를 직접 통합 데이터 키로 사용

async function getSession(sessionId: string, env: Env): Promise<any | null> {
  try {
    const sessionData = await env.SESSIONS.get(`session_user:${sessionId}`);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch {
    return null;
  }
}

async function getAllActiveSessions(env: Env): Promise<Map<string, any>> {
  const sessions = new Map<string, any>();
  
  try {
    // KV doesn't have a direct way to list all keys, so this is a simplified approach
    // In a real implementation, you might want to maintain a separate index of active sessions
    // For now, we'll return an empty map and log that we need session management
    console.log('Note: Session enumeration not implemented. Webhook will only work if session IDs are known.');
    
    // Alternative: Store active session IDs in a separate KV key
    const activeSessionIds = await env.SESSIONS.get('ACTIVE_SESSIONS');
    if (activeSessionIds) {
      const sessionIds = JSON.parse(activeSessionIds) as string[];
      
      for (const sessionId of sessionIds) {
        const sessionData = await getSession(sessionId, env);
        if (sessionData) {
          sessions.set(sessionId, sessionData);
        }
      }
    }
    
  } catch (error) {
    console.error('Failed to get active sessions:', error);
  }
  
  return sessions;
}

async function addToActiveSessions(sessionId: string, env: Env): Promise<void> {
  try {
    const activeSessionIds = await env.SESSIONS.get('ACTIVE_SESSIONS');
    let sessionIds: string[] = [];
    
    if (activeSessionIds) {
      sessionIds = JSON.parse(activeSessionIds);
    }
    
    // Add session ID if not already present
    if (!sessionIds.includes(sessionId)) {
      sessionIds.push(sessionId);
      await env.SESSIONS.put('ACTIVE_SESSIONS', JSON.stringify(sessionIds), { expirationTtl: 86400 * 7 }); // 7 days
    }
  } catch (error) {
    console.error('Failed to add session to active sessions:', error);
  }
}

function checkAutomationCondition(rule: AutomationRule, oldValue: string, newValue: string): boolean {
  const { operator, triggerValue } = rule.conditions;

  switch (operator) {
    case 'equals':
      return newValue === triggerValue;
    case 'contains':
      return newValue.includes(triggerValue);
    case 'changes_to':
      return oldValue !== newValue && newValue === triggerValue;
    default:
      return false;
  }
}

async function executeAutomationAction(
  rule: AutomationRule, 
  rowData: { [key: string]: any }, 
  solapiAccessToken: string | undefined,
  env: Env
): Promise<boolean> {
  try {
    if (!solapiAccessToken) {
      console.error('SOLAPI access token is required for automation actions');
      return false;
    }

    const { actions } = rule;
    const { type, senderNumber, recipientColumn, messageTemplate } = actions;

    // Get recipient number from row data
    const recipientNumber = rowData[recipientColumn];
    if (!recipientNumber) {
      console.error(`Recipient number not found in column: ${recipientColumn}`);
      return false;
    }

    // Replace variables in message template
    const message = replaceVariables(messageTemplate, rowData);

    // Send message based on type
    let success = false;
    if (type === 'sms') {
      success = await sendSMS(solapiAccessToken, senderNumber, recipientNumber, message);
    } else if (type === 'kakao') {
      success = await sendKakaoTalk(solapiAccessToken, senderNumber, recipientNumber, message);
    }

    if (success) {
      console.log(`Automation executed successfully: ${rule.name}`);
      console.log(`Message sent to ${recipientNumber}: ${message}`);
    }

    return success;
  } catch (error: any) {
    console.error('Failed to execute automation action:', error);
    return false;
  }
}

function replaceVariables(template: string, rowData: { [key: string]: any }): string {
  let message = template;
  
  // Replace #{columnName} with actual values
  const variablePattern = /#\{([^}]+)\}/g;
  message = message.replace(variablePattern, (match, columnName) => {
    const value = rowData[columnName];
    return value !== undefined ? String(value) : match;
  });

  return message;
}

async function sendSMS(
  accessToken: string,
  senderNumber: string,
  recipientNumber: string,
  message: string
): Promise<boolean> {
  try {
    // 메시지 길이에 따라 SMS/LMS 자동 선택
    const messageBytes = Buffer.byteLength(message, 'utf8');
    const messageType = messageBytes <= 90 ? 'SMS' : 'LMS';
    
    console.log(`Message length: ${messageBytes} bytes, using type: ${messageType}`);
    
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          type: messageType,
          from: senderNumber.replace(/-/g, ''),
          to: recipientNumber.replace(/-/g, ''),
          text: message,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`SOLAPI ${messageType} failed:`, response.status, errorText);
      return false;
    }

    const result = await response.json() as { messageId?: string; statusCode?: number };
    console.log(`${messageType} sent successfully:`, {
      messageId: result.messageId,
      statusCode: result.statusCode,
      messageLength: messageBytes
    });

    return true;
  } catch (error: any) {
    console.error('Failed to send SMS/LMS:', error);
    return false;
  }
}

async function sendKakaoTalk(
  accessToken: string,
  senderNumber: string,
  recipientNumber: string,
  message: string
): Promise<boolean> {
  try {
    const response = await fetch('https://api.solapi.com/messages/v4/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          type: 'ATA', // KakaoTalk Alimtalk
          from: senderNumber.replace(/-/g, ''),
          to: recipientNumber.replace(/-/g, ''),
          text: message,
        },
      }),
    });

    if (!response.ok) {
      console.log('KakaoTalk failed, falling back to SMS...');
      return await sendSMS(accessToken, senderNumber, recipientNumber, message);
    }

    const result = await response.json() as { messageId?: string; statusCode?: number };
    console.log('KakaoTalk sent successfully:', {
      messageId: result.messageId,
      statusCode: result.statusCode
    });

    return true;
  } catch (error: any) {
    console.error('Failed to send KakaoTalk:', error);
    // Fallback to SMS if KakaoTalk fails
    console.log('Falling back to SMS...');
    return await sendSMS(accessToken, senderNumber, recipientNumber, message);
  }
}

/**
 * Get all automation rules (no filtering)
 */
automation.get('/rules', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    // 구조적 개선: 세션 기반 통합 데이터 직접 조회
    const unifiedUserService = c.get('unifiedUserService');
    const rules = await unifiedUserService.getAutomationRulesBySession(sessionId);
    
    if (rules === null) {
      return c.json({
        success: false,
        message: '세션 데이터를 찾을 수 없습니다. 다시 로그인해주세요.',
      } as ApiResponse, 401);
    }

    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    const userEmail = userData?.email;

    console.log(`Returning ${rules.length} automation rules for user: ${userEmail}`);

    return c.json({
      success: true,
      data: rules,
      message: `자동화 규칙 목록을 성공적으로 조회했습니다. (Google 계정: ${userEmail})`,
    } as ApiResponse<AutomationRule[]>);
  } catch (error: any) {
    console.error('Failed to get automation rules:', error);
    return c.json({
      success: false,
      message: '자동화 규칙 조회에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Create new automation rule
 */
automation.post('/rules', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    const body = await c.req.json();
    const { name, conditions, actions, targetDate, spreadsheetId, spreadsheetName } = body;

    if (!name || !conditions || !actions) {
      return c.json({
        success: false,
        message: '필수 필드가 누락되었습니다. (name, conditions, actions)',
      } as ApiResponse, 400);
    }

    // 구조적 개선: 세션 기반 통합 데이터에서 사용자 정보 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    
    if (!userData?.email) {
      return c.json({
        success: false,
        message: '세션 데이터를 찾을 수 없습니다. 다시 로그인해주세요.',
      } as ApiResponse, 401);
    }

    const userEmail = userData.email;

    const newRule: AutomationRule = {
      id: crypto.randomUUID(),
      name,
      enabled: true,
      spreadsheetId, // 스프레드시트 ID (사용자별 구분)
      targetDate, // 특정 날짜 시트만 대상 (선택사항)
      userEmail, // 규칙을 생성한 Google 계정 이메일
      conditions,
      actions,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Add additional metadata for UI display
    if (spreadsheetName) {
      (newRule as any).spreadsheetName = spreadsheetName; // 시트 이름 저장
    }

    try {
      // 구조적 개선: 세션 기반 자동화 규칙 추가 (자동으로 20개 제한 체크)
      await unifiedUserService.addAutomationRuleBySession(sessionId, newRule);
    } catch (error: any) {
      if (error.message.includes('최대 20개')) {
        return c.json({
          success: false,
          message: error.message,
        } as ApiResponse, 400);
      }
      throw error;
    }

    console.log(`New automation rule created for ${userEmail}: ${newRule.name} (${newRule.id})`);

    return c.json({
      success: true,
      data: newRule,
      message: '자동화 규칙이 성공적으로 생성되었습니다.',
    } as ApiResponse<AutomationRule>);
  } catch (error: any) {
    console.error('Failed to create automation rule:', error);
    return c.json({
      success: false,
      message: '자동화 규칙 생성에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Update automation rule
 */
automation.put('/rules/:id', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID');
    const ruleId = c.req.param('id');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    // 구조적 개선: 세션 기반 통합 데이터에서 사용자 정보 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    
    if (!userData?.email) {
      return c.json({
        success: false,
        message: '세션 데이터를 찾을 수 없습니다. 다시 로그인해주세요.',
      } as ApiResponse, 401);
    }

    const body = await c.req.json();

    const ruleIndex = userData.automationRules.findIndex(rule => rule.id === ruleId);
    
    if (ruleIndex === -1) {
      return c.json({
        success: false,
        message: '자동화 규칙을 찾을 수 없습니다.',
      } as ApiResponse, 404);
    }

    // 구조적 개선: 세션 기반 규칙 업데이트
    userData.automationRules[ruleIndex] = {
      ...userData.automationRules[ruleIndex],
      ...body,
      updatedAt: new Date().toISOString(),
    };
    
    await unifiedUserService.saveSessionBasedUserData(sessionId, userData);

    return c.json({
      success: true,
      data: userData.automationRules[ruleIndex],
      message: '자동화 규칙이 성공적으로 수정되었습니다.',
    } as ApiResponse<AutomationRule>);
  } catch (error: any) {
    console.error('Failed to update automation rule:', error);
    return c.json({
      success: false,
      message: '자동화 규칙 수정에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Delete automation rule
 */
automation.delete('/rules/:id', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID');
    const ruleId = c.req.param('id');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    // 구조적 개선: 세션 기반 통합 데이터에서 규칙 삭제
    const unifiedUserService = c.get('unifiedUserService');
    await unifiedUserService.removeAutomationRuleBySession(sessionId, ruleId);
    
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    if (!userData?.email) {
      return c.json({
        success: false,
        message: '세션 데이터를 찾을 수 없습니다.',
      } as ApiResponse, 401);
    }

    console.log(`Automation rule deleted for ${userData.email}: ${ruleId}`);

    return c.json({
      success: true,
      message: '자동화 규칙이 삭제되었습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to delete automation rule:', error);
    return c.json({
      success: false,
      message: '자동화 규칙 삭제에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Handle Google Sheets Webhook trigger
 * Processes automation when spreadsheet values change
 */
automation.post('/trigger', async (c) => {
  try {
    const body = await c.req.json();
    console.log('Webhook received:', JSON.stringify(body, null, 2));

    // Validate webhook payload structure
    const { 
      sheetName, 
      spreadsheetName,
      spreadsheetId,
      sheetDate, 
      rowIndex,
      columnName,
      columnIndex, 
      oldValue, 
      newValue, 
      rowData, 
      timestamp 
    } = body;

    if (!sheetName || !columnName || !rowData) {
      return c.json({
        success: false,
        message: '필수 webhook 필드가 누락되었습니다. (sheetName, columnName, rowData)',
      } as ApiResponse, 400);
    }

    // Use spreadsheetName or sheetDate for date matching
    const targetSheetDate = spreadsheetName || sheetDate;
    
    // Helper function to normalize date formats for comparison
    const normalizeDateForComparison = (date: string | Date): string => {
      if (!date) return '';
      
      if (typeof date === 'string') {
        // If it's already in YYYYMMDD format (8 digits)
        if (/^\d{8}$/.test(date)) {
          return date;
        }
        // If it's in ISO format, extract date part
        if (date.includes('T') || date.includes('-')) {
          const dateObj = new Date(date);
          return dateObj.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
        }
      }
      
      if (date instanceof Date) {
        return date.toISOString().slice(0, 10).replace(/-/g, ''); // YYYYMMDD
      }
      
      return date.toString();
    };

    // 새로운 통합 사용자 서비스를 사용한 웹훅 처리
    const unifiedUserService = c.get('unifiedUserService');
    const allUserRules = await unifiedUserService.getAllAutomationRules();
    
    let executedRules = 0;
    let results: any[] = [];

    console.log(`Processing automation rules from ${allUserRules.length} users`);

    for (const userRules of allUserRules) {
      const { email, rules } = userRules;
      const activeRules = rules.filter((rule: AutomationRule) => rule.enabled);

      if (activeRules.length === 0) continue;

      console.log(`Processing ${activeRules.length} rules for user: ${email}`);

      // 해당 사용자의 SOLAPI 토큰 조회
      const userData = await unifiedUserService.getUserData(email);
      console.log(`User data for ${email}:`, {
        hasUserData: !!userData,
        hasSolapiTokens: !!userData?.solapiTokens,
        solapiTokensKeys: userData?.solapiTokens ? Object.keys(userData.solapiTokens) : 'none',
        actualTokens: userData?.solapiTokens || 'NO_TOKENS'
      });
      const solapiAccessToken = userData?.solapiTokens?.accessToken;

      for (const rule of activeRules) {
        // Check if rule matches the changed column and target date
        if (rule.conditions.columnName !== columnName) {
          continue;
        }

        // Check spreadsheetId matching if rule has spreadsheetId
        if (rule.spreadsheetId && spreadsheetId && rule.spreadsheetId !== spreadsheetId) {
          console.log(`Rule ${rule.name} skipped: spreadsheetId ${rule.spreadsheetId} != ${spreadsheetId}`);
          continue;
        }

        // Check date matching if rule has targetDate
        if (rule.targetDate) {
          const ruleDate = normalizeDateForComparison(rule.targetDate);
          const sheetDate = normalizeDateForComparison(targetSheetDate);
          
          if (ruleDate !== sheetDate) {
            console.log(`Rule ${rule.name} skipped: targetDate ${ruleDate} != ${sheetDate} (original: ${rule.targetDate} != ${targetSheetDate})`);
            continue;
          }
        }

        // Check if condition is met
        const conditionMet = checkAutomationCondition(rule, oldValue, newValue);
        
        if (conditionMet) {
          console.log(`Automation rule triggered: ${rule.name} for user: ${email}`);
          console.log(`SOLAPI token status: ${solapiAccessToken ? 'found' : 'NOT FOUND'}`);
          
          // Execute automation action
          const success = await executeAutomationAction(
            rule, 
            rowData, 
            solapiAccessToken,
            c.env
          );
          
          executedRules++;
          results.push({
            userEmail: email,
            ruleId: rule.id,
            ruleName: rule.name,
            success,
            columnName,
            oldValue,
            newValue,
            timestamp: new Date().toISOString()
          });

          if (success) {
            console.log(`Automation executed successfully: ${rule.name}`);
          } else {
            console.error(`Failed to execute automation: ${rule.name}`);
          }
        }
      }
    }

    return c.json({
      success: true,
      message: `Webhook processed successfully. ${executedRules} rules executed.`,
      data: {
        processedRules: executedRules,
        results,
        webhook: {
          sheetName,
          sheetDate,
          rowIndex,
          columnName,
          oldValue,
          newValue,
          timestamp
        }
      },
    } as ApiResponse);

  } catch (error: any) {
    console.error('Webhook processing failed:', error);
    return c.json({
      success: false,
      message: 'Webhook 처리에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Test automation rule trigger (for manual testing)
 */
automation.post('/test-trigger', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    // 구조적 개선: 세션 기반 통합 데이터에서 사용자 정보 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    
    if (!userData?.email) {
      return c.json({
        success: false,
        message: '세션 데이터를 찾을 수 없습니다. 다시 로그인해주세요.',
      } as ApiResponse, 401);
    }

    const body = await c.req.json();
    const { ruleId, testData } = body;

    if (!ruleId || !testData) {
      return c.json({
        success: false,
        message: '필수 필드가 누락되었습니다. (ruleId, testData)',
      } as ApiResponse, 400);
    }

    // 구조적 개선: userData는 이미 위에서 조회됨

    const rule = userData.automationRules.find((r: AutomationRule) => r.id === ruleId);
    
    if (!rule) {
      return c.json({
        success: false,
        message: '자동화 규칙을 찾을 수 없습니다.',
      } as ApiResponse, 404);
    }

    if (!rule.enabled) {
      return c.json({
        success: false,
        message: '비활성화된 자동화 규칙입니다.',
      } as ApiResponse, 400);
    }

    // Execute automation action
    const success = await executeAutomationAction(
      rule,
      testData,
      userData.solapiTokens?.accessToken,
      c.env
    );

    return c.json({
      success: true,
      message: success ? '자동화 테스트가 성공적으로 실행되었습니다.' : '자동화 실행에 실패했습니다.',
      data: {
        ruleId,
        ruleName: rule.name,
        testData,
        success,
        timestamp: new Date().toISOString(),
      },
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to trigger automation:', error);
    return c.json({
      success: false,
      message: '자동화 테스트 실행에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Webhook 테스트 및 디버깅용 엔드포인트
 */
automation.get('/webhook/status', async (c) => {
  try {
    const activeSessions = await getAllActiveSessions(c.env);
    
    let totalRules = 0;
    const sessionsInfo: any[] = [];
    
    for (const [sessionId, sessionData] of activeSessions) {
      const rules = sessionData.automationRules || [];
      const enabledRules = rules.filter((rule: AutomationRule) => rule.enabled);
      
      totalRules += enabledRules.length;
      
      sessionsInfo.push({
        sessionId: sessionId.substring(0, 8) + '...',
        totalRules: rules.length,
        enabledRules: enabledRules.length,
        rules: enabledRules.map((rule: AutomationRule) => ({
          name: rule.name,
          targetDate: rule.targetDate,
          columnName: rule.conditions.columnName,
          triggerValue: rule.conditions.triggerValue
        }))
      });
    }
    
    return c.json({
      success: true,
      data: {
        webhookUrl: '/api/automation/trigger',
        totalActiveSessions: activeSessions.size,
        totalEnabledRules: totalRules,
        sessions: sessionsInfo
      },
      message: 'Webhook 상태 조회 완료'
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get webhook status:', error);
    return c.json({
      success: false,
      message: 'Webhook 상태 조회에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * 수동 webhook 테스트 (개발용)
 */
automation.post('/webhook/test', async (c) => {
  try {
    const testPayload = {
      sheetName: "20250825",
      sheetDate: "20250825",
      rowIndex: 2,
      columnName: "배송상태",
      columnIndex: 5,
      oldValue: "배송 준비중",
      newValue: "배송 완료",
      rowData: {
        "고객명": "테스트 고객",
        "배송지": "서울시 강남구 테스트동 123-45",
        "고객 연락처": "010-3091-7061",
        "배송상태": "배송 완료",
        "배송 담당자": "테스트 담당자"
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('Manual webhook test triggered:', testPayload);
    
    // Call the actual webhook trigger endpoint
    const webhookResponse = await fetch(`${c.req.url.replace('/webhook/test', '/trigger')}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload)
    });
    
    const result = await webhookResponse.json();
    
    return c.json({
      success: true,
      message: '수동 Webhook 테스트 완료',
      data: {
        testPayload,
        webhookResult: result
      }
    } as ApiResponse);
    
  } catch (error: any) {
    console.error('Manual webhook test failed:', error);
    return c.json({
      success: false,
      message: '수동 Webhook 테스트 실패',
      error: error.message,
    } as ApiResponse, 500);
  }
});

// Debug endpoint to check unified user data
automation.get('/debug/user/:email', async (c) => {
  try {
    const email = c.req.param('email');
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getUserData(email);
    
    return c.json({
      success: true,
      email,
      userData,
      hasSolapiTokens: !!userData?.solapiTokens,
      solapiTokensKeys: userData?.solapiTokens ? Object.keys(userData.solapiTokens) : null
    });
  } catch (error: any) {
    return c.json({
      success: false,
      error: error.message
    });
  }
});

export default automation;