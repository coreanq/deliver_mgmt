import dotenv from 'dotenv'

dotenv.config()

export const solapiConfig = {
  clientId: process.env.SOLAPI_CLIENT_ID!,
  clientSecret: process.env.SOLAPI_CLIENT_SECRET!,
  redirectUri: process.env.SOLAPI_REDIRECT_URI!,
  
  // SOLAPI OAuth2 엔드포인트
  authUrl: 'https://api.solapi.com/oauth2/authorize',
  tokenUrl: 'https://api.solapi.com/oauth2/token',
  
  // API 기본 URL
  apiBaseUrl: 'https://api.solapi.com',
  
  // OAuth2 스코프
  scopes: [
    'message:write',    // 메시지 발송
    'cash:read',        // 잔액 조회
    'senderid:read',    // 발신번호 조회
    'kakao:write',      // 카카오톡 발송
    'kakao:read'        // 카카오톡 템플릿 조회
  ]
}

export const generateSolapiAuthUrl = (): string => {
  const params = new URLSearchParams({
    client_id: solapiConfig.clientId,
    redirect_uri: solapiConfig.redirectUri,
    scope: solapiConfig.scopes.join(' '),
    response_type: 'code'
  })

  return `${solapiConfig.authUrl}?${params.toString()}`
}