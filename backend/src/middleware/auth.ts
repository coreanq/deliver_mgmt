import { Request, Response, NextFunction } from 'express'
import TokenService from '../services/TokenService'

// 확장된 Request 타입
interface ExtendedRequest extends Request {
  session: any
  googleAuth?: any
  googleTokens?: any
  user?: any  // 인증된 사용자 정보
  deliveryStaff?: any  // 배달기사 정보
}

/**
 * Google 인증 확인 미들웨어
 */
export const requireGoogleAuth = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const tokens = req.session.googleTokens

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'Google 인증이 필요합니다.',
        requireAuth: true
      })
    }

    // 토큰 유효성 확인 및 갱신
    const { client, tokens: validTokens } = await TokenService.getAuthenticatedClient(tokens)

    // 갱신된 토큰이 있으면 세션 업데이트
    if (validTokens !== tokens) {
      req.session.googleTokens = validTokens
    }

    // 요청 객체에 인증된 클라이언트 추가
    req.googleAuth = client
    req.googleTokens = validTokens

    return next()
  } catch (error) {
    console.error('Google 인증 확인 실패:', error)
    
    // 인증 실패 시 세션에서 토큰 제거
    delete req.session.googleTokens

    return res.status(401).json({
      success: false,
      message: '인증이 만료되었습니다. 다시 로그인해주세요.',
      requireAuth: true
    })
  }
}

/**
 * 선택적 Google 인증 미들웨어
 * 인증되지 않아도 계속 진행하지만, 인증 정보가 있으면 추가
 */
export const optionalGoogleAuth = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tokens = req.session.googleTokens

    if (tokens) {
      const isValid = await TokenService.isTokenValid(tokens)
      
      if (isValid) {
        const { client, tokens: validTokens } = await TokenService.getAuthenticatedClient(tokens)
        
        req.googleAuth = client
        req.googleTokens = validTokens
        
        if (validTokens !== tokens) {
          req.session.googleTokens = validTokens
        }
      } else {
        delete req.session.googleTokens
      }
    }

    return next()
  } catch (error) {
    console.error('선택적 Google 인증 처리 실패:', error)
    return next()
  }
}

/**
 * 세션 확인 미들웨어
 */
export const requireSession = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): void | Response => {
  if (!req.session) {
    return res.status(500).json({
      success: false,
      message: '세션을 사용할 수 없습니다.'
    })
  }
  return next()
}

/**
 * JWT 토큰 기반 관리자 인증 미들웨어
 */
export const requireAdminAuth = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 없습니다.',
        requireAuth: true
      })
    }

    const token = authHeader.substring(7) // "Bearer " 제거
    const decoded = TokenService.verifyAdminToken(token)

    // 요청 객체에 사용자 정보 추가
    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      type: decoded.type,
      jti: decoded.jti
    }

    return next()
  } catch (error) {
    console.error('관리자 인증 실패:', error)
    
    return res.status(401).json({
      success: false,
      message: '유효하지 않은 토큰입니다.',
      requireAuth: true
    })
  }
}

/**
 * JWT 토큰 기반 배달기사 인증 미들웨어
 */
export const requireStaffAuth = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  try {
    // URL 파라미터나 헤더에서 토큰 추출
    const token = req.query.token as string || 
                 req.headers.authorization?.replace('Bearer ', '') ||
                 req.body.token

    if (!token) {
      return res.status(401).json({
        success: false,
        message: '인증 토큰이 없습니다.',
        requireAuth: true
      })
    }

    const decoded = TokenService.verifyStaffToken(token)

    // 요청 객체에 배달기사 정보 추가
    req.deliveryStaff = {
      staff: decoded.staff,
      workDate: decoded.workDate,
      sheet: decoded.sheet,
      type: decoded.type,
      jti: decoded.jti,
      token
    }

    return next()
  } catch (error) {
    console.error('배달기사 인증 실패:', error)
    
    return res.status(401).json({
      success: false,
      message: '유효하지 않은 인증 정보입니다.',
      requireAuth: true
    })
  }
}

/**
 * 권한별 접근 제어 미들웨어
 */
export const requirePermission = (requiredType: 'admin' | 'delivery_staff') => {
  return (req: ExtendedRequest, res: Response, next: NextFunction): void | Response => {
    const userType = req.user?.type || req.deliveryStaff?.type

    if (userType !== requiredType) {
      return res.status(403).json({
        success: false,
        message: '권한이 없습니다.'
      })
    }

    return next()
  }
}

/**
 * 배달기사의 시트 접근 권한 확인 미들웨어
 */
export const requireSheetAccess = (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): void | Response => {
  const requestedSheet = req.params.sheetName || req.body.sheetName
  const authorizedSheet = req.deliveryStaff?.sheet

  if (!authorizedSheet) {
    return res.status(401).json({
      success: false,
      message: '인증 정보가 없습니다.'
    })
  }

  if (requestedSheet && requestedSheet !== authorizedSheet) {
    console.warn(`배달기사 ${req.deliveryStaff.staff}가 권한이 없는 시트 ${requestedSheet}에 접근 시도`)
    
    return res.status(403).json({
      success: false,
      message: '해당 시트에 접근 권한이 없습니다.'
    })
  }

  return next()
}

/**
 * 복합 인증 미들웨어 (Google OAuth + JWT 둘 다 지원)
 */
export const requireAnyAuth = async (
  req: ExtendedRequest,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  // JWT 토큰 확인
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7)
      const decoded = TokenService.verifyToken(token)
      
      if (decoded.type === 'admin') {
        req.user = decoded
        return next()
      } else if (decoded.type === 'delivery_staff') {
        req.deliveryStaff = decoded
        return next()
      }
    } catch (error) {
      // JWT 토큰 실패 시 Google OAuth 시도
    }
  }

  // Google OAuth 확인
  const tokens = req.session.googleTokens
  if (tokens) {
    try {
      const { client, tokens: validTokens } = await TokenService.getAuthenticatedClient(tokens)
      
      if (validTokens !== tokens) {
        req.session.googleTokens = validTokens
      }
      
      req.googleAuth = client
      req.googleTokens = validTokens
      return next()
    } catch (error) {
      console.error('Google 인증 확인 실패:', error)
      delete req.session.googleTokens
    }
  }

  return res.status(401).json({
    success: false,
    message: '인증이 필요합니다.',
    requireAuth: true
  })
}

// Express Request 타입을 위에서 ExtendedRequest로 정의함