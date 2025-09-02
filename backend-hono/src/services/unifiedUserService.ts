import type { Env, UnifiedUserData, GoogleTokens, AutomationRule } from '../types';

// Constants
const MAX_AUTOMATION_RULES = 20;

/**
 * 타입 가드 함수들
 */
function isUnifiedUserData(obj: any): obj is UnifiedUserData {
  return obj && 
         typeof obj === 'object' && 
         typeof obj.email === 'string' && 
         typeof obj.emailHash === 'string' &&
         obj.googleTokens &&
         typeof obj.createdAt === 'string';
}

function isSessionMetadata(obj: any): obj is { email: string; sessionId: string; createdAt: string } {
  return obj && 
         typeof obj === 'object' && 
         typeof obj.email === 'string' && 
         typeof obj.sessionId === 'string' && 
         typeof obj.createdAt === 'string';
}

/**
 * 통합 사용자 데이터 관리 서비스
 * Google 인증정보, SOLAPI 인증정보, 자동화 룰을 하나의 키로 관리
 * 해시 기반 보안 키 사용으로 이메일 추측 공격 방지
 */
export class UnifiedUserService {

  constructor(private env: Env) {}

  /**
   * 이메일을 SHA-256 해시로 변환 (SALT 포함)
   */
  private async getEmailHash(email: string): Promise<string> {
    const salt = this.env.EMAIL_HASH_SALT || 'default_salt_change_in_production';
    const encoder = new TextEncoder();
    const data = encoder.encode(email.toLowerCase() + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * 통합 사용자 키 생성
   */
  private async getUserKey(email: string): Promise<string> {
    const emailHash = await this.getEmailHash(email);
    return `unified_user:${emailHash}`;
  }

  /**
   * 사용자 데이터 전체 조회
   */
  async getUserData(email: string): Promise<UnifiedUserData | null> {
    try {
      const userKey = await this.getUserKey(email);
      const userData = await this.env.SESSIONS.get(userKey);
      
      if (!userData) return null;
      
      const parsed = JSON.parse(userData);
      if (!isUnifiedUserData(parsed)) {
        console.error('Invalid user data structure:', parsed);
        return null;
      }
      
      return parsed;
    } catch (error) {
      console.error('Failed to get user data:', error);
      return null;
    }
  }

  /**
   * 사용자 데이터 전체 저장/업데이트
   */
  async saveUserData(userData: UnifiedUserData): Promise<void> {
    try {
      const userKey = await this.getUserKey(userData.email);
      const emailHash = await this.getEmailHash(userData.email);
      
      const dataToSave: UnifiedUserData = {
        ...userData,
        emailHash,
        updatedAt: new Date().toISOString()
      };

      // 1년간 보관 (Google/SOLAPI 토큰, 자동화 룰 포함)
      await this.env.SESSIONS.put(userKey, JSON.stringify(dataToSave), {
        expirationTtl: 31536000 // 1년
      });

      console.log(`Unified user data saved for: ${userData.email}`);
    } catch (error) {
      console.error('Failed to save user data:', error);
      throw new Error('사용자 데이터 저장에 실패했습니다.');
    }
  }

  /**
   * 새 사용자 데이터 생성
   */
  async createUserData(email: string, googleTokens: GoogleTokens): Promise<UnifiedUserData> {
    const emailHash = await this.getEmailHash(email);
    
    const userData: UnifiedUserData = {
      email: email.toLowerCase(),
      emailHash,
      googleTokens,
      automationRules: [],
      lastLoginAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await this.saveUserData(userData);
    return userData;
  }

  /**
   * Google 토큰 업데이트
   */
  async updateGoogleTokens(email: string, googleTokens: GoogleTokens): Promise<void> {
    const userData = await this.getUserData(email);
    
    if (!userData) {
      // 새 사용자 생성
      await this.createUserData(email, googleTokens);
      return;
    }

    userData.googleTokens = googleTokens;
    userData.lastLoginAt = new Date().toISOString();
    
    await this.saveUserData(userData);
  }

  /**
   * SOLAPI 토큰 업데이트
   */
  async updateSolapiTokens(email: string, solapiTokens: {
    accessToken: string;
    refreshToken: string;
    connectedAt: string;
    expiryDate: number;
  }): Promise<void> {
    const userData = await this.getUserData(email);
    
    if (!userData) {
      throw new Error('사용자 데이터를 찾을 수 없습니다. Google 로그인이 필요합니다.');
    }

    userData.solapiTokens = solapiTokens;
    await this.saveUserData(userData);
  }

  /**
   * SOLAPI 토큰 제거 (연결 해제)
   */
  async removeSolapiTokens(email: string): Promise<void> {
    const userData = await this.getUserData(email);
    
    if (!userData) return;

    userData.solapiTokens = undefined;
    await this.saveUserData(userData);
  }

  /**
   * 자동화 룰 추가
   */
  async addAutomationRule(email: string, rule: AutomationRule): Promise<void> {
    console.log(`[DEBUG] addAutomationRule called for email: ${email}, rule: ${rule.name}`);
    
    const userData = await this.getUserData(email);
    
    if (!userData) {
      throw new Error('사용자 데이터를 찾을 수 없습니다. Google 로그인이 필요합니다.');
    }

    console.log(`[DEBUG] Current automation rules count: ${userData.automationRules.length}`);

    // 최대 개수 제한 확인
    if (userData.automationRules.length >= MAX_AUTOMATION_RULES) {
      throw new Error(`자동화 규칙은 최대 ${MAX_AUTOMATION_RULES}개까지만 저장할 수 있습니다.`);
    }

    // 룰에 사용자 이메일 설정
    rule.userEmail = email;
    
    userData.automationRules.push(rule);
    console.log(`[DEBUG] Added rule, new count: ${userData.automationRules.length}`);
    
    await this.saveUserData(userData);
    console.log(`[DEBUG] Saved userData to unified storage`);
    
    // 웹훅을 위한 사용자 인덱스에 추가
    await this.addToAutomationIndex(email);
    console.log(`[DEBUG] Added ${email} to automation index`);
  }

  /**
   * 자동화 룰 삭제
   */
  async removeAutomationRule(email: string, ruleId: string): Promise<void> {
    const userData = await this.getUserData(email);
    
    if (!userData) return;

    userData.automationRules = userData.automationRules.filter(rule => rule.id !== ruleId);
    await this.saveUserData(userData);
    
    // 자동화 룰이 모두 삭제되면 인덱스에서 제거
    if (userData.automationRules.length === 0) {
      await this.removeFromAutomationIndex(email);
    }
  }

  /**
   * 자동화 룰 목록 조회
   */
  async getAutomationRules(email: string): Promise<AutomationRule[]> {
    const userData = await this.getUserData(email);
    return userData?.automationRules || [];
  }

  /**
   * Google 토큰 조회
   */
  async getGoogleTokens(email: string): Promise<GoogleTokens | null> {
    const userData = await this.getUserData(email);
    return userData?.googleTokens || null;
  }

  /**
   * SOLAPI 토큰 조회
   */
  async getSolapiTokens(email: string): Promise<{
    accessToken: string;
    refreshToken: string;
    connectedAt: string;
    expiryDate: number;
  } | null> {
    const userData = await this.getUserData(email);
    return userData?.solapiTokens || null;
  }

  /**
   * 사용자 세션에서 이메일 추출 (하위 호환성)
   */
  async getEmailFromSession(sessionId: string): Promise<string | null> {
    try {
      const sessionData = await this.env.SESSIONS.get(sessionId);
      if (!sessionData) return null;
      
      const parsed = JSON.parse(sessionData);
      if (!isSessionMetadata(parsed)) {
        console.error('Invalid session metadata structure:', parsed);
        return null;
      }
      return parsed.email;
    } catch (error) {
      console.error('Failed to get email from session:', error);
      return null;
    }
  }

  /**
   * Google 이메일 추출 (Google OAuth 토큰에서)
   */
  async extractGoogleEmail(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        console.error('Failed to get Google user info:', response.status);
        return null;
      }

      const userInfo = await response.json() as { email?: string };
      return userInfo.email || null;
    } catch (error) {
      console.error('Error extracting Google email:', error);
      return null;
    }
  }

  /**
   * 사용자 데이터 정리 (로그아웃시) - 세션만 정리, 사용자 데이터는 유지
   */
  async cleanupSession(sessionId: string): Promise<void> {
    try {
      await this.env.SESSIONS.delete(sessionId);
      console.log(`Session cleaned up: ${sessionId}`);
    } catch (error) {
      console.error('Failed to cleanup session:', error);
    }
  }

  /**
   * 사용자 데이터 완전 삭제 (계정 삭제시)
   */
  async deleteUserData(email: string): Promise<void> {
    try {
      const userKey = await this.getUserKey(email);
      await this.env.SESSIONS.delete(userKey);
      await this.removeFromAutomationIndex(email);
      console.log(`User data completely deleted for: ${email}`);
    } catch (error) {
      console.error('Failed to delete user data:', error);
      throw new Error('사용자 데이터 삭제에 실패했습니다.');
    }
  }

  /**
   * 관리자 세션 인덱스 관리 - 보안 최적화를 위해 추가
   */
  async addAdminSessionToIndex(email: string, sessionId: string): Promise<void> {
    try {
      const indexKey = 'admin_sessions_index';
      const sessionData = {
        email,
        sessionId,
        createdAt: new Date().toISOString()
      };
      
      await this.env.SESSIONS.put(`${indexKey}:${email}`, JSON.stringify(sessionData), {
        expirationTtl: 86400 // 24시간
      });
    } catch (error) {
      console.error('Failed to add admin session to index:', error);
    }
  }

  async getValidAdminSession(): Promise<GoogleTokens | null> {
    try {
      const indexPrefix = 'admin_sessions_index:';
      const kvKeys = await this.env.SESSIONS.list({ prefix: indexPrefix });
      
      for (const key of kvKeys.keys) {
        try {
          const sessionDataStr = await this.env.SESSIONS.get(key.name);
          if (!sessionDataStr) continue;
          
          const parsed = JSON.parse(sessionDataStr);
          if (!isSessionMetadata(parsed)) {
            console.error('Invalid admin session metadata structure:', parsed);
            continue;
          }
          const userData = await this.getUserData(parsed.email);
          
          if (userData?.googleTokens?.accessToken && userData.googleTokens?.refreshToken) {
            // 토큰 만료 확인
            const expiryDate = userData.googleTokens.expiryDate;
            if (!expiryDate || new Date(expiryDate) > new Date()) {
              return userData.googleTokens;
            }
          }
        } catch (e) {
          console.error(`Error checking admin session ${key.name}:`, e);
          continue;
        }
      }
      return null;
    } catch (error) {
      console.error('Failed to get valid admin session:', error);
      return null;
    }
  }

  async removeAdminSessionFromIndex(email: string): Promise<void> {
    try {
      const indexKey = `admin_sessions_index:${email}`;
      await this.env.SESSIONS.delete(indexKey);
    } catch (error) {
      console.error('Failed to remove admin session from index:', error);
    }
  }

  /**
   * 웹훅용 자동화 사용자 인덱스에 추가
   */
  private async addToAutomationIndex(email: string): Promise<void> {
    try {
      const indexKey = 'automation_users_index';
      const indexData = await this.env.SESSIONS.get(indexKey);
      let userEmails: string[] = [];
      
      if (indexData) {
        const parsed = JSON.parse(indexData);
        if (Array.isArray(parsed) && parsed.every(item => typeof item === 'string')) {
          userEmails = parsed;
        } else {
          console.error('Invalid automation index structure, resetting:', parsed);
          userEmails = [];
        }
      }
      
      // 이미 있으면 추가하지 않음
      if (!userEmails.includes(email.toLowerCase())) {
        userEmails.push(email.toLowerCase());
        await this.env.SESSIONS.put(indexKey, JSON.stringify(userEmails), {
          expirationTtl: 31536000 // 1년
        });
        console.log(`Added ${email} to automation index`);
      }
    } catch (error) {
      console.error('Failed to add to automation index:', error);
    }
  }

  /**
   * 웹훅용 자동화 사용자 인덱스에서 제거
   */
  private async removeFromAutomationIndex(email: string): Promise<void> {
    try {
      const indexKey = 'automation_users_index';
      const indexData = await this.env.SESSIONS.get(indexKey);
      
      if (!indexData) return;
      
      const parsed = JSON.parse(indexData);
      if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
        console.error('Invalid automation index structure, cannot remove:', parsed);
        return;
      }
      const userEmails = parsed.filter(userEmail => userEmail !== email.toLowerCase());
      
      await this.env.SESSIONS.put(indexKey, JSON.stringify(userEmails), {
        expirationTtl: 31536000 // 1년
      });
      console.log(`Removed ${email} from automation index`);
    } catch (error) {
      console.error('Failed to remove from automation index:', error);
    }
  }

