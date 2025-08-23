import { EventEmitter } from 'events'
import GoogleSheetsService from './GoogleSheetsService'

export interface SyncConfig {
  spreadsheetId: string
  staffList: string[]
  tokens: any
  intervalMs: number
  batchSize?: number // 배치 크기 (성능 최적화)
  maxConcurrent?: number // 최대 동시 요청 수
}

export interface SyncStatus {
  isActive: boolean
  lastSyncTime: Date | null
  syncCount: number
  errorCount: number
  lastError: string | null
  syncDuration: number // 동기화 소요 시간 (ms)
  ordersProcessed: number // 처리된 주문 수
  throughput: number // 초당 처리 주문 수
}

export interface SyncEvent {
  type: 'sync_start' | 'sync_complete' | 'sync_error' | 'data_changed'
  sessionId: string
  timestamp: Date
  data?: any
  error?: string
}

class SyncService extends EventEmitter {
  private syncIntervals: Map<string, NodeJS.Timeout> = new Map()
  private syncStatus: Map<string, SyncStatus> = new Map()
  private cachedData: Map<string, any> = new Map()
  private dataHashMap: Map<string, string> = new Map() // 데이터 변경 감지용

  constructor() {
    super()
    this.setMaxListeners(100) // 많은 동시 연결 지원
  }

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
        lastError: null,
        syncDuration: 0,
        ordersProcessed: 0,
        throughput: 0
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
   * 실제 동기화 수행 (성능 최적화 버전)
   */
  private async performSync(sessionId: string, config: SyncConfig): Promise<void> {
    const status = this.syncStatus.get(sessionId)
    if (!status || !status.isActive) {
      return
    }

    const startTime = Date.now()
    let totalOrdersProcessed = 0

    try {
      // 동기화 시작 이벤트 발생
      this.emit('sync', {
        type: 'sync_start',
        sessionId,
        timestamp: new Date()
      } as SyncEvent)

      const syncData: any = {
        spreadsheetId: config.spreadsheetId,
        staffData: {},
        lastSyncTime: new Date().toISOString()
      }

      // 배치 크기 설정 (기본값: 5)
      const batchSize = config.batchSize || 5
      const maxConcurrent = config.maxConcurrent || 3
      
      // 배달담당자 목록을 배치로 분할
      const staffBatches = this.chunkArray(config.staffList, batchSize)
      
      for (const batch of staffBatches) {
        // 배치 내에서 동시 처리 (최대 동시 요청 수 제한)
        const batchPromises = batch.slice(0, maxConcurrent).map(async (staffName) => {
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

            totalOrdersProcessed += deliveryData.length
            return { staffName, staffData }
          } catch (staffError) {
            console.error(`배달담당자 '${staffName}' 동기화 실패:`, staffError)
            return { staffName, staffData: null, error: staffError }
          }
        })

        // 배치 실행 및 결과 처리
        const batchResults = await Promise.allSettled(batchPromises)
        
        batchResults.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.staffData) {
            syncData.staffData[result.value.staffName] = result.value.staffData
          }
        })
      }

      // 데이터 변경 감지
      const dataHash = this.generateDataHash(syncData)
      const previousHash = this.dataHashMap.get(sessionId)
      
      if (previousHash !== dataHash) {
        this.dataHashMap.set(sessionId, dataHash)
        
        // 데이터 변경 이벤트 발생
        this.emit('sync', {
          type: 'data_changed',
          sessionId,
          timestamp: new Date(),
          data: syncData
        } as SyncEvent)
      }

      // 캐시 데이터 업데이트
      this.cachedData.set(sessionId, syncData)

      // 성능 메트릭 계산
      const syncDuration = Date.now() - startTime
      const throughput = syncDuration > 0 ? (totalOrdersProcessed / syncDuration) * 1000 : 0

      // 동기화 상태 업데이트
      status.lastSyncTime = new Date()
      status.syncCount += 1
      status.syncDuration = syncDuration
      status.ordersProcessed = totalOrdersProcessed
      status.throughput = throughput
      this.syncStatus.set(sessionId, status)

      // 동기화 완료 이벤트 발생
      this.emit('sync', {
        type: 'sync_complete',
        sessionId,
        timestamp: new Date(),
        data: {
          duration: syncDuration,
          ordersProcessed: totalOrdersProcessed,
          throughput: throughput
        }
      } as SyncEvent)

      console.log(`동기화 완료: ${sessionId} (${status.syncCount}회, ${syncDuration}ms, ${totalOrdersProcessed}개 주문, ${throughput.toFixed(2)} 주문/초)`)
    } catch (error: any) {
      console.error(`동기화 수행 실패: ${sessionId}`, error)
      
      // 에러 상태 업데이트
      status.errorCount += 1
      status.lastError = error.message || '알 수 없는 오류'
      status.syncDuration = Date.now() - startTime
      this.syncStatus.set(sessionId, status)

      // 에러 이벤트 발생
      this.emit('sync', {
        type: 'sync_error',
        sessionId,
        timestamp: new Date(),
        error: error.message || '알 수 없는 오류'
      } as SyncEvent)
    }
  }

  /**
   * 배열을 지정된 크기로 분할
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = []
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * 데이터 해시 생성 (변경 감지용)
   */
  private generateDataHash(data: any): string {
    const crypto = require('crypto')
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex')
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