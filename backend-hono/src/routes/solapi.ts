import { Hono } from 'hono';
import axios from 'axios';
import type { Env, ApiResponse, SolapiConfig } from '../types';

const solapi = new Hono<{ Bindings: Env }>();

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
    const authUrl = `https://api.solapi.com/oauth2/authorize?client_id=${c.env.SOLAPI_CLIENT_ID}&redirect_uri=${encodeURIComponent(c.env.SOLAPI_REDIRECT_URL)}&response_type=code&scope=message:write`;

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
    
    if (!code) {
      return c.json({
        success: false,
        message: '인증 코드가 제공되지 않았습니다.',
      }, 400);
    }

    // Exchange code for tokens
    const tokenResponse = await axios.post('https://api.solapi.com/oauth2/token', {
      grant_type: 'authorization_code',
      client_id: c.env.SOLAPI_CLIENT_ID,
      client_secret: c.env.SOLAPI_CLIENT_SECRET,
      redirect_uri: c.env.SOLAPI_REDIRECT_URL,
      code: code,
    });

    const { access_token, refresh_token } = tokenResponse.data;

    // Get session ID from query or generate secure new one
    const sessionId = c.req.query('sessionId') || generateSecureSessionId();
    
    // Get existing session or create new one
    let sessionData = await getSession(sessionId, c.env) || {};
    
    // Store SOLAPI tokens in session
    sessionData.solapiTokens = {
      accessToken: access_token,
      refreshToken: refresh_token,
      connectedAt: new Date().toISOString(),
    };

    await setSession(sessionId, sessionData, c.env);

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
 * Send KakaoTalk message
 */
solapi.post('/message/send', async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID') || c.req.query('sessionId');
    
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

    const { to, message } = await c.req.json();

    if (!to || !message) {
      return c.json({
        success: false,
        message: '수신자와 메시지가 필요합니다.',
      } as ApiResponse, 400);
    }

    // Send message via SOLAPI
    const messageResponse = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      {
        message: {
          to: to,
          from: '발신번호', // This should be configured
          text: message,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${sessionData.solapiTokens.accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return c.json({
      success: true,
      data: messageResponse.data,
      message: '메시지가 전송되었습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to send message:', error);
    return c.json({
      success: false,
      message: '메시지 전송에 실패했습니다.',
      error: error.response?.data || error.message,
    } as ApiResponse, 500);
  }
});

export default solapi;