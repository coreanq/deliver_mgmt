import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { GoogleAuthService } from '../services/googleAuth';
import { UserSessionService } from '../services/userSessionService';
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

    // Google 계정 기반 세션 관리 시스템
    const userSessionService = new UserSessionService(c.env);
    
    // Google 이메일 추출
    const userEmail = await userSessionService.extractGoogleEmail(tokens.accessToken);
    if (!userEmail) {
      console.error('Failed to extract Google email from access token');
      return c.json({ success: false, message: '사용자 정보를 가져올 수 없습니다.' }, 400);
    }

    // Generate session ID and store tokens (기존 방식 유지 + 계정 기반 추가)
    const sessionId = generateSecureSessionId();
    const sessionData: GoogleTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      connectedAt: new Date().toISOString(),
      expiryDate: Date.now() + (3600 * 1000), // 1 hour from now
      email: userEmail, // Google 이메일 추가
    };

    // 기존 세션 방식 유지 (하위 호환성)
    await setSession(sessionId, sessionData, c.env);
    
    // Google 계정 기반 사용자 프로필 저장 (영구 저장)
    await userSessionService.saveUserProfile(userEmail, sessionData);
    
    // 활성 세션 등록
    await userSessionService.registerSession(userEmail, sessionId, c.req.header('User-Agent'));

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
        success: true,
        data: {
          google: false,
          solapi: false
        }
      });
    }

    const sessionData = await getSession(sessionId, c.env);
    
    if (!sessionData) {
      return c.json({
        success: true,
        data: {
          google: false,
          solapi: false
        }
      });
    }

    // Check Google authentication status
    const hasGoogleAuth = !!(sessionData.accessToken && sessionData.refreshToken);
    
    if (!hasGoogleAuth) {
      // Only SOLAPI is authenticated
      const hasSolapiAuth = !!(sessionData.solapiTokens?.accessToken);
      return c.json({
        success: true,
        data: {
          google: false,
          solapi: hasSolapiAuth,
          ...(hasSolapiAuth && {
            solapiData: {
              connectedAt: sessionData.solapiTokens!.connectedAt
            }
          })
        }
      });
    }

    // Check if token needs refresh
    const googleAuth = new GoogleAuthService(c.env);
    const needsRefresh = googleAuth.shouldRefreshToken(sessionData.expiryDate);

    if (needsRefresh && sessionData.refreshToken) {
      try {
        googleAuth.setCredentials(sessionData.accessToken!, sessionData.refreshToken!);
        const newAccessToken = await googleAuth.refreshAccessToken();
        
        sessionData.accessToken = newAccessToken;
        sessionData.expiryDate = Date.now() + (3600 * 1000); // 1 hour from now
        
        await setSession(sessionId, sessionData, c.env);
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // Even if Google token refresh failed, check SOLAPI status
        const hasSolapiAuth = !!(sessionData.solapiTokens?.accessToken);
        return c.json({
          success: true,
          data: {
            google: false,
            solapi: hasSolapiAuth,
            ...(hasSolapiAuth && {
              solapiData: {
                connectedAt: sessionData.solapiTokens!.connectedAt
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
      sheetsService.init(sessionData.accessToken!, sessionData.refreshToken!);
      spreadsheetsList = await sheetsService.getSpreadsheets();
    } catch (error) {
      console.error('Failed to fetch spreadsheets list:', error);
    }

    // Check SOLAPI authentication status
    const hasSolapiAuth = !!(sessionData.solapiTokens?.accessToken);

    return c.json({
      success: true,
      data: {
        google: true,
        solapi: hasSolapiAuth,
        googleData: {
          connectedAt: sessionData.connectedAt,
          spreadsheets: spreadsheetsList
        },
        ...(hasSolapiAuth && {
          solapiData: {
            connectedAt: sessionData.solapiTokens!.connectedAt
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

    // Get existing session
    let sessionData = await getSession(sessionId, c.env);
    
    if (sessionData) {
      // Remove only Google tokens, keep SOLAPI tokens
      delete sessionData.accessToken;
      delete sessionData.refreshToken;
      delete sessionData.connectedAt;
      delete sessionData.expiryDate;
      await setSession(sessionId, sessionData, c.env);
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