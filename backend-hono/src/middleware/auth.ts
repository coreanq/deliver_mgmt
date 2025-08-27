import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, GoogleTokens, Variables } from '../types';
import { GoogleAuthService } from '../services/googleAuth';

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

/**
 * Middleware to require Google authentication
 */
export async function requireGoogleAuth(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID') || c.req.query('sessionId');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '인증이 필요합니다. 로그인해주세요.',
      }, 401);
    }

    const sessionData = await getSession(sessionId, c.env);
    
    if (!sessionData) {
      return c.json({
        success: false,
        message: '유효하지 않은 세션입니다. 다시 로그인해주세요.',
      }, 401);
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
        console.log('Token refreshed successfully');
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return c.json({
          success: false,
          message: '인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
        }, 401);
      }
    }

    // Store session data in context for use in handlers
    c.set('sessionData', sessionData);
    c.set('sessionId', sessionId);

    await next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    return c.json({
      success: false,
      message: '인증 처리 중 오류가 발생했습니다.',
      error: error.message,
    }, 500);
  }
}