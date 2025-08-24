import express from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { SolapiAuthService } from '../services/solapiAuth';
import { logger } from '../utils/logger';
import { config } from '../config/index';
import type { ApiResponse } from '../types/index';

const router = express.Router();
const solapiAuthService = new SolapiAuthService();

/**
 * Start SOLAPI OAuth2 authentication
 */
router.get('/auth/login', (req, res) => {
  try {
    // Generate state parameter for CSRF protection
    const state = crypto.randomBytes(32).toString('hex');
    req.session.solapiState = state;

    const authUrl = solapiAuthService.getAuthUrl(state);
    res.redirect(authUrl);
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
router.get('/auth/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (error) {
    logger.error('SOLAPI OAuth error:', error);
    return res.redirect(`${config.frontendUrl}/admin?error=solapi_auth_failed`);
  }

  if (!code || typeof code !== 'string') {
    logger.error('No SOLAPI authorization code received');
    return res.redirect(`${config.frontendUrl}/admin?error=no_solapi_code`);
  }

  // Verify state parameter for CSRF protection
  if (!state || state !== req.session.solapiState) {
    logger.error('Invalid state parameter in SOLAPI OAuth callback');
    return res.redirect(`${config.frontendUrl}/admin?error=invalid_state`);
  }

  try {
    const tokens = await solapiAuthService.getTokens(code);
    
    // Get account info and sender IDs
    const [accountInfo, senderIds] = await Promise.all([
      solapiAuthService.getAccountInfo(tokens.accessToken),
      solapiAuthService.getSenderIds(tokens.accessToken),
    ]);

    // Store tokens and info in session
    req.session.solapiTokens = tokens;
    req.session.solapiAccountInfo = accountInfo;
    req.session.solapiSenders = senderIds;

    // Clear state
    delete req.session.solapiState;

    logger.info('SOLAPI OAuth completed successfully');
    res.redirect(`${config.frontendUrl}/admin?solapi_auth=success`);
  } catch (error) {
    logger.error('SOLAPI OAuth callback failed:', error);
    res.redirect(`${config.frontendUrl}/admin?error=solapi_auth_failed`);
  }
});

/**
 * Get SOLAPI account information
 */
router.get('/account', async (req, res) => {
  if (!req.session.solapiTokens) {
    return res.status(401).json({
      success: false,
      message: 'SOLAPI 인증이 필요합니다.',
    } as ApiResponse);
  }

  try {
    // Use cached account info if available, otherwise fetch fresh
    let accountInfo = req.session.solapiAccountInfo;
    
    if (!accountInfo) {
      accountInfo = await solapiAuthService.getAccountInfo(req.session.solapiTokens.accessToken);
      req.session.solapiAccountInfo = accountInfo;
    }

    res.json({
      success: true,
      data: accountInfo,
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to get SOLAPI account info:', error);
    res.status(500).json({
      success: false,
      message: 'SOLAPI 계정 정보를 가져오는데 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Get SOLAPI sender ID list
 */
router.get('/senders', async (req, res) => {
  if (!req.session.solapiTokens) {
    return res.status(401).json({
      success: false,
      message: 'SOLAPI 인증이 필요합니다.',
    } as ApiResponse);
  }

  try {
    // Use cached sender IDs if available, otherwise fetch fresh
    let senderIds = req.session.solapiSenders;
    
    if (!senderIds) {
      senderIds = await solapiAuthService.getSenderIds(req.session.solapiTokens.accessToken);
      req.session.solapiSenders = senderIds;
    }

    res.json({
      success: true,
      data: senderIds,
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to get SOLAPI sender IDs:', error);
    res.status(500).json({
      success: false,
      message: 'SOLAPI 발신번호 목록을 가져오는데 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Get SOLAPI message templates
 */
router.get('/templates', async (req, res) => {
  if (!req.session.solapiTokens) {
    return res.status(401).json({
      success: false,
      message: 'SOLAPI 인증이 필요합니다.',
    } as ApiResponse);
  }

  try {
    const templates = await solapiAuthService.getTemplates(req.session.solapiTokens.accessToken);

    res.json({
      success: true,
      data: templates,
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to get SOLAPI templates:', error);
    res.status(500).json({
      success: false,
      message: 'SOLAPI 템플릿 목록을 가져오는데 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Send delivery completion message
 */
router.post('/send', async (req, res) => {
  const { customerName, customerPhone, templateId } = req.body;

  if (!req.session.solapiTokens) {
    return res.status(401).json({
      success: false,
      message: 'SOLAPI 인증이 필요합니다.',
    } as ApiResponse);
  }

  if (!customerName || !customerPhone) {
    return res.status(400).json({
      success: false,
      message: '고객명과 연락처가 필요합니다.',
    } as ApiResponse);
  }

  // Get default sender ID (first available)
  const senderIds = req.session.solapiSenders || [];
  const defaultSender = senderIds.find(sender => sender.status === 'ACTIVE');

  if (!defaultSender) {
    return res.status(400).json({
      success: false,
      message: '사용 가능한 발신번호가 없습니다.',
    } as ApiResponse);
  }

  try {
    const result = await solapiAuthService.sendKakaoMessage(
      req.session.solapiTokens.accessToken,
      customerPhone,
      defaultSender.phoneNumber,
      templateId || 'default_delivery_complete',
      {
        고객명: customerName,
      }
    );

    logger.info(`Delivery completion message sent to ${customerPhone}`);

    res.json({
      success: true,
      data: result,
      message: '고객에게 배달 완료 알림이 발송되었습니다.',
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to send delivery completion message:', error);
    res.status(500).json({
      success: false,
      message: '메시지 발송에 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Test message sending (for testing purposes)
 */
router.post('/send/test', async (req, res) => {
  const { phone, message } = req.body;

  if (!req.session.solapiTokens) {
    return res.status(401).json({
      success: false,
      message: 'SOLAPI 인증이 필요합니다.',
    } as ApiResponse);
  }

  if (!phone || !message) {
    return res.status(400).json({
      success: false,
      message: '전화번호와 메시지가 필요합니다.',
    } as ApiResponse);
  }

  const senderIds = req.session.solapiSenders || [];
  const defaultSender = senderIds.find(sender => sender.status === 'ACTIVE');

  if (!defaultSender) {
    return res.status(400).json({
      success: false,
      message: '사용 가능한 발신번호가 없습니다.',
    } as ApiResponse);
  }

  try {
    // Send simple SMS for testing  
    const response = await axios.post('https://api.solapi.com/messages/v4/send', {
      message: {
        to: phone,
        from: defaultSender.phoneNumber,
        text: message,
      },
    }, {
      headers: {
        'Authorization': `Bearer ${req.session.solapiTokens.accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    res.json({
      success: true,
      data: response.data,
      message: '테스트 메시지가 발송되었습니다.',
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to send test message:', error);
    res.status(500).json({
      success: false,
      message: '테스트 메시지 발송에 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Disconnect SOLAPI (clear session)
 */
router.post('/disconnect', (req, res) => {
  delete req.session.solapiTokens;
  delete req.session.solapiAccountInfo;
  delete req.session.solapiSenders;
  delete req.session.solapiState;

  res.json({
    success: true,
    message: 'SOLAPI 연결이 해제되었습니다.',
  } as ApiResponse);
});

export default router;