import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import { useErrorTracker } from '@/services/ErrorTracker'

export interface DeliveryOrder {
  rowIndex: number
  customerName: string
  phone: string
  address: string
  status: '대기' | '준비중' | '출발' | '완료'
  updating?: boolean
  lastUpdated?: string
}

export interface StatusInfo {
  status: string
  description: string
  color: string
  icon: string
  isCompleted?: boolean
  isInProgress?: boolean
  nextValidStatuses?: string[]
}

export interface StatusTransitionRule {
  from: string
  to: string
  allowed: boolean
}

export interface DeliveryStaff {
  staffName: string
  workDate: string
  phone?: string
  email?: string
}

export interface DeliverySession {
  staff: DeliveryStaff | null
  isAuthenticated: boolean
  orders: DeliveryOrder[]
  lastSync: string | null
}

export const useDeliveryStore = defineStore('delivery', () => {
  const errorTracker = useErrorTracker()
  
  // State
  const session = ref<DeliverySession>({
    staff: null,
    isAuthenticated: false,
    orders: [],
    lastSync: null
  })
  
  const loading = ref(false)
  const syncInProgress = ref(false)
  
  // Status Management State
  const statusInfo = ref<Record<string, StatusInfo>>({})
  const validStatuses = ref<string[]>([])
  const statusLoading = ref(false)
  
  // Getters (Computed)
  const isAuthenticated = computed(() => session.value.isAuthenticated)
  const currentStaff = computed(() => session.value.staff)
  const orders = computed(() => session.value.orders)
  const ordersCount = computed(() => session.value.orders.length)
  const completedOrders = computed(() => 
    session.value.orders.filter(order => order.status === '완료').length
  )
  const pendingOrders = computed(() => 
    session.value.orders.filter(order => order.status !== '완료').length
  )
  const completionRate = computed(() => {
    if (ordersCount.value === 0) return 0
    return Math.round((completedOrders.value / ordersCount.value) * 100)
  })
  
  // 상태별 주문 필터링
  const getOrdersByStatus = computed(() => (status: string) => {
    if (status === '전체') return session.value.orders
    return session.value.orders.filter(order => order.status === status)
  })
  
  // 다음 가능한 상태 계산
  const getNextValidStatuses = computed(() => (currentStatus: string): Array<{title: string, value: string}> => {
    const statusFlow = ['대기', '준비중', '출발', '완료']
    const currentIndex = statusFlow.indexOf(currentStatus)
    
    if (currentIndex === -1) return []
    
    // 현재 상태 이후의 모든 상태 반환
    return statusFlow.slice(currentIndex).map(status => ({
      title: status,
      value: status
    }))
  })
  
  // Actions
  
  /**
   * 상태 정보 로드
   */
  const loadStatusInfo = async () => {
    if (statusLoading.value) return
    
    statusLoading.value = true
    try {
      const response = await axios.get('/api/delivery/status-info')
      
      if (response.data.success) {
        const data = response.data.data
        statusInfo.value = data.statusDescriptions
        validStatuses.value = data.validStatuses
      }
    } catch (error: any) {
      errorTracker.captureError(error, {
        action: 'load_status_info'
      })
      console.error('상태 정보 로드 실패:', error)
    } finally {
      statusLoading.value = false
    }
  }

  /**
   * 상태 전환 유효성 검증
   */
  const validateStatusTransition = async (currentStatus: string, newStatus: string): Promise<{
    isValid: boolean
    errorMessage?: string
    nextValidStatuses: string[]
  }> => {
    try {
      const response = await axios.post('/api/delivery/validate-transition', {
        currentStatus,
        newStatus
      })
      
      if (response.data.success) {
        const data = response.data.data
        return {
          isValid: data.isValidTransition,
          errorMessage: data.errorMessage,
          nextValidStatuses: data.validNextStatuses
        }
      }
      
      return { isValid: false, errorMessage: '검증 요청 실패', nextValidStatuses: [] }
    } catch (error: any) {
      errorTracker.captureError(error, {
        action: 'validate_status_transition',
        currentStatus,
        newStatus
      })
      
      return { isValid: false, errorMessage: '네트워크 오류', nextValidStatuses: [] }
    }
  }

  /**
   * 주문별 상태 히스토리 조회
   */
  const getOrderStatusHistory = async (staffName: string, rowIndex: number) => {
    try {
      const response = await axios.get(`/api/delivery/status-history/${staffName}/${rowIndex}`)
      
      if (response.data.success) {
        return response.data.data
      } else {
        throw new Error(response.data.message)
      }
    } catch (error: any) {
      errorTracker.captureError(error, {
        action: 'get_order_status_history',
        staffName,
        rowIndex
      })
      throw error
    }
  }

  /**
   * 상태 정보 헬퍼 함수들
   */
  const getStatusInfo = (status: string): StatusInfo | null => {
    return statusInfo.value[status] || null
  }

  const getNextValidStatusesForOrder = (currentStatus: string): StatusInfo[] => {
    const statusFlow = ['대기', '준비중', '출발', '완료']
    const currentIndex = statusFlow.indexOf(currentStatus)
    
    if (currentIndex === -1) return []
    
    // 현재 상태의 다음 상태만 반환 (순차적 전환)
    const nextStatus = statusFlow[currentIndex + 1]
    if (nextStatus && statusInfo.value[nextStatus]) {
      return [statusInfo.value[nextStatus]]
    }
    
    return []
  }

  const canTransitionTo = (currentStatus: string, targetStatus: string): boolean => {
    const statusFlow = ['대기', '준비중', '출발', '완료']
    const currentIndex = statusFlow.indexOf(currentStatus)
    const targetIndex = statusFlow.indexOf(targetStatus)
    
    // 현재 상태와 같거나, 다음 순서 상태로만 전환 가능
    return targetIndex >= currentIndex && targetIndex <= currentIndex + 1
  }
  
  /**
   * QR 코드로 로그인
   */
  const loginWithQR = async (staffName: string, token: string, workDate?: string) => {
    loading.value = true
    try {
      const response = await axios.post('/api/delivery/qr-login', {
        staffName,
        token,
        workDate
      })
      
      if (response.data.success) {
        const data = response.data.data
        session.value = {
          staff: {
            staffName: data.staffName,
            workDate: data.workDate,
            phone: data.staffInfo?.phone,
            email: data.staffInfo?.email
          },
          isAuthenticated: true,
          orders: data.orders || [],
          lastSync: new Date().toISOString()
        }
        
        // 사용자 액션 추적
        errorTracker.captureUserAction('qr_login', {
          staffName: data.staffName,
          workDate: data.workDate,
          ordersCount: data.orders?.length || 0
        })
        
        return { success: true, data: response.data }
      } else {
        throw new Error(response.data.message)
      }
    } catch (error: any) {
      errorTracker.captureError(error, {
        action: 'qr_login',
        staffName,
        workDate
      })
      throw error
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 현재 작업 로드 (재인증)
   */
  const loadCurrentWork = async () => {
    loading.value = true
    try {
      const response = await axios.get('/api/delivery/current-work')
      
      if (response.data.success) {
        const data = response.data.data
        session.value = {
          staff: {
            staffName: data.staffName,
            workDate: data.workDate,
            phone: data.staffInfo?.phone,
            email: data.staffInfo?.email
          },
          isAuthenticated: true,
          orders: data.orders?.map((order: any) => ({
            ...order,
            updating: false,
            lastUpdated: new Date().toISOString()
          })) || [],
          lastSync: new Date().toISOString()
        }
        
        return { success: true, data: response.data }
      } else {
        throw new Error(response.data.message)
      }
    } catch (error: any) {
      // 401 에러의 경우 인증 실패로 처리
      if (error.response?.status === 401) {
        await logout()
      }
      
      errorTracker.captureError(error, {
        action: 'load_current_work'
      })
      throw error
    } finally {
      loading.value = false
    }
  }
  
  /**
   * 주문 상태 업데이트
   */
  const updateOrderStatus = async (
    order: DeliveryOrder, 
    newStatus: string,
    options?: {
      sendNotification?: boolean
      showConfirmation?: boolean
    }
  ) => {
    const orderIndex = session.value.orders.findIndex(o => o.rowIndex === order.rowIndex)
    if (orderIndex === -1) {
      throw new Error('주문을 찾을 수 없습니다.')
    }
    
    // 낙관적 업데이트 - UI에서 즉시 반영
    const originalStatus = order.status
    session.value.orders[orderIndex].updating = true
    
    try {
      const response = await axios.put('/api/delivery/update-status', {
        rowIndex: order.rowIndex,
        status: newStatus,
        customerName: order.customerName,
        ...options
      })
      
      if (response.data.success) {
        // 성공 시 상태 업데이트
        session.value.orders[orderIndex] = {
          ...session.value.orders[orderIndex],
          status: newStatus as any,
          lastUpdated: new Date().toISOString(),
          updating: false
        }
        
        // 성능 메트릭 추적
        errorTracker.capturePerformance('order_status_update', Date.now(), {
          fromStatus: originalStatus,
          toStatus: newStatus,
          orderIndex: order.rowIndex
        })
        
        // 사용자 액션 추적
        errorTracker.captureUserAction('order_status_update', {
          customerName: order.customerName,
          fromStatus: originalStatus,
          toStatus: newStatus,
          completedDelivery: newStatus === '완료'
        })
        
        return { 
          success: true, 
          message: response.data.message,
          shouldSendNotification: response.data.shouldSendNotification 
        }
      } else {
        throw new Error(response.data.message)
      }
    } catch (error: any) {
      // 에러 시 원래 상태로 롤백
      session.value.orders[orderIndex].status = originalStatus
      session.value.orders[orderIndex].updating = false
      
      errorTracker.captureError(error, {
        action: 'update_order_status',
        orderIndex: order.rowIndex,
        fromStatus: originalStatus,
        toStatus: newStatus
      })
      
      throw error
    }
  }
  
  /**
   * 여러 주문 상태 일괄 업데이트
   */
  const batchUpdateOrderStatus = async (
    updates: Array<{
      order: DeliveryOrder
      newStatus: string
    }>
  ) => {
    const promises = updates.map(({ order, newStatus }) => 
      updateOrderStatus(order, newStatus)
    )
    
    try {
      const results = await Promise.allSettled(promises)
      
      const successful = results.filter(result => result.status === 'fulfilled').length
      const failed = results.filter(result => result.status === 'rejected').length
      
      errorTracker.captureInfo('batch_order_update_completed', {
        totalUpdates: updates.length,
        successful,
        failed
      })
      
      return {
        successful,
        failed,
        total: updates.length
      }
    } catch (error: any) {
      errorTracker.captureError(error, {
        action: 'batch_update_orders',
        updateCount: updates.length
      })
      throw error
    }
  }
  
  /**
   * 주문 목록 새로고침
   */
  const refreshOrders = async () => {
    syncInProgress.value = true
    try {
      await loadCurrentWork()
      
      errorTracker.captureUserAction('refresh_orders', {
        ordersCount: session.value.orders.length,
        staffName: session.value.staff?.staffName
      })
      
    } finally {
      syncInProgress.value = false
    }
  }
  
  // WebSocket 연결 상태
  const wsConnected = ref(false)
  let socket: WebSocket | null = null
  
  /**
   * 실시간 동기화 (WebSocket 연동)
   */
  const enableRealtimeSync = () => {
    if (!session.value.isAuthenticated || !session.value.staff) {
      console.warn('WebSocket: 인증되지 않은 상태입니다.')
      return
    }

    const wsUrl = `ws://${window.location.hostname}:5001/ws/delivery`
    
    try {
      socket = new WebSocket(wsUrl)
      
      socket.onopen = () => {
        wsConnected.value = true
        console.log('WebSocket 연결됨')
        
        // 배달자 정보로 구독
        socket?.send(JSON.stringify({
          type: 'subscribe',
          staffName: session.value.staff?.staffName,
          workDate: session.value.staff?.workDate
        }))
        
        errorTracker.captureInfo('websocket_connected', {
          staffName: session.value.staff?.staffName
        })
      }
      
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data)
          handleRealtimeUpdate(message)
        } catch (error) {
          console.error('WebSocket 메시지 파싱 실패:', error)
        }
      }
      
      socket.onclose = () => {
        wsConnected.value = false
        console.log('WebSocket 연결 종료')
        
        // 자동 재연결 (3초 후)
        setTimeout(() => {
          if (session.value.isAuthenticated) {
            enableRealtimeSync()
          }
        }, 3000)
      }
      
      socket.onerror = (error) => {
        console.error('WebSocket 오류:', error)
        errorTracker.captureError(new Error('WebSocket connection error'), {
          action: 'websocket_error'
        })
      }
      
    } catch (error: any) {
      console.error('WebSocket 연결 실패:', error)
      errorTracker.captureError(error, {
        action: 'websocket_connect_failed'
      })
    }
  }
  
  /**
   * WebSocket 연결 해제
   */
  const disableRealtimeSync = () => {
    if (socket) {
      socket.close()
      socket = null
      wsConnected.value = false
    }
  }
  
  /**
   * 실시간 업데이트 처리
   */
  const handleRealtimeUpdate = (message: any) => {
    switch (message.type) {
      case 'order_updated':
        const { rowIndex, status, updatedBy } = message.data
        const orderIndex = session.value.orders.findIndex(o => o.rowIndex === rowIndex)
        
        if (orderIndex !== -1) {
          // 다른 사용자가 업데이트한 경우에만 반영
          if (updatedBy !== session.value.staff?.staffName) {
            session.value.orders[orderIndex] = {
              ...session.value.orders[orderIndex],
              status: status as any,
              lastUpdated: new Date().toISOString()
            }
            
            // 알림 표시 (다른 사용자가 업데이트한 경우)
            errorTracker.captureInfo('order_updated_by_other', {
              rowIndex,
              status,
              updatedBy,
              currentUser: session.value.staff?.staffName
            })
          }
        }
        break
        
      case 'bulk_sync':
        // 대량 동기화 - 전체 주문 목록 새로고침
        refreshOrders()
        break
        
      case 'notification':
        // 실시간 알림
        errorTracker.captureInfo('realtime_notification', {
          message: message.data.message,
          type: message.data.notificationType
        })
        break
        
      default:
        console.log('Unknown WebSocket message type:', message.type)
    }
  }
  
  /**
   * 로그아웃
   */
  const logout = async () => {
    try {
      await axios.post('/api/delivery/logout')
    } catch (error) {
      // 로그아웃 에러는 무시 (네트워크 오류 등)
      console.warn('Logout API call failed:', error)
    } finally {
      // WebSocket 연결 해제
      disableRealtimeSync()
      
      // 로컬 상태 초기화
      session.value = {
        staff: null,
        isAuthenticated: false,
        orders: [],
        lastSync: null
      }
      
      errorTracker.captureUserAction('logout', {
        reason: 'manual'
      })
    }
  }
  
  /**
   * 세션 상태 확인
   */
  const checkSession = async () => {
    try {
      await loadCurrentWork()
      return true
    } catch (error) {
      await logout()
      return false
    }
  }
  
  /**
   * 오프라인 상태 처리
   */
  const handleOfflineMode = () => {
    // 오프라인 상태에서 가능한 작업들
    // 로컬 스토리지에 임시 저장 등
    errorTracker.captureInfo('offline_mode_activated', {
      ordersCount: session.value.orders.length,
      pendingUpdates: session.value.orders.filter(o => o.updating).length
    })
  }
  
  /**
   * 온라인 복구 시 동기화
   */
  const handleOnlineRestore = async () => {
    try {
      await refreshOrders()
      errorTracker.captureInfo('online_mode_restored', {
        ordersCount: session.value.orders.length
      })
    } catch (error) {
      errorTracker.captureError(error as Error, {
        action: 'online_restore_sync'
      })
    }
  }
  
  return {
    // State
    session: readonly(session),
    loading: readonly(loading),
    syncInProgress: readonly(syncInProgress),
    wsConnected: readonly(wsConnected),
    statusInfo: readonly(statusInfo),
    validStatuses: readonly(validStatuses),
    statusLoading: readonly(statusLoading),
    
    // Getters
    isAuthenticated,
    currentStaff,
    orders,
    ordersCount,
    completedOrders,
    pendingOrders,
    completionRate,
    getOrdersByStatus,
    getNextValidStatuses,
    
    // Actions
    loginWithQR,
    loadCurrentWork,
    updateOrderStatus,
    batchUpdateOrderStatus,
    refreshOrders,
    enableRealtimeSync,
    disableRealtimeSync,
    logout,
    checkSession,
    handleOfflineMode,
    handleOnlineRestore,
    
    // Status Management Actions
    loadStatusInfo,
    validateStatusTransition,
    getOrderStatusHistory,
    getStatusInfo,
    getNextValidStatusesForOrder,
    canTransitionTo
  }
})

// 타입 내보내기
export type DeliveryStore = ReturnType<typeof useDeliveryStore>