import { Hono } from 'hono';
import { getCookie, setCookie } from 'hono/cookie';
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

    // Generate session ID and store tokens
    const sessionId = generateSessionId();
    const sessionData: GoogleTokens = {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      connectedAt: new Date().toISOString(),
      expiryDate: Date.now() + (3600 * 1000), // 1 hour from now
    };

    await setSession(sessionId, sessionData, c.env);

    // Set session cookie with cross-site compatibility
    console.log('Setting session cookie:', { sessionId, sameSite: 'None', secure: true, httpOnly: false });
    
    // Try multiple Set-Cookie approaches
    setCookie(c, 'sessionId', sessionId, {
      httpOnly: false,
      secure: true,
      maxAge: 86400,
      sameSite: 'None',
      path: '/'
    });
    
    // Also set manual header as fallback
    const cookieValue = `sessionId=${sessionId}; Max-Age=86400; Path=/; SameSite=None; Secure`;
    c.header('Set-Cookie', cookieValue);
    
    console.log('Cookie header set:', cookieValue);

    // Redirect to frontend with sessionId in URL as fallback
    const redirectUrl = new URL('/admin', c.env.FRONTEND_URL);
    redirectUrl.searchParams.set('auth', 'success');
    redirectUrl.searchParams.set('sessionId', sessionId); // Fallback for cross-site cookie issues

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
      cookie: cookieSessionId,
      header: headerSessionId,
      query: querySessionId,
      allCookies: c.req.header('Cookie'),
      allHeaders: Object.fromEntries(c.req.raw.headers.entries())
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
          success: true,
          data: {
            google: false,
            solapi: false
          }
        });
      }
    }

    // Get spreadsheets list for the response
    let spreadsheetsList: any[] = [];
    try {
      const { GoogleSheetsService } = await import('../services/googleSheets');
      const sheetsService = new GoogleSheetsService(c.env);
      sheetsService.init(sessionData.accessToken, sessionData.refreshToken);
      spreadsheetsList = await sheetsService.getSpreadsheets();
    } catch (error) {
      console.error('Failed to fetch spreadsheets list:', error);
    }

    return c.json({
      success: true,
      data: {
        google: true,
        solapi: false,
        googleData: {
          connectedAt: sessionData.connectedAt,
          spreadsheets: spreadsheetsList
        }
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
 * Logout
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
      secure: process.env.NODE_ENV === 'production',
      maxAge: 0, // Delete cookie
      sameSite: 'Lax',
      domain: 'localhost' // Allow cross-port access on localhost
    });

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