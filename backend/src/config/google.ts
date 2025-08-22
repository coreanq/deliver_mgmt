import { google } from 'googleapis'
import dotenv from 'dotenv'

dotenv.config()

// 동적 리다이렉트 URI 생성
const getRedirectUri = () => {
  const serverIp = process.env.SERVER_IP || 'localhost'
  const serverPort = process.env.SERVER_PORT || '5000'
  return `http://${serverIp}:${serverPort}/api/auth/google/callback`
}

export const googleConfig = {
  clientId: process.env.GOOGLE_CLIENT_ID!,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
  redirectUri: getRedirectUri(),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive.readonly'
  ]
}

export const createOAuth2Client = () => {
  return new google.auth.OAuth2(
    googleConfig.clientId,
    googleConfig.clientSecret,
    googleConfig.redirectUri
  )
}

export const getAuthUrl = (oauth2Client: any) => {
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: googleConfig.scopes,
    prompt: 'consent'
  })
}