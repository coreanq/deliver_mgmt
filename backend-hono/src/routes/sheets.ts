import { Hono } from 'hono';
import { GoogleSheetsService } from '../services/googleSheets';
import { requireGoogleAuth } from '../middleware/auth';
import type { Env, ApiResponse, GoogleTokens, Variables } from '../types';

const sheets = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes
sheets.use('*', requireGoogleAuth);

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
    const sessionData = c.get('sessionData') as any; // Extended with connectedSpreadsheet
    
    if (!sessionData.connectedSpreadsheet?.id) {
      return c.json({
        success: false,
        message: '연결된 스프레드시트가 없습니다.',
      } as ApiResponse, 400);
    }

    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    // Try to get orders from date-named sheet
    try {
      const orders = await sheetsService.getDeliveryOrders(sessionData.connectedSpreadsheet.id, date);
      
      return c.json({
        success: true,
        data: { orders, sheetName: date },
        message: `${date} 날짜의 배달 주문을 조회했습니다.`,
      } as ApiResponse);
    } catch (sheetError) {
      // If date sheet doesn't exist, return empty orders
      return c.json({
        success: true,
        data: { orders: [], sheetName: date },
        message: `${date} 날짜의 시트를 찾을 수 없습니다.`,
      } as ApiResponse);
    }
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
    const sessionData = c.get('sessionData') as any;
    
    if (!sessionData.connectedSpreadsheet?.id) {
      return c.json({
        success: false,
        message: '연결된 스프레드시트가 없습니다.',
      } as ApiResponse, 400);
    }

    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    try {
      const ordersByStaff = await sheetsService.getDeliveryOrdersByStaff(sessionData.connectedSpreadsheet.id, date);
      
      return c.json({
        success: true,
        data: { ordersByStaff, sheetName: date },
        message: `${date} 날짜의 배달담당자별 주문을 조회했습니다.`,
      } as ApiResponse);
    } catch (sheetError) {
      return c.json({
        success: true,
        data: { ordersByStaff: {}, sheetName: date },
        message: `${date} 날짜의 시트를 찾을 수 없습니다.`,
      } as ApiResponse);
    }
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
    const sessionData = c.get('sessionData') as any;
    
    if (!sessionData.connectedSpreadsheet?.id) {
      return c.json({
        success: false,
        message: '연결된 스프레드시트가 없습니다.',
      } as ApiResponse, 400);
    }

    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    const ordersByStaff = await sheetsService.getDeliveryOrdersByStaff(sessionData.connectedSpreadsheet.id, date);
    const staffOrders = ordersByStaff[staffName] || [];
    
    return c.json({
      success: true,
      data: { orders: staffOrders, staffName, sheetName: date },
      message: `${staffName}의 ${date} 배달 주문을 조회했습니다.`,
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

    const sessionData = c.get('sessionData') as any;
    
    if (!sessionData.connectedSpreadsheet?.id) {
      return c.json({
        success: false,
        message: '연결된 스프레드시트가 없습니다.',
      } as ApiResponse, 400);
    }

    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken, sessionData.refreshToken);

    await sheetsService.updateDeliveryStatus(
      sessionData.connectedSpreadsheet.id,
      date,
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