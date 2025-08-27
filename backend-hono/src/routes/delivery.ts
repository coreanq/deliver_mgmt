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
    const token = jwt.sign(payload, 'your-jwt-secret', { expiresIn: '24h' });
    
    // Create QR code data URL
    const qrData = `${c.env.FRONTEND_URL}/delivery/auth?token=${token}`;
    const qrCodeDataUrl = await QRCode.toDataURL(qrData, {
      width: 300,
      margin: 2,
    });

    return c.json({
      success: true,
      data: {
        staffName,
        token,
        qrCodeDataUrl,
        expiresIn: '24시간',
      },
      message: '배달담당자 QR 코드가 생성되었습니다.',
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
 * Verify QR code token
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

export default delivery;