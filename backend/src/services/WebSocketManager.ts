import { Server as SocketIOServer } from 'socket.io'
import { Server } from 'http'
import SyncService, { SyncEvent } from './SyncService'

export interface ClientInfo {
  sessionId: string
  userId?: string
  connectedAt: Date
}

class WebSocketManager {
  private io: SocketIOServer | null = null
  private clients: Map<string, ClientInfo> = new Map()

  /**
   * WebSocket 서버 초기화
   */
  initialize(httpServer: Server): void {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003',
          'http://localhost:3004',
          'http://localhost:3005'
        ],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    })

    this.setupEventHandlers()
    this.setupSyncEventListeners()
    
    console.log('WebSocket 서버가 초기화되었습니다.')
  }

  /**
   * Socket.IO 이벤트 핸들러 설정
   */
  private setupEventHandlers(): void {
    if (!this.io) return

    this.io.on('connection', (socket) => {
      console.log(`클라이언트 연결: ${socket.id}`)

      // 클라이언트 등록
      socket.on('register', (data: { sessionId: string; userId?: string }) => {
        this.clients.set(socket.id, {
          sessionId: data.sessionId,
          userId: data.userId,
          connectedAt: new Date()
        })

        socket.join(`session:${data.sessionId}`)
        
        if (data.userId) {
          socket.join(`user:${data.userId}`)
        }

        console.log(`클라이언트 등록: ${socket.id} → 세션: ${data.sessionId}`)
      })

      // 동기화 시작 요청
      socket.on('start-sync', (data) => {
        const clientInfo = this.clients.get(socket.id)
        if (clientInfo) {
          socket.to(`session:${clientInfo.sessionId}`).emit('sync-started', data)
        }
      })

      // 동기화 중지 요청
      socket.on('stop-sync', (data) => {
        const clientInfo = this.clients.get(socket.id)
        if (clientInfo) {
          socket.to(`session:${clientInfo.sessionId}`).emit('sync-stopped', data)
        }
      })

      // 클라이언트 연결 해제
      socket.on('disconnect', () => {
        const clientInfo = this.clients.get(socket.id)
        if (clientInfo) {
          console.log(`클라이언트 연결 해제: ${socket.id} (세션: ${clientInfo.sessionId})`)
          this.clients.delete(socket.id)
        }
      })

      // 에러 처리
      socket.on('error', (error) => {
        console.error(`Socket 에러 (${socket.id}):`, error)
      })
    })
  }

  /**
   * SyncService 이벤트 리스너 설정
   */
  private setupSyncEventListeners(): void {
    // 동기화 이벤트 수신 및 WebSocket으로 전송
    SyncService.on('sync', (event: SyncEvent) => {
      this.broadcastToSession(event.sessionId, 'sync-event', event)
    })
  }

  /**
   * 특정 세션의 모든 클라이언트에게 메시지 전송
   */
  broadcastToSession(sessionId: string, event: string, data: any): void {
    if (!this.io) return

    this.io.to(`session:${sessionId}`).emit(event, {
      timestamp: new Date().toISOString(),
      ...data
    })

    console.log(`세션 ${sessionId}에 ${event} 이벤트 전송:`, data.type || 'data')
  }

  /**
   * 특정 사용자에게 메시지 전송
   */
  sendToUser(userId: string, event: string, data: any): void {
    if (!this.io) return

    this.io.to(`user:${userId}`).emit(event, {
      timestamp: new Date().toISOString(),
      ...data
    })
  }

  /**
   * 모든 클라이언트에게 메시지 전송
   */
  broadcast(event: string, data: any): void {
    if (!this.io) return

    this.io.emit(event, {
      timestamp: new Date().toISOString(),
      ...data
    })
  }

  /**
   * 연결된 클라이언트 수 조회
   */
  getConnectedClientsCount(): number {
    return this.clients.size
  }

  /**
   * 세션별 클라이언트 수 조회
   */
  getSessionClientsCount(sessionId: string): number {
    return Array.from(this.clients.values())
      .filter(client => client.sessionId === sessionId).length
  }

  /**
   * 연결된 클라이언트 정보 조회
   */
  getConnectedClients(): Array<{ socketId: string; info: ClientInfo }> {
    return Array.from(this.clients.entries())
      .map(([socketId, info]) => ({ socketId, info }))
  }

  /**
   * WebSocket 서버 종료
   */
  shutdown(): void {
    if (this.io) {
      this.io.close()
      this.clients.clear()
      console.log('WebSocket 서버가 종료되었습니다.')
    }
  }
}

export default new WebSocketManager()