import axios from 'axios';
import { config } from '../config/index';
import { logger } from '../utils/logger';

export interface SolapiTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

export interface SolapiAccountInfo {
  accountId: string;
  balance: number;
  point: number;
}

export interface SolapiSender {
  phoneNumber: string;
  status: string;
  dateCreated: string;
  dateUpdated: string;
}

interface SolapiTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

interface SolapiBalanceResponse {
  accountId: string;
  balance: number;
  point: number;
}

interface SolapiSenderListResponse {
  senderIdList: SolapiSender[];
}

interface SolapiMessageResponse {
  messageId: string;
  statusCode: string;
}

interface SolapiTemplateListResponse {
  templateList: any[];
}

export class SolapiAuthService {
  private readonly baseUrl = 'https://api.solapi.com';

  /**
   * Generate SOLAPI OAuth2 authorization URL
   */
  getAuthUrl(state?: string): string {
    const params = new URLSearchParams({
      client_id: config.solapi.clientId,
      response_type: 'code',
      redirect_uri: config.solapi.redirectUrl,
    });

    if (state) {
      params.append('state', state);
    }

    // Add scopes for message sending, balance check, and sender management
    params.append('scope', 'message cash senderid');

    return `${this.baseUrl}/oauth2/v1/authorize?${params.toString()}`;
  }

  /**
   * Exchange authorization code for access token
   */
  async getTokens(code: string): Promise<SolapiTokens> {
    try {
      const response = await axios.post<SolapiTokenResponse>(`${this.baseUrl}/oauth2/v1/access_token`, {
        grant_type: 'authorization_code',
        client_id: config.solapi.clientId,
        client_secret: config.solapi.clientSecret,
        redirect_uri: config.solapi.redirectUrl,
        code,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { access_token, refresh_token, expires_in, token_type } = response.data;

      if (!access_token || !refresh_token) {
        throw new Error('Invalid token response from SOLAPI');
      }

      logger.info('SOLAPI OAuth tokens obtained successfully');

      return {
        accessToken: access_token,
        refreshToken: refresh_token,
        expiresIn: expires_in || 86400, // Default 24 hours
        tokenType: token_type || 'Bearer',
      };
    } catch (error) {
      logger.error('Failed to exchange code for SOLAPI tokens:', error);
      throw new Error('SOLAPI OAuth 인증에 실패했습니다.');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string): Promise<SolapiTokens> {
    try {
      const response = await axios.post<SolapiTokenResponse>(`${this.baseUrl}/oauth2/v1/access_token`, {
        grant_type: 'refresh_token',
        client_id: config.solapi.clientId,
        client_secret: config.solapi.clientSecret,
        refresh_token: refreshToken,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const { access_token, refresh_token, expires_in, token_type } = response.data;

      logger.info('SOLAPI access token refreshed successfully');

      return {
        accessToken: access_token,
        refreshToken: refresh_token || refreshToken, // Keep old refresh token if new one not provided
        expiresIn: expires_in || 86400,
        tokenType: token_type || 'Bearer',
      };
    } catch (error) {
      logger.error('Failed to refresh SOLAPI access token:', error);
      throw new Error('SOLAPI 토큰 갱신에 실패했습니다.');
    }
  }

  /**
   * Get account information
   */
  async getAccountInfo(accessToken: string): Promise<SolapiAccountInfo> {
    try {
      const response = await axios.get<SolapiBalanceResponse>(`${this.baseUrl}/cash/v1/balance`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info('SOLAPI account info retrieved successfully');

      return {
        accountId: response.data.accountId || '',
        balance: response.data.balance || 0,
        point: response.data.point || 0,
      };
    } catch (error) {
      logger.error('Failed to get SOLAPI account info:', error);
      throw new Error('SOLAPI 계정 정보를 가져오는데 실패했습니다.');
    }
  }

  /**
   * Get sender ID list
   */
  async getSenderIds(accessToken: string): Promise<SolapiSender[]> {
    try {
      const response = await axios.get<SolapiSenderListResponse>(`${this.baseUrl}/senderid/v1/list`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info('SOLAPI sender IDs retrieved successfully');

      return response.data.senderIdList || [];
    } catch (error) {
      logger.error('Failed to get SOLAPI sender IDs:', error);
      throw new Error('SOLAPI 발신번호 목록을 가져오는데 실패했습니다.');
    }
  }

  /**
   * Send KakaoTalk message
   */
  async sendKakaoMessage(
    accessToken: string,
    to: string,
    from: string,
    templateId: string,
    variables: Record<string, string>
  ): Promise<{ messageId: string; statusCode: string }> {
    try {
      const response = await axios.post<SolapiMessageResponse>(`${this.baseUrl}/messages/v4/send`, {
        message: {
          to,
          from,
          kakaoOptions: {
            pfId: templateId,
            templateId,
            variables,
          },
        },
      }, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info(`KakaoTalk message sent successfully to ${to}`);

      return {
        messageId: response.data.messageId || '',
        statusCode: response.data.statusCode || '',
      };
    } catch (error) {
      logger.error('Failed to send KakaoTalk message:', error);
      throw new Error('카카오톡 메시지 발송에 실패했습니다.');
    }
  }

  /**
   * Get message templates
   */
  async getTemplates(accessToken: string): Promise<any[]> {
    try {
      const response = await axios.get<SolapiTemplateListResponse>(`${this.baseUrl}/kakao/v1/templates`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      });

      logger.info('SOLAPI templates retrieved successfully');

      return response.data.templateList || [];
    } catch (error) {
      logger.error('Failed to get SOLAPI templates:', error);
      throw new Error('SOLAPI 템플릿 목록을 가져오는데 실패했습니다.');
    }
  }
}