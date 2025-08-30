import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { GoogleAuthService } from '../services/googleAuth';
import { UnifiedUserService } from '../services/unifiedUserService';
import type { Env, GoogleTokens } from '../types';

const auth = new Hono<{ Bindings: Env }>();

// Temporary session ID management for cookie-based authentication (하위 호환성)
async function createTempSession(sessionId: string, email: string, env: Env): Promise<void> {
  await env.SESSIONS.put(sessionId, JSON.stringify({ email }), { expirationTtl: 86400 }); // 24 hours
}

async function getTempSession(sessionId: string, env: Env): Promise<{ email?: string } | null> {
  try {
    const sessionData = await env.SESSIONS.get(sessionId);
    return sessionData ? JSON.parse(sessionData) : null;
  } catch {
    return null;
  }
}

// Generate secure session ID
function generateSecureSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Google OAuth login - redirect to Google
 */
auth.get('/google', async (c) => {
  try {
    // Debug: 환경변수 확인
    console.log('Environment variables check:');
    console.log('GOOGLE_CLIENT_ID:', c.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING');
    console.log('GOOGLE_CLIENT_SECRET:', c.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING');
    console.log('GOOGLE_REDIRECT_URL:', c.env.GOOGLE_REDIRECT_URL || 'MISSING');
    
    if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET || !c.env.GOOGLE_REDIRECT_URL) {
      return c.json({
        success: false,
        message: '환경변수가 설정되지 않았습니다.',
        debug: {
          GOOGLE_CLIENT_ID: !!c.env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: !!c.env.GOOGLE_CLIENT_SECRET,
          GOOGLE_REDIRECT_URL: !!c.env.GOOGLE_REDIRECT_URL
        }
      }, 500);
    }

    const googleAuth = new GoogleAuthService(c.env);
    const authUrl = googleAuth.getAuthUrl();
    
    console.log('Generated auth URL:', authUrl);
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

    // 통합 사용자 데이터 관리 시스템
    const unifiedUserService = new UnifiedUserService(c.env);
    
    // Google 이메일 추출
    const userEmail = await unifiedUserService.extractGoogleEmail(tokens.accessToken);
    if (!userEmail) {
      console.error('Failed to extract Google email from access token');
      return c.json({ success: false, message: '사용자 정보를 가져올 수 없습니다.' }, 400);
    }

    // Generate session ID for cookie-based authentication (임시 세션)
    const sessionId = generateSecureSessionId();
    const googleTokens: GoogleTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      connectedAt: new Date().toISOString(),
      expiryDate: Date.now() + (3600 * 1000), // 1 hour from now
      email: userEmail,
    };

    // 임시 세션 저장 (쿠키 기반 인증용, 이메일만 저장)
    await createTempSession(sessionId, userEmail, c.env);
    
    // 통합 사용자 데이터 저장/업데이트 (Google 토큰 + 기존 자동화 룰 등 유지)
    await unifiedUserService.updateGoogleTokens(userEmail, googleTokens);

    // Set secure httpOnly session cookie with SameSite=None for cross-domain
    console.log('Setting secure session cookie:', { sessionId: sessionId.substring(0, 8) + '...', httpOnly: true, secure: true });
    
    setCookie(c, 'sessionId', sessionId, {
      httpOnly: true,  // XSS 방지
      secure: true,    // HTTPS 필수
      maxAge: 86400,   // 24시간
      sameSite: 'None', // Cross-domain 허용 (HTTPS에서 안전)
      path: '/'
    });

    // Redirect to frontend with sessionId for Brave browser compatibility
    const redirectUrl = new URL('/admin', c.env.FRONTEND_URL);
    redirectUrl.searchParams.set('auth', 'success');
    redirectUrl.searchParams.set('sessionId', sessionId);

    console.log('Redirecting to:', redirectUrl.toString());
    return c.redirect(redirectUrl.toString());
  } catch (error: any) {
    console.error('Google OAuth callback error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: c.req.query('code')?.substring(0, 10) + '...' // First 10 chars of code for debugging
    });
    
    // For debugging: return JSON error instead of redirect
    return c.json({
      success: false,
      message: '서버 내부 오류가 발생했습니다.',
      debug: {
        error: error.message,
        hasCode: !!c.req.query('code'),
        hasEnvVars: {
          GOOGLE_CLIENT_ID: !!c.env.GOOGLE_CLIENT_ID,
          GOOGLE_CLIENT_SECRET: !!c.env.GOOGLE_CLIENT_SECRET,
          GOOGLE_REDIRECT_URL: !!c.env.GOOGLE_REDIRECT_URL,
          FRONTEND_URL: !!c.env.FRONTEND_URL
        }
      }
    }, 500);
  }
});

/**
 * Check authentication status
 */
