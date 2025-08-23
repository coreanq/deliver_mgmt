import winston from 'winston'
import path from 'path'
import fs from 'fs'

// 로그 디렉토리 생성
const logsDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true })
}

// 로그 레벨 정의
export enum LogLevel {
  ERROR = 'error',
  WARN = 'warn', 
  INFO = 'info',
  HTTP = 'http',
  DEBUG = 'debug'
}

// 로그 컨텍스트 인터페이스
export interface LogContext {
  userId?: string
  sessionId?: string
  requestId?: string
  operation?: string
  duration?: number
  [key: string]: any
}

// 커스텀 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    }
    return JSON.stringify(logEntry, null, 2)
  })
)

// 콘솔 포맷 (개발용)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : ''
    return `${timestamp} [${level}]: ${message}${metaStr}`
  })
)

// 로그 파일 회전 설정
const dailyRotateFile = require('winston-daily-rotate-file')

class LoggerService {
  private logger: winston.Logger
  private static instance: LoggerService

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: logFormat,
      defaultMeta: { 
        service: 'delivery-mgmt-backend',
        environment: process.env.NODE_ENV || 'development',
        pid: process.pid
      },
      transports: [
        // 에러 로그 (별도 파일)
        new winston.transports.File({
          filename: path.join(logsDir, 'error.log'),
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5
        }),

        // 전체 로그 (일별 회전)
        new dailyRotateFile({
          filename: path.join(logsDir, 'application-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          zippedArchive: true,
          maxSize: '20m',
          maxFiles: '14d'
        }),

        // HTTP 요청 로그
        new winston.transports.File({
          filename: path.join(logsDir, 'http.log'),
          level: 'http',
          maxsize: 10485760, // 10MB
          maxFiles: 3
        })
      ],
      // 예외 및 rejection 처리
      exceptionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'exceptions.log')
        })
      ],
      rejectionHandlers: [
        new winston.transports.File({
          filename: path.join(logsDir, 'rejections.log')
        })
      ],
      exitOnError: false
    })

    // 개발 환경에서는 콘솔 출력 추가
    if (process.env.NODE_ENV !== 'production') {
      this.logger.add(new winston.transports.Console({
        format: consoleFormat,
        level: 'debug'
      }))
    }

    // 프로덕션 환경에서는 민감한 정보 필터링
    if (process.env.NODE_ENV === 'production') {
      this.logger = this.logger.child({
        redact: ['password', 'token', 'secret', 'key']
      })
    }
  }

  static getInstance(): LoggerService {
    if (!LoggerService.instance) {
      LoggerService.instance = new LoggerService()
    }
    return LoggerService.instance
  }

  /**
   * 에러 로깅
   */
  error(message: string, context?: LogContext, error?: Error): void {
    const logData: any = {
      message,
      ...context
    }

    if (error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    }

    this.logger.error(logData)
  }

  /**
   * 경고 로깅
   */
  warn(message: string, context?: LogContext): void {
    this.logger.warn({ message, ...context })
  }

  /**
   * 정보 로깅
   */
  info(message: string, context?: LogContext): void {
    this.logger.info({ message, ...context })
  }

  /**
   * HTTP 요청 로깅
   */
  http(message: string, context?: LogContext): void {
    this.logger.http({ message, ...context })
  }

  /**
   * 디버그 로깅
   */
  debug(message: string, context?: LogContext): void {
    this.logger.debug({ message, ...context })
  }

  /**
   * 성능 측정용 타이머 시작
   */
  startTimer(label: string): winston.Profiler {
    return this.logger.startTimer()
  }

  /**
   * 운영 메트릭 로깅 (중요한 비즈니스 이벤트)
   */
  metric(eventName: string, value: number, context?: LogContext): void {
    this.info(`METRIC: ${eventName}`, {
      metric: true,
      eventName,
      value,
      ...context
    })
  }

  /**
   * 보안 이벤트 로깅
   */
  security(message: string, context?: LogContext): void {
    this.warn(`SECURITY: ${message}`, {
      security: true,
      ...context
    })
  }

  /**
   * 감사 로깅 (중요한 사용자 행동)
   */
  audit(action: string, context?: LogContext): void {
    this.info(`AUDIT: ${action}`, {
      audit: true,
      action,
      ...context
    })
  }

  /**
   * 동기화 관련 로깅
   */
  sync(message: string, context?: LogContext): void {
    this.info(`SYNC: ${message}`, {
      sync: true,
      ...context
    })
  }

  /**
   * API 응답 시간 로깅
   */
  apiResponse(method: string, path: string, statusCode: number, responseTime: number, context?: LogContext): void {
    this.http(`${method} ${path} ${statusCode}`, {
      method,
      path,
      statusCode,
      responseTime,
      ...context
    })
  }

  /**
   * 데이터베이스 쿼리 로깅
   */
  query(query: string, duration: number, context?: LogContext): void {
    this.debug('Database query executed', {
      query: this.sanitizeQuery(query),
      duration,
      ...context
    })
  }

  /**
   * 쿼리에서 민감한 정보 제거
   */
  private sanitizeQuery(query: string): string {
    // 민감한 정보 패턴 제거
    return query
      .replace(/password\s*=\s*['"][^'"]*['"]/gi, "password='***'")
      .replace(/token\s*=\s*['"][^'"]*['"]/gi, "token='***'")
  }

  /**
   * 구조화된 오류 생성
   */
  createError(message: string, code: string, context?: LogContext): Error {
    const error = new Error(message) as any
    error.code = code
    error.context = context
    return error
  }

  /**
   * 로그 레벨 동적 변경
   */
  setLogLevel(level: string): void {
    this.logger.level = level
    this.info('Log level changed', { newLevel: level })
  }

  /**
   * 로그 통계 조회
   */
  getLogStats(): any {
    // 실제 구현에서는 로그 파일을 분석하여 통계 반환
    return {
      totalLogs: 'N/A',
      errorCount: 'N/A',
      warnCount: 'N/A',
      logLevel: this.logger.level
    }
  }
}

// 싱글톤 인스턴스 생성 및 내보내기
const logger = LoggerService.getInstance()
export default logger

// 타입 가드 함수들
export const isError = (error: any): error is Error => {
  return error instanceof Error
}

export const isLogContext = (obj: any): obj is LogContext => {
  return typeof obj === 'object' && obj !== null
}