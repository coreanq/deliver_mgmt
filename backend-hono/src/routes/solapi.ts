import { Hono } from 'hono';
import { setCookie, getCookie } from 'hono/cookie';
import axios from 'axios';
import type { Env, ApiResponse, SolapiConfig, Variables } from '../types';
import { SolapiAuthService } from '../services/solapiAuth';
import { UnifiedUserService } from '../services/unifiedUserService';

const solapi = new Hono<{ Bindings: Env; Variables: Variables }>();

// Debug middleware to log all SOLAPI requests + UnifiedUserService 전역 설정
solapi.use('*', async (c, next) => {
  console.log(`[SOLAPI DEBUG ROUTE CALLED] ${c.req.method} ${c.req.path}`);
  console.log(`[SOLAPI DEBUG ROUTE CALLED] Headers:`, Object.fromEntries(Object.entries(c.req.header())));
  console.log(`[SOLAPI DEBUG ROUTE CALLED] This confirms SOLAPI router is being executed`);
  
  // UnifiedUserService를 context에 전역으로 설정
  c.set('unifiedUserService', new UnifiedUserService(c.env));
  
  await next();
});

// 구조적 개선: 임시 세션 헬퍼 함수 제거됨
// sessionId를 직접 통합 데이터 키로 사용

// Generate secure session ID
function generateSecureSessionId(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * SOLAPI OAuth login - redirect to SOLAPI
 * Requires Google authentication first
 */
solapi.get('/auth/login', async (c) => {
  try {
    // Check if Google session exists first
    const sessionId = getCookie(c, 'sessionId') || c.req.header('X-Session-ID') || c.req.query('sessionId');
    
    if (!sessionId) {
      return c.json({
        success: false,
        requiresGoogleAuth: true,
        message: 'SOLAPI 연결을 위해서는 먼저 Google 계정으로 로그인해주세요.',
        guide: {
          step1: 'Google 계정으로 먼저 로그인하세요',
          step2: '로그인 완료 후 SOLAPI 연결을 진행할 수 있습니다',
          googleAuthUrl: '/api/auth/google'
        }
      }, 200); // 200으로 변경하여 가이드 제공
    }

    // 구조적 개선: 세션 기반 통합 데이터 직접 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    
    if (!userData?.email) {
      return c.json({
        success: false,
        requiresGoogleAuth: true,
        message: 'Google 인증 세션이 만료되었습니다. 먼저 Google 계정으로 다시 로그인해주세요.',
        guide: {
          step1: 'Google 계정으로 다시 로그인하세요',
          step2: '로그인 완료 후 SOLAPI 연결을 진행할 수 있습니다',
          googleAuthUrl: '/api/auth/google'
        }
      }, 200);
    }

    // Generate secure state parameter for CSRF protection
    const state = generateSecureSessionId();
    const authUrl = `https://api.solapi.com/oauth2/v1/authorize?client_id=${c.env.SOLAPI_CLIENT_ID}&redirect_uri=${encodeURIComponent(c.env.SOLAPI_REDIRECT_URL)}&response_type=code&scope=message:write%20cash:read%20senderid:read%20pricing:read&state=${state}`;

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

    // SOLAPI 토큰 정보
    const solapiTokens = {
      accessToken: access_token,
      refreshToken: refresh_token,
      connectedAt: new Date().toISOString(),
      expiryDate: Date.now() + (18 * 60 * 60 * 1000), // 18 hours from now
    };

    // 통합 사용자 서비스에 SOLAPI 토큰 저장
    const unifiedUserService = c.get('unifiedUserService');
    
    // Google 세션에서 이메일 추출
    const sessionId = getCookie(c, 'sessionId');
    let userEmail = null;
    let userData = null;
    
    if (sessionId) {
      // 구조적 개선: 세션 기반 통합 데이터 직접 조회
      userData = await unifiedUserService.getSessionBasedUserData(sessionId);
      if (userData?.email) {
        userEmail = userData.email;
      }
    }

    if (userEmail && userData && sessionId) {
      // 세션 기반 데이터와 이메일 기반 데이터 모두 업데이트
      userData.solapiTokens = solapiTokens;
      await unifiedUserService.saveSessionBasedUserData(sessionId, userData);
      await unifiedUserService.updateSolapiTokens(userEmail, solapiTokens);
      console.log(`SOLAPI tokens saved to unified user data for: ${userEmail}`);
    } else {
      console.error('Could not extract user email for SOLAPI token storage');
      return c.json({
        success: false,
        message: 'Google 로그인 세션이 필요합니다.',
      }, 400);
    }

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
    // Google 세션에서 이메일 추출
    const sessionId = getCookie(c, 'sessionId');
    if (!sessionId) {
      return c.json({
        success: false,
        authenticated: false,
        message: 'Google 로그인 세션이 필요합니다.',
      });
    }

    // 구조적 개선: 세션 기반 통합 데이터 직접 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    const userEmail = userData?.email;

    if (!userEmail) {
      return c.json({
        success: false,
        authenticated: false,
        message: 'Google 로그인 세션이 유효하지 않습니다.',
      });
    }

    // 세션 기반 데이터에서 SOLAPI 토큰 확인 (이미 조회된 userData 사용)
    const solapiTokens = userData.solapiTokens || await unifiedUserService.getSolapiTokens(userEmail);
    
    if (!solapiTokens) {
      return c.json({
        success: false,
        authenticated: false,
        message: 'SOLAPI 인증이 되어있지 않습니다.',
      });
    }

    // Check if SOLAPI token needs refresh
    const solapiAuth = new SolapiAuthService(c.env);
    const needsRefresh = solapiAuth.shouldRefreshToken(solapiTokens.expiryDate);

    if (needsRefresh && solapiTokens.refreshToken) {
      try {
        const { accessToken, expiryDate } = await solapiAuth.refreshAccessToken(solapiTokens.refreshToken);
        
        // Update unified user service with refreshed token
        const updatedTokens = {
          ...solapiTokens,
          accessToken,
          expiryDate
        };
        
        await unifiedUserService.updateSolapiTokens(userEmail, updatedTokens);
        console.log('SOLAPI token refreshed during status check');
      } catch (refreshError) {
        console.error('SOLAPI token refresh failed during status check:', refreshError);
        return c.json({
          success: false,
          authenticated: false,
          message: 'SOLAPI 인증 토큰이 만료되었고 갱신에 실패했습니다. 다시 로그인해주세요.',
        });
      }
    }

    return c.json({
      success: true,
      authenticated: true,
      connectedAt: solapiTokens.connectedAt,
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

    // Google 세션에서 이메일 추출
    // 구조적 개선: 세션 기반 통합 데이터 직접 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    const userEmail = userData?.email;

    if (!userEmail) {
      return c.json({
        success: false,
        message: 'Google 로그인 세션이 유효하지 않습니다.',
      }, 400);
    }

    // 세션 기반 데이터와 이메일 기반 데이터에서 SOLAPI 토큰 제거
    userData.solapiTokens = undefined;
    await unifiedUserService.saveSessionBasedUserData(sessionId, userData);
    await unifiedUserService.removeSolapiTokens(userEmail);
    console.log(`SOLAPI tokens removed from unified user data for: ${userEmail}`);

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
 * Get account balance information
 */
solapi.get('/account/balance', async (c) => {
  try {
    const cookieSessionId = getCookie(c, 'sessionId');
    const headerSessionId = c.req.header('X-Session-ID');
    const querySessionId = c.req.query('sessionId');
    const sessionId = cookieSessionId || headerSessionId || querySessionId;
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    // Google 세션에서 이메일 추출
    // 구조적 개선: 세션 기반 통합 데이터 직접 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    const userEmail = userData?.email;

    if (!userEmail) {
      return c.json({
        success: false,
        message: 'Google 로그인 세션이 유효하지 않습니다.',
      } as ApiResponse, 400);
    }

    // 통합 사용자 서비스에서 SOLAPI 토큰 가져오기
    let solapiTokens = await unifiedUserService.getSolapiTokens(userEmail);
    
    if (!solapiTokens) {
      return c.json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
      } as ApiResponse, 401);
    }

    // Check if SOLAPI token needs refresh
    const solapiAuth = new SolapiAuthService(c.env);
    const needsRefresh = solapiAuth.shouldRefreshToken(solapiTokens.expiryDate);

    if (needsRefresh && solapiTokens.refreshToken) {
      try {
        const { accessToken, expiryDate } = await solapiAuth.refreshAccessToken(solapiTokens.refreshToken);
        
        const updatedTokens = {
          ...solapiTokens,
          accessToken,
          expiryDate
        };
        
        await unifiedUserService.updateSolapiTokens(userEmail, updatedTokens);
        solapiTokens = updatedTokens;
        console.log('SOLAPI token refreshed for balance inquiry');
      } catch (refreshError) {
        console.error('SOLAPI token refresh failed for balance inquiry:', refreshError);
        return c.json({
          success: false,
          message: 'SOLAPI 인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
        } as ApiResponse, 401);
      }
    }

    // Get account balance
    const balanceResponse = await axios.get(
      'https://api.solapi.com/cash/v1/balance',
      {
        headers: {
          Authorization: `Bearer ${solapiTokens.accessToken}`,
        },
        // Skip SSL verification for development
        ...(process.env.NODE_ENV === 'development' && {
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false
          })
        })
      }
    );

    console.log('SOLAPI balance response:', balanceResponse.data);

    return c.json({
      success: true,
      data: balanceResponse.data,
      message: '잔액 정보를 성공적으로 조회했습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get balance:', error);
    console.error('Error response data:', error.response?.data);
    
    return c.json({
      success: false,
      message: '잔액 조회에 실패했습니다.',
      error: error.response?.data || error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Get message pricing information
 */
solapi.get('/account/pricing', async (c) => {
  try {
    const cookieSessionId = getCookie(c, 'sessionId');
    const headerSessionId = c.req.header('X-Session-ID');
    const querySessionId = c.req.query('sessionId');
    const sessionId = cookieSessionId || headerSessionId || querySessionId;
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    // 구조적 개선: 세션 기반 통합 데이터 직접 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    const userEmail = userData?.email;

    if (!userEmail) {
      return c.json({
        success: false,
        message: 'Google 로그인 세션이 유효하지 않습니다.',
      } as ApiResponse, 400);
    }

    // 통합 사용자 서비스에서 SOLAPI 토큰 가져오기
    let solapiTokens = await unifiedUserService.getSolapiTokens(userEmail);
    
    if (!solapiTokens) {
      return c.json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
      } as ApiResponse, 401);
    }

    // Check if SOLAPI token needs refresh
    const solapiAuth = new SolapiAuthService(c.env);
    const needsRefresh = solapiAuth.shouldRefreshToken(solapiTokens.expiryDate);

    if (needsRefresh && solapiTokens.refreshToken) {
      try {
        const { accessToken, expiryDate } = await solapiAuth.refreshAccessToken(solapiTokens.refreshToken);
        
        const updatedTokens = {
          ...solapiTokens,
          accessToken,
          expiryDate
        };
        
        await unifiedUserService.updateSolapiTokens(userEmail, updatedTokens);
        solapiTokens = updatedTokens;
        console.log('SOLAPI token refreshed for pricing inquiry');
      } catch (refreshError) {
        console.error('SOLAPI token refresh failed for pricing inquiry:', refreshError);
        return c.json({
          success: false,
          message: 'SOLAPI 인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
        } as ApiResponse, 401);
      }
    }

    // Get message pricing information
    const pricingResponse = await axios.get(
      'https://api.solapi.com/pricing/v1/messaging',
      {
        headers: {
          Authorization: `Bearer ${solapiTokens.accessToken}`,
        },
        // Skip SSL verification for development
        ...(process.env.NODE_ENV === 'development' && {
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false
          })
        })
      }
    );

    console.log('SOLAPI pricing response:', pricingResponse.data);

    return c.json({
      success: true,
      data: pricingResponse.data,
      message: '단가 정보를 성공적으로 조회했습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get pricing:', error);
    console.error('Error response data:', error.response?.data);
    
    return c.json({
      success: false,
      message: '단가 정보 조회에 실패했습니다.',
      error: error.response?.data || error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Get app-specific message pricing information
 */
solapi.get('/account/app-pricing', async (c) => {
  try {
    const cookieSessionId = getCookie(c, 'sessionId');
    const headerSessionId = c.req.header('X-Session-ID');
    const querySessionId = c.req.query('sessionId');
    const sessionId = cookieSessionId || headerSessionId || querySessionId;
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    // 구조적 개선: 세션 기반 통합 데이터 직접 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    const userEmail = userData?.email;

    if (!userEmail) {
      return c.json({
        success: false,
        message: 'Google 로그인 세션이 유효하지 않습니다.',
      } as ApiResponse, 400);
    }

    // 통합 사용자 서비스에서 SOLAPI 토큰 가져오기
    let solapiTokens = await unifiedUserService.getSolapiTokens(userEmail);
    
    if (!solapiTokens) {
      return c.json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
      } as ApiResponse, 401);
    }

    // Check if SOLAPI token needs refresh
    const solapiAuth = new SolapiAuthService(c.env);
    const needsRefresh = solapiAuth.shouldRefreshToken(solapiTokens.expiryDate);

    if (needsRefresh && solapiTokens.refreshToken) {
      try {
        const { accessToken, expiryDate } = await solapiAuth.refreshAccessToken(solapiTokens.refreshToken);
        
        const updatedTokens = {
          ...solapiTokens,
          accessToken,
          expiryDate
        };
        
        await unifiedUserService.updateSolapiTokens(userEmail, updatedTokens);
        solapiTokens = updatedTokens;
        console.log('SOLAPI token refreshed');
      } catch (refreshError) {
        console.error('SOLAPI token refresh failed:', refreshError);
        return c.json({
          success: false,
          message: 'SOLAPI 인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
        } as ApiResponse, 401);
      }
    }

    // Get app-specific pricing information
    const appId = c.req.query('appId'); // Optional appId parameter
    const appPricingUrl = appId 
      ? `https://api.solapi.com/pricing/v1/messaging/combined?appId=${appId}`
      : 'https://api.solapi.com/pricing/v1/messaging/combined';
    
    const appPricingResponse = await axios.get(
      appPricingUrl,
      {
        headers: {
          Authorization: `Bearer ${solapiTokens.accessToken}`,
        },
        // Skip SSL verification for development
        ...(process.env.NODE_ENV === 'development' && {
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false
          })
        })
      }
    );

    console.log('SOLAPI app pricing response:', appPricingResponse.data);

    return c.json({
      success: true,
      data: appPricingResponse.data,
      message: '앱 단가 정보를 성공적으로 조회했습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get app pricing:', error);
    console.error('Error response data:', error.response?.data);
    
    return c.json({
      success: false,
      message: '앱 단가 정보 조회에 실패했습니다.',
      error: error.response?.data || error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Get sender IDs (발신번호 조회)
 */
solapi.get('/account/sender-ids', async (c) => {
  try {
    const cookieSessionId = getCookie(c, 'sessionId');
    const headerSessionId = c.req.header('X-Session-ID');
    const querySessionId = c.req.query('sessionId');
    const sessionId = cookieSessionId || headerSessionId || querySessionId;
    
    if (!sessionId) {
      return c.json({
        success: false,
        message: '세션 ID가 필요합니다.',
      } as ApiResponse, 401);
    }

    // 구조적 개선: 세션 기반 통합 데이터 직접 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    const userEmail = userData?.email;

    if (!userEmail) {
      return c.json({
        success: false,
        message: 'Google 로그인 세션이 유효하지 않습니다.',
      } as ApiResponse, 400);
    }

    // 통합 사용자 서비스에서 SOLAPI 토큰 가져오기
    let solapiTokens = await unifiedUserService.getSolapiTokens(userEmail);
    
    if (!solapiTokens) {
      return c.json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
      } as ApiResponse, 401);
    }

    // Check if SOLAPI token needs refresh
    const solapiAuth = new SolapiAuthService(c.env);
    const needsRefresh = solapiAuth.shouldRefreshToken(solapiTokens.expiryDate);

    if (needsRefresh && solapiTokens.refreshToken) {
      try {
        const { accessToken, expiryDate } = await solapiAuth.refreshAccessToken(solapiTokens.refreshToken);
        
        const updatedTokens = {
          ...solapiTokens,
          accessToken,
          expiryDate
        };
        
        await unifiedUserService.updateSolapiTokens(userEmail, updatedTokens);
        solapiTokens = updatedTokens;
        console.log('SOLAPI token refreshed');
      } catch (refreshError) {
        console.error('SOLAPI token refresh failed:', refreshError);
        return c.json({
          success: false,
          message: 'SOLAPI 인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
        } as ApiResponse, 401);
      }
    }

    // Get sender IDs
    const senderIdsResponse = await axios.get(
      'https://api.solapi.com/senderid/v1/numbers/active',
      {
        headers: {
          Authorization: `Bearer ${solapiTokens.accessToken}`,
        },
        // Skip SSL verification for development
        ...(process.env.NODE_ENV === 'development' && {
          httpsAgent: new (require('https').Agent)({
            rejectUnauthorized: false
          })
        })
      }
    );

    console.log('SOLAPI sender IDs response:', senderIdsResponse.data);

    return c.json({
      success: true,
      data: senderIdsResponse.data,
      message: '발신번호 목록을 성공적으로 조회했습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get sender IDs:', error);
    console.error('Error response data:', error.response?.data);
    
    return c.json({
      success: false,
      message: '발신번호 조회에 실패했습니다.',
      error: error.response?.data || error.message,
    } as ApiResponse, 500);
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

    // Google 세션에서 이메일 추출
    // 구조적 개선: 세션 기반 통합 데이터 직접 조회
    const unifiedUserService = c.get('unifiedUserService');
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);
    const userEmail = userData?.email;

    if (!userEmail) {
      return c.json({
        success: false,
        message: 'Google 로그인 세션이 유효하지 않습니다.',
      } as ApiResponse, 400);
    }

    // 통합 사용자 서비스에서 SOLAPI 토큰 가져오기
    let solapiTokens = await unifiedUserService.getSolapiTokens(userEmail);
    
    if (!solapiTokens) {
      return c.json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
      } as ApiResponse, 401);
    }

    // Check if SOLAPI token needs refresh
    const solapiAuth = new SolapiAuthService(c.env);
    const needsRefresh = solapiAuth.shouldRefreshToken(solapiTokens.expiryDate);

    if (needsRefresh && solapiTokens.refreshToken) {
      try {
        const { accessToken, expiryDate } = await solapiAuth.refreshAccessToken(solapiTokens.refreshToken);
        
        // Update unified user service with refreshed token
        const updatedTokens = {
          ...solapiTokens,
          accessToken,
          expiryDate
        };
        
        await unifiedUserService.updateSolapiTokens(userEmail, updatedTokens);
        solapiTokens = updatedTokens;
        console.log('SOLAPI token refreshed successfully');
      } catch (refreshError) {
        console.error('SOLAPI token refresh failed:', refreshError);
        return c.json({
          success: false,
          message: 'SOLAPI 인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
        } as ApiResponse, 401);
      }
    }

    const { from, to, text, type } = await c.req.json();

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

    // Calculate message byte size (Korean characters = 2 bytes, ASCII = 1 byte)
    const calculateMessageBytes = (message: string): number => {
      let bytes = 0;
      for (let i = 0; i < message.length; i++) {
        const char = message.charAt(i);
        // Korean characters (Hangul), Chinese, Japanese characters = 2 bytes
        if (char >= '\u0080') {
          bytes += 2;
        } else {
          bytes += 1;
        }
      }
      return bytes;
    };

    // Auto-detect message type based on byte size if not specified
    // SMS: up to 90 bytes (SOLAPI standard)
    // LMS: 91+ bytes (up to 2000 bytes)
    const messageBytes = calculateMessageBytes(text);
    const messageType = type || (messageBytes <= 90 ? 'SMS' : 'LMS');

    console.log('Sending message:', { 
      from, 
      to: to.substring(0, 7) + '***', 
      textLength: text.length,
      messageBytes: messageBytes,
      messageType: messageType,
      autoDetected: !type ? 'yes' : 'no'
    });

    // Send message via SOLAPI
    const messageResponse = await axios.post(
      'https://api.solapi.com/messages/v4/send',
      {
        message: {
          type: messageType,
          from: from.replace(/-/g, ''),
          to: to.replace(/-/g, ''),
          text: text,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${solapiTokens.accessToken}`,
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
      messageId: messageResponse.data.messageId,
      messageType: messageType,
      messageLength: text.length,
      messageBytes: messageBytes
    });

    return c.json({
      success: true,
      data: {
        messageId: messageResponse.data.messageId,
        statusCode: messageResponse.data.statusCode,
        statusMessage: messageResponse.data.statusMessage || '메시지 발송 요청이 완료되었습니다.',
        messageType: messageType,
        messageLength: text.length,
        messageBytes: messageBytes
      },
      message: `${messageType}가 성공적으로 발송되었습니다. (${text.length}자, ${messageBytes}바이트)`,
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