auth.get('/status', async (c) => {
  try {
    const cookieSessionId = getCookie(c, 'sessionId');
    const headerSessionId = c.req.header('X-Session-ID');
    const querySessionId = c.req.query('sessionId');
    
    console.log('Session ID check:', {
      cookie: cookieSessionId ? cookieSessionId.substring(0, 8) + '...' : 'none',
      header: headerSessionId ? headerSessionId.substring(0, 8) + '...' : 'none',
      query: querySessionId ? querySessionId.substring(0, 8) + '...' : 'none'
    });
    
    const sessionId = cookieSessionId || headerSessionId || querySessionId;
    
    if (!sessionId) {
      console.log('No session ID found, returning unauthenticated status');
      return c.json({
        success: false,
        authenticated: false,
        message: '인증되지 않은 사용자입니다.',
        data: {
          google: false,
          solapi: false
        }
      });
    }

    const tempSession = await getTempSession(sessionId, c.env);
    
    if (!tempSession?.email) {
      return c.json({
        success: false,
        authenticated: false,
        message: '유효하지 않은 세션입니다.',
        data: {
          google: false,
          solapi: false
        }
      });
    }

    const unifiedUserService = new UnifiedUserService(c.env);
    const userData = await unifiedUserService.getUserData(tempSession.email);
    
    if (!userData) {
      return c.json({
        success: false,
        authenticated: false,
        message: '사용자 데이터를 찾을 수 없습니다.',
        data: {
          google: false,
          solapi: false
        }
      });
    }

    // Check Google authentication status
    const hasGoogleAuth = !!(userData.googleTokens.accessToken && userData.googleTokens.refreshToken);
    
    if (!hasGoogleAuth) {
      // Only SOLAPI is authenticated
      const hasSolapiAuth = !!(userData.solapiTokens?.accessToken);
      return c.json({
        success: true,
        data: {
          google: false,
          solapi: hasSolapiAuth,
          ...(hasSolapiAuth && {
            solapiData: {
              connectedAt: userData.solapiTokens!.connectedAt
            }
          })
        }
      });
    }

    // Check if token needs refresh
    const googleAuth = new GoogleAuthService(c.env);
    const needsRefresh = googleAuth.shouldRefreshToken(userData.googleTokens.expiryDate);

    if (needsRefresh && userData.googleTokens.refreshToken) {
      try {
        googleAuth.setCredentials(userData.googleTokens.accessToken!, userData.googleTokens.refreshToken!);
        const newAccessToken = await googleAuth.refreshAccessToken();
        
        userData.googleTokens.accessToken = newAccessToken;
        userData.googleTokens.expiryDate = Date.now() + (3600 * 1000); // 1 hour from now
        
        await unifiedUserService.updateGoogleTokens(tempSession.email, userData.googleTokens);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Even if Google token refresh failed, check SOLAPI status
        const hasSolapiAuth = !!(userData.solapiTokens?.accessToken);
        return c.json({
          success: true,
          data: {
            google: false,
            solapi: hasSolapiAuth,
            ...(hasSolapiAuth && {
              solapiData: {
                connectedAt: userData.solapiTokens!.connectedAt
              }
            })
          }
        });
      }
    }

    // Get spreadsheets list for the response
    let spreadsheetsList: any[] = [];
    try {
      const { GoogleSheetsService } = await import('../services/googleSheets');
      const sheetsService = new GoogleSheetsService(c.env);
      sheetsService.init(userData.googleTokens.accessToken!, userData.googleTokens.refreshToken!);
      spreadsheetsList = await sheetsService.getSpreadsheets();
    } catch (error) {
      console.error('Failed to fetch spreadsheets list:', error);
    }

    // Check SOLAPI authentication status
    const hasSolapiAuth = !!(userData.solapiTokens?.accessToken);

    return c.json({
      success: true,
      data: {
        google: true,
        solapi: hasSolapiAuth,
        googleData: {
          connectedAt: userData.googleTokens.connectedAt,
          spreadsheets: spreadsheetsList
        },
        ...(hasSolapiAuth && {
          solapiData: {
            connectedAt: userData.solapiTokens!.connectedAt
          }
        })
      }
    });
  } catch (error: any) {
    console.error('Auth status check error:', error);
    return c.json({
      success: true,
      data: {
        google: false,
        solapi: false
      }
    });
  }
});

/**
 * Google logout - remove Google tokens from session
 */
auth.post('/google/logout', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID') || c.req.query('sessionId');
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 제공되지 않았습니다.',
      }, 401);
    }

    // Get temp session to extract email
    const tempSession = await getTempSession(sessionId, c.env);
    
    if (tempSession?.email) {
      // UnifiedUserService에서 Google 토큰만 제거하는 기능은 없으므로
      // SOLAPI 토큰은 유지하면서 Google 토큰만 빈 값으로 설정
      const unifiedUserService = new UnifiedUserService(c.env);
      const userData = await unifiedUserService.getUserData(tempSession.email);
      
      if (userData) {
        // Google 토큰을 빈 값으로 설정 (SOLAPI는 유지)
        const emptyGoogleTokens: GoogleTokens = {
          accessToken: undefined,
          refreshToken: undefined,
          connectedAt: undefined,
          expiryDate: undefined,
          email: tempSession.email
        };
        
        await unifiedUserService.updateGoogleTokens(tempSession.email, emptyGoogleTokens);
      }
    }

    return c.json({
      success: true,
      message: 'Google 연결이 해제되었습니다.',
    });
  } catch (error: any) {
    console.error('Google logout error:', error);
    return c.json({
      success: false,
      message: 'Google 연결 해제 중 오류가 발생했습니다.',
      error: error.message,
    }, 500);
  }
});

/**
 * Logout (전체)
 */
auth.post('/logout', async (c) => {
  try {
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID') || c.req.query('sessionId');
    
    if (sessionId) {
      // 임시 세션만 삭제 (UnifiedUserService의 데이터는 유지)
      await c.env.SESSIONS.delete(sessionId);
    }

    // Clear session cookie
    setCookie(c, 'sessionId', '', {
      httpOnly: true,
      secure: true,
      maxAge: 0, // Delete cookie
      sameSite: 'None',
      path: '/'
    })

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