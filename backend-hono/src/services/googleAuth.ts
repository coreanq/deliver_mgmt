import { google } from 'googleapis';
import type { Env } from '../types';

export class GoogleAuthService {
  private oauth2Client;
  private env: Env;

  constructor(env: Env) {
    this.env = env;
    this.oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URL
    );
  }

  /**
   * Generate secure OAuth state parameter
   */
  generateOAuthState(): string {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Validate OAuth state parameter
   */
  async validateOAuthState(state: string, storedState: string): Promise<boolean> {
    if (!state || !storedState) return false;
    
    // Use crypto.subtle for timing-safe comparison
    const encoder = new TextEncoder();
    const stateBuffer = encoder.encode(state);
    const storedStateBuffer = encoder.encode(storedState);
    
    if (stateBuffer.length !== storedStateBuffer.length) return false;
    
    try {
      const stateKey = await crypto.subtle.importKey(
        'raw', stateBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const storedStateKey = await crypto.subtle.importKey(
        'raw', storedStateBuffer, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      
      const dummyData = encoder.encode('validation');
      const signature1 = await crypto.subtle.sign('HMAC', stateKey, dummyData);
      const signature2 = await crypto.subtle.sign('HMAC', storedStateKey, dummyData);
      
      return new Uint8Array(signature1).every((val, i) => val === new Uint8Array(signature2)[i]);
    } catch (error) {
      console.error('OAuth state validation error:', error);
      return false;
    }
  }

  /**
   * Generate Google OAuth2 authorization URL with state parameter
   */
  getAuthUrl(state?: string): string {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email', // 사용자 이메일 접근 권한
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: state, // Include state for CSRF protection
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string): Promise<{ accessToken: string; refreshToken: string; expiryDate: number }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain access or refresh token');
      }

      // Use actual expiry_date from Google response, fallback to 1 hour if not provided
      const expiryDate = tokens.expiry_date || (Date.now() + (60 * 60 * 1000));

      console.log('Google OAuth tokens obtained successfully', {
        expiryDate: new Date(expiryDate).toISOString(),
        expiresInSeconds: Math.floor((expiryDate - Date.now()) / 1000)
      });
      
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate
      };
    } catch (error) {
      console.error('Failed to exchange code for tokens:', error);
      throw new Error('Google OAuth 인증에 실패했습니다.');
    }
  }

  /**
   * Set credentials for API calls
   */
  setCredentials(accessToken: string, refreshToken: string): void {
    this.oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
  }

  /**
   * Get authenticated Google Sheets API client
   */
  getSheetsClient() {
    return google.sheets({ version: 'v4', auth: this.oauth2Client });
  }

  /**
   * Get authenticated Google Drive API client
   */
  getDriveClient() {
    return google.drive({ version: 'v3', auth: this.oauth2Client });
  }

  /**
   * Refresh access token if needed
   */
  async refreshAccessToken(): Promise<{ accessToken: string; expiryDate: number }> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      // Use actual expiry_date from Google response, fallback to 1 hour if not provided
      const expiryDate = credentials.expiry_date || (Date.now() + (60 * 60 * 1000));

      console.log('Google access token refreshed successfully', {
        expiryDate: new Date(expiryDate).toISOString(),
        expiresInSeconds: Math.floor((expiryDate - Date.now()) / 1000)
      });
      
      return {
        accessToken: credentials.access_token,
        expiryDate
      };
    } catch (error) {
      console.error('Failed to refresh access token:', error);
      throw new Error('Google 인증 토큰 갱신에 실패했습니다.');
    }
  }

  /**
   * Check if token needs refresh (within 5 minutes of expiry)
   */
  shouldRefreshToken(expiryDate?: number): boolean {
    if (!expiryDate) return true;
    
    const now = Date.now();
    const expiryTime = expiryDate;
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    return (expiryTime - now) <= fiveMinutes;
  }
}