import { google } from 'googleapis';
import { config } from '../config/index';
import { logger } from '../utils/logger';

export class GoogleAuthService {
  private oauth2Client;

  constructor() {
    this.oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUrl
    );
  }

  /**
   * Generate Google OAuth2 authorization URL
   */
  getAuthUrl(): string {
    const scopes = [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
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

      logger.info('Google OAuth tokens obtained successfully');
      
      return {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
      };
    } catch (error) {
      logger.error('Failed to exchange code for tokens:', error);
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

      logger.info('Google access token refreshed successfully');
      return credentials.access_token;
    } catch (error) {
      logger.error('Failed to refresh access token:', error);
      throw new Error('Google 인증 토큰 갱신에 실패했습니다.');
    }
  }
}