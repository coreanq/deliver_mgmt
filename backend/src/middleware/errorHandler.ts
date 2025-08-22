import { Request, Response, NextFunction } from 'express'

export interface ApiError extends Error {
  statusCode?: number
  errorType?: string
  details?: any
}

export class DeliverySystemError extends Error {
  statusCode: number
  errorType: string
  details?: any

  constructor(message: string, statusCode: number = 500, errorType: string = 'SYSTEM_ERROR', details?: any) {
    super(message)
    this.name = 'DeliverySystemError'
    this.statusCode = statusCode
    this.errorType = errorType
    this.details = details
  }
}

// 미리 정의된 에러 타입들
export class AuthenticationError extends DeliverySystemError {
  constructor(message: string = '인증이 필요합니다.', details?: any) {
    super(message, 401, 'AUTHENTICATION_REQUIRED', details)
  }
}

export class AuthorizationError extends DeliverySystemError {
  constructor(message: string = '권한이 없습니다.', details?: any) {
    super(message, 403, 'AUTHORIZATION_FAILED', details)
  }
}

export class ValidationError extends DeliverySystemError {
  constructor(message: string = '입력값이 유효하지 않습니다.', details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
  }
}

export class NotFoundError extends DeliverySystemError {
  constructor(message: string = '요청한 리소스를 찾을 수 없습니다.', details?: any) {
    super(message, 404, 'RESOURCE_NOT_FOUND', details)
  }
}

export class GoogleSheetsError extends DeliverySystemError {
  constructor(message: string = '구글 시트 접근 오류가 발생했습니다.', details?: any) {
    super(message, 503, 'GOOGLE_SHEETS_ERROR', details)
  }
}

export class QrCodeError extends DeliverySystemError {
  constructor(message: string = 'QR 코드 처리 오류가 발생했습니다.', details?: any) {
    super(message, 400, 'QR_CODE_ERROR', details)
  }
}

export class StaffManagementError extends DeliverySystemError {
  constructor(message: string = '배송자 관리 오류가 발생했습니다.', details?: any) {
    super(message, 400, 'STAFF_MANAGEMENT_ERROR', details)
  }
}

// 에러 핸들링 미들웨어
export const errorHandler = (
  err: ApiError | Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 로깅
  console.error('에러 발생:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  })

  // DeliverySystemError 처리
  if (err instanceof DeliverySystemError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errorType: err.errorType,
      details: err.details,
      timestamp: new Date().toISOString()
    })
  }

  // 일반적인 API 에러 처리
  if (err.name === 'ApiError' && (err as ApiError).statusCode) {
    return res.status((err as ApiError).statusCode!).json({
      success: false,
      message: err.message,
      errorType: (err as ApiError).errorType || 'API_ERROR',
      timestamp: new Date().toISOString()
    })
  }

  // JWT 에러 처리
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: '유효하지 않은 토큰입니다.',
      errorType: 'INVALID_TOKEN',
      timestamp: new Date().toISOString()
    })
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: '토큰이 만료되었습니다.',
      errorType: 'TOKEN_EXPIRED',
      timestamp: new Date().toISOString()
    })
  }

  // MongoDB 에러 (향후 사용할 수 있음)
  if (err.name === 'MongoError' || err.name === 'MongoServerError') {
    return res.status(500).json({
      success: false,
      message: '데이터베이스 연결 오류가 발생했습니다.',
      errorType: 'DATABASE_ERROR',
      timestamp: new Date().toISOString()
    })
  }

  // 기본 에러 처리
  const statusCode = (err as ApiError).statusCode || 500
  const message = err.message || '서버 내부 오류가 발생했습니다.'

  return res.status(statusCode).json({
    success: false,
    message,
    errorType: 'INTERNAL_SERVER_ERROR',
    timestamp: new Date().toISOString(),
    // 개발 환경에서만 스택 트레이스 포함
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  })
}

// 404 핸들러
export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `요청한 경로 '${req.originalUrl}'를 찾을 수 없습니다.`,
    errorType: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString()
  })
}

// 비동기 라우트 핸들러를 위한 래퍼
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// 구글 시트 API 에러를 우리 에러로 변환하는 헬퍼
export const handleGoogleSheetsError = (error: any): DeliverySystemError => {
  console.error('Google Sheets API 에러:', error)

  // 권한 오류
  if (error.code === 403) {
    return new GoogleSheetsError('구글 시트에 접근 권한이 없습니다. 관리자에게 문의하세요.', {
      originalError: error.message
    })
  }

  // 시트를 찾을 수 없음
  if (error.code === 404) {
    return new NotFoundError('요청한 구글 시트를 찾을 수 없습니다.', {
      originalError: error.message
    })
  }

  // 할당량 초과
  if (error.code === 429) {
    return new GoogleSheetsError('구글 시트 API 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.', {
      originalError: error.message
    })
  }

  // 인증 오류
  if (error.code === 401) {
    return new AuthenticationError('구글 시트 인증이 만료되었습니다. 다시 로그인해주세요.', {
      originalError: error.message
    })
  }

  // 기본 구글 시트 에러
  return new GoogleSheetsError('구글 시트 처리 중 오류가 발생했습니다.', {
    originalError: error.message,
    code: error.code
  })
}

// QR 코드 관련 에러 헬퍼들
export const QrErrorTypes = {
  INVALID_FORMAT: 'QR 코드 형식이 올바르지 않습니다.',
  EXPIRED_TOKEN: 'QR 코드가 만료되었습니다.',
  INVALID_SIGNATURE: 'QR 코드 서명이 유효하지 않습니다.',
  STAFF_MISMATCH: 'QR 코드의 배송자 정보가 일치하지 않습니다.',
  DATE_MISMATCH: 'QR 코드의 작업 날짜가 일치하지 않습니다.'
}

// 배송자 관리 에러 헬퍼들
export const StaffErrorTypes = {
  NOT_REGISTERED: '등록되지 않은 배송자입니다.',
  INACTIVE_STAFF: '비활성화된 배송자입니다.',
  DUPLICATE_STAFF: '이미 등록된 배송자입니다.',
  INVALID_PHONE: '전화번호 형식이 올바르지 않습니다.'
}

// 스프레드시트 매핑 에러 헬퍼들
export const SheetMappingErrorTypes = {
  DATE_NOT_MAPPED: '해당 날짜의 스프레드시트가 연결되지 않았습니다.',
  INVALID_DATE_FORMAT: '날짜 형식이 올바르지 않습니다.',
  SHEET_CONNECTION_FAILED: '스프레드시트 연결에 실패했습니다.',
  MAPPING_NOT_FOUND: '스프레드시트 매핑 정보를 찾을 수 없습니다.'
}