import GoogleSheetsService from './GoogleSheetsService'

export interface SyncConfig {
  spreadsheetId: string
  staffList: string[]
  tokens: any
  intervalMs: number
}

export interface SyncStatus {
  isActive: boolean
  lastSyncTime: Date | null
  syncCount: number
  errorCount: number
  lastError: string | null
}

class SyncService {
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map()
  private syncStatus: Map<string, SyncStatus> = new Map()
  private cachedData: Map<string, any> = new Map()

  /**
   * 특정 스프레드시트의 실시간 동기화 시작
   */
  startSync(sessionId: string, config: SyncConfig): boolean {
    try {
      // 기존 동기화가 있으면 중지
      this.stopSync(sessionId)

      // 동기화 상태 초기화
      this.syncStatus.set(sessionId, {
        isActive: true,
        lastSyncTime: null,
        syncCount: 0,
        errorCount: 0,
        lastError: null
      })

      // 즉시 첫 동기화 수행
      this.performSync(sessionId, config)

      // 주기적 동기화 설정
      const interval = setInterval(() => {
        this.performSync(sessionId, config)
      }, config.intervalMs)

      this.syncIntervals.set(sessionId, interval)

      console.log(`동기화 시작: ${sessionId} (${config.intervalMs}ms 간격)`)
      return true
    } catch (error) {
      console.error(`동기화 시작 실패: ${sessionId}`, error)
      return false
    }
  }

  /**
   * 동기화 중지
   */
  stopSync(sessionId: string): boolean {
    try {
      const interval = this.syncIntervals.get(sessionId)
      if (interval) {
        clearInterval(interval)
        this.syncIntervals.delete(sessionId)
      }

      const status = this.syncStatus.get(sessionId)
      if (status) {
        status.isActive = false
        this.syncStatus.set(sessionId, status)
      }

      // 캐시 데이터 정리
      this.cachedData.delete(sessionId)

      console.log(`동기화 중지: ${sessionId}`)
      return true
    } catch (error) {
      console.error(`동기화 중지 실패: ${sessionId}`, error)
      return false
    }
  }

  /**
   * 실제 동기화 수행
   */
  private async performSync(sessionId: string, config: SyncConfig): Promise<void> {
    const status = this.syncStatus.get(sessionId)
    if (!status || !status.isActive) {
      return
    }

    try {
      const syncData: any = {
        spreadsheetId: config.spreadsheetId,
        staffData: {},
        lastSyncTime: new Date().toISOString()
      }

      // 각 배달담당자별 데이터 동기화
      for (const staffName of config.staffList) {
        try {
          const deliveryData = await GoogleSheetsService.getDeliveryData(
            config.tokens,
            config.spreadsheetId,
            staffName
          )

          syncData.staffData[staffName] = {
            orders: deliveryData,
            totalOrders: deliveryData.length,
            completedOrders: deliveryData.filter(order => order.status === '완료').length,
            pendingOrders: deliveryData.filter(order => order.status === '대기').length,
            lastUpdated: new Date().toISOString()
          }
        } catch (staffError) {
          console.error(`배달담당자 '${staffName}' 동기화 실패:`, staffError)
          // 개별 배달담당자 에러는 건너뛰고 계속 진행
        }
      }

      // 캐시 데이터 업데이트
      this.cachedData.set(sessionId, syncData)

      // 동기화 상태 업데이트
      status.lastSyncTime = new Date()
      status.syncCount += 1
      this.syncStatus.set(sessionId, status)

      console.log(`동기화 완료: ${sessionId} (${status.syncCount}회)`)
    } catch (error: any) {
      console.error(`동기화 수행 실패: ${sessionId}`, error)
      
      // 에러 상태 업데이트
      status.errorCount += 1
      status.lastError = error.message || '알 수 없는 오류'
      this.syncStatus.set(sessionId, status)
    }
  }

  /**
   * 동기화 상태 조회
   */
  getSyncStatus(sessionId: string): SyncStatus | null {
    return this.syncStatus.get(sessionId) || null
  }

  /**
   * 캐시된 데이터 조회
   */
  getCachedData(sessionId: string): any {
    return this.cachedData.get(sessionId) || null
  }

  /**
   * 활성 동기화 목록 조회
   */
  getActiveSyncs(): string[] {
    const activeSyncs: string[] = []
    
    this.syncStatus.forEach((status, sessionId) => {
      if (status.isActive) {
        activeSyncs.push(sessionId)
      }
    })

    return activeSyncs
  }

  /**
   * 모든 동기화 중지 (서버 종료 시 사용)
   */
  stopAllSyncs(): void {
    const activeSyncs = this.getActiveSyncs()
    
    activeSyncs.forEach(sessionId => {
      this.stopSync(sessionId)
    })

    console.log(`모든 동기화 중지됨: ${activeSyncs.length}개`)
  }

  /**
   * 특정 배달담당자의 데이터만 동기화
   */
  async syncStaffData(sessionId: string, config: SyncConfig, staffName: string): Promise<any> {
    try {
      const deliveryData = await GoogleSheetsService.getDeliveryData(
        config.tokens,
        config.spreadsheetId,
        staffName
      )

      const staffData = {
        orders: deliveryData,
        totalOrders: deliveryData.length,
        completedOrders: deliveryData.filter(order => order.status === '완료').length,
        pendingOrders: deliveryData.filter(order => order.status === '대기').length,
        lastUpdated: new Date().toISOString()
      }

      // 캐시 업데이트
      const cachedData = this.getCachedData(sessionId) || { staffData: {} }
      cachedData.staffData[staffName] = staffData
      this.cachedData.set(sessionId, cachedData)

      return staffData
    } catch (error) {
      console.error(`배달담당자 '${staffName}' 개별 동기화 실패:`, error)
      throw error
    }
  }
}

export default new SyncService()