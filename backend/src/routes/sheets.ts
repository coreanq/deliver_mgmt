import express from 'express';
import { GoogleSheetsService } from '../services/googleSheets';
import { logger } from '../utils/logger';
import type { ApiResponse } from '../types/index.js';

const router = express.Router();

/**
 * Middleware to check Google authentication
 */
const requireGoogleAuth = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
  if (!req.session.googleTokens) {
    res.status(401).json({
      success: false,
      message: 'Google 인증이 필요합니다.',
    } as ApiResponse);
    return;
  }
  next();
};

/**
 * Get list of available spreadsheets
 */
router.get('/list', requireGoogleAuth, async (req, res) => {
  try {
    const sheetsService = new GoogleSheetsService();
    sheetsService.init(
      req.session.googleTokens!.accessToken,
      req.session.googleTokens!.refreshToken
    );

    const spreadsheets = await sheetsService.getSpreadsheets();
    
    res.json({
      success: true,
      data: spreadsheets,
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to get spreadsheet list:', error);
    res.status(500).json({
      success: false,
      message: '스프레드시트 목록을 가져오는데 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Connect to a specific spreadsheet
 */
router.post('/connect', requireGoogleAuth, async (req, res) => {
  const { spreadsheetId } = req.body;

  if (!spreadsheetId) {
    return res.status(400).json({
      success: false,
      message: '스프레드시트 ID가 필요합니다.',
    } as ApiResponse);
  }

  try {
    const sheetsService = new GoogleSheetsService();
    sheetsService.init(
      req.session.googleTokens!.accessToken,
      req.session.googleTokens!.refreshToken
    );

    const sheets = await sheetsService.getSheets(spreadsheetId);
    
    // Store connected spreadsheet in session
    req.session.connectedSpreadsheet = {
      id: spreadsheetId,
      sheets,
    };

    res.json({
      success: true,
      data: { spreadsheetId, sheets },
      message: '스프레드시트가 성공적으로 연결되었습니다.',
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to connect spreadsheet:', error);
    res.status(500).json({
      success: false,
      message: '스프레드시트 연결에 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Get delivery orders from a specific sheet
 */
router.get('/data/:sheetName', requireGoogleAuth, async (req, res) => {
  const { sheetName } = req.params;

  if (!req.session.connectedSpreadsheet) {
    return res.status(400).json({
      success: false,
      message: '연결된 스프레드시트가 없습니다.',
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
      sheetName
    );

    res.json({
      success: true,
      data: orders,
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to get sheet data:', error);
    res.status(500).json({
      success: false,
      message: '시트 데이터를 가져오는데 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Update delivery status
 */
router.put('/data/:sheetName/status', requireGoogleAuth, async (req, res) => {
  const { sheetName } = req.params;
  const { rowIndex, status } = req.body;

  if (!req.session.connectedSpreadsheet) {
    return res.status(400).json({
      success: false,
      message: '연결된 스프레드시트가 없습니다.',
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
      sheetName,
      rowIndex,
      status
    );

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

/**
 * Test Google Sheets connection (development only)
 */
router.get('/test', async (req, res) => {
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      success: false,
      message: 'Test endpoint only available in development',
    } as ApiResponse);
  }

  try {
    // Mock successful Google Sheets connection for testing
    const mockSpreadsheets = [
      {
        id: 'test-spreadsheet-id-123',
        name: '배달 관리 테스트 시트',
        url: 'https://docs.google.com/spreadsheets/d/test-spreadsheet-id-123',
        createdTime: new Date().toISOString(),
      },
      {
        id: 'test-spreadsheet-id-456', 
        name: '주문 관리 시트',
        url: 'https://docs.google.com/spreadsheets/d/test-spreadsheet-id-456',
        createdTime: new Date().toISOString(),
      }
    ];

    res.json({
      success: true,
      data: {
        message: 'Google Sheets 연동 테스트 성공',
        spreadsheets: mockSpreadsheets,
        timestamp: new Date().toISOString(),
      },
    } as ApiResponse);
  } catch (error) {
    logger.error('Sheets test failed:', error);
    res.status(500).json({
      success: false,
      message: '테스트에 실패했습니다.',
    } as ApiResponse);
  }
});

/**
 * Create new staff sheet
 */
router.post('/staff', requireGoogleAuth, async (req, res) => {
  const { staffName } = req.body;

  if (!staffName) {
    return res.status(400).json({
      success: false,
      message: '배달담당자 이름이 필요합니다.',
    } as ApiResponse);
  }

  if (!req.session.connectedSpreadsheet) {
    return res.status(400).json({
      success: false,
      message: '연결된 스프레드시트가 없습니다.',
    } as ApiResponse);
  }

  try {
    const sheetsService = new GoogleSheetsService();
    sheetsService.init(
      req.session.googleTokens!.accessToken,
      req.session.googleTokens!.refreshToken
    );

    await sheetsService.createStaffSheet(
      req.session.connectedSpreadsheet!.id,
      staffName
    );

    res.json({
      success: true,
      message: `${staffName} 배달담당자 시트가 생성되었습니다.`,
    } as ApiResponse);
  } catch (error) {
    logger.error('Failed to create staff sheet:', error);
    res.status(500).json({
      success: false,
      message: '배달담당자 시트 생성에 실패했습니다.',
    } as ApiResponse);
  }
});

export default router;