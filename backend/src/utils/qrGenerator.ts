import QRCode from 'qrcode';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from '../config/index';
import { logger } from './logger';
import type { QRTokenPayload } from '../types/index.js';

export class QRGenerator {
  /**
   * Generate secure hash for QR token
   */
  private generateHash(staffName: string, timestamp: number): string {
    const data = `${staffName}|${timestamp}|${config.qrSecretKey}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate QR token payload
   */
  generateToken(staffName: string): string {
    const timestamp = Date.now();
    const hash = this.generateHash(staffName, timestamp);
    
    const payload: QRTokenPayload = {
      staffName,
      timestamp,
      hash,
    };

    return jwt.sign(payload, config.jwtSecret, { expiresIn: '24h' });
  }

  /**
   * Verify QR token
   */
  verifyToken(token: string): QRTokenPayload | null {
    try {
      const decoded = jwt.verify(token, config.jwtSecret) as QRTokenPayload;
      
      // Verify hash
      const expectedHash = this.generateHash(decoded.staffName, decoded.timestamp);
      if (decoded.hash !== expectedHash) {
        logger.warn('QR token hash verification failed');
        return null;
      }

      // Check if token is not too old (24 hours)
      const now = Date.now();
      const tokenAge = now - decoded.timestamp;
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours

      if (tokenAge > maxAge) {
        logger.warn('QR token expired');
        return null;
      }

      return decoded;
    } catch (error) {
      logger.warn('Invalid QR token:', error);
      return null;
    }
  }

  /**
   * Generate QR code URL for staff
   */
  generateQRUrl(staffName: string): string {
    const token = this.generateToken(staffName);
    return `${config.frontendUrl}/delivery/auth?staff=${encodeURIComponent(staffName)}&token=${token}`;
  }

  /**
   * Generate QR code image as base64 data URL
   */
  async generateQRImage(staffName: string): Promise<string> {
    try {
      const qrUrl = this.generateQRUrl(staffName);
      const qrCodeDataURL = await QRCode.toDataURL(qrUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 256,
      });

      logger.info(`QR code generated for staff: ${staffName}`);
      return qrCodeDataURL;
    } catch (error) {
      logger.error('Failed to generate QR code image:', error);
      throw new Error('QR 코드 생성에 실패했습니다.');
    }
  }

  /**
   * Generate QR code as buffer for download
   */
  async generateQRBuffer(staffName: string): Promise<Buffer> {
    try {
      const qrUrl = this.generateQRUrl(staffName);
      const buffer = await QRCode.toBuffer(qrUrl, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 512,
      });

      logger.info(`QR code buffer generated for staff: ${staffName}`);
      return buffer;
    } catch (error) {
      logger.error('Failed to generate QR code buffer:', error);
      throw new Error('QR 코드 생성에 실패했습니다.');
    }
  }
}