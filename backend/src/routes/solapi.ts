import { Router, Response } from 'express'
import SolapiService from '../services/SolapiService'
import { generateSolapiAuthUrl } from '../config/solapi'

// 확장된 Request 타입
interface ExtendedRequest {
  session: any
  googleAuth?: any
  googleTokens?: any
  body: any
  params: any
  query: any
}

const router = Router()

/**
 * SOLAPI OAuth2 인증 시작
 */
router.get('/auth/login', (req: ExtendedRequest, res: Response) => {
  try {
    const state = SolapiService.generateState()
    const authUrl = generateSolapiAuthUrl(state)
    
    return res.json({
      success: true,
      authUrl,
      state, // 클라이언트에서 콜백 검증을 위해 반환
      message: 'SOLAPI 인증 URL이 생성되었습니다.'
    })
  } catch (error: any) {
    console.error('SOLAPI 인증 URL 생성 실패:', error)
    return res.status(500).json({
      success: false,
      message: 'SOLAPI 인증 URL 생성에 실패했습니다.'
    })
  }
})

/**
 * SOLAPI OAuth2 콜백 처리
 */
router.get('/auth/callback', async (req: ExtendedRequest, res: Response) => {
  try {
    const { code, state } = req.query

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'SOLAPI 인증 코드가 제공되지 않았습니다.'
      })
    }

    // 코드를 토큰으로 교환 (state 검증 포함)
    const tokens = await SolapiService.exchangeCodeForTokens(code as string, state as string)

    // 세션에 토큰 저장
    req.session.solapiTokens = tokens

    return res.json({
      success: true,
      message: 'SOLAPI 인증이 완료되었습니다.',
      data: {
        hasRefreshToken: !!tokens.refresh_token,
        scope: tokens.scope,
        expiresIn: tokens.expires_in
      }
    })
  } catch (error: any) {
    console.error('SOLAPI OAuth2 콜백 처리 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'SOLAPI 인증 처리에 실패했습니다.'
    })
  }
})

/**
 * SOLAPI 인증 상태 확인
 */
router.get('/auth/status', (req: ExtendedRequest, res: Response) => {
  const isAuthenticated = !!req.session.solapiTokens
  const tokens = req.session.solapiTokens

  return res.json({
    success: true,
    authenticated: isAuthenticated,
    data: isAuthenticated ? {
      scope: tokens.scope,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type
    } : null,
    message: isAuthenticated ? 'SOLAPI 계정이 연결되어 있습니다.' : 'SOLAPI 계정이 연결되지 않았습니다.'
  })
})

/**
 * SOLAPI 상태 확인 (별칭)
 */
router.get('/status', (req: ExtendedRequest, res: Response) => {
  const isAuthenticated = !!req.session.solapiTokens
  const tokens = req.session.solapiTokens

  return res.json({
    success: true,
    authenticated: isAuthenticated,
    data: isAuthenticated ? {
      scope: tokens.scope,
      expiresIn: tokens.expires_in,
      tokenType: tokens.token_type
    } : null,
    message: isAuthenticated ? 'SOLAPI 계정이 연결되어 있습니다.' : 'SOLAPI 계정이 연결되지 않았습니다.'
  })
})

/**
 * SOLAPI 계정 정보 조회
 */
router.get('/account', async (req: ExtendedRequest, res: Response) => {
  try {
    const tokens = req.session.solapiTokens

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
        requireAuth: true
      })
    }

    const accountInfo = await SolapiService.getAccountInfo(tokens)

    return res.json({
      success: true,
      data: accountInfo,
      message: 'SOLAPI 계정 정보를 조회했습니다.'
    })
  } catch (error: any) {
    console.error('SOLAPI 계정 정보 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '계정 정보 조회에 실패했습니다.'
    })
  }
})

/**
 * 발신번호 목록 조회
 */
router.get('/senders', async (req: ExtendedRequest, res: Response) => {
  try {
    const tokens = req.session.solapiTokens

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
        requireAuth: true
      })
    }

    const senders = await SolapiService.getSenderIds(tokens)

    return res.json({
      success: true,
      data: senders,
      message: '발신번호 목록을 조회했습니다.'
    })
  } catch (error: any) {
    console.error('발신번호 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '발신번호 조회에 실패했습니다.'
    })
  }
})

/**
 * 카카오톡 템플릿 목록 조회
 */
router.get('/templates', async (req: ExtendedRequest, res: Response) => {
  try {
    const tokens = req.session.solapiTokens

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
        requireAuth: true
      })
    }

    const templates = await SolapiService.getKakaoTemplates(tokens)

    return res.json({
      success: true,
      data: templates,
      message: '카카오톡 템플릿 목록을 조회했습니다.'
    })
  } catch (error: any) {
    console.error('템플릿 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '템플릿 조회에 실패했습니다.'
    })
  }
})

/**
 * 테스트 메시지 발송
 */
router.post('/send-test', async (req: ExtendedRequest, res: Response) => {
  try {
    const tokens = req.session.solapiTokens
    const { to, from, customerName, templateId, messageType = 'sms' } = req.body

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
        requireAuth: true
      })
    }

    if (!to || !from || !customerName) {
      return res.status(400).json({
        success: false,
        message: '수신번호, 발신번호, 고객명이 필요합니다.'
      })
    }

    let result

    if (messageType === 'kakao' && templateId) {
      // 카카오톡 테스트 발송
      result = await SolapiService.sendKakaoMessage(
        tokens,
        templateId,
        to,
        { 고객명: customerName },
        from
      )
    } else {
      // SMS 테스트 발송
      const text = `${customerName}님, 테스트 메시지입니다. 배달 관리 시스템이 정상 작동 중입니다.`
      result = await SolapiService.sendSMS(tokens, to, text, from)
    }

    return res.json({
      success: result.success,
      data: result,
      message: result.success ? '테스트 메시지가 발송되었습니다.' : '테스트 메시지 발송에 실패했습니다.'
    })
  } catch (error: any) {
    console.error('테스트 메시지 발송 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '테스트 메시지 발송에 실패했습니다.'
    })
  }
})

/**
 * 배달 완료 알림 발송
 */
router.post('/send-delivery-complete', async (req: ExtendedRequest, res: Response) => {
  try {
    const tokens = req.session.solapiTokens
    const { to, from, customerName, templateId } = req.body

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
        requireAuth: true
      })
    }

    if (!to || !from || !customerName) {
      return res.status(400).json({
        success: false,
        message: '수신번호, 발신번호, 고객명이 필요합니다.'
      })
    }

    const result = await SolapiService.sendDeliveryCompleteNotification(
      tokens,
      customerName,
      to,
      from,
      templateId
    )

    return res.json({
      success: result.success,
      data: result,
      message: result.success ? 
        '배달 완료 알림이 발송되었습니다.' : 
        result.errorMessage || '배달 완료 알림 발송에 실패했습니다.'
    })
  } catch (error: any) {
    console.error('배달 완료 알림 발송 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '배달 완료 알림 발송에 실패했습니다.'
    })
  }
})

/**
 * Hello World 메시지 발송 (OAuth2 방식)
 */
router.post('/send-hello-world', async (req: ExtendedRequest, res: Response) => {
  try {
    const tokens = req.session.solapiTokens
    const { to, from } = req.body

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'SOLAPI 인증이 필요합니다.',
        requireAuth: true
      })
    }

    if (!to || !from) {
      return res.status(400).json({
        success: false,
        message: '수신번호(to), 발신번호(from)가 필요합니다.'
      })
    }

    // Hello World SMS 발송
    const result = await SolapiService.sendSMS(tokens, to, 'Hello world', from)

    return res.json({
      success: result.success,
      data: result,
      message: result.success ? 
        `${to} 번호로 Hello world 메시지가 발송되었습니다!` : 
        result.errorMessage || 'Hello world 메시지 발송에 실패했습니다.'
    })
  } catch (error: any) {
    console.error('Hello world 발송 실패:', error)
    return res.status(500).json({
      success: false,
      message: 'Hello world 메시지 발송에 실패했습니다.'
    })
  }
})

/**
 * SOLAPI 인증 해제
 */
router.post('/auth/logout', (req: ExtendedRequest, res: Response) => {
  delete req.session.solapiTokens

  return res.json({
    success: true,
    message: 'SOLAPI 계정 연결이 해제되었습니다.'
  })
})

/**
 * SOLAPI 환경변수 확인 (개발용)
 */
router.get('/debug/config', (req: ExtendedRequest, res: Response) => {
  const hasClientId = !!process.env.SOLAPI_CLIENT_ID && process.env.SOLAPI_CLIENT_ID !== 'your-solapi-client-id'
  const hasClientSecret = !!process.env.SOLAPI_CLIENT_SECRET && process.env.SOLAPI_CLIENT_SECRET !== 'your-solapi-client-secret'
  
  return res.json({
    success: true,
    config: {
      hasClientId,
      hasClientSecret,
      clientIdLength: process.env.SOLAPI_CLIENT_ID?.length || 0,
      redirectUri: process.env.SOLAPI_REDIRECT_URI
    }
  })
})

export default router