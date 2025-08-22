import 'express-session'

declare module 'express-session' {
  interface SessionData {
    tokens?: {
      access_token?: string
      refresh_token?: string
      scope?: string
      token_type?: string
      expiry_date?: number
    }
    googleTokens?: {
      access_token?: string
      refresh_token?: string
      scope?: string
      token_type?: string
      expiry_date?: number
    }
    solapiTokens?: {
      access_token?: string
      refresh_token?: string
      token_type?: string
      expires_in?: number
    }
    connectedSpreadsheet?: {
      id: string
      title: string
      connectedAt: string
    }
    syncActive?: boolean
    syncSessionId?: string
    deliveryAuth?: {
      staffName: string
      staffId: number
      workDate: string
      spreadsheetId: string
      loginTime: string
      tokenData: any
    }
  }
}