  /**
   * 모든 자동화 사용자 이메일 조회 (웹훅용)
   */
  async getAllAutomationUserEmails(): Promise<string[]> {
    try {
      const indexKey = 'automation_users_index';
      const indexData = await this.env.SESSIONS.get(indexKey);
      
      if (!indexData) return [];
      
      const parsed = JSON.parse(indexData);
      if (!Array.isArray(parsed) || !parsed.every(item => typeof item === 'string')) {
        console.error('Invalid automation user emails structure:', parsed);
        return [];
      }
      return parsed;
    } catch (error) {
      console.error('Failed to get automation user emails:', error);
      return [];
    }
  }

  /**
   * 모든 자동화 룰 조회 (웹훅용)
   */
  async getAllAutomationRules(): Promise<{ email: string; rules: AutomationRule[] }[]> {
    const userEmails = await this.getAllAutomationUserEmails();
    const allRules: { email: string; rules: AutomationRule[] }[] = [];
    
    for (const email of userEmails) {
      try {
        const userData = await this.getUserData(email);
        if (userData && userData.automationRules.length > 0) {
          allRules.push({
            email: email,
            rules: userData.automationRules
          });
        }
      } catch (error) {
        console.error(`Failed to get rules for ${email}:`, error);
      }
    }
    
    return allRules;
  }

  /**
   * 세션 기반 사용자 데이터 저장 → 통합 저장소로 리다이렉트
   */
  async saveSessionBasedUserData(sessionId: string, userData: UnifiedUserData): Promise<void> {
    try {
      // 통합 저장소에 저장
      await this.saveUserData(userData);
      
      // 세션에는 이메일과 세션 ID만 저장 (가벼운 세션 관리)
      const sessionData = {
        email: userData.email,
        sessionId,
        createdAt: new Date().toISOString()
      };
      
      const sessionKey = `session_user:${sessionId}`;
      await this.env.SESSIONS.put(sessionKey, JSON.stringify(sessionData), {
        expirationTtl: 86400 // 1일 (세션만)
      });

      console.log(`Unified user data saved for sessionId: ${sessionId.substring(0, 8)}..., email: ${userData.email}`);
    } catch (error) {
      console.error('Failed to save unified user data:', error);
      throw new Error('사용자 데이터 저장에 실패했습니다.');
    }
  }

  /**
   * 세션 기반 사용자 데이터 조회 → 통합 저장소에서 조회
   */
  async getSessionBasedUserData(sessionId: string): Promise<UnifiedUserData | null> {
    try {
      const sessionKey = `session_user:${sessionId}`;
      const sessionData = await this.env.SESSIONS.get(sessionKey);
      
      if (!sessionData) return null;
      
      const parsed = JSON.parse(sessionData);
      if (!isSessionMetadata(parsed)) {
        console.error('Invalid session metadata structure:', parsed);
        return null;
      }
      const email = parsed.email;
      
      if (!email) return null;
      
      // 통합 저장소에서 실제 데이터 조회
      return await this.getUserData(email);
    } catch (error) {
      console.error('Failed to get unified user data via session:', error);
      return null;
    }
  }

