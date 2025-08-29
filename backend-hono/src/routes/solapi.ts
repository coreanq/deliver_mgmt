import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import axios from 'axios';
import type { Env, ApiResponse, SolapiConfig } from '../types';

const solapi = new Hono<{ Bindings: Env }>();

// Debug middleware to log all SOLAPI requests
solapi.use('*', async (c, next) => {
  console.log(`[SOLAPI DEBUG ROUTE CALLED] ${c.req.method} ${c.req.path}`);
  console.log(`[SOLAPI DEBUG ROUTE CALLED] Headers:`, Object.fromEntries(Object.entries(c.req.header())));
  console.log(`[SOLAPI DEBUG ROUTE CALLED] This confirms SOLAPI router is being executed`);
  await next();
});

// Session management helper functions
async function getSession(sessionId: string, env: Env): Promise<any | null> {
  try {
    const sessionData = await env.SESSIONS.get(sessionId);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch {
    return null;
  }
}

async function setSession(sessionId: string, data: any, env: Env): Promise<void> {
  await env.SESSIONS.put(sessionId, JSON.stringify(data), { expirationTtl: 86400 }); // 24 hours
}

// Generate secure session ID
function generateSecureSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * SOLAPI OAuth login - redirect to SOLAPI
 */
solapi.get('/auth/login', async (c) => {
  try {
    // Generate secure state parameter for CSRF protection
    const state = generateSecureSessionId();
    const authUrl = `https://api.solapi.com/oauth2/v1/authorize?client_id=${c.env.SOLAPI_CLIENT_ID}&redirect_uri=${encodeURIComponent(c.env.SOLAPI_REDIRECT_URL)}&response_type=code&scope=message:write&state=${state}`;

    return c.redirect(authUrl);
  } catch (error: any) {
    console.error('SOLAPI auth error:', error);
    return c.json({
      success: false,
      message: 'SOLAPI 로그인 URL 생성에 실패했습니다.',
      error: error.message,
    }, 500);
  }
});

/**
 * SOLAPI OAuth callback
 */
solapi.get('/auth/callback', async (c) => {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state');
    
    if (!code) {
      return c.json({
        success: false,
        message: '인증 코드가 제공되지 않았습니다.',
      }, 400);
    }

    if (!state) {
      return c.json({
        success: false,
        message: 'State 파라미터가 제공되지 않았습니다.',
      }, 400);
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://api.solapi.com/oauth2/v1/access_token', {
      grant_type: 'authorization_code',
      client_id: c.env.SOLAPI_CLIENT_ID,
      client_secret: c.env.SOLAPI_CLIENT_SECRET,
      redirect_uri: c.env.SOLAPI_REDIRECT_URL,
      code: code,
    }, {
      // Skip SSL verification for development
      ...(process.env.NODE_ENV === 'development' && {
        httpsAgent: new (require('https').Agent)({
          rejectUnauthorized: false
        })
      })
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Get session ID from cookie, query, or generate secure new one
    const sessionId = getCookie(c, 'sessionId') || c.req.query('sessionId') || generateSecureSessionId();
    
    // Get existing session or create new one
    let sessionData = await getSession(sessionId, c.env) || {};
    
    // Store SOLAPI tokens in session
    sessionData.solapiTokens = {
      accessToken: access_token,
      refreshToken: refresh_token,
      connectedAt: new Date().toISOString(),
    };

    await setSession(sessionId, sessionData, c.env);

    // Set secure httpOnly session cookie for SOLAPI authentication (match Google auth settings)
    const isProduction = c.env.NODE_ENV === 'production';
    console.log('Setting SOLAPI session cookie:', { sessionId: sessionId.substring(0, 8) + '...', isProduction });
    setCookie(c, 'sessionId', sessionId, {
      httpOnly: true,  // XSS 방지
      secure: true,    // HTTPS 필수 (match Google auth)
      maxAge: 86400,   // 24시간
      sameSite: 'None', // Cross-domain 허용 (match Google auth)
      path: '/'
    });

    // Redirect to frontend without sessionId in URL (security improvement)
    const redirectUrl = new URL('/admin', c.env.FRONTEND_URL);
    redirectUrl.searchParams.set('solapi', 'success');

    return c.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error('SOLAPI OAuth callback error:', error);
    
    const redirectUrl = new URL('/admin', c.env.FRONTEND_URL);
    redirectUrl.searchParams.set('solapi', 'error');
    redirectUrl.searchParams.set('message', encodeURIComponent('SOLAPI 인증에 실패했습니다.'));
    
    return c.redirect(redirectUrl.toString());
  }
});

/**
 * Check SOLAPI authentication status
 */
solapi.get('/auth/status', async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID') || c.req.query('sessionId');
    
    if (!sessionId) {
      return c.json({
        success: false,
        authenticated: false,
        message: '세션 ID가 제공되지 않았습니다.',
      });
    }

    const sessionData = await getSession(sessionId, c.env);
    
    if (!sessionData?.solapiTokens) {
      return c.json({
        success: false,
        authenticated: false,
        message: 'SOLAPI 인증이 되어있지 않습니다.',
      });
    }

    return c.json({
      success: true,
      authenticated: true,
      connectedAt: sessionData.solapiTokens.connectedAt,
      message: 'SOLAPI 인증된 상태입니다.',
    });
  } catch (error: any) {
    console.error('SOLAPI auth status check error:', error);
    return c.json({
      success: false,
      authenticated: false,
      message: 'SOLAPI 인증 상태 확인 중 오류가 발생했습니다.',
      error: error.message,
    }, 500);
  }
});

