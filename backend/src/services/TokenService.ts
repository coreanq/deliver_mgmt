import { google } from 'googleapis'
import { createOAuth2Client } from '../config/google'

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
}

export default new TokenService()