import express from 'express';
import { QRGenerator } from '../utils/qrGenerator';
import { GoogleSheetsService } from '../services/googleSheets';
import { logger } from '../utils/logger';
import type { ApiResponse, DeliveryStatus } from '../types/index.js';

const router = express.Router();
const qrGenerator = new QRGenerator();

/**
 * Generate QR code for delivery staff
 */
router.post('/qr/generate/:staffName', async (req, res) => {
  const { staffName } = req.params;

  if (!staffName) {
    return res.status(400).json({
      success: false,
      message: '배달담당자 이름이 필요합니다.',
    } as ApiResponse);
  }

  try {
    const qrImageData = await qrGenerator.generateQRImage(staffName);
    const qrUrl = qrGenerator.generateQRUrl(staffName);

    res.json({
      success: true,
      data: {
        qrImage: qrImageData,
        qrUrl,
        staffName,
      },
      message: 'QR 코드가 생성되었습니다.',
    } as ApiResponse);
  } catch (error) {
    logger.error('QR code generation failed:', error);
    res.status(500).json({
      success: false,
      message: 'QR 코드 생성에 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Download QR code as PNG file
 */
router.get('/qr/download/:staffName', async (req, res) => {
  const { staffName } = req.params;

  try {
    const qrBuffer = await qrGenerator.generateQRBuffer(staffName);
    
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `attachment; filename="qr-${staffName}.png"`);
    res.send(qrBuffer);
  } catch (error) {
    logger.error('QR code download failed:', error);
    res.status(500).json({
      success: false,
      message: 'QR 코드 다운로드에 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Verify QR token
 */
router.get('/qr/verify/:token', (req, res) => {
  const { token } = req.params;

  try {
    const payload = qrGenerator.verifyToken(token);
    
    if (!payload) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 QR 코드입니다.',
      } as ApiResponse);
    }

    res.json({
      success: true,
      data: payload,
      message: 'QR 코드가 확인되었습니다.',
    } as ApiResponse);
  } catch (error) {
    logger.error('QR token verification failed:', error);
    res.status(401).json({
      success: false,
      message: 'QR 코드 인증에 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Authenticate delivery staff with name verification
 */
router.post('/auth', (req, res) => {
  const { staffName, inputName, token } = req.body;

  if (!staffName || !inputName || !token) {
    return res.status(400).json({
      success: false,
      message: '필수 정보가 누락되었습니다.',
    } as ApiResponse);
  }

  try {
    // Verify QR token first
    const tokenPayload = qrGenerator.verifyToken(token);
    if (!tokenPayload || tokenPayload.staffName !== staffName) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 QR 코드입니다.',
      } as ApiResponse);
    }

    // Verify name matches exactly
    if (inputName.trim() !== staffName.trim()) {
      return res.status(401).json({
        success: false,
        message: '이름이 일치하지 않습니다. 다시 확인해주세요.',
      } as ApiResponse);
    }

    // Set authenticated session
    req.session.deliveryAuth = {
      staffName,
      authenticatedAt: new Date().toISOString(),
    };

    logger.info(`Delivery staff authenticated: ${staffName}`);
    
    res.json({
      success: true,
      data: { staffName },
      message: '인증이 완료되었습니다.',
    } as ApiResponse);
  } catch (error) {
    logger.error('Delivery staff authentication failed:', error);
    res.status(500).json({
      success: false,
      message: '인증에 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Get delivery orders for authenticated staff
 */
router.get('/orders/:staff', async (req, res) => {
  const { staff } = req.params;

  // Check if staff is authenticated
  if (!req.session.deliveryAuth || req.session.deliveryAuth.staffName !== staff) {
    return res.status(401).json({
      success: false,
      message: '인증이 필요합니다.',
    } as ApiResponse);
  }

  if (!req.session.googleTokens || !req.session.connectedSpreadsheet) {
    return res.status(400).json({
      success: false,
      message: '스프레드시트가 연결되지 않았습니다.',
    } as ApiResponse);
  }

  try {
    const sheetsService = new GoogleSheetsService();
    sheetsService.init(
      req.session.googleTokens!.accessToken,
      req.session.googleTokens!.refreshToken
    );

    const orders = await sheetsService.getDeliveryOrders(
      req.session.connectedSpreadsheet!.id,
      staff
    );

    res.json({
      success: true,
      data: orders,
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to get delivery orders:', error);
    res.status(500).json({
      success: false,
      message: '배달 주문 목록을 가져오는데 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Update delivery status
 */
router.put('/status', async (req, res) => {
  const { staffName, rowIndex, status } = req.body;

  // Check if staff is authenticated
  if (!req.session.deliveryAuth || req.session.deliveryAuth.staffName !== staffName) {
    return res.status(401).json({
      success: false,
      message: '인증이 필요합니다.',
    } as ApiResponse);
  }

  if (!req.session.googleTokens || !req.session.connectedSpreadsheet) {
    return res.status(400).json({
      success: false,
      message: '스프레드시트가 연결되지 않았습니다.',
    } as ApiResponse);
  }

  if (!rowIndex || !status) {
    return res.status(400).json({
      success: false,
      message: '행 번호와 상태 정보가 필요합니다.',
    } as ApiResponse);
  }

  try {
    const sheetsService = new GoogleSheetsService();
    sheetsService.init(
      req.session.googleTokens!.accessToken,
      req.session.googleTokens!.refreshToken
    );

    await sheetsService.updateDeliveryStatus(
      req.session.connectedSpreadsheet!.id,
      staffName,
      rowIndex,
      status as DeliveryStatus
    );

    // TODO: If status is '완료', trigger SOLAPI message sending
    if (status === '완료') {
      logger.info(`Delivery completed for staff ${staffName}, row ${rowIndex} - should send customer notification`);
    }

    res.json({
      success: true,
      message: '배달 상태가 업데이트되었습니다.',
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to update delivery status:', error);
    res.status(500).json({
      success: false,
      message: '배달 상태 업데이트에 실패했습니다.',
    } as ApiResponse);
  }
});

export default router;