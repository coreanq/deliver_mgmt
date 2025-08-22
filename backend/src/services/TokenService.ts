import { google } from 'googleapis'
import { createOAuth2Client } from '../config/google'
import jwt from 'jsonwebtoken'
import QRCode from 'qrcode'

export class TokenService {
  private oauth2Client: any

  constructor() {
    this.oauth2Client = createOAuth2Client()
  }

  /**
   * 토큰이 유효한지 확인
   */
  async isTokenValid(tokens: any): Promise<boolean> {
    try {
      if (!tokens || !tokens.access_token) {
        return false
      }

      this.oauth2Client.setCredentials(tokens)
      
      // 토큰 정보 확인
      const tokenInfo = await this.oauth2Client.getTokenInfo(tokens.access_token)
      return !!tokenInfo
    } catch (error) {
      console.error('토큰 유효성 확인 실패:', error)
      return false
    }
  }

  /**
   * 액세스 토큰 갱신
   */
  async refreshAccessToken(tokens: any): Promise<any> {
    try {
      if (!tokens.refresh_token) {
        throw new Error('리프레시 토큰이 없습니다.')
      }

      this.oauth2Client.setCredentials(tokens)
      const { credentials } = await this.oauth2Client.refreshAccessToken()
      
      return {
        ...tokens,
        access_token: credentials.access_token,
        expiry_date: credentials.expiry_date
      }
    } catch (error) {
      console.error('토큰 갱신 실패:', error)
      throw error
    }
  }

  /**
   * 유효한 OAuth2 클라이언트 반환
   */
  async getAuthenticatedClient(tokens: any): Promise<any> {
    try {
      // 토큰 유효성 확인
      let validTokens = tokens

      const isValid = await this.isTokenValid(tokens)
      
      if (!isValid && tokens.refresh_token) {
        // 토큰 갱신 시도
        validTokens = await this.refreshAccessToken(tokens)
      } else if (!isValid) {
        throw new Error('유효하지 않은 토큰입니다. 재인증이 필요합니다.')
      }

      this.oauth2Client.setCredentials(validTokens)
      return { client: this.oauth2Client, tokens: validTokens }
    } catch (error) {
      console.error('인증된 클라이언트 생성 실패:', error)
      throw error
    }
  }

  /**
   * 토큰 만료 시간 확인
   */
  getTokenExpiry(tokens: any): Date | null {
    if (!tokens || !tokens.expiry_date) {
      return null
    }
    return new Date(tokens.expiry_date)
  }

  /**
   * 토큰이 곧 만료되는지 확인 (10분 전)
   */
  isTokenExpiringSoon(tokens: any): boolean {
    const expiry = this.getTokenExpiry(tokens)
    if (!expiry) return true

    const now = new Date()
    const tenMinutesFromNow = new Date(now.getTime() + 10 * 60 * 1000)
    
    return expiry <= tenMinutesFromNow
  }

  /**
   * 보안 강화된 JWT 토큰 생성 (배달기사용)
   */
  generateStaffToken(staffName: string, workDate?: string, sheetName?: string): string {
    const secretKey = process.env.QR_SECRET_KEY || process.env.JWT_SECRET
    if (!secretKey) {
      throw new Error('QR_SECRET_KEY 또는 JWT_SECRET이 설정되지 않았습니다.')
    }

    // 입력값 검증
    if (!staffName || typeof staffName !== 'string' || staffName.trim().length === 0) {
      throw new Error('유효하지 않은 배달기사 이름입니다.')
    }

    const sanitizedStaffName = staffName.trim().slice(0, 50) // 최대 50자 제한
    const today = new Date().toISOString().split('T')[0]
    const targetDate = workDate || today
    const jti = this.generateJti() // 토큰 고유 ID

    const payload = {
      staff: sanitizedStaffName,
      workDate: targetDate,
      sheet: sheetName || sanitizedStaffName,
      type: 'delivery_staff',
      createdDate: today,
      jti, // JWT ID for uniqueness and revocation
      iss: 'deliver-mgmt-system', // issuer
      aud: 'delivery-staff', // audience
      iat: Math.floor(Date.now() / 1000)
    }

    return jwt.sign(payload, secretKey, { 
      expiresIn: '7d', // 1주일로 단축 (보안 강화)
      algorithm: 'HS256',
      issuer: 'deliver-mgmt-system',
      audience: 'delivery-staff'
    })
  }

  /**
   * 관리자용 JWT 토큰 생성
   */
  generateAdminToken(userId: string, email: string): string {
    const secretKey = process.env.JWT_SECRET
    if (!secretKey) {
      throw new Error('JWT_SECRET이 설정되지 않았습니다.')
    }

    // 입력값 검증
    if (!userId || !email) {
      throw new Error('유효하지 않은 사용자 정보입니다.')
    }

    const jti = this.generateJti()
    
    const payload = {
      userId: userId.trim(),
      email: email.trim(),
      type: 'admin',
      jti,
      iss: 'deliver-mgmt-system',
      aud: 'admin',
      iat: Math.floor(Date.now() / 1000)
    }

    return jwt.sign(payload, secretKey, { 
      expiresIn: '1d', // 관리자는 1일
      algorithm: 'HS256',
      issuer: 'deliver-mgmt-system',
      audience: 'admin'
    })
  }

