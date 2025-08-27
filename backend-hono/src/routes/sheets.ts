import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from '../services/googleSheets';
import { requireGoogleAuth } from '../middleware/auth';
import type { Env, ApiResponse, GoogleTokens, Variables, QRTokenPayload } from '../types';
import crypto from 'crypto';

const sheets = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes except status update
sheets.use('*', async (c, next) => {
  // Skip Google auth for status update endpoint if QR token is present
  if (c.req.path.includes('/status') && c.req.method === 'PUT') {
    const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token');
    if (token) {
      // Skip Google auth, handle QR token auth in the endpoint
      await next();
      return;
    }
  }
  // Apply Google auth for all other cases
  return requireGoogleAuth(c, next);
});

/**
 * Test Google Sheets connection
 */
sheets.get('/test', async (c) => {
  try {
    const sessionData = c.get('sessionData') as GoogleTokens;
    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    const spreadsheets = await sheetsService.getSpreadsheets();
    
    return c.json({
      success: true,
      message: 'Google Sheets 연동 테스트 성공!',
      data: {
        message: 'Google Sheets API에 정상적으로 연결되었습니다.',
        timestamp: new Date().toISOString(),
        spreadsheets: spreadsheets
      }
    } as ApiResponse);
  } catch (error: any) {
    console.error('Google Sheets test failed:', error);
    return c.json({
      success: false,
      message: 'Google Sheets 연동 테스트에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Get list of available spreadsheets
 */
sheets.get('/list', async (c) => {
  try {
    const sessionData = c.get('sessionData') as GoogleTokens;
    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    const spreadsheets = await sheetsService.getSpreadsheets();
    
    return c.json({
      success: true,
      data: spreadsheets,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get spreadsheet list:', error);
    return c.json({
      success: false,
      message: '스프레드시트 목록을 가져오는데 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Connect to a specific spreadsheet
 */
sheets.post('/connect', async (c) => {
  try {
    const { spreadsheetId } = await c.req.json();

    if (!spreadsheetId) {
      return c.json({
        success: false,
        message: '스프레드시트 ID가 필요합니다.',
      } as ApiResponse, 400);
    }

    const sessionData = c.get('sessionData') as GoogleTokens;
    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    const sheetList = await sheetsService.getSheets(spreadsheetId);
    
    // Store connected spreadsheet info in session (extend session data)
    const sessionId = c.get('sessionId') as string;
    const extendedSession = {
      ...sessionData,
      connectedSpreadsheet: {
        id: spreadsheetId,
        sheets: sheetList,
      }
    };
    
    await c.env.SESSIONS.put(sessionId, JSON.stringify(extendedSession), { expirationTtl: 86400 });

    return c.json({
      success: true,
      data: { spreadsheetId, sheets: sheetList },
      message: '스프레드시트가 성공적으로 연결되었습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to connect spreadsheet:', error);
    return c.json({
      success: false,
      message: '스프레드시트 연결에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Get delivery orders from a date-based sheet (YYYYMMDD format)
 */
sheets.get('/date/:date', async (c) => {
  const date = c.req.param('date');

  // Validate date format (YYYYMMDD)
  if (!/^\d{8}$/.test(date)) {
    return c.json({
      success: false,
      message: '날짜 형식이 올바르지 않습니다. YYYYMMDD 형식으로 입력해주세요.',
    } as ApiResponse, 400);
  }

  try {
    const sessionData = c.get('sessionData') as GoogleTokens;
    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    // First, try to find a spreadsheet with the date name
    const spreadsheets = await sheetsService.getSpreadsheets();
    const dateSpreadsheet = spreadsheets.find(sheet => sheet.name === date);

    if (dateSpreadsheet) {
      // Found spreadsheet with date name, get its first sheet's data
      console.log(`Found spreadsheet with date name: ${date}`);
      const sheets = await sheetsService.getSheets(dateSpreadsheet.id);
      
      if (sheets && sheets.length > 0) {
        const firstSheetName = sheets[0].title;
        const orders = await sheetsService.getDeliveryOrders(dateSpreadsheet.id, firstSheetName);
        
        return c.json({
          success: true,
          data: { orders, sheetName: firstSheetName, spreadsheetId: dateSpreadsheet.id },
          message: `${date} 날짜의 배달 주문을 조회했습니다.`,
        } as ApiResponse);
      }
    }

    // If no date-named spreadsheet found, return empty result
    return c.json({
      success: true,
      data: { orders: [], sheetName: date },
      message: `${date} 날짜의 스프레드시트를 찾을 수 없습니다.`,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get delivery orders:', error);
    return c.json({
      success: false,
      message: '배달 주문 목록을 가져오는데 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Get delivery orders grouped by staff from a date-based sheet
 */
sheets.get('/date/:date/by-staff', async (c) => {
  const date = c.req.param('date');

  // Validate date format (YYYYMMDD)
  if (!/^\d{8}$/.test(date)) {
    return c.json({
      success: false,
      message: '날짜 형식이 올바르지 않습니다. YYYYMMDD 형식으로 입력해주세요.',
    } as ApiResponse, 400);
  }

  try {
    const sessionData = c.get('sessionData') as GoogleTokens;
    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    // First, try to find a spreadsheet with the date name
    const spreadsheets = await sheetsService.getSpreadsheets();
    const dateSpreadsheet = spreadsheets.find(sheet => sheet.name === date);

    if (dateSpreadsheet) {
      console.log(`Found spreadsheet with date name: ${date}`);
      const sheets = await sheetsService.getSheets(dateSpreadsheet.id);
      
      if (sheets && sheets.length > 0) {
        const firstSheetName = sheets[0].title;
        const ordersByStaff = await sheetsService.getDeliveryOrdersByStaff(dateSpreadsheet.id, firstSheetName);
        const allOrders = await sheetsService.getDeliveryOrders(dateSpreadsheet.id, firstSheetName);
        const headers = allOrders.length > 0 ? Object.keys(allOrders[0]).filter(key => key !== 'rowIndex') : [];
        
        return c.json({
          success: true,
          data: { ordersByStaff, sheetName: firstSheetName, spreadsheetId: dateSpreadsheet.id },
          headers: headers,
          message: `${date} 날짜의 배달담당자별 주문을 조회했습니다.`,
        } as ApiResponse);
      }
    }

    // If no date-named spreadsheet found, return empty result
    return c.json({
      success: true,
      data: { ordersByStaff: {}, sheetName: date },
      message: `${date} 날짜의 스프레드시트를 찾을 수 없습니다.`,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get delivery orders by staff:', error);
    return c.json({
      success: false,
      message: '배달담당자별 주문 목록을 가져오는데 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Get delivery orders for a specific staff member from a date-based sheet
 */
sheets.get('/date/:date/staff/:staffName', async (c) => {
  const date = c.req.param('date');
  const staffName = decodeURIComponent(c.req.param('staffName'));

  // Validate date format (YYYYMMDD)
  if (!/^\d{8}$/.test(date)) {
    return c.json({
      success: false,
      message: '날짜 형식이 올바르지 않습니다. YYYYMMDD 형식으로 입력해주세요.',
    } as ApiResponse, 400);
  }

  try {
    console.log(`Staff endpoint called for date: ${date}, staff: ${staffName}`);
    const sessionData = c.get('sessionData') as GoogleTokens;
    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    // First, try to find a spreadsheet with the date name
    const spreadsheets = await sheetsService.getSpreadsheets();
    const dateSpreadsheet = spreadsheets.find(sheet => sheet.name === date);

    if (dateSpreadsheet) {
      console.log(`Found spreadsheet with date name: ${date}`);
      const sheets = await sheetsService.getSheets(dateSpreadsheet.id);
      
      if (sheets && sheets.length > 0) {
        const firstSheetName = sheets[0].title;
        const ordersByStaff = await sheetsService.getDeliveryOrdersByStaff(dateSpreadsheet.id, firstSheetName);
        const staffOrders = ordersByStaff[staffName] || [];
        
        return c.json({
          success: true,
          data: staffOrders,
          headers: staffOrders.length > 0 ? Object.keys(staffOrders[0]).filter(key => key !== 'rowIndex') : [],
          message: `${staffName}의 ${date} 배달 주문을 조회했습니다.`,
        } as ApiResponse);
      }
    }

    // If no date-named spreadsheet found, return empty result
    return c.json({
      success: true,
      data: [],
      headers: [],
      message: `${staffName}의 ${date} 날짜 스프레드시트를 찾을 수 없습니다.`,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get staff delivery orders:', error);
    return c.json({
      success: false,
      message: '배달담당자 주문 목록을 가져오는데 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Update delivery status
 */
sheets.put('/data/:date/status', async (c) => {
  const date = c.req.param('date');

  // Validate date format (YYYYMMDD)
  if (!/^\d{8}$/.test(date)) {
    return c.json({
      success: false,
      message: '날짜 형식이 올바르지 않습니다. YYYYMMDD 형식으로 입력해주세요.',
    } as ApiResponse, 400);
  }

  try {
    const { rowIndex, status } = await c.req.json();

    if (!rowIndex || !status) {
      return c.json({
        success: false,
        message: '행 번호와 상태가 필요합니다.',
      } as ApiResponse, 400);
    }

    // Check for QR token authentication
    const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token');
    let sessionData: any;

    if (token) {
      // QR token authentication
      try {
        const decoded = jwt.verify(token, 'your-jwt-secret') as QRTokenPayload;
        
        // Additional validation
        const now = Date.now();
        const tokenAge = now - decoded.timestamp;
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        if (tokenAge > maxAge) {
          return c.json({
            success: false,
            message: '토큰이 만료되었습니다.',
          } as ApiResponse, 401);
        }

        // Verify hash
        const expectedHash = crypto
          .createHash('sha256')
          .update(`${decoded.staffName}-${decoded.timestamp}`)
          .digest('hex');

        if (decoded.hash !== expectedHash) {
          return c.json({
            success: false,
            message: '유효하지 않은 토큰입니다.',
          } as ApiResponse, 401);
        }

        // For QR token, we need to find an active admin session
        // Look for active admin Google tokens in KV storage
        let adminSessionData = null;
        
        try {
          // Try to find the most recent admin session
          // In a production environment, you might want to store a reference to the admin session
          // For now, we'll try to find any valid Google session
          const kvKeys = await c.env.SESSIONS.list();
          
          for (const key of kvKeys.keys) {
            try {
              const sessionData = await c.env.SESSIONS.get(key.name);
              if (sessionData) {
                const parsed = JSON.parse(sessionData);
                if (parsed.accessToken && parsed.refreshToken) {
                  adminSessionData = parsed;
                  break; // Use the first valid session found
                }
              }
            } catch (e) {
              continue; // Skip invalid sessions
            }
          }
          
          if (!adminSessionData) {
            return c.json({
              success: false,
              message: '관리자 세션을 찾을 수 없습니다. 관리자가 먼저 로그인해주세요.',
            } as ApiResponse, 401);
          }
          
          sessionData = adminSessionData;
          
        } catch (error: any) {
          console.error('Failed to find admin session:', error);
          return c.json({
            success: false,
            message: '관리자 인증 확인 중 오류가 발생했습니다.',
          } as ApiResponse, 500);
        }
        
      } catch (error: any) {
        if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
          return c.json({
            success: false,
            message: '유효하지 않거나 만료된 토큰입니다.',
          } as ApiResponse, 401);
        }
        throw error;
      }
    } else {
      // Google OAuth authentication (existing logic)
      sessionData = c.get('sessionData') as any;
    }
    
    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    // Find spreadsheet by date name (same logic as other endpoints)
    const spreadsheets = await sheetsService.getSpreadsheets();
    const dateSpreadsheet = spreadsheets.find(sheet => sheet.name === date);
    
    if (!dateSpreadsheet) {
      return c.json({
        success: false,
        message: `${date} 날짜의 스프레드시트를 찾을 수 없습니다.`,
      } as ApiResponse, 400);
    }

    // Get the first sheet name
    const sheets = await sheetsService.getSheets(dateSpreadsheet.id);
    if (!sheets || sheets.length === 0) {
      return c.json({
        success: false,
        message: '스프레드시트에 시트가 없습니다.',
      } as ApiResponse, 400);
    }
    
    const firstSheetName = sheets[0].title;

    await sheetsService.updateDeliveryStatus(
      dateSpreadsheet.id,
      firstSheetName,
      rowIndex,
      status
    );
    
    return c.json({
      success: true,
      message: '배달 상태가 업데이트되었습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to update delivery status:', error);
    return c.json({
      success: false,
      message: '배달 상태 업데이트에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

export default sheets;