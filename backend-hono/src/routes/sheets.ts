import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from '../services/googleSheets';
import { UnifiedUserService } from '../services/unifiedUserService';
import { requireGoogleAuth } from '../middleware/auth';
import type { Env, ApiResponse, GoogleTokens, Variables, QRTokenPayload } from '../types';
import crypto from 'crypto';

const sheets = new Hono<{ Bindings: Env; Variables: Variables }>();

// Apply auth middleware to all routes except status update and QR token staff access
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
  
  // Skip Google auth for staff data access if QR token is present
  if (c.req.path.includes('/staff/') && c.req.method === 'GET') {
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
    sheetsService.init(sessionData.accessToken!, sessionData.refreshToken!);

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
    sheetsService.init(sessionData.accessToken!, sessionData.refreshToken!);

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
    sheetsService.init(sessionData.accessToken!, sessionData.refreshToken!);

    const sheetList = await sheetsService.getSheets(spreadsheetId);
    
    // Save connected spreadsheet info into unified user data (unified storage)
    const sessionId = c.get('sessionId') as string;
    const unifiedUserService = new UnifiedUserService(c.env);
    const userData = await unifiedUserService.getSessionBasedUserData(sessionId);

    if (userData) {
      userData.connectedSpreadsheet = {
        id: spreadsheetId,
        sheets: sheetList,
      };
      // Persist to unified storage and refresh session mapping
      await unifiedUserService.saveUserData(userData);
      await unifiedUserService.saveSessionBasedUserData(sessionId, userData);
    }

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
    sheetsService.init(sessionData.accessToken!, sessionData.refreshToken!);

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
          message: `${date} 날짜의 배송 주문을 조회했습니다.`,
        } as ApiResponse);
      }
    }

    // If no date-named spreadsheet found, try to find a sheet with the date name in available spreadsheets
    for (const spreadsheet of spreadsheets) {
      try {
        const sheets = await sheetsService.getSheets(spreadsheet.id);
        const dateSheet = sheets.find(sheet => sheet.title === date);
        
        if (dateSheet) {
          console.log(`Found sheet with date name: ${date} in spreadsheet: ${spreadsheet.name}`);
          const orders = await sheetsService.getDeliveryOrders(spreadsheet.id, dateSheet.title);
          
          return c.json({
            success: true,
            data: { orders, sheetName: dateSheet.title, spreadsheetId: spreadsheet.id },
            message: `${date} 날짜의 배송 주문을 조회했습니다.`,
          } as ApiResponse);
        }
      } catch (error) {
        console.log(`Error checking sheets in spreadsheet ${spreadsheet.name}:`, error);
        continue;
      }
    }

    // If no date-named sheet found, return empty result
    return c.json({
      success: true,
      data: { orders: [], sheetName: date },
      message: `${date} 날짜의 스프레드시트를 찾을 수 없습니다.`,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get delivery orders:', error);
    return c.json({
      success: false,
      message: '배송 주문 목록을 가져오는데 실패했습니다.',
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
    sheetsService.init(sessionData.accessToken!, sessionData.refreshToken!);

    // First, try to find a spreadsheet with the date name
    const spreadsheets = await sheetsService.getSpreadsheets();
    console.log(`Available spreadsheets:`, spreadsheets.map(s => s.name));
    console.log(`Looking for spreadsheet with name: ${date}`);
    const dateSpreadsheet = spreadsheets.find(sheet => sheet.name === date);

    if (dateSpreadsheet) {
      console.log(`Found spreadsheet with date name: ${date}`);
      const sheets = await sheetsService.getSheets(dateSpreadsheet.id);
      
      if (sheets && sheets.length > 0) {
        const firstSheetName = sheets[0].title;
        console.log(`Using first sheet: ${firstSheetName}`);
        const ordersByStaff = await sheetsService.getDeliveryOrdersByStaff(dateSpreadsheet.id, firstSheetName);
        const allOrders = await sheetsService.getDeliveryOrders(dateSpreadsheet.id, firstSheetName);
        const headers = allOrders.length > 0 ? Object.keys(allOrders[0]).filter(key => key !== 'rowIndex') : [];
        
        console.log(`Found ${Object.keys(ordersByStaff).length} staff members with ${allOrders.length} total orders`);
        
        return c.json({
          success: true,
          data: { ordersByStaff, sheetName: firstSheetName, spreadsheetId: dateSpreadsheet.id },
          headers: headers,
          message: `${date} 날짜의 배송담당자별 주문을 조회했습니다.`,
        } as ApiResponse);
      }
    }

    // If no date-named spreadsheet found, try to find a sheet with the date name in available spreadsheets
    console.log(`No spreadsheet named ${date} found, checking sheets within each spreadsheet...`);
    for (const spreadsheet of spreadsheets) {
      try {
        console.log(`Checking sheets in spreadsheet: ${spreadsheet.name}`);
        const sheets = await sheetsService.getSheets(spreadsheet.id);
        console.log(`Sheets in ${spreadsheet.name}:`, sheets.map(s => s.title));
        const dateSheet = sheets.find(sheet => sheet.title === date);
        
        if (dateSheet) {
          console.log(`Found sheet with date name: ${date} in spreadsheet: ${spreadsheet.name}`);
          const ordersByStaff = await sheetsService.getDeliveryOrdersByStaff(spreadsheet.id, dateSheet.title);
          const allOrders = await sheetsService.getDeliveryOrders(spreadsheet.id, dateSheet.title);
          const headers = allOrders.length > 0 ? Object.keys(allOrders[0]).filter(key => key !== 'rowIndex') : [];
          
          console.log(`Found ${Object.keys(ordersByStaff).length} staff members with ${allOrders.length} total orders in sheet ${dateSheet.title}`);
          
          return c.json({
            success: true,
            data: { ordersByStaff, sheetName: dateSheet.title, spreadsheetId: spreadsheet.id },
            headers: headers,
            message: `${date} 날짜의 배송담당자별 주문을 조회했습니다.`,
          } as ApiResponse);
        }
      } catch (error) {
        console.log(`Error checking sheets in spreadsheet ${spreadsheet.name}:`, error);
        continue;
      }
    }

    // If no date-named sheet found, return empty result
    return c.json({
      success: true,
      data: { ordersByStaff: {}, sheetName: date },
      message: `${date} 날짜의 스프레드시트나 시트를 찾을 수 없습니다.`,
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to get delivery orders by staff:', error);
    return c.json({
      success: false,
      message: '배송담당자별 주문 목록을 가져오는데 실패했습니다.',
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
    
    // Check for QR token authentication first
    const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token');
    let sessionData: any;

    if (token) {
      console.log(`QR token provided for staff access: ${staffName}`);
      // QR token authentication
      try {
        const decoded = jwt.verify(token, c.env.JWT_SECRET || 'fallback-jwt-secret') as QRTokenPayload;
        
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

        // Verify staff name matches token
        if (decoded.staffName !== staffName) {
          return c.json({
            success: false,
            message: '토큰의 담당자 정보가 일치하지 않습니다.',
          } as ApiResponse, 401);
        }

        // For QR token, we need to find an active admin session
        let adminSessionData = null;
        
        try {
          const kvKeys = await c.env.SESSIONS.list();
          
          console.log(`Searching for admin session among ${kvKeys.keys.length} sessions`);
          
          for (const key of kvKeys.keys) {
            try {
              const sessionDataStr = await c.env.SESSIONS.get(key.name);
              if (sessionDataStr) {
                const parsed = JSON.parse(sessionDataStr);
                console.log(`Checking session ${key.name}:`, { hasAccessToken: !!parsed.accessToken, hasRefreshToken: !!parsed.refreshToken });
                if (parsed.accessToken && parsed.refreshToken) {
                  // Verify the session is not expired
                  if (parsed.expiryDate && new Date(parsed.expiryDate) > new Date()) {
                    adminSessionData = parsed;
                    console.log(`Found valid admin session: ${key.name}`);
                    break;
                  } else if (!parsed.expiryDate) {
                    // Fallback for sessions without expiry date
                    adminSessionData = parsed;
                    console.log(`Found admin session without expiry: ${key.name}`);
                    break;
                  }
                }
              }
            } catch (e) {
              console.error(`Error parsing session ${key.name}:`, e);
              continue;
            }
          }
          
          if (!adminSessionData) {
            return c.json({
              success: false,
              message: '유효한 관리자 세션을 찾을 수 없습니다. 관리자가 먼저 Google 인증을 완료해주세요.',
            } as ApiResponse, 401);
          }
          
          sessionData = adminSessionData;
          console.log(`Using admin session for QR token access: ${staffName}`);
          
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
      sessionData = c.get('sessionData') as GoogleTokens;
    }

    const sheetsService = new GoogleSheetsService(c.env);
    sheetsService.init(sessionData.accessToken!, sessionData.refreshToken!);

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
          message: `${staffName}의 ${date} 배송 주문을 조회했습니다.`,
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
      message: '배송담당자 주문 목록을 가져오는데 실패했습니다.',
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
        const decoded = jwt.verify(token, c.env.JWT_SECRET || 'fallback-jwt-secret') as QRTokenPayload;
        
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
          const kvKeys = await c.env.SESSIONS.list();
          
          console.log(`[Status Update] Searching for admin session among ${kvKeys.keys.length} sessions`);
          
          for (const key of kvKeys.keys) {
            try {
              const sessionDataStr = await c.env.SESSIONS.get(key.name);
              if (sessionDataStr) {
                const parsed = JSON.parse(sessionDataStr);
                console.log(`[Status Update] Checking session ${key.name}:`, { hasAccessToken: !!parsed.accessToken, hasRefreshToken: !!parsed.refreshToken });
                if (parsed.accessToken && parsed.refreshToken) {
                  // Verify the session is not expired
                  if (parsed.expiryDate && new Date(parsed.expiryDate) > new Date()) {
                    adminSessionData = parsed;
                    console.log(`[Status Update] Found valid admin session: ${key.name}`);
                    break;
                  } else if (!parsed.expiryDate) {
                    // Fallback for sessions without expiry date
                    adminSessionData = parsed;
                    console.log(`[Status Update] Found admin session without expiry: ${key.name}`);
                    break;
                  }
                }
              }
            } catch (e) {
              console.error(`[Status Update] Error parsing session ${key.name}:`, e);
              continue;
            }
          }
          
          if (!adminSessionData) {
            return c.json({
              success: false,
              message: '유효한 관리자 세션을 찾을 수 없습니다. 관리자가 먼저 Google 인증을 완료해주세요.',
            } as ApiResponse, 401);
          }
          
          sessionData = adminSessionData;
          console.log(`[Status Update] Using admin session for QR token`);
          
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
    sheetsService.init(sessionData.accessToken!, sessionData.refreshToken!);

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
      message: '배송 상태가 업데이트되었습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to update delivery status:', error);
    return c.json({
      success: false,
      message: '배송 상태 업데이트에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

export default sheets;
