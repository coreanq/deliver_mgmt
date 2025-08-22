import { Request, Response, NextFunction } from 'express'
import { getClientIp } from './validation'

interface RateLimitEntry {
  count: number
  firstRequest: number
  blockUntil?: number
}

interface RateLimitOptions {
  windowMs: number      // 시간 윈도우 (밀리초)
  maxRequests: number   // 최대 요청 수
  blockDurationMs?: number // 블록 지속 시간 (밀리초)
  message?: string      // 제한 메시지
  skipSuccessfulRequests?: boolean // 성공한 요청은 제외
}

class RateLimiterService {
  private store: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // 5분마다 만료된 엔트리 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanup()
    }, 5 * 60 * 1000)
  }

  /**
   * 만료된 엔트리 정리
   */
  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.store.entries()) {
      // 블록이 해제되었거나 윈도우가 지난 엔트리 제거
      if (entry.blockUntil && entry.blockUntil < now) {
        this.store.delete(key)
      } else if (!entry.blockUntil && (now - entry.firstRequest) > 24 * 60 * 60 * 1000) { // 24시간 후 정리
        this.store.delete(key)
      }
    }
  }

  /**
   * Rate limit 체크
   */
  checkLimit(key: string, options: RateLimitOptions): {
    allowed: boolean
    count: number
    resetTime: number
    blockUntil?: number
  } {
    const now = Date.now()
    const entry = this.store.get(key)

    // 블록된 상태인지 확인
    if (entry?.blockUntil && entry.blockUntil > now) {
      return {
        allowed: false,
        count: entry.count,
        resetTime: entry.blockUntil,
        blockUntil: entry.blockUntil
      }
    }

    // 새로운 윈도우 시작 또는 첫 요청
    if (!entry || (now - entry.firstRequest) > options.windowMs) {
      const newEntry: RateLimitEntry = {
        count: 1,
        firstRequest: now
      }
      this.store.set(key, newEntry)
      
      return {
        allowed: true,
        count: 1,
        resetTime: now + options.windowMs
      }
    }

    // 기존 윈도우 내 요청 증가
    entry.count++
    
    // 제한 초과 시
    if (entry.count > options.maxRequests) {
      if (options.blockDurationMs) {
        entry.blockUntil = now + options.blockDurationMs
      }
      
      return {
        allowed: false,
        count: entry.count,
        resetTime: entry.firstRequest + options.windowMs,
        blockUntil: entry.blockUntil
      }
    }

    return {
      allowed: true,
      count: entry.count,
      resetTime: entry.firstRequest + options.windowMs
    }
  }

  /**
   * 특정 키의 제한 해제
   */
  resetLimit(key: string): void {
    this.store.delete(key)
  }

  /**
   * 모든 제한 해제
   */
  resetAll(): void {
    this.store.clear()
  }

  /**
   * 현재 상태 조회
   */
  getStatus(key: string): RateLimitEntry | undefined {
    return this.store.get(key)
  }

  /**
   * 정리 작업 중단
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }
  }
}

// 싱글톤 인스턴스
const rateLimiterService = new RateLimiterService()

/**
 * Rate Limiter 미들웨어 팩토리
 */
export const createRateLimit = (options: RateLimitOptions) => {
  return (req: Request, res: Response, next: NextFunction): void | Response => {
    const clientIp = getClientIp(req)
    const key = `${clientIp}:${req.route?.path || req.path}`

    const result = rateLimiterService.checkLimit(key, options)

    // Rate limit 헤더 설정
    res.setHeader('X-RateLimit-Limit', options.maxRequests)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - result.count))
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString())

    if (result.blockUntil) {
      res.setHeader('X-RateLimit-Retry-After', Math.ceil((result.blockUntil - Date.now()) / 1000))
    }

    if (!result.allowed) {
      const message = options.message || 'Too many requests, please try again later.'
      
      console.warn(`Rate limit exceeded for ${clientIp} on ${req.path}`, {
        count: result.count,
        limit: options.maxRequests,
        blockUntil: result.blockUntil ? new Date(result.blockUntil) : undefined
      })

      return res.status(429).json({
        success: false,
        message,
        retryAfter: result.blockUntil ? Math.ceil((result.blockUntil - Date.now()) / 1000) : undefined
      })
    }

    // 성공한 요청은 제외하는 옵션이 있는 경우
    if (options.skipSuccessfulRequests) {
      // response가 끝난 후 성공/실패 여부에 따라 카운트 조정
      const originalSend = res.send
      res.send = function(body: any) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // 성공한 요청의 카운트를 되돌림
          const entry = rateLimiterService.getStatus(key)
          if (entry) {
            entry.count = Math.max(0, entry.count - 1)
          }
        }
        return originalSend.call(this, body)
      }
    }

    return next()
  }
}

/**
 * 사전 정의된 Rate Limiter들
 */

// 일반 API 요청 제한 (1분에 60회)
export const generalRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 60,
  message: 'API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
})

// 인증 관련 요청 제한 (15분에 5회, 1시간 블록)
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  maxRequests: 5,
  blockDurationMs: 60 * 60 * 1000,
  message: '인증 시도가 너무 많습니다. 1시간 후 다시 시도해주세요.'
})

// QR 코드 생성 제한 (1분에 10회)
export const qrGenerateRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'QR 코드 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
})

// 메시지 발송 제한 (1시간에 50회)
export const messageRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 50,
  blockDurationMs: 2 * 60 * 60 * 1000,
  message: '메시지 발송 한도를 초과했습니다. 2시간 후 다시 시도해주세요.'
})

// 스프레드시트 연결 제한 (1시간에 20회)
export const spreadsheetConnectRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  maxRequests: 20,
  message: '스프레드시트 연결 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
})

// 배달 상태 업데이트 제한 (1분에 30회, 성공한 요청 제외)
export const deliveryUpdateRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  maxRequests: 30,
  skipSuccessfulRequests: true,
  message: '배달 상태 업데이트 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.'
})

export { rateLimiterService }