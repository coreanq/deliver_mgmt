import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
import { GoogleAuthService } from '../services/googleAuth';
import { UnifiedUserService } from '../services/unifiedUserService';
import { safeConsoleError, createSafeErrorResponse } from '../utils/errorSanitizer';
import type { Env, GoogleTokens, Variables } from '../types';

const auth = new Hono<{ Bindings: Env; Variables: Variables }>();

// UnifiedUserService 전역 설정
auth.use('*', async (c, next) => {
  c.set('unifiedUserService', new UnifiedUserService(c.env));
  await next();
});

// 구조적 개선: 임시 세션 제거됨
// sessionId를 직접 통합 데이터 키로 사용하여 자동화 규칙 지속성 보장

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
    
    // Generate secure OAuth state parameter for CSRF protection
    const oauthState = googleAuth.generateOAuthState();
    
    // Store state in KV for validation (5 minute TTL)
    const stateKey = `oauth_state:${oauthState}`;
    await c.env.SESSIONS.put(stateKey, 'valid', { expirationTtl: 300 });
    
    const authUrl = googleAuth.getAuthUrl(oauthState);
    
    console.log('Generated auth URL with state parameter');
    return c.redirect(authUrl);
  } catch (error: any) {
    safeConsoleError('Google auth error:', error);
    return c.json({
      success: false,
      message: 'Google 로그인 URL 생성에 실패했습니다.',
      ...createSafeErrorResponse(error)
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

    // Validate OAuth state parameter for CSRF protection
    if (!state) {
      console.error('OAuth callback missing state parameter');
      return c.json({
        success: false,
        message: '잘못된 OAuth 요청입니다.',
      }, 400);
    }

    // Check if state exists in KV storage
    const stateKey = `oauth_state:${state}`;
    const storedState = await c.env.SESSIONS.get(stateKey);
    
    if (!storedState) {
      console.error('OAuth state validation failed - state not found or expired');
      return c.json({
        success: false,
        message: '만료되었거나 잘못된 OAuth 요청입니다.',
      }, 400);
    }

    // Clean up used state
    await c.env.SESSIONS.delete(stateKey);

    const googleAuth = new GoogleAuthService(c.env);
    const tokens = await googleAuth.getTokens(code);

    // 통합 사용자 데이터 관리 시스템
    const unifiedUserService = c.get('unifiedUserService');
    
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
      expiryDate: tokens.expiryDate, // Use actual expiry from Google OAuth response
      email: userEmail,
    };

    // 구조적 개선: sessionId를 직접 통합 데이터 키로 사용
    // 기존 이메일 기반 통합 데이터가 있는지 확인하고 마이그레이션
    let userData = await unifiedUserService.getUserData(userEmail);
    
    if (userData) {
      // 기존 통합 데이터를 세션 기반으로 복사 (Google 토큰 업데이트 포함)
      userData.googleTokens = googleTokens;
      userData.lastLoginAt = new Date().toISOString();
    } else {
      // 새로운 사용자 데이터 생성
      userData = await unifiedUserService.createUserData(userEmail, googleTokens);
    }
    
    // 세션 기반 통합 데이터 저장 (자동화 룰 포함, 1년 TTL)
    await unifiedUserService.saveSessionBasedUserData(sessionId, userData);
    
    // 기존 이메일 기반 데이터도 업데이트 (웹훅 호환성 유지)
    await unifiedUserService.updateGoogleTokens(userEmail, googleTokens);

    // 관리자 세션 인덱스에 추가 (보안 최적화)
    await unifiedUserService.addAdminSessionToIndex(userEmail, sessionId);

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
    safeConsoleError('Google OAuth callback error:', error);
    
    // For debugging: return JSON error instead of redirect
    return c.json({
      success: false,
      message: '서버 내부 오류가 발생했습니다.',
      ...createSafeErrorResponse(error),
      debug: {
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

    // 구조적 개선: 세션 기반 통합 데이터 직접 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    
    if (!userData?.email) {
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

    // userData는 이미 위에서 조회됨
    
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
        const refreshResult = await googleAuth.refreshAccessToken();
        
        userData.googleTokens.accessToken = refreshResult.accessToken;
        userData.googleTokens.expiryDate = refreshResult.expiryDate; // Use actual expiry from Google response
        
        // 세션 기반 데이터와 이메일 기반 데이터 모두 업데이트
        await unifiedUserService.saveSessionBasedUserData(sessionId, userData);
        await unifiedUserService.updateGoogleTokens(userData.email, userData.googleTokens);
      } catch (refreshError) {
        safeConsoleError('Token refresh failed:', refreshError);
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
        ...(userData.connectedSpreadsheet && {
          connectedSpreadsheet: userData.connectedSpreadsheet
        }),
        ...(hasSolapiAuth && {
          solapiData: {
            connectedAt: userData.solapiTokens!.connectedAt
          }
        })
      }
    });
  } catch (error: any) {
    safeConsoleError('Auth status check error:', error);
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

    // 구조적 개선: 세션 기반 통합 데이터에서 사용자 정보 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    
    if (userData?.email) {
      // UnifiedUserService에서 Google 토큰만 제거하는 기능은 없으므로
      // SOLAPI 토큰은 유지하면서 Google 토큰만 빈 값으로 설정
      
      if (userData) {
        // Google 토큰을 빈 값으로 설정 (SOLAPI는 유지)
        const emptyGoogleTokens: GoogleTokens = {
          accessToken: undefined,
          refreshToken: undefined,
          connectedAt: undefined,
          expiryDate: undefined,
          email: userData.email
        };
        
        // 세션 기반 데이터와 이메일 기반 데이터에서 Google 토큰 제거
        userData.googleTokens = emptyGoogleTokens;
        await unifiedUserService.saveSessionBasedUserData(sessionId, userData);
        await unifiedUserService.updateGoogleTokens(userData.email, emptyGoogleTokens);
      }
    }

    return c.json({
      success: true,
      message: 'Google 연결이 해제되었습니다.',
    });
  } catch (error: any) {
    safeConsoleError('Google logout error:', error);
    return c.json({
      success: false,
      message: 'Google 연결 해제 중 오류가 발생했습니다.',
      ...createSafeErrorResponse(error)
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
      // 구조적 개선: 세션 기반 통합 데이터 정리
      const unifiedUserService = c.get('unifiedUserService');
      
      // 세션 데이터에서 이메일 추출하여 관리자 인덱스에서 제거
      const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
      if (userData?.email) {
        await unifiedUserService.removeAdminSessionFromIndex(userData.email);
      }
      
      await unifiedUserService.cleanupSessionData(sessionId);
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
    safeConsoleError('Logout error:', error);
    return c.json({
      success: false,
      message: '로그아웃 중 오류가 발생했습니다.',
      ...createSafeErrorResponse(error)
    }, 500);
  }
});

export default auth;