/**
 * SOLAPI logout - remove SOLAPI tokens from session
 */
solapi.post('/auth/logout', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID') || c.req.query('sessionId');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 제공되지 않았습니다.',
      }, 401);
    }

    // Get existing session
    let sessionData = await getSession(sessionId, c.env);
    
    if (sessionData && sessionData.solapiTokens) {
      // Remove only SOLAPI tokens, keep Google tokens
      delete sessionData.solapiTokens;
      await setSession(sessionId, sessionData, c.env);
    }

    return c.json({
      success: true,
      message: 'SOLAPI 연결이 해제되었습니다.',
    });
  } catch (error: any) {
    console.error('SOLAPI logout error:', error);
    return c.json({
      success: false,
      message: 'SOLAPI 연결 해제 중 오류가 발생했습니다.',
      error: error.message,
    }, 500);
  }
});

/**
 * Send SMS message
 */
solapi.post('/message/send', async (c) => {
  console.log('=== SOLAPI SMS ENDPOINT DEFINITELY CALLED ===');
  try {
    const cookieSessionId = getCookie(c, 'sessionId');
    const headerSessionId = c.req.header('X-Session-ID');
    const querySessionId = c.req.query('sessionId');
    const sessionId = cookieSessionId || headerSessionId || querySessionId;
    
    console.log('SOLAPI SMS send session ID check:', {
      cookie: cookieSessionId ? cookieSessionId.substring(0, 8) + '...' : 'none',
      header: headerSessionId ? headerSessionId.substring(0, 8) + '...' : 'none',
      query: querySessionId ? querySessionId.substring(0, 8) + '...' : 'none',
      final: sessionId ? sessionId.substring(0, 8) + '...' : 'none'
    });
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    const sessionData = await getSession(sessionId, c.env);
    
    if (!sessionData?.solapiTokens) {
      return c.json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
      } as ApiResponse, 401);
    }

    const { from, to, text, type = 'SMS' } = await c.req.json();

    if (!from || !to || !text) {
      return c.json({
        success: false,
        message: '발신번호, 수신번호, 메시지 내용이 모두 필요합니다.',
      } as ApiResponse, 400);
    }

    // Phone number validation (basic)
    const phoneRegex = /^01[0-9]{8,9}$/;
    if (!phoneRegex.test(from.replace(/-/g, ''))) {
      return c.json({
        success: false,
        message: '올바른 발신번호를 입력해주세요 (예: 010-1234-5678)',
      } as ApiResponse, 400);
    }
    
    if (!phoneRegex.test(to.replace(/-/g, ''))) {
      return c.json({
        success: false,
        message: '올바른 수신번호를 입력해주세요 (예: 010-1234-5678)',
      } as ApiResponse, 400);
    }

    console.log('Sending SMS:', { from, to: to.substring(0, 7) + '***', textLength: text.length });

    // Send message via SOLAPI
    const messageResponse = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      {
        message: {
          type: type,
          from: from.replace(/-/g, ''),
          to: to.replace(/-/g, ''),
          text: text,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${sessionData.solapiTokens.accessToken}`,
          'Content-Type': 'application/json',
        },
        // Skip SSL verification for development
        ...(process.env.NODE_ENV === 'development' && {
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false
          })
        })
      }
    );

    console.log('SOLAPI response:', { 
      statusCode: messageResponse.data.statusCode,
      messageId: messageResponse.data.messageId 
    });

    return c.json({
      success: true,
      data: {
        messageId: messageResponse.data.messageId,
        statusCode: messageResponse.data.statusCode,
        statusMessage: messageResponse.data.statusMessage || '메시지 발송 요청이 완료되었습니다.'
      },
      message: 'SMS가 성공적으로 발송되었습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to send SMS:', error);
    console.error('Error response data:', error.response?.data);
    
    let errorMessage = 'SMS 전송에 실패했습니다.';
    if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    } else if (error.response?.data?.errorMessage) {
      errorMessage = error.response.data.errorMessage;
    }
    
    return c.json({
      success: false,
      message: errorMessage,
      error: error.response?.data || error.message,
    } as ApiResponse, 500);
  }
});

export default solapi;