import express from 'express';
import { GoogleAuthService } from '../services/googleAuth';
import { logger } from '../utils/logger';
import type { ApiResponse, GoogleTokens } from '../types/index.js';

interface AuthenticatedRequest extends express.Request {
  session: express.Request['session'] & {
    googleTokens?: GoogleTokens;
  };
}

const googleAuthService = new GoogleAuthService();

export const requireGoogleAuth = async (
  req: AuthenticatedRequest,
  res: express.Response,
  next: express.NextFunction
): Promise<void> => {
  try {
    if (!req.session.googleTokens) {
      res.status(401).json({
        success: false,
        message: 'Google 인증이 필요합니다.',
      } as ApiResponse);
      return;
    }

    const tokens = req.session.googleTokens;
    const now = Date.now();

    // Check if token is about to expire (within 5 minutes)
    if (tokens.expiryDate && tokens.expiryDate - now < 5 * 60 * 1000) {
      try {
        logger.info('Access token will expire soon, refreshing...');
        
        googleAuthService.setCredentials(tokens.accessToken, tokens.refreshToken);
        const newAccessToken = await googleAuthService.refreshAccessToken();
        
        // Update session with new token
        req.session.googleTokens = {
          ...tokens,
          accessToken: newAccessToken,
          expiryDate: now + 3600 * 1000, // 1 hour from now
        };
        
        logger.info('Access token refreshed successfully');
      } catch (error) {
        logger.error('Failed to refresh access token:', error);
        res.status(401).json({
          success: false,
          message: 'Google 인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
        } as ApiResponse);
        return;
      }
    }

    next();
  } catch (error) {
    logger.error('Auth middleware error:', error);
    res.status(500).json({
      success: false,
      message: '인증 처리 중 오류가 발생했습니다.',
    } as ApiResponse);
  }
};

export const handleGoogleApiError = async (
  error: any,
  req: AuthenticatedRequest,
  retryCallback: () => Promise<any>
): Promise<any> => {
  // Check if error is due to invalid or expired token
  if (error.code === 401 || error.status === 401 || 
      (error.response && error.response.status === 401)) {
    
    logger.info('API call failed with 401, attempting token refresh...');
    
    try {
      const tokens = req.session.googleTokens;
      if (!tokens) {
        throw new Error('No tokens available for refresh');
      }

      googleAuthService.setCredentials(tokens.accessToken, tokens.refreshToken);
      const newAccessToken = await googleAuthService.refreshAccessToken();
      
      // Update session with new token
      req.session.googleTokens = {
        ...tokens,
        accessToken: newAccessToken,
        expiryDate: Date.now() + 3600 * 1000, // 1 hour from now
      };

      logger.info('Token refreshed, retrying API call...');
      
      // Retry the original API call with new token
      return await retryCallback();
      
    } catch (refreshError) {
      logger.error('Failed to refresh token and retry:', refreshError);
      throw new Error('Google 인증 토큰 갱신에 실패했습니다. 다시 로그인해주세요.');
    }
  }
  
  // If not an auth error, rethrow the original error
  throw error;
};