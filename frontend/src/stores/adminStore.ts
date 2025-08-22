import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

// 인터페이스 정의
export interface DeliveryStaff {
  id: string
  name: string
  phone: string
  email?: string
  status: 'active' | 'inactive'
  vehicleType?: string
  notes?: string
  qrCodeUrl?: string
  qrCodeDataUrl?: string
  lastActive?: string
  createdAt: string
  updatedAt: string
}

export interface SheetConnection {
  id: string
  date: string
  spreadsheetId: string
  spreadsheetName: string
  spreadsheetUrl: string
  webViewLink?: string
  description?: string
  status: 'connected' | 'error' | 'testing'
  createdAt: string
  lastAccessed?: string
}

export interface SpreadsheetInfo {
  id: string
  name: string
  createdTime: string
  modifiedTime: string
  owners: string[]
  webViewLink: string
  size?: number
  starred: boolean
  shared: boolean
}

export interface SolapiAccount {
  accountId: string
  accountName: string
  balance: number
  connectedAt: string
}

export interface MessageSettings {
  senderPhone: string
  completionTemplate: string
  autoSend: boolean
}

export interface MessageHistory {
  id: string
  recipientPhone: string
  message: string
  status: 'sent' | 'failed' | 'pending'
  sentAt: string
  cost?: number
  errorMessage?: string
}