  /**
   * 세션 기반 자동화 룰 조회 (구조적 개선)
   */
  async getAutomationRulesBySession(sessionId: string): Promise<AutomationRule[]> {
    const userData = await this.getSessionBasedUserData(sessionId);
    return userData?.automationRules || [];
  }

  /**
   * 세션 기반 자동화 룰 추가 → 통합 저장소에 직접 추가
   */
  async addAutomationRuleBySession(sessionId: string, rule: AutomationRule): Promise<void> {
    console.log(`[DEBUG] addAutomationRuleBySession called for sessionId: ${sessionId.substring(0, 8)}..., rule: ${rule.name}`);
    
    const userData = await this.getSessionBasedUserData(sessionId);
    
    if (!userData) {
      throw new Error('세션 데이터를 찾을 수 없습니다. 다시 로그인해주세요.');
    }

    console.log(`[DEBUG] Found userData for email: ${userData.email}`);

    // 통합 저장소의 addAutomationRule 메소드 사용
    await this.addAutomationRule(userData.email, rule);
    console.log(`[DEBUG] addAutomationRuleBySession completed`);
  }

  /**
   * 세션 기반 자동화 룰 삭제 → 통합 저장소에서 직접 삭제
   */
  async removeAutomationRuleBySession(sessionId: string, ruleId: string): Promise<void> {
    const userData = await this.getSessionBasedUserData(sessionId);
    
    if (!userData) return;

    // 통합 저장소의 removeAutomationRule 메소드 사용
    await this.removeAutomationRule(userData.email, ruleId);
  }

  /**
   * 세션 정리 (로그아웃 시)
   */
  async cleanupSessionData(sessionId: string): Promise<void> {
    try {
      const sessionKey = `session_user:${sessionId}`;
      await this.env.SESSIONS.delete(sessionKey);
      console.log(`Session data cleaned up: ${sessionId.substring(0, 8)}...`);
    } catch (error) {
      console.error('Failed to cleanup session data:', error);
    }
  }
}