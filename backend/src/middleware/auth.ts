import { Request, Response, NextFunction } from 'express'
import TokenService from '../services/TokenService'

// 확장된 Request 타입
interface ExtendedRequest extends Request {
  session: any
  googleAuth?: any
  googleTokens?: any
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

// Express Request 타입을 위에서 ExtendedRequest로 정의함