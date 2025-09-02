import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import type { Env, ApiResponse, QRTokenPayload } from '../types';
import crypto from 'crypto';

const delivery = new Hono<{ Bindings: Env }>();

/**
 * Generate QR code for staff authentication
 */
delivery.get('/qr/:staffName', async (c) => {
  const staffName = decodeURIComponent(c.req.param('staffName'));
  
  if (!staffName) {
    return c.json({
      success: false,
      message: '담당자 이름이 필요합니다.',
    } as ApiResponse, 400);
  }

  try {
    // Create a simple hash for additional security
    const timestamp = Date.now();
    const hash = crypto
      .createHash('sha256')
      .update(`${staffName}-${timestamp}`)
      .digest('hex');

    // JWT payload
    const payload: QRTokenPayload = {
      staffName,
      timestamp,
      hash,
    };

    // Create JWT token (24 hour expiry)
    const token = jwt.sign(payload, c.env.JWT_SECRET || 'fallback-jwt-secret', { expiresIn: '24h' });
    
    // Create QR code SVG (Cloudflare Workers compatible)
    const qrData = `${c.env.FRONTEND_URL}/delivery/auth?token=${token}`;
    const qrCodeSvg = await QRCode.toString(qrData, {
      type: 'svg',
      width: 300,
      margin: 2,
    });
    
    // Convert SVG to data URL
    const qrCodeDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrCodeSvg).toString('base64')}`;

    return c.json({
      success: true,
      data: {
        staffName,
        token,
        qrCodeDataUrl,
        expiresIn: '24시간',
      },
      message: '배송담당자 QR 코드가 생성되었습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to generate QR code:', error);
    return c.json({
      success: false,
      message: 'QR 코드 생성에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Generate QR code for staff mobile page with date (mobile-specific endpoint)
 */
delivery.post('/qr/generate-mobile/:staffName/:date', async (c) => {
  const staffName = decodeURIComponent(c.req.param('staffName'));
  const date = c.req.param('date');
  
  if (!staffName || !date) {
    return c.json({
      success: false,
      message: '배송담당자 이름과 날짜가 필요합니다.',
    } as ApiResponse, 400);
  }

  // Validate date format (YYYYMMDD)
  if (!/^\d{8}$/.test(date)) {
    return c.json({
      success: false,
      message: '날짜 형식이 올바르지 않습니다. YYYYMMDD 형식으로 입력해주세요.',
    } as ApiResponse, 400);
  }

  try {
    // Create a simple hash for additional security
    const timestamp = Date.now();
    const hash = crypto
      .createHash('sha256')
      .update(`${staffName}-${timestamp}`)
      .digest('hex');

    // JWT payload
    const payload: QRTokenPayload = {
      staffName,
      date,
      timestamp,
      hash,
    };

    // Create JWT token (24 hour expiry)
    const token = jwt.sign(payload, c.env.JWT_SECRET || 'fallback-jwt-secret', { expiresIn: '24h' });
    
    // Generate URL for staff mobile page with date
    const qrUrl = `${c.env.FRONTEND_URL}/delivery/${date}/${encodeURIComponent(staffName)}?token=${token}`;
    
    // Create QR code SVG (Cloudflare Workers compatible)
    const qrCodeSvg = await QRCode.toString(qrUrl, {
      type: 'svg',
      width: 300,
      margin: 2,
    });
    
    // Convert SVG to data URL
    const qrCodeDataUrl = `data:image/svg+xml;base64,${Buffer.from(qrCodeSvg).toString('base64')}`;

    return c.json({
      success: true,
      data: {
        qrImage: qrCodeDataUrl,
        qrUrl,
        staffName,
        date,
      },
      message: '담당자별 모바일 QR 코드가 생성되었습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to generate mobile QR code:', error);
    return c.json({
      success: false,
      message: 'QR 코드 생성에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Verify QR code token (GET endpoint for URL-based verification)
 */
delivery.get('/qr/verify/:token', async (c) => {
  const token = c.req.param('token');
  
  if (!token) {
    return c.json({
      success: false,
      message: '토큰이 필요합니다.',
    } as ApiResponse, 400);
  }

  try {
    // Verify JWT token
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

    return c.json({
      success: true,
      data: {
        staffName: decoded.staffName,
        validUntil: new Date(decoded.timestamp + maxAge).toISOString(),
      },
      message: 'QR 코드 인증이 완료되었습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to verify QR token:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return c.json({
        success: false,
        message: '유효하지 않은 토큰입니다.',
      } as ApiResponse, 401);
    }
    
    if (error.name === 'TokenExpiredError') {
      return c.json({
        success: false,
        message: '토큰이 만료되었습니다.',
      } as ApiResponse, 401);
    }

    return c.json({
      success: false,
      message: 'QR 코드 검증에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Verify QR code token (POST endpoint for body-based verification)
 */
delivery.post('/qr/verify', async (c) => {
  try {
    const { token } = await c.req.json();
    
    if (!token) {
      return c.json({
        success: false,
        message: '토큰이 필요합니다.',
      } as ApiResponse, 400);
    }

    // Verify JWT token
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

    return c.json({
      success: true,
      data: {
        staffName: decoded.staffName,
        validUntil: new Date(decoded.timestamp + maxAge).toISOString(),
      },
      message: 'QR 코드 인증이 완료되었습니다.',
    } as ApiResponse);
  } catch (error: any) {
    console.error('Failed to verify QR token:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return c.json({
        success: false,
        message: '유효하지 않은 토큰입니다.',
      } as ApiResponse, 401);
    }
    
    if (error.name === 'TokenExpiredError') {
      return c.json({
        success: false,
        message: '토큰이 만료되었습니다.',
      } as ApiResponse, 401);
    }

    return c.json({
      success: false,
      message: 'QR 코드 검증에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

/**
 * Update delivery status for staff (with QR token authentication)
 */
delivery.put('/status/:date/:staffName/:rowIndex/:status', async (c) => {
  const date = c.req.param('date');
  const staffName = decodeURIComponent(c.req.param('staffName'));
  const rowIndex = parseInt(c.req.param('rowIndex'));
  const status = decodeURIComponent(c.req.param('status'));
  const token = c.req.header('Authorization')?.replace('Bearer ', '') || c.req.query('token');

  // Validate date format (YYYYMMDD)
  if (!/^\d{8}$/.test(date)) {
    return c.json({
      success: false,
      message: '날짜 형식이 올바르지 않습니다. YYYYMMDD 형식으로 입력해주세요.',
    } as ApiResponse, 400);
  }

  if (!token) {
    return c.json({
      success: false,
      message: 'QR 토큰이 필요합니다.',
    } as ApiResponse, 401);
  }

  if (!rowIndex || !status) {
    return c.json({
      success: false,
      message: '행 번호와 상태가 필요합니다.',
    } as ApiResponse, 400);
  }

  try {
    // Verify QR token first
    const decoded = jwt.verify(token, c.env.JWT_SECRET || 'fallback-jwt-secret') as QRTokenPayload;
    
    // Verify staff name matches token
    if (decoded.staffName !== staffName) {
      return c.json({
        success: false,
        message: '토큰의 담당자 정보가 일치하지 않습니다.',
      } as ApiResponse, 401);
    }

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

    // For this endpoint, we need to get Google credentials from environment
    // This is a limitation - we need Google credentials to update sheets
    // For now, we'll return a success response but won't actually update
    // TODO: Implement a way to get admin Google credentials for sheet updates
    
    return c.json({
      success: false,
      message: '이 기능은 현재 구현 중입니다. 관리자 페이지를 사용해주세요.',
    } as ApiResponse, 501);
    
  } catch (error: any) {
    console.error('Failed to update delivery status:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return c.json({
        success: false,
        message: '유효하지 않은 토큰입니다.',
      } as ApiResponse, 401);
    }
    
    if (error.name === 'TokenExpiredError') {
      return c.json({
        success: false,
        message: '토큰이 만료되었습니다.',
      } as ApiResponse, 401);
    }

    return c.json({
      success: false,
      message: '배송 상태 업데이트에 실패했습니다.',
      error: error.message,
    } as ApiResponse, 500);
  }
});

export default delivery;