export const useAdminStore = defineStore('admin', () => {
  // === 상태 관리 ===
  
  // 인증 상태
  const isGoogleAuthenticated = ref(false)
  const isSolapiConnected = ref(false)
  
  // 로딩 상태
  const loading = ref({
    auth: false,
    staff: false,
    sheets: false,
    connections: false,
    solapi: false
  })
  
  // 배달기사 관리
  const deliveryStaff = ref<DeliveryStaff[]>([])
  const selectedStaff = ref<DeliveryStaff | null>(null)
  
  // 스프레드시트 관리
  const spreadsheets = ref<SpreadsheetInfo[]>([])
  const connectedSheets = ref<SpreadsheetInfo[]>([])
  const sheetConnections = ref<SheetConnection[]>([])
  const nextPageToken = ref<string | null>(null)
  
  // SOLAPI 관리
  const solapiAccount = ref<SolapiAccount | null>(null)
  const messageSettings = ref<MessageSettings>({
    senderPhone: '',
    completionTemplate: '{customerName}님, 주문하신 상품이 배달 완료되었습니다. 감사합니다!',
    autoSend: true
  })
  const messageHistory = ref<MessageHistory[]>([])
  
  // 검색 및 필터
  const searchQuery = ref('')
  const filterPreferences = ref<any[]>([])
  
  // === 계산된 속성 ===
  
  const activeStaff = computed(() => 
    deliveryStaff.value.filter(staff => staff.status === 'active')
  )
  
  const inactiveStaff = computed(() => 
    deliveryStaff.value.filter(staff => staff.status === 'inactive')
  )
  
  const connectedSheetConnections = computed(() =>
    sheetConnections.value.filter(conn => conn.status === 'connected')
  )
  
  const recentConnections = computed(() =>
    sheetConnections.value
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10)
  )
  
  const successfulMessages = computed(() =>
    messageHistory.value.filter(msg => msg.status === 'sent')
  )
  
  const failedMessages = computed(() =>
    messageHistory.value.filter(msg => msg.status === 'failed')
  )
  
  // === 인증 관련 액션 ===
  
  const checkGoogleAuthStatus = async () => {
    try {
      loading.value.auth = true
      const response = await axios.get('/api/admin/auth-status')
      isGoogleAuthenticated.value = response.data.authenticated
      return response.data.authenticated
    } catch (error) {
      console.error('Google 인증 상태 확인 실패:', error)
      isGoogleAuthenticated.value = false
      return false
    } finally {
      loading.value.auth = false
    }
  }
  
  const authenticateGoogle = async () => {
    try {
      loading.value.auth = true
      const response = await axios.get('/api/admin/google-auth-url')
      
      // 팝업 창에서 인증 진행
      const popup = window.open(response.data.authUrl, 'googleAuth', 'width=500,height=600')
      console.log('Google 인증 팝업 열림:', popup)
      
      // 팝업에서 인증 완료 메시지 대기
      return new Promise((resolve, reject) => {
        let authTimeout: NodeJS.Timeout
        let checkClosed: NodeJS.Timeout
        
        const handleMessage = async (event: MessageEvent) => {
          console.log('팝업에서 메시지 받음:', event.data)
          if (event.data.type === 'oauth_success') {
            console.log('Google 인증 성공! 임시 토큰:', event.data.tempToken)
            clearInterval(checkClosed)
            clearTimeout(authTimeout)
            window.removeEventListener('message', handleMessage)
            popup?.close()
            
            // 임시 토큰으로 현재 세션에 인증 완료
            try {
              const completeResponse = await axios.post('/api/auth/complete', {
                tempToken: event.data.tempToken
              })
              console.log('세션 인증 완료:', completeResponse.data)
              
              // 인증 상태 업데이트
              await checkGoogleAuthStatus()
              resolve(event.data)
            } catch (error) {
              console.error('세션 인증 완료 실패:', error)
              reject(new Error('세션 인증 완료에 실패했습니다.'))
            }
          } else if (event.data.type === 'oauth_error') {
            console.log('Google 인증 실패:', event.data.error)
            clearInterval(checkClosed)
            clearTimeout(authTimeout)
            window.removeEventListener('message', handleMessage)
            popup?.close()
            reject(new Error(event.data.error))
          }
        }
        
        window.addEventListener('message', handleMessage)
        
        // 팝업이 닫힌 경우 처리 (더 긴 타임아웃 설정)
        checkClosed = setInterval(() => {
          if (popup?.closed) {
            clearInterval(checkClosed)
            clearTimeout(authTimeout)
            window.removeEventListener('message', handleMessage)
            reject(new Error('인증이 취소되었습니다.'))
          }
        }, 2000)
        
        // 30초 타임아웃 설정
        authTimeout = setTimeout(() => {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          popup?.close()
          reject(new Error('인증 시간이 초과되었습니다.'))
        }, 30000)
      })
    } catch (error) {
      console.error('Google 인증 실패:', error)
      throw error
    } finally {
      loading.value.auth = false
    }
  }
  
  const checkSolapiStatus = async () => {
    try {
      loading.value.solapi = true
      const response = await axios.get('/api/solapi/status')
      isSolapiConnected.value = response.data.connected
      if (response.data.connected) {
        solapiAccount.value = response.data.accountInfo
      }
      return response.data.connected
    } catch (error) {
      console.error('SOLAPI 상태 확인 실패:', error)
      isSolapiConnected.value = false
      return false
    } finally {
      loading.value.solapi = false
    }
  }
  
  // === 배달기사 관리 액션 ===
  
  const loadDeliveryStaff = async () => {
    try {
      loading.value.staff = true
      const response = await axios.get('/api/admin/staff')
      deliveryStaff.value = response.data.data || []
      return response.data
    } catch (error) {
      console.error('배달기사 목록 로드 실패:', error)
      throw error
    } finally {
      loading.value.staff = false
    }
  }
  
  const addDeliveryStaff = async (staffData: Partial<DeliveryStaff>) => {
    try {
      const response = await axios.post('/api/admin/staff', staffData)
      if (response.data.success && response.data.data) {
        deliveryStaff.value.push(response.data.data)
      }
      return response.data
    } catch (error) {
      console.error('배달기사 추가 실패:', error)
      throw error
    }
  }
  
  const updateDeliveryStaff = async (staffId: string, staffData: Partial<DeliveryStaff>) => {
    try {
      const response = await axios.put(`/api/admin/delivery-staff/${staffId}`, staffData)
      const index = deliveryStaff.value.findIndex(staff => staff.id === staffId)
      if (index !== -1) {
        deliveryStaff.value[index] = response.data
      }
      return response.data
    } catch (error) {
      console.error('배달기사 수정 실패:', error)
      throw error
    }
  }
  
  const deleteDeliveryStaff = async (staffId: string) => {
    try {
      await axios.delete(`/api/admin/delivery-staff/${staffId}`)
      deliveryStaff.value = deliveryStaff.value.filter(staff => staff.id !== staffId)
      return true
    } catch (error) {
      console.error('배달기사 삭제 실패:', error)
      throw error
    }
  }
  
  const toggleStaffStatus = async (staffId: string) => {
    try {
      const staff = deliveryStaff.value.find(s => s.id === staffId)
      if (!staff) return
      
      const newStatus = staff.status === 'active' ? 'inactive' : 'active'
      await axios.patch(`/api/admin/delivery-staff/${staffId}/status`, { status: newStatus })
      
      staff.status = newStatus
      return staff
    } catch (error) {
      console.error('배달기사 상태 변경 실패:', error)
      throw error
    }
  }
  
  const generateStaffQrCode = async (staffId: string) => {
    try {
      const staff = deliveryStaff.value.find(s => s.id === staffId)
      if (!staff) throw new Error('배달기사를 찾을 수 없습니다.')
      
      const response = await axios.post('/api/qr/generate', {
        staffName: staff.name,
        sheetName: staff.name
      })
      
      staff.qrCodeUrl = response.data.data.qrCodeUrl
      staff.qrCodeDataUrl = response.data.data.qrCodeDataUrl
      
      return response.data
    } catch (error) {
      console.error('QR 코드 생성 실패:', error)
      throw error
    }
  }
  
  const generateAllQrCodes = async () => {
    try {
      const activeStaffList = activeStaff.value
      const promises = activeStaffList.map(staff => generateStaffQrCode(staff.id))
      const results = await Promise.allSettled(promises)
      
      const successful = results.filter(result => result.status === 'fulfilled').length
      const failed = results.filter(result => result.status === 'rejected').length
      
      return { successful, failed, total: activeStaffList.length }
    } catch (error) {
      console.error('QR 코드 일괄 생성 실패:', error)
      throw error
    }
  }
  
  // === 스프레드시트 관리 액션 ===
  
  const searchSpreadsheets = async (params: {
    query?: string
    orderBy?: string
    pageSize?: number
    pageToken?: string
    filterType?: string
  } = {}) => {
    try {
      loading.value.sheets = true
      
      if (params.filterType === 'starred') {
        const response = await axios.get('/api/admin/spreadsheets/starred')
        spreadsheets.value = response.data
        nextPageToken.value = null
      } else {
        const response = await axios.get('/api/admin/spreadsheets', { params })
        
        if (params.pageToken) {
          spreadsheets.value.push(...response.data.files)
        } else {
          spreadsheets.value = response.data.files
        }
        nextPageToken.value = response.data.nextPageToken || null
      }
      
      return spreadsheets.value
    } catch (error) {
      console.error('스프레드시트 검색 실패:', error)
      throw error
    } finally {
      loading.value.sheets = false
    }
  }
  
  const connectSpreadsheets = async (spreadsheetIds: string[]) => {
    try {
      const response = await axios.post('/api/admin/spreadsheets/bulk-connect', {
        spreadsheetIds
      })
      
      await loadConnectedSheets()
      return response.data
    } catch (error) {
      console.error('스프레드시트 연결 실패:', error)
      throw error
    }
  }
  
  const loadConnectedSheets = async () => {
    try {
      const response = await axios.get('/api/admin/connected-sheets')
      connectedSheets.value = response.data
      return response.data
    } catch (error) {
      console.error('연결된 시트 목록 로드 실패:', error)
      throw error
    }
  }
  
  const disconnectSheet = async (sheetId: string) => {
    try {
      await axios.delete(`/api/admin/connected-sheets/${sheetId}`)
      connectedSheets.value = connectedSheets.value.filter(sheet => sheet.id !== sheetId)
      return true
    } catch (error) {
      console.error('시트 연결 해제 실패:', error)
      throw error
    }
  }
  
  const toggleSheetStar = async (sheetId: string) => {
    try {
      const response = await axios.post(`/api/admin/spreadsheets/${sheetId}/toggle-star`)
      const sheet = spreadsheets.value.find(s => s.id === sheetId)
      if (sheet) {
        sheet.starred = response.data.starred
      }
      return response.data.starred
    } catch (error) {
      console.error('즐겨찾기 설정 실패:', error)
      throw error
    }
  }
  
  // === 날짜별 시트 연결 관리 ===
  
  const loadSheetConnections = async () => {
    try {
      loading.value.connections = true
      const response = await axios.get('/api/admin/sheet-mappings')
      sheetConnections.value = response.data.data || []
      return response.data
    } catch (error) {
      console.error('시트 연결 목록 로드 실패:', error)
      throw error
    } finally {
      loading.value.connections = false
    }
  }
  
  const addSheetConnection = async (connectionData: Partial<SheetConnection>) => {
    try {
      const response = await axios.post('/api/admin/sheet-mapping', connectionData)
      sheetConnections.value.push(response.data)
      return response.data
    } catch (error) {
      console.error('시트 연결 추가 실패:', error)
      throw error
    }
  }
  
  const updateSheetConnection = async (connectionId: string, connectionData: Partial<SheetConnection>) => {
    try {
      const response = await axios.put(`/api/admin/sheet-connections/${connectionId}`, connectionData)
      const index = sheetConnections.value.findIndex(conn => conn.id === connectionId)
      if (index !== -1) {
        sheetConnections.value[index] = response.data
      }
      return response.data
    } catch (error) {
      console.error('시트 연결 수정 실패:', error)
      throw error
    }
  }
  
  const removeSheetConnection = async (connectionId: string) => {
    try {
      await axios.delete(`/api/admin/sheet-connections/${connectionId}`)
      sheetConnections.value = sheetConnections.value.filter(conn => conn.id !== connectionId)
      return true
    } catch (error) {
      console.error('시트 연결 제거 실패:', error)
      throw error
    }
  }
  
  const testSheetConnection = async (connectionId: string) => {
    try {
      const response = await axios.post(`/api/admin/sheet-connections/${connectionId}/test`)
      const connection = sheetConnections.value.find(conn => conn.id === connectionId)
      if (connection) {
        connection.status = response.data.success ? 'connected' : 'error'
      }
      return response.data
    } catch (error) {
      console.error('시트 연결 테스트 실패:', error)
      throw error
    }
  }
  
  const getConnectionByDate = (date: string) => {
    return sheetConnections.value.find(conn => conn.date === date)
  }
  
  // === SOLAPI 관리 액션 ===
  
  const authenticateSolapi = async () => {
    try {
      loading.value.solapi = true
      const response = await axios.get('/api/solapi/auth-url')
      window.location.href = response.data.authUrl
    } catch (error) {
      console.error('SOLAPI 인증 실패:', error)
      throw error
    } finally {
      loading.value.solapi = false
    }
  }
  
  const disconnectSolapi = async () => {
    try {
      await axios.post('/api/solapi/disconnect')
      isSolapiConnected.value = false
      solapiAccount.value = null
      return true
    } catch (error) {
      console.error('SOLAPI 연결 해제 실패:', error)
      throw error
    }
  }
  
  const refreshSolapiAccount = async () => {
    try {
      const response = await axios.get('/api/solapi/account')
      solapiAccount.value = response.data
      return response.data
    } catch (error) {
      console.error('SOLAPI 계정 정보 새로고침 실패:', error)
      throw error
    }
  }
  
  const loadMessageSettings = async () => {
    try {
      const response = await axios.get('/api/solapi/settings')
      if (response.data) {
        messageSettings.value = { ...messageSettings.value, ...response.data }
      }
      return messageSettings.value
    } catch (error) {
      console.error('메시지 설정 로드 실패:', error)
      throw error
    }
  }
  
  const saveMessageSettings = async (settings: Partial<MessageSettings>) => {
    try {
      await axios.post('/api/solapi/settings', settings)
      messageSettings.value = { ...messageSettings.value, ...settings }
      return messageSettings.value
    } catch (error) {
      console.error('메시지 설정 저장 실패:', error)
      throw error
    }
  }
  
  const sendTestMessage = async (recipientPhone: string, message: string, senderPhone?: string) => {
    try {
      const response = await axios.post('/api/solapi/send', {
        to: recipientPhone.replace(/[^0-9]/g, ''),
        message,
        from: senderPhone ? senderPhone.replace(/[^0-9]/g, '') : messageSettings.value.senderPhone.replace(/[^0-9]/g, '')
      })
      
      await loadMessageHistory()
      return response.data
    } catch (error) {
      console.error('테스트 메시지 발송 실패:', error)
      throw error
    }
  }
  
  const loadMessageHistory = async () => {
    try {
      const response = await axios.get('/api/solapi/history')
      messageHistory.value = response.data
      return response.data
    } catch (error) {
      console.error('메시지 발송 내역 로드 실패:', error)
      throw error
    }
  }
  
  // === 필터 및 검색 관리 ===
  
  const loadFilterPreferences = async () => {
    try {
      const response = await axios.get('/api/admin/filter-preferences')
      filterPreferences.value = response.data
      return response.data
    } catch (error) {
      console.error('필터 기본 설정 로드 실패:', error)
      throw error
    }
  }
  
  const saveFilterPreference = async (filterData: any) => {
    try {
      const response = await axios.post('/api/admin/filter-preferences', filterData)
      filterPreferences.value.push(response.data)
      return response.data
    } catch (error) {
      console.error('필터 저장 실패:', error)
      throw error
    }
  }
  
  const deleteFilterPreference = async (filterId: string) => {
    try {
      await axios.delete(`/api/admin/filter-preferences/${filterId}`)
      filterPreferences.value = filterPreferences.value.filter(filter => filter.id !== filterId)
      return true
    } catch (error) {
      console.error('필터 삭제 실패:', error)
      throw error
    }
  }
  
  // === 초기화 및 리셋 ===
  
  const initializeStore = async () => {
    try {
      await Promise.all([
        checkGoogleAuthStatus(),
        checkSolapiStatus(),
        loadFilterPreferences()
      ])
      
      if (isGoogleAuthenticated.value) {
        await Promise.all([
          loadDeliveryStaff(),
          loadConnectedSheets(),
          loadSheetConnections()
        ])
      }
      
      if (isSolapiConnected.value) {
        await Promise.all([
          loadMessageSettings(),
          loadMessageHistory()
        ])
      }
    } catch (error) {
      console.error('스토어 초기화 실패:', error)
    }
  }
  
  const resetStore = () => {
    // 상태 초기화
    isGoogleAuthenticated.value = false
    isSolapiConnected.value = false
    
    // 데이터 초기화
    deliveryStaff.value = []
    selectedStaff.value = null
    spreadsheets.value = []
    connectedSheets.value = []
    sheetConnections.value = []
    solapiAccount.value = null
    messageHistory.value = []
    filterPreferences.value = []
    
    // 로딩 상태 초기화
    loading.value = {
      auth: false,
      staff: false,
      sheets: false,
      connections: false,
      solapi: false
    }
    
    // 검색 상태 초기화
    searchQuery.value = ''
    nextPageToken.value = null
  }
  
  // === 반환 ===
  return {
    // 상태
    isGoogleAuthenticated,
    isSolapiConnected,
    loading,
    deliveryStaff,
    selectedStaff,
    spreadsheets,
    connectedSheets,
    sheetConnections,
    nextPageToken,
    solapiAccount,
    messageSettings,
    messageHistory,
    searchQuery,
    filterPreferences,
    
    // 계산된 속성
    activeStaff,
    inactiveStaff,
    connectedSheetConnections,
    recentConnections,
    successfulMessages,
    failedMessages,
    
    // 인증 액션
    checkGoogleAuthStatus,
    authenticateGoogle,
    checkSolapiStatus,
    
    // 배달기사 관리 액션
    loadDeliveryStaff,
    addDeliveryStaff,
    updateDeliveryStaff,
    deleteDeliveryStaff,
    toggleStaffStatus,
    generateStaffQrCode,
    generateAllQrCodes,
    
    // 스프레드시트 관리 액션
    searchSpreadsheets,
    connectSpreadsheets,
    loadConnectedSheets,
    disconnectSheet,
    toggleSheetStar,
    
    // 날짜별 시트 연결 관리
    loadSheetConnections,
    addSheetConnection,
    updateSheetConnection,
    removeSheetConnection,
    testSheetConnection,
    getConnectionByDate,
    
    // SOLAPI 관리 액션
    authenticateSolapi,
    disconnectSolapi,
    refreshSolapiAccount,
    loadMessageSettings,
    saveMessageSettings,
    sendTestMessage,
    loadMessageHistory,
    
    // 필터 및 검색 관리
    loadFilterPreferences,
    saveFilterPreference,
    deleteFilterPreference,
    
    // 유틸리티
    initializeStore,
    resetStore
  }
})

export type AdminStore = ReturnType<typeof useAdminStore>