import axios from 'axios'
import { solapiConfig } from '../config/solapi'

export interface SolapiTokens {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
}

export interface SenderInfo {
  phoneNumber: string
  status: string
  name?: string
}

export interface KakaoTemplate {
  templateId: string
  name: string
  content: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  buttons?: any[]
}

export interface MessageSendResult {
  success: boolean
  messageId?: string
  statusCode?: string
  statusMessage?: string
  errorCode?: string
  errorMessage?: string
  messageType?: string
}

export class SolapiService {
  private tokens: SolapiTokens | null = null
  private stateStore: Map<string, number> = new Map() // CSRF 방지용 state 저장소

  /**
   * OAuth2 인증용 state 생성 및 저장
   */
  generateState(): string {
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
    this.stateStore.set(state, Date.now())
    return state
  }

  /**
   * State 유효성 검증 (CSRF 방지)
   */
  validateState(state: string): boolean {
    if (!this.stateStore.has(state)) {
      return false
    }
    
    const timestamp = this.stateStore.get(state)!
    const isValid = Date.now() - timestamp < 10 * 60 * 1000 // 10분 유효
    
    // 사용된 state는 제거
    this.stateStore.delete(state)
    
    return isValid
  }

  /**
   * OAuth2 콜백에서 받은 코드로 토큰 교환
   */
  async exchangeCodeForTokens(code: string, state?: string): Promise<SolapiTokens> {
    try {
      // State 파라미터 검증 (제공된 경우)
      if (state && !this.validateState(state)) {
        throw new Error('Invalid or expired state parameter')
      }

      // OAuth2 표준에 따른 form-urlencoded 형식
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: solapiConfig.clientId,
        client_secret: solapiConfig.clientSecret,
        redirect_uri: solapiConfig.redirectUri
      })

      const response = await axios.post(solapiConfig.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      this.tokens = response.data
      return response.data
    } catch (error: any) {
      console.error('SOLAPI 토큰 교환 실패:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message
      })
      
      // 더 구체적인 에러 메시지 제공
      if (error.response?.status === 400) {
        throw new Error('잘못된 인증 코드이거나 만료된 코드입니다.')
      } else if (error.response?.status === 401) {
        throw new Error('클라이언트 인증 정보가 올바르지 않습니다.')
      }
      
      throw new Error('SOLAPI 인증에 실패했습니다.')
    }
  }

  /**
   * 리프레시 토큰으로 액세스 토큰 갱신
   */
  async refreshTokens(refreshToken: string): Promise<SolapiTokens> {
    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: solapiConfig.clientId,
        client_secret: solapiConfig.clientSecret
      })

      const response = await axios.post(solapiConfig.tokenUrl, params, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      })

      this.tokens = response.data
      return response.data
    } catch (error: any) {
      console.error('SOLAPI 토큰 갱신 실패:', error.response?.data || error.message)
      throw new Error('토큰 갱신에 실패했습니다.')
    }
  }

  /**
   * 토큰 자동 갱신을 포함한 API 호출
   */
  private async makeAuthenticatedRequest(
    tokens: SolapiTokens, 
    requestFn: (accessToken: string) => Promise<any>
  ): Promise<any> {
    try {
      return await requestFn(tokens.access_token)
    } catch (error: any) {
      // 401 에러 시 토큰 갱신 시도
      if (error.response?.status === 401 && tokens.refresh_token) {
        console.log('Access token expired, attempting refresh...')
        try {
          const newTokens = await this.refreshTokens(tokens.refresh_token)
          return await requestFn(newTokens.access_token)
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError)
          throw new Error('인증이 만료되었습니다. 다시 로그인해주세요.')
        }
      }
      throw error
    }
  }

  /**
   * 계정 정보 조회
   */
  async getAccountInfo(tokens: SolapiTokens): Promise<any> {
    try {
      return await this.makeAuthenticatedRequest(tokens, async (accessToken) => {
        const response = await axios.get(`${solapiConfig.apiBaseUrl}/cash/v1/balance`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
        return response.data
      })
    } catch (error: any) {
      console.error('계정 정보 조회 실패:', error.response?.data || error.message)
      throw new Error('계정 정보를 가져올 수 없습니다.')
    }
  }

  /**
   * 발신번호 목록 조회
   */
  async getSenderIds(tokens: SolapiTokens): Promise<SenderInfo[]> {
    try {
      const result = await this.makeAuthenticatedRequest(tokens, async (accessToken) => {
        const response = await axios.get(`${solapiConfig.apiBaseUrl}/senderid/v1/list`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
        return response.data
      })

      return result.senderIdList || []
    } catch (error: any) {
      console.error('발신번호 조회 실패:', error.response?.data || error.message)
      throw new Error('발신번호 목록을 가져올 수 없습니다.')
    }
  }

  /**
   * 카카오톡 템플릿 목록 조회
   */
  async getKakaoTemplates(tokens: SolapiTokens): Promise<KakaoTemplate[]> {
    try {
      const response = await axios.get(`${solapiConfig.apiBaseUrl}/kakao/v1/templates`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      return response.data.templates || []
    } catch (error: any) {
      console.error('카카오톡 템플릿 조회 실패:', error.response?.data || error.message)
      throw new Error('카카오톡 템플릿을 가져올 수 없습니다.')
    }
  }

  /**
   * 카카오톡 알림톡 발송
   */
  async sendKakaoMessage(
    tokens: SolapiTokens,
    templateId: string,
    to: string,
    variables?: { [key: string]: string },
    from?: string
  ): Promise<MessageSendResult> {
    try {
      const messageData = {
        message: {
          to,
          from: from || '', // 발신번호 필요
          kakaoOptions: {
            pfId: '', // 카카오톡 채널 ID (나중에 설정)
            templateId,
            variables: variables || {}
          }
        }
      }

      const response = await axios.post(
        `${solapiConfig.apiBaseUrl}/messages/v4/send`,
        messageData,
        {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return {
        success: true,
        messageId: response.data.messageId,
        statusCode: response.data.statusCode,
        statusMessage: response.data.statusMessage
      }
    } catch (error: any) {
      console.error('카카오톡 메시지 발송 실패:', error.response?.data || error.message)
      
      return {
        success: false,
        errorCode: error.response?.data?.errorCode,
        errorMessage: error.response?.data?.message || '메시지 발송에 실패했습니다.'
      }
    }
  }

  /**
   * SMS 발송 (카카오톡 실패 시 대체)
   */
  async sendSMS(
    tokens: SolapiTokens,
    to: string,
    text: string,
    from: string
  ): Promise<MessageSendResult> {
    try {
      const messageData = {
        message: {
          to,
          from,
          text
        }
      }

      const response = await axios.post(
        `${solapiConfig.apiBaseUrl}/messages/v4/send`,
        messageData,
        {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return {
        success: true,
        messageId: response.data.messageId,
        statusCode: response.data.statusCode,
        statusMessage: response.data.statusMessage
      }
    } catch (error: any) {
      console.error('SMS 발송 실패:', error.response?.data || error.message)
      
      return {
        success: false,
        errorCode: error.response?.data?.errorCode,
        errorMessage: error.response?.data?.message || 'SMS 발송에 실패했습니다.'
      }
    }
  }

  /**
   * 메시지 발송 상태 조회
   */
  async getMessageStatus(tokens: SolapiTokens, messageId: string): Promise<any> {
    try {
      const response = await axios.get(
        `${solapiConfig.apiBaseUrl}/messages/v4/list/${messageId}`,
        {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Content-Type': 'application/json'
          }
        }
      )

      return response.data
    } catch (error: any) {
      console.error('메시지 상태 조회 실패:', error.response?.data || error.message)
      throw new Error('메시지 상태를 조회할 수 없습니다.')
    }
  }

  /**
   * 배달 완료 알림 발송 (메인 기능)
   */
  async sendDeliveryCompleteNotification(
    tokens: SolapiTokens,
    customerName: string,
    phoneNumber: string,
    from: string,
    templateId?: string
  ): Promise<MessageSendResult> {
    console.log(`배달 완료 알림 발송 시작: ${customerName} (${phoneNumber})`)
    
    try {
      // 전화번호 형식 검증 및 정규화
      const cleanPhone = phoneNumber.replace(/[^0-9]/g, '')
      if (cleanPhone.length < 10 || cleanPhone.length > 11) {
        return {
          success: false,
          errorMessage: '유효하지 않은 전화번호 형식입니다.'
        }
      }

      // 카카오톡 알림톡 시도
      if (templateId) {
        console.log(`카카오톡 알림톡 발송 시도 - 템플릿 ID: ${templateId}`)
        
        const kakaoResult = await this.sendKakaoMessage(
          tokens,
          templateId,
          cleanPhone,
          { 
            고객명: customerName,
            상품명: '주문 상품',
            배달시간: new Date().toLocaleTimeString('ko-KR'),
            날짜: new Date().toLocaleDateString('ko-KR')
          },
          from
        )

        if (kakaoResult.success) {
          console.log(`✅ 카카오톡 배달 완료 알림 발송 성공: ${customerName} (${cleanPhone})`)
          return {
            ...kakaoResult,
            messageType: 'kakao'
          }
        }

        console.log(`⚠️ 카카오톡 발송 실패: ${kakaoResult.errorMessage}, SMS로 대체 발송 시도`)
      } else {
        console.log('카카오톡 템플릿 ID가 없어 SMS로 직접 발송')
      }

      // SMS 대체 발송 - 더 정중하고 구체적인 메시지
      const currentTime = new Date().toLocaleString('ko-KR', {
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
      
      const smsText = `[배달완료] ${customerName}님, ${currentTime}에 주문하신 상품의 배달이 완료되었습니다. 맛있게 드세요! 감사합니다.`
      
      console.log(`SMS 대체 발송 시도: ${smsText}`)
      
      const smsResult = await this.sendSMS(tokens, cleanPhone, smsText, from)

      if (smsResult.success) {
        console.log(`✅ SMS 배달 완료 알림 발송 성공: ${customerName} (${cleanPhone})`)
        return {
          ...smsResult,
          messageType: 'sms'
        }
      } else {
        console.log(`❌ SMS 발송 실패: ${smsResult.errorMessage}`)
      }

      return smsResult
    } catch (error: any) {
      console.error('❌ 배달 완료 알림 발송 실패:', error)
      return {
        success: false,
        errorMessage: error.message || '배달 완료 알림 발송에 실패했습니다.',
        errorCode: 'DELIVERY_NOTIFICATION_ERROR'
      }
    }
  }
}

export default new SolapiService()