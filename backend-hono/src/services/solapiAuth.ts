import axios from 'axios';
import type { Env } from '../types';

export class SolapiAuthService {
  private env: Env;

  constructor(env: Env) {
    this.env = env;
  }

  /**
   * Refresh SOLAPI access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<{ accessToken: string; expiryDate: number }> {
    try {
      const response = await axios.post(
        'https://api.solapi.com/oauth2/v1/access_token',
        {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        },
        {
          headers: {
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

      const { access_token } = response.data;

      if (!access_token) {
        throw new Error('Failed to refresh SOLAPI access token');
      }

      // SOLAPI access tokens are valid for 24 hours
      const expiryDate = Date.now() + (24 * 60 * 60 * 1000); // 24 hours from now

      console.log('SOLAPI access token refreshed successfully');
      
      return {
        accessToken: access_token,
        expiryDate: expiryDate,
      };
    } catch (error: any) {
      console.error('Failed to refresh SOLAPI access token:', error);
      throw new Error('SOLAPI 인증 토큰 갱신에 실패했습니다.');
    }
  }

  /**
   * Check if SOLAPI token needs refresh (within 30 minutes of expiry)
   * Note: SOLAPI tokens last 24 hours, so we use 30 minutes buffer
   */
  shouldRefreshToken(expiryDate?: number): boolean {
    if (!expiryDate) return true;
    
    const now = Date.now();
    const expiryTime = expiryDate;
    const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
    
    return (expiryTime - now) <= thirtyMinutes;
  }
}