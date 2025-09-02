import type { Context, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import type { Env, GoogleTokens, Variables } from '../types';
import { GoogleAuthService } from '../services/googleAuth';
import { UnifiedUserService } from '../services/unifiedUserService';
import { safeConsoleError } from '../utils/errorSanitizer';

// 구조적 개선: 임시 세션 헬퍼 함수 제거됨
// sessionId를 직접 통합 데이터 키로 사용

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

    // Use existing UnifiedUserService instance from context or create new one
    let unifiedUserService = c.get('unifiedUserService');
    if (!unifiedUserService) {
      unifiedUserService = new UnifiedUserService(c.env);
      c.set('unifiedUserService', unifiedUserService);
    }
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);

    if (!userData || !userData.googleTokens.accessToken) {
      return c.json({
        success: false,
        message: '세션 데이터를 찾을 수 없습니다. 다시 로그인해주세요.',
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
        
        // 구조적 개선: 세션 기반 데이터와 이메일 기반 데이터 모두 업데이트
        await unifiedUserService.saveSessionBasedUserData(sessionId, userData);
        await unifiedUserService.updateGoogleTokens(userData.email, userData.googleTokens);
        console.log('Token refreshed successfully');
      } catch (refreshError) {
        safeConsoleError('Token refresh failed:', refreshError);
        return c.json({
          success: false,
          message: '인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
        }, 401);
      }
    }

    // Touch session mapping to extend TTL on each authenticated request
    try {
      const unifiedUserService = new UnifiedUserService(c.env);
      await unifiedUserService.saveSessionBasedUserData(sessionId, userData);
    } catch (e) {
      console.log('Failed to refresh session TTL:', e);
    }

    // Store session data in context for use in handlers (backward compatibility)
    c.set('sessionData', userData.googleTokens);
    c.set('sessionId', sessionId);

    await next();
  } catch (error: any) {
    safeConsoleError('Auth middleware error:', error);
    return c.json({
      success: false,
      message: '인증 처리 중 오류가 발생했습니다.',
      error: error.message,
    }, 500);
  }
}
