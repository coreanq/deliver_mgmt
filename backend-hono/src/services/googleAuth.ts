import { google } from 'googleapis';
import type { Env } from '../types';

export class GoogleAuthService {
  private oauth2Client;

  constructor(env: Env) {
    this.oauth2Client = new google.auth.OAuth2(
      env.GOOGLE_CLIENT_ID,
      env.GOOGLE_CLIENT_SECRET,
      env.GOOGLE_REDIRECT_URL
    );
  }

  /**
   * Generate Google OAuth2 authorization URL
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/userinfo.email', // 사용자 이메일 접근 권한
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokens(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      
      if (!tokens.access_token || !tokens.refresh_token) {
        throw new Error('Failed to obtain access or refresh token');
      }

      console.log('Google OAuth tokens obtained successfully');
      
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
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
  async refreshAccessToken(): Promise<string> {
    try {
      const { credentials } = await this.oauth2Client.refreshAccessToken();
      
      if (!credentials.access_token) {
        throw new Error('Failed to refresh access token');
      }

      console.log('Google access token refreshed successfully');
      return credentials.access_token;
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