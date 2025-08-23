// 프론트엔드 에러 추적 시스템

export interface ErrorContext {
  userId?: string
  sessionId?: string
  route?: string
  userAgent?: string
  timestamp?: string
  [key: string]: any
}

export interface ErrorReport {
  message: string
  stack?: string
  level: 'error' | 'warn' | 'info'
  context: ErrorContext
  fingerprint: string
}

export class ErrorTracker {
  private static instance: ErrorTracker
  private apiBaseUrl: string
  private errorQueue: ErrorReport[] = []
  private maxQueueSize = 50
  private flushInterval = 30000 // 30초마다 전송
  private isOnline = navigator.onLine

  constructor() {
    this.apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001'
    this.setupGlobalErrorHandlers()
    this.setupPeriodicFlush()
    this.setupNetworkStatusListener()
  }

  static getInstance(): ErrorTracker {
    if (!ErrorTracker.instance) {
      ErrorTracker.instance = new ErrorTracker()
    }
    return ErrorTracker.instance
  }

  /**
   * 전역 에러 핸들러 설정
   */
  private setupGlobalErrorHandlers(): void {
    // 일반 JavaScript 에러 처리
    window.addEventListener('error', (event) => {
      this.captureError(event.error || new Error(event.message), {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        source: 'window.error'
      })
    })

    // Promise rejection 에러 처리
    window.addEventListener('unhandledrejection', (event) => {
      this.captureError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          type: 'unhandledrejection',
          source: 'promise'
        }
      )
    })

    // Vue 에러 핸들러는 main.ts에서 설정
  }

  /**
   * 네트워크 상태 리스너 설정
   */
  private setupNetworkStatusListener(): void {
    window.addEventListener('online', () => {
      this.isOnline = true
      this.flushErrors() // 온라인 상태가 되면 즉시 전송
    })

    window.addEventListener('offline', () => {
      this.isOnline = false
    })
  }

  /**
   * 주기적 에러 전송 설정
   */
  private setupPeriodicFlush(): void {
    setInterval(() => {
      if (this.errorQueue.length > 0 && this.isOnline) {
        this.flushErrors()
      }
    }, this.flushInterval)
  }

  /**
   * 에러 캡처
   */
  captureError(error: Error, additionalContext?: any): void {
    try {
      const context: ErrorContext = {
        userId: this.getUserId(),
        sessionId: this.getSessionId(),
        route: window.location.pathname + window.location.search,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        viewport: `${window.innerWidth}x${window.innerHeight}`,
        ...additionalContext
      }

      const errorReport: ErrorReport = {
        message: error.message,
        stack: error.stack,
        level: 'error',
        context,
        fingerprint: this.generateFingerprint(error, context)
      }

      this.addToQueue(errorReport)
    } catch (captureError) {
      console.error('Error capturing error:', captureError)
    }
  }

  /**
   * 경고 메시지 캡처
   */
  captureWarning(message: string, context?: any): void {
    const warningReport: ErrorReport = {
      message,
      level: 'warn',
      context: {
        userId: this.getUserId(),
        sessionId: this.getSessionId(),
        route: window.location.pathname,
        timestamp: new Date().toISOString(),
        ...context
      },
      fingerprint: this.generateFingerprint(new Error(message), context || {})
    }

    this.addToQueue(warningReport)
  }

  /**
   * 정보 메시지 캡처
   */
  captureInfo(message: string, context?: any): void {
    const infoReport: ErrorReport = {
      message,
      level: 'info',
      context: {
        userId: this.getUserId(),
        sessionId: this.getSessionId(),
        route: window.location.pathname,
        timestamp: new Date().toISOString(),
        ...context
      },
      fingerprint: this.generateFingerprint(new Error(message), context || {})
    }

    this.addToQueue(infoReport)
  }

  /**
   * 성능 메트릭 캡처
   */
  capturePerformance(metricName: string, value: number, context?: any): void {
    this.captureInfo(`PERFORMANCE: ${metricName}`, {
      metric: true,
      metricName,
      value,
      ...context
    })
  }

  /**
   * 사용자 상호작용 추적
   */
  captureUserAction(action: string, context?: any): void {
    this.captureInfo(`USER_ACTION: ${action}`, {
      userAction: true,
      action,
      ...context
    })
  }

  /**
   * API 응답 에러 캡처
   */
  captureAPIError(error: any, request: any): void {
    const context = {
      api: true,
      method: request.method,
      url: request.url,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data
    }

    if (error.response?.status >= 500) {
      this.captureError(new Error(`API Error: ${error.message}`), context)
    } else if (error.response?.status >= 400) {
      this.captureWarning(`API Client Error: ${error.message}`, context)
    }
  }

  /**
   * 큐에 에러 추가
   */
  private addToQueue(errorReport: ErrorReport): void {
    if (this.errorQueue.length >= this.maxQueueSize) {
      this.errorQueue.shift() // 오래된 에러 제거
    }

    this.errorQueue.push(errorReport)

    // 중요한 에러는 즉시 전송
    if (errorReport.level === 'error' && this.isOnline) {
      this.flushErrors()
    }
  }

  /**
   * 에러 서버로 전송
   */
  private async flushErrors(): Promise<void> {
    if (this.errorQueue.length === 0) return

    const errors = [...this.errorQueue]
    this.errorQueue = []

    try {
      await fetch(`${this.apiBaseUrl}/api/logging/errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ errors })
      })
    } catch (flushError) {
      console.error('Failed to flush errors:', flushError)
      // 전송 실패 시 다시 큐에 추가 (최대 한 번만)
      this.errorQueue.unshift(...errors.slice(-25)) // 최근 25개만 복구
    }
  }

  /**
   * 에러 지문 생성 (중복 제거용)
   */
  private generateFingerprint(error: Error, context: any): string {
    const key = `${error.message}:${context.route || ''}:${error.stack?.split('\n')[1] || ''}`
    return btoa(key).slice(0, 16)
  }

  /**
   * 사용자 ID 조회
   */
  private getUserId(): string | undefined {
    // 실제 구현에서는 인증 상태에서 가져옴
    return localStorage.getItem('userId') || undefined
  }

  /**
   * 세션 ID 조회
   */
  private getSessionId(): string | undefined {
    let sessionId = sessionStorage.getItem('sessionId')
    if (!sessionId) {
      sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)
      sessionStorage.setItem('sessionId', sessionId)
    }
    return sessionId
  }

  /**
   * 현재 큐 상태 조회
   */
  getQueueStatus(): { queueSize: number; isOnline: boolean; maxQueueSize: number } {
    return {
      queueSize: this.errorQueue.length,
      isOnline: this.isOnline,
      maxQueueSize: this.maxQueueSize
    }
  }

  /**
   * 수동 플러시
   */
  async flush(): Promise<void> {
    await this.flushErrors()
  }

  /**
   * 에러 트래커 비활성화
   */
  disable(): void {
    this.errorQueue = []
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const errorTracker = ErrorTracker.getInstance()
export default errorTracker

// Vue 컴포지션 함수로도 사용 가능
export function useErrorTracker() {
  return {
    captureError: errorTracker.captureError.bind(errorTracker),
    captureWarning: errorTracker.captureWarning.bind(errorTracker),
    captureInfo: errorTracker.captureInfo.bind(errorTracker),
    capturePerformance: errorTracker.capturePerformance.bind(errorTracker),
    captureUserAction: errorTracker.captureUserAction.bind(errorTracker),
    captureAPIError: errorTracker.captureAPIError.bind(errorTracker),
    getQueueStatus: errorTracker.getQueueStatus.bind(errorTracker),
    flush: errorTracker.flush.bind(errorTracker)
  }
}