import SecurityService from './SecurityService'

interface TokenData {
  access_token: string
  refresh_token?: string
  scope?: string
  token_type?: string
  expiry_date?: number
}

interface SecureTokenEntry {
  userId: string
  encryptedTokens: string
  createdAt: Date
  lastAccessed: Date
  expiresAt?: Date
}

/**
 * OAuth2 토큰 보안 저장소 서비스
 * 메모리 기반 (실제 프로덕션에서는 Redis나 보안 데이터베이스 사용 권장)
 */
export class TokenStorageService {
  private static tokenStore: Map<string, SecureTokenEntry> = new Map()
  private static cleanupInterval: NodeJS.Timeout

  static {
    // 1시간마다 만료된 토큰 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTokens()
    }, 60 * 60 * 1000)
  }

  /**
   * OAuth2 토큰을 암호화하여 저장
   */
  static storeTokens(userId: string, tokens: TokenData): string {
    try {
      // 토큰을 JSON 문자열로 변환 후 암호화
      const tokensJson = JSON.stringify(tokens)
      const encryptedTokens = SecurityService.encryptPhone(tokensJson) // 암호화 함수 재사용

      // 세션 키 생성
      const sessionKey = SecurityService.generateSecureRandomString(32)

      // 만료 시간 계산 (토큰의 expiry_date 또는 기본 2시간)
      const expiresAt = tokens.expiry_date 
        ? new Date(tokens.expiry_date)
        : new Date(Date.now() + 2 * 60 * 60 * 1000)

      const entry: SecureTokenEntry = {
        userId,
        encryptedTokens,
        createdAt: new Date(),
        lastAccessed: new Date(),
        expiresAt
      }

      this.tokenStore.set(sessionKey, entry)

      // 보안 감사 로그
      SecurityService.createAuditLog('TOKEN_STORED', userId, {
        sessionKey: sessionKey.substring(0, 8) + '...',
        expiresAt
      })

      return sessionKey
    } catch (error) {
      console.error('토큰 저장 실패:', error)
      throw new Error('토큰 저장에 실패했습니다.')
    }
  }

  /**
   * 저장된 토큰 복호화하여 조회
   */
  static retrieveTokens(sessionKey: string): TokenData | null {
    try {
      const entry = this.tokenStore.get(sessionKey)
      
      if (!entry) {
        return null
      }

      // 토큰 만료 확인
      if (entry.expiresAt && entry.expiresAt < new Date()) {
        this.tokenStore.delete(sessionKey)
        return null
      }

      // 마지막 접근 시간 업데이트
      entry.lastAccessed = new Date()

      // 토큰 복호화
      const decryptedTokensJson = SecurityService.decryptPhone(entry.encryptedTokens)
      const tokens = JSON.parse(decryptedTokensJson) as TokenData

      // 토큰 자체 만료 확인
      if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
        this.tokenStore.delete(sessionKey)
        return null
      }

      return tokens
    } catch (error) {
      console.error('토큰 조회 실패:', error)
      return null
    }
  }

  /**
   * 토큰 업데이트 (refresh 후)
   */
  static updateTokens(sessionKey: string, newTokens: TokenData): boolean {
    try {
      const entry = this.tokenStore.get(sessionKey)
      
      if (!entry) {
        return false
      }

      // 새 토큰을 암호화하여 저장
      const tokensJson = JSON.stringify(newTokens)
      const encryptedTokens = SecurityService.encryptPhone(tokensJson)

      entry.encryptedTokens = encryptedTokens
      entry.lastAccessed = new Date()
      
      // 새 만료 시간 설정
      if (newTokens.expiry_date) {
        entry.expiresAt = new Date(newTokens.expiry_date)
      }

      // 보안 감사 로그
      SecurityService.createAuditLog('TOKEN_UPDATED', entry.userId, {
        sessionKey: sessionKey.substring(0, 8) + '...',
        expiresAt: entry.expiresAt
      })

      return true
    } catch (error) {
      console.error('토큰 업데이트 실패:', error)
      return false
    }
  }

  /**
   * 토큰 삭제 (로그아웃)
   */
  static removeTokens(sessionKey: string): boolean {
    const entry = this.tokenStore.get(sessionKey)
    
    if (entry) {
      // 보안 감사 로그
      SecurityService.createAuditLog('TOKEN_REMOVED', entry.userId, {
        sessionKey: sessionKey.substring(0, 8) + '...'
      })
    }

    return this.tokenStore.delete(sessionKey)
  }

  /**
   * 사용자별 모든 토큰 삭제
   */
  static removeAllUserTokens(userId: string): number {
    let removedCount = 0
    
    for (const [sessionKey, entry] of this.tokenStore.entries()) {
      if (entry.userId === userId) {
        this.tokenStore.delete(sessionKey)
        removedCount++
      }
    }

    if (removedCount > 0) {
      SecurityService.createAuditLog('ALL_USER_TOKENS_REMOVED', userId, {
        removedCount
      })
    }

    return removedCount
  }

  /**
   * 만료된 토큰 정리
   */
  private static cleanupExpiredTokens(): void {
    const now = new Date()
    let cleanedCount = 0

    for (const [sessionKey, entry] of this.tokenStore.entries()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        this.tokenStore.delete(sessionKey)
        cleanedCount++
      }
      // 7일 이상 접근하지 않은 토큰도 정리
      else if (now.getTime() - entry.lastAccessed.getTime() > 7 * 24 * 60 * 60 * 1000) {
        this.tokenStore.delete(sessionKey)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`만료된 토큰 ${cleanedCount}개 정리 완료`)
    }
  }

  /**
   * 저장소 통계 조회
   */
  static getStorageStats(): {
    totalTokens: number
    expiredTokens: number
    activeTokens: number
    oldestToken: Date | null
  } {
    const now = new Date()
    let expiredCount = 0
    let oldestDate: Date | null = null

    for (const entry of this.tokenStore.values()) {
      if (entry.expiresAt && entry.expiresAt < now) {
        expiredCount++
      }

      if (!oldestDate || entry.createdAt < oldestDate) {
        oldestDate = entry.createdAt
      }
    }

    return {
      totalTokens: this.tokenStore.size,
      expiredTokens: expiredCount,
      activeTokens: this.tokenStore.size - expiredCount,
      oldestToken: oldestDate
    }
  }

  /**
   * 토큰 검증 (유효성 확인)
   */
  static validateTokenSession(sessionKey: string, expectedUserId?: string): boolean {
    const entry = this.tokenStore.get(sessionKey)
    
    if (!entry) {
      return false
    }

    // 만료 확인
    if (entry.expiresAt && entry.expiresAt < new Date()) {
      this.tokenStore.delete(sessionKey)
      return false
    }

    // 사용자 ID 확인 (제공된 경우)
    if (expectedUserId && entry.userId !== expectedUserId) {
      return false
    }

    return true
  }

  /**
   * 보안 위험 토큰 감지
   */
  static detectSuspiciousTokenActivity(): Array<{
    sessionKey: string
    userId: string
    reason: string
    lastAccessed: Date
  }> {
    const suspicious = []
    const now = new Date()

    for (const [sessionKey, entry] of this.tokenStore.entries()) {
      // 1시간 내에 너무 많은 접근
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
      if (entry.lastAccessed < oneHourAgo) {
        // 이 로직은 더 정교한 추적이 필요하지만 기본 구현
        continue
      }

      // 매우 오래된 토큰
      const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
      if (entry.createdAt < threeDaysAgo && entry.lastAccessed > oneHourAgo) {
        suspicious.push({
          sessionKey: sessionKey.substring(0, 8) + '...',
          userId: entry.userId,
          reason: '오래된 토큰의 비정상적 활동',
          lastAccessed: entry.lastAccessed
        })
      }
    }

    return suspicious
  }

  /**
   * 서비스 종료 시 정리
   */
  static destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
    this.tokenStore.clear()
  }
}

export default TokenStorageService