  /**
   * JWT 토큰 고유 ID 생성
   */
  private generateJti(): string {
    return require('crypto').randomBytes(16).toString('hex')
  }

  /**
   * 보안 강화된 JWT 토큰 검증
   */
  verifyToken(token: string, expectedAudience?: string): any {
    try {
      const secretKey = process.env.QR_SECRET_KEY || process.env.JWT_SECRET
      if (!secretKey) {
        throw new Error('JWT_SECRET이 설정되지 않았습니다.')
      }

      // 토큰 형식 검증
      if (!token || typeof token !== 'string') {
        throw new Error('유효하지 않은 토큰 형식입니다.')
      }

      const decoded = jwt.verify(token, secretKey, {
        issuer: 'deliver-mgmt-system',
        audience: expectedAudience,
        algorithms: ['HS256']
      }) as any

      // 추가 검증
      this.validateTokenClaims(decoded, expectedAudience)

      return decoded
    } catch (error) {
      console.error('토큰 검증 실패:', error)
      if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('유효하지 않은 토큰입니다.')
      } else if (error instanceof jwt.TokenExpiredError) {
        throw new Error('토큰이 만료되었습니다.')
      } else if (error instanceof jwt.NotBeforeError) {
        throw new Error('토큰이 아직 활성화되지 않았습니다.')
      }
      throw error
    }
  }

  /**
   * 배달기사용 JWT 토큰 검증 (하위 호환성)
   */
  verifyStaffToken(token: string): any {
    return this.verifyToken(token, 'delivery-staff')
  }

  /**
   * 관리자용 JWT 토큰 검증
   */
  verifyAdminToken(token: string): any {
    return this.verifyToken(token, 'admin')
  }

  /**
   * 토큰 클레임 추가 검증
   */
  private validateTokenClaims(decoded: any, expectedAudience?: string): void {
    // 필수 클레임 검증
    if (!decoded.jti) {
      throw new Error('토큰 ID가 없습니다.')
    }

    if (!decoded.type) {
      throw new Error('토큰 타입이 없습니다.')
    }

    // audience 검증
    if (expectedAudience && decoded.aud !== expectedAudience) {
      throw new Error('토큰 대상이 일치하지 않습니다.')
    }

    // 토큰 타입별 추가 검증
    if (decoded.type === 'delivery_staff') {
      if (!decoded.staff) {
        throw new Error('배달기사 정보가 없습니다.')
      }
    } else if (decoded.type === 'admin') {
      if (!decoded.userId || !decoded.email) {
        throw new Error('관리자 정보가 없습니다.')
      }
    }
  }

  /**
   * 배달기사용 QR 코드 URL 생성 (날짜 정보 포함)
   */
  generateStaffQrUrl(staffName: string, workDate?: string, sheetName?: string): string {
    const token = this.generateStaffToken(staffName, workDate, sheetName)
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000'
    
    return `${frontendUrl}/delivery?staff=${encodeURIComponent(staffName)}&workDate=${workDate || new Date().toISOString().split('T')[0]}&token=${token}`
  }

  /**
   * 배달기사용 QR 코드 이미지 생성 (Data URL)
   */
  async generateStaffQrCode(staffName: string, workDate?: string, sheetName?: string): Promise<string> {
    try {
      const url = this.generateStaffQrUrl(staffName, workDate, sheetName)
      return await QRCode.toDataURL(url, {
        errorCorrectionLevel: 'M',
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        width: 256
      })
    } catch (error) {
      console.error('QR 코드 생성 실패:', error)
      throw new Error('QR 코드 생성에 실패했습니다.')
    }
  }

  /**
   * QR 코드에서 추출한 정보 검증
   */
  validateQrCodeData(staffName: string, token: string): boolean {
    try {
      const decoded = this.verifyStaffToken(token)
      
      // 토큰의 배달기사 이름과 요청된 이름이 일치하는지 확인
      if (decoded.staff !== staffName) {
        console.error('토큰의 배달기사 이름이 일치하지 않습니다:', { 
          tokenStaff: decoded.staff, 
          requestStaff: staffName 
        })
        return false
      }

      // 토큰 타입 확인
      if (decoded.type !== 'delivery_staff') {
        console.error('잘못된 토큰 타입입니다:', decoded.type)
        return false
      }

      return true
    } catch (error) {
      console.error('QR 코드 데이터 검증 실패:', error)
      return false
    }
  }
}

export default new TokenService()