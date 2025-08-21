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
}

export class SolapiService {
  private tokens: SolapiTokens | null = null

  /**
   * OAuth2 콜백에서 받은 코드로 토큰 교환
   */
  async exchangeCodeForTokens(code: string): Promise<SolapiTokens> {
    try {
      const response = await axios.post(solapiConfig.tokenUrl, {
        grant_type: 'authorization_code',
        code,
        client_id: solapiConfig.clientId,
        client_secret: solapiConfig.clientSecret,
        redirect_uri: solapiConfig.redirectUri
      }, {
        headers: {
          'Content-Type': 'application/json'
        }
      })

      this.tokens = response.data
      return response.data
    } catch (error: any) {
      console.error('SOLAPI 토큰 교환 실패:', error.response?.data || error.message)
      throw new Error('SOLAPI 인증에 실패했습니다.')
    }
  }

  /**
   * 리프레시 토큰으로 액세스 토큰 갱신
   */
  async refreshTokens(refreshToken: string): Promise<SolapiTokens> {
    try {
      const response = await axios.post(solapiConfig.tokenUrl, {
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: solapiConfig.clientId,
        client_secret: solapiConfig.clientSecret
      }, {
        headers: {
          'Content-Type': 'application/json'
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
   * 계정 정보 조회
   */
  async getAccountInfo(tokens: SolapiTokens): Promise<any> {
    try {
      const response = await axios.get(`${solapiConfig.apiBaseUrl}/cash/v1/balance`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      return response.data
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
      const response = await axios.get(`${solapiConfig.apiBaseUrl}/senderid/v1/list`, {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
          'Content-Type': 'application/json'
        }
      })

      return response.data.senderIdList || []
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
    try {
      // 카카오톡 알림톡 시도
      if (templateId) {
        const kakaoResult = await this.sendKakaoMessage(
          tokens,
          templateId,
          phoneNumber,
          { 고객명: customerName },
          from
        )

        if (kakaoResult.success) {
          console.log(`카카오톡 배달 완료 알림 발송 성공: ${customerName} (${phoneNumber})`)
          return kakaoResult
        }

        console.log('카카오톡 발송 실패, SMS로 대체 발송 시도')
      }

      // SMS 대체 발송
      const smsText = `${customerName}님, 주문하신 상품이 성공적으로 배달 완료되었습니다. 맛있게 드세요!`
      const smsResult = await this.sendSMS(tokens, phoneNumber, smsText, from)

      if (smsResult.success) {
        console.log(`SMS 배달 완료 알림 발송 성공: ${customerName} (${phoneNumber})`)
      }

      return smsResult
    } catch (error: any) {
      console.error('배달 완료 알림 발송 실패:', error)
      return {
        success: false,
        errorMessage: '배달 완료 알림 발송에 실패했습니다.'
      }
    }
  }
}

export default new SolapiService()