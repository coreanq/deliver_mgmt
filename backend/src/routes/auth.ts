import { Router, Request, Response } from 'express'
import { createOAuth2Client, getAuthUrl } from '../config/google'

// 세션 타입 확장
interface CustomRequest extends Request {
  session: any
}

const router = Router()

// Google OAuth2 인증 시작
router.get('/google', (req: Request, res: Response) => {
  try {
    const oauth2Client = createOAuth2Client()
    const authUrl = getAuthUrl(oauth2Client)
    
    return res.json({
      success: true,
      authUrl,
      message: '인증 URL이 생성되었습니다.'
    })
  } catch (error) {
    console.error('Google OAuth2 인증 URL 생성 실패:', error)
    return res.status(500).json({
      success: false,
      message: '인증 URL 생성에 실패했습니다.'
    })
  }
})

// Google OAuth2 콜백 처리
router.get('/google/callback', async (req: CustomRequest, res: Response) => {
  try {
    const { code } = req.query

    if (!code) {
      return res.status(400).json({
        success: false,
        message: '인증 코드가 제공되지 않았습니다.'
      })
    }

    const oauth2Client = createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code as string)

    // 세션에 토큰 저장
    req.session.googleTokens = tokens
    
    // OAuth2 클라이언트에 토큰 설정
    oauth2Client.setCredentials(tokens)
    
    console.log('구글 OAuth 인증 성공:', {
      tokenType: tokens.token_type,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token
    })

    return res.json({
      success: true,
      message: 'Google 인증이 완료되었습니다.',
      hasRefreshToken: !!tokens.refresh_token
    })
  } catch (error) {
    console.error('Google OAuth2 콜백 처리 실패:', error)
    return res.status(500).json({
      success: false,
      message: 'Google 인증 처리에 실패했습니다.'
    })
  }
})

// 인증 상태 확인
router.get('/status', (req: CustomRequest, res: Response) => {
  const isAuthenticated = !!req.session.googleTokens
  
  return res.json({
    success: true,
    authenticated: isAuthenticated,
    message: isAuthenticated ? 'Google 계정이 연결되어 있습니다.' : 'Google 계정이 연결되지 않았습니다.'
  })
})

// 인증 해제
router.post('/logout', (req: CustomRequest, res: Response) => {
  delete req.session.googleTokens
  
  return res.json({
    success: true,
    message: 'Google 계정 연결이 해제되었습니다.'
  })
})

export default router