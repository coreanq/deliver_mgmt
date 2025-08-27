import { Hono } from 'hono';
import { GoogleAuthService } from '../services/googleAuth';
import type { Env, GoogleTokens } from '../types';

const auth = new Hono<{ Bindings: Env }>();

// Session management helper functions
async function getSession(sessionId: string, env: Env): Promise<GoogleTokens | null> {
  try {
    const sessionData = await env.SESSIONS.get(sessionId);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch {
    return null;
  }
}

async function setSession(sessionId: string, data: GoogleTokens, env: Env): Promise<void> {
  await env.SESSIONS.put(sessionId, JSON.stringify(data), { expirationTtl: 86400 }); // 24 hours
}

// Generate session ID
function generateSessionId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

/**
 * Google OAuth login - redirect to Google
 */
auth.get('/google', async (c) => {
  try {
    const googleAuth = new GoogleAuthService(c.env);
    const authUrl = googleAuth.getAuthUrl();

    return c.redirect(authUrl);
  } catch (error: any) {
    console.error('Google auth error:', error);
    return c.json({
      success: false,
      message: 'Google 로그인 URL 생성에 실패했습니다.',
      error: error.message,
    }, 500);
  }
});

/**
 * Google OAuth callback
 */
auth.get('/google/callback', async (c) => {
  try {
    const code = c.req.query('code');
    const state = c.req.query('state');
    
    if (!code) {
      return c.json({
        success: false,
        message: '인증 코드가 제공되지 않았습니다.',
      }, 400);
    }

    const googleAuth = new GoogleAuthService(c.env);
    const tokens = await googleAuth.getTokens(code);

    // Generate session ID and store tokens
    const sessionId = generateSessionId();
    const sessionData: GoogleTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      connectedAt: new Date().toISOString(),
      expiryDate: Date.now() + (3600 * 1000), // 1 hour from now
    };

    await setSession(sessionId, sessionData, c.env);

    // Redirect to frontend with session info
    const redirectUrl = new URL('/admin', c.env.FRONTEND_URL);
    redirectUrl.searchParams.set('auth', 'success');
    redirectUrl.searchParams.set('sessionId', sessionId);

    return c.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    
    const redirectUrl = new URL('/admin', c.env.FRONTEND_URL);
    redirectUrl.searchParams.set('auth', 'error');
    redirectUrl.searchParams.set('message', encodeURIComponent('Google 인증에 실패했습니다.'));
    
    return c.redirect(redirectUrl.toString());
  }
});

/**
 * Check authentication status
 */
auth.get('/status', async (c) => {
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
    
    if (!sessionData) {
      return c.json({
        success: false,
        authenticated: false,
        message: '유효하지 않은 세션입니다.',
      });
    }

    // Check if token needs refresh
    const googleAuth = new GoogleAuthService(c.env);
    const needsRefresh = googleAuth.shouldRefreshToken(sessionData.expiryDate);

    if (needsRefresh && sessionData.refreshToken) {
      try {
        googleAuth.setCredentials(sessionData.accessToken, sessionData.refreshToken);
        const newAccessToken = await googleAuth.refreshAccessToken();
        
        sessionData.accessToken = newAccessToken;
        sessionData.expiryDate = Date.now() + (3600 * 1000); // 1 hour from now
        
        await setSession(sessionId, sessionData, c.env);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return c.json({
          success: false,
          authenticated: false,
          message: '인증 토큰 갱신에 실패했습니다.',
        });
      }
    }

    return c.json({
      success: true,
      authenticated: true,
      connectedAt: sessionData.connectedAt,
      message: '인증된 상태입니다.',
    });
  } catch (error: any) {
    console.error('Auth status check error:', error);
    return c.json({
      success: false,
      authenticated: false,
      message: '인증 상태 확인 중 오류가 발생했습니다.',
      error: error.message,
    }, 500);
  }
});

/**
 * Logout
 */
auth.post('/logout', async (c) => {
  try {
    const sessionId = c.req.header('X-Session-ID') || c.req.query('sessionId');
    
    if (sessionId) {
      await c.env.SESSIONS.delete(sessionId);
    }

    return c.json({
      success: true,
      message: '로그아웃되었습니다.',
    });
  } catch (error: any) {
    console.error('Logout error:', error);
    return c.json({
      success: false,
      message: '로그아웃 중 오류가 발생했습니다.',
      error: error.message,
    }, 500);
  }
});

export default auth;