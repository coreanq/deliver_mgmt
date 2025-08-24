import express from 'express';
import { GoogleAuthService } from '../services/googleAuth';
import { logger } from '../utils/logger';
import { config } from '../config/index';
import type { ApiResponse } from '../types/index.js';

const router = express.Router();
const googleAuthService = new GoogleAuthService();

/**
 * Start Google OAuth2 authentication
 */
router.get('/google', (req, res) => {
  try {
    const authUrl = googleAuthService.getAuthUrl();
    res.redirect(authUrl);
  } catch (error) {
    logger.error('Google OAuth initiation failed:', error);
    res.status(500).json({
      success: false,
      message: 'Google 인증 시작에 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Handle Google OAuth2 callback
 */
router.get('/google/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    logger.error('Google OAuth error:', error);
    return res.redirect(`${config.frontendUrl}/admin?error=google_auth_failed`);
  }

  if (!code || typeof code !== 'string') {
    logger.error('No authorization code received');
    return res.redirect(`${config.frontendUrl}/admin?error=no_auth_code`);
  }

  try {
    const tokens = await googleAuthService.getTokens(code);
    
    // Store tokens in session (in production, use secure storage)
    req.session.googleTokens = tokens;
    
    logger.info('Google OAuth completed successfully');
    res.redirect(`${config.frontendUrl}/admin?google_auth=success`);
  } catch (error) {
    logger.error('Google OAuth callback failed:', error);
    res.redirect(`${config.frontendUrl}/admin?error=google_auth_failed`);
  }
});

/**
 * Start SOLAPI OAuth2 authentication
 */
router.get('/solapi', (req, res) => {
  try {
    // TODO: Implement SOLAPI OAuth2 URL generation
    const solapiAuthUrl = `${config.solapi.apiBaseUrl}/oauth/authorize?` +
      `client_id=${config.solapi.clientId}&` +
      `redirect_uri=${encodeURIComponent(config.solapi.redirectUrl)}&` +
      `response_type=code&` +
      `scope=message:write,cash:read,senderid:read,kakao:write,kakao:read`;
    
    res.redirect(solapiAuthUrl);
  } catch (error) {
    logger.error('SOLAPI OAuth initiation failed:', error);
    res.status(500).json({
      success: false,
      message: 'SOLAPI 인증 시작에 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Handle SOLAPI OAuth2 callback
 */
router.get('/solapi/callback', async (req, res) => {
  const { code, error } = req.query;

  if (error) {
    logger.error('SOLAPI OAuth error:', error);
    return res.redirect(`${config.frontendUrl}/admin?error=solapi_auth_failed`);
  }

  if (!code || typeof code !== 'string') {
    logger.error('No SOLAPI authorization code received');
    return res.redirect(`${config.frontendUrl}/admin?error=no_solapi_code`);
  }

  try {
    // TODO: Implement SOLAPI token exchange
    // const tokens = await solapiService.getTokens(code);
    
    // Store tokens in session (in production, use secure storage)
    req.session.solapiTokens = { 
      accessToken: 'mock_token', 
      refreshToken: 'mock_refresh',
      expiresIn: 86400,
      tokenType: 'Bearer'
    };
    
    logger.info('SOLAPI OAuth completed successfully');
    res.redirect(`${config.frontendUrl}/admin?solapi_auth=success`);
  } catch (error) {
    logger.error('SOLAPI OAuth callback failed:', error);
    res.redirect(`${config.frontendUrl}/admin?error=solapi_auth_failed`);
  }
});

/**
 * Get authentication status
 */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      google: !!req.session.googleTokens,
      solapi: !!req.session.solapiTokens,
    },
  } as ApiResponse);
});

/**
 * Logout and clear all authentication
 */
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Session destruction failed:', err);
      return res.status(500).json({
        success: false,
        message: '로그아웃에 실패했습니다.',
      } as ApiResponse);
    }

    res.json({
      success: true,
      message: '로그아웃되었습니다.',
    } as ApiResponse);
  });
});

export default router;