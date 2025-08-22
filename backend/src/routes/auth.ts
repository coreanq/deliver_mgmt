import { Router, Request, Response } from 'express'
import { createOAuth2Client, getAuthUrl } from '../config/google'
import crypto from 'crypto'

// 임시 인증 토큰 저장소 (실제 환경에서는 Redis 사용)
const tempAuthTokens = new Map<string, any>()

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
      return res.send(`
        <html>
          <body>
            <script>
              if (window.opener) {
                window.opener.postMessage({
                  type: 'oauth_error',
                  error: '인증 코드가 제공되지 않았습니다.'
                }, '*');
              }
              window.close();
            </script>
            <p>인증 코드가 없습니다. 창이 자동으로 닫힙니다.</p>
          </body>
        </html>
      `)
    }

    console.log('받은 OAuth 코드 (원본):', code)
    
    // HTML 엔티티 디코딩 (이중 인코딩 처리)
    const decodedCode = typeof code === 'string' ? 
      decodeURIComponent(code.replace(/&amp;/g, '&').replace(/&#x2F;/g, '/').replace(/&#x3D;/g, '=')) : code
    
    console.log('디코딩된 OAuth 코드:', decodedCode)
    
    const oauth2Client = createOAuth2Client()
    
    // 디코딩된 코드 사용
    const { tokens } = await oauth2Client.getToken(decodedCode as string)

    // 세션에 토큰 저장
    req.session.googleTokens = tokens
    
    // OAuth2 클라이언트에 토큰 설정
    oauth2Client.setCredentials(tokens)
    
    // 임시 인증 토큰 생성 (5분 만료)
    const tempToken = crypto.randomBytes(32).toString('hex')
    tempAuthTokens.set(tempToken, {
      tokens,
      createdAt: Date.now(),
      expiresAt: Date.now() + 5 * 60 * 1000 // 5분
    })
    
    console.log('구글 OAuth 인증 성공:', {
      tokenType: tokens.token_type,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      tempToken
    })

    // 임시 토큰과 함께 팝업 창에서 부모 창으로 메시지 전송
    return res.send(`
      <html>
        <body>
          <script>
            // 부모 창의 localStorage에 임시 토큰 저장
            if (window.opener && window.opener.localStorage) {
              window.opener.localStorage.setItem('google_temp_token', '${tempToken}');
            }
            
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth_success',
                message: 'Google 인증이 완료되었습니다.',
                hasRefreshToken: ${!!tokens.refresh_token},
                tempToken: '${tempToken}'
              }, '*');
            }
            window.close();
          </script>
          <p>인증이 완료되었습니다. 창이 자동으로 닫힙니다.</p>
        </body>
      </html>
    `)
  } catch (error) {
    console.error('Google OAuth2 콜백 처리 실패:', error)
    return res.send(`
      <html>
        <body>
          <script>
            if (window.opener) {
              window.opener.postMessage({
                type: 'oauth_error',
                error: 'Google 인증 처리에 실패했습니다.'
              }, '*');
            }
            window.close();
          </script>
          <p>인증에 실패했습니다. 창이 자동으로 닫힙니다.</p>
        </body>
      </html>
    `)
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

// 임시 토큰으로 인증 완료
router.post('/complete', (req: CustomRequest, res: Response) => {
  const { tempToken } = req.body
  
  if (!tempToken) {
    return res.status(400).json({
      success: false,
      message: '임시 토큰이 필요합니다.'
    })
  }
  
  const authData = tempAuthTokens.get(tempToken)
  if (!authData) {
    return res.status(400).json({
      success: false,
      message: '유효하지 않거나 만료된 토큰입니다.'
    })
  }
  
  // 만료 시간 확인
  if (Date.now() > authData.expiresAt) {
    tempAuthTokens.delete(tempToken)
    return res.status(400).json({
      success: false,
      message: '토큰이 만료되었습니다.'
    })
  }
  
  // 현재 세션에 토큰 저장
  req.session.googleTokens = authData.tokens
  
  // 임시 토큰 삭제
  tempAuthTokens.delete(tempToken)
  
  return res.json({
    success: true,
    message: 'Google 인증이 완료되었습니다.',
    authenticated: true
  })
})

// 임시 토큰 정리 (10분마다 실행)
setInterval(() => {
  const now = Date.now()
  for (const [token, data] of tempAuthTokens.entries()) {
    if (now > data.expiresAt) {
      tempAuthTokens.delete(token)
    }
  }
}, 10 * 60 * 1000)

export default router