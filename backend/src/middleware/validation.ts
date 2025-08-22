import { Request, Response, NextFunction } from 'express'
import validator from 'validator'
import { body, param, query, validationResult } from 'express-validator'

/**
 * 입력값 새니타이제이션 및 검증 미들웨어
 */

/**
 * 검증 결과 확인 미들웨어
 */
export const handleValidationErrors = (
  req: Request,
  res: Response,
  next: NextFunction
): void | Response => {
  const errors = validationResult(req)
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: '입력값 검증 실패',
      errors: errors.array()
    })
  }
  return next()
}

/**
 * 문자열 새니타이제이션
 */
export const sanitizeString = (str: string, maxLength: number = 100): string => {
  if (!str || typeof str !== 'string') return ''
  
  return validator.escape(str.trim().slice(0, maxLength))
}

/**
 * 전화번호 검증 및 새니타이제이션
 */
export const sanitizePhoneNumber = (phone: string): string => {
  if (!phone || typeof phone !== 'string') return ''
  
  // 숫자만 추출
  const digitsOnly = phone.replace(/\D/g, '')
  
  // 한국 전화번호 형식 검증 (010, 011, 016, 017, 018, 019로 시작하는 11자리)
  if (digitsOnly.length === 11 && /^01[0-9]/.test(digitsOnly)) {
    return digitsOnly
  }
  
  // 일반 전화번호 (지역번호 포함) 검증
  if (digitsOnly.length >= 8 && digitsOnly.length <= 11) {
    return digitsOnly
  }
  
  return ''
}

/**
 * 이메일 검증
 */
export const validateEmail = (email: string): boolean => {
  if (!email || typeof email !== 'string') return false
  return validator.isEmail(email) && email.length <= 100
}

/**
 * 스프레드시트 이름 검증 규칙
 */
export const validateSpreadsheetName = [
  param('sheetName')
    .isString()
    .isLength({ min: 1, max: 100 })
    .matches(/^[a-zA-Z0-9가-힣\s_-]+$/)
    .withMessage('스프레드시트 이름은 한글, 영문, 숫자, 공백, _, -만 포함할 수 있습니다.')
    .customSanitizer((value) => sanitizeString(value, 100)),
  handleValidationErrors
]

/**
 * 배달기사 이름 검증 규칙
 */
export const validateStaffName = [
  param('staffName')
    .isString()
    .isLength({ min: 1, max: 20 })
    .matches(/^[a-zA-Z0-9가-힣\s]+$/)
    .withMessage('배달기사 이름은 한글, 영문, 숫자, 공백만 포함할 수 있습니다.')
    .customSanitizer((value) => sanitizeString(value, 20)),
  handleValidationErrors
]

/**
 * 전화번호 검증 규칙
 */
export const validatePhoneNumber = [
  body('phone')
    .optional()
    .custom((value) => {
      if (value && !sanitizePhoneNumber(value)) {
        throw new Error('유효하지 않은 전화번호 형식입니다.')
      }
      return true
    })
    .customSanitizer((value) => sanitizePhoneNumber(value)),
  handleValidationErrors
]

/**
 * QR 토큰 검증 규칙
 */
export const validateQrToken = [
  param('token')
    .isString()
    .isLength({ min: 10, max: 500 })
    .matches(/^[A-Za-z0-9._-]+$/)
    .withMessage('유효하지 않은 토큰 형식입니다.'),
  handleValidationErrors
]

/**
 * 배달 상태 검증 규칙
 */
export const validateDeliveryStatus = [
  body('status')
    .isIn(['대기', '준비중', '출발', '완료'])
    .withMessage('유효하지 않은 배달 상태입니다.'),
  handleValidationErrors
]

/**
 * 페이지네이션 검증 규칙
 */
export const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1, max: 1000 })
    .withMessage('페이지는 1-1000 사이의 숫자여야 합니다.'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('페이지 크기는 1-100 사이의 숫자여야 합니다.'),
  handleValidationErrors
]

/**
 * 검색 쿼리 검증 규칙
 */
export const validateSearchQuery = [
  query('q')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .customSanitizer((value) => sanitizeString(value, 100))
    .withMessage('검색어는 100자를 초과할 수 없습니다.'),
  handleValidationErrors
]

/**
 * 일반적인 입력값 새니타이제이션 미들웨어
 */
export const sanitizeInputs = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Body 파라미터 새니타이제이션
  if (req.body && typeof req.body === 'object') {
    for (const key in req.body) {
      if (typeof req.body[key] === 'string') {
        // 특정 필드는 특별 처리
        if (key.toLowerCase().includes('phone')) {
          req.body[key] = sanitizePhoneNumber(req.body[key])
        } else if (key.toLowerCase().includes('email')) {
          req.body[key] = req.body[key].trim().toLowerCase()
        } else {
          req.body[key] = sanitizeString(req.body[key])
        }
      }
    }
  }

  // Query 파라미터 새니타이제이션
  if (req.query && typeof req.query === 'object') {
    for (const key in req.query) {
      if (typeof req.query[key] === 'string') {
        req.query[key] = sanitizeString(req.query[key] as string)
      }
    }
  }

  next()
}

/**
 * XSS 방지 헤더 설정 미들웨어
 */
export const setSecurityHeaders = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // XSS Protection
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  // CSP 헤더 (개발 환경 고려)
  const isDevelopment = process.env.NODE_ENV === 'development'
  const cspDirectives = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // 개발시 완화
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "connect-src 'self' https://sheets.googleapis.com https://www.googleapis.com https://oauth2.googleapis.com",
    "font-src 'self'",
    "object-src 'none'",
    "media-src 'self'",
    "frame-src 'none'"
  ]
  
  if (!isDevelopment) {
    res.setHeader('Content-Security-Policy', cspDirectives.join('; '))
  }

  next()
}

/**
 * Rate limiting용 IP 추출
 */
export const getClientIp = (req: Request): string => {
  return (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
         req.connection.remoteAddress ||
         req.socket.remoteAddress ||
         'unknown'
}