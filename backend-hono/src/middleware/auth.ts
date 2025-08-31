import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, GoogleTokens, Variables } from '../types';
import { GoogleAuthService } from '../services/googleAuth';
import { UnifiedUserService } from '../services/unifiedUserService';

// Helper function for temp session access
async function getTempSession(sessionId: string, env: Env): Promise<{ email?: string } | null> {
  try {
    const sessionData = await env.SESSIONS.get(sessionId);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch {
    return null;
  }
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

    const tempSession = await getTempSession(sessionId, c.env);
    
    if (!tempSession?.email) {
      return c.json({
        success: false,
        message: '유효하지 않은 세션입니다. 다시 로그인해주세요.',
      }, 401);
    }

    const unifiedUserService = new UnifiedUserService(c.env);
    const userData = await unifiedUserService.getUserData(tempSession.email);

    if (!userData || !userData.googleTokens.accessToken) {
      return c.json({
        success: false,
        message: '사용자 데이터를 찾을 수 없습니다. 다시 로그인해주세요.',
      }, 401);
    }

    // Check if token needs refresh
    const googleAuth = new GoogleAuthService(c.env);
    const needsRefresh = googleAuth.shouldRefreshToken(userData.googleTokens.expiryDate);

    if (needsRefresh && userData.googleTokens.refreshToken) {
      try {
        googleAuth.setCredentials(userData.googleTokens.accessToken!, userData.googleTokens.refreshToken);
        const newAccessToken = await googleAuth.refreshAccessToken();
        
        userData.googleTokens.accessToken = newAccessToken;
        userData.googleTokens.expiryDate = Date.now() + (18 * 60 * 60 * 1000); // 18 hours from now
        
        await unifiedUserService.updateGoogleTokens(tempSession.email, userData.googleTokens);
        console.log('Token refreshed successfully');
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        return c.json({
          success: false,
          message: '인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
        }, 401);
      }
    }

    // Store session data in context for use in handlers (backward compatibility)
    c.set('sessionData', userData.googleTokens);
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