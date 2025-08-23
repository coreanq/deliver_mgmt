import { Router, Request, Response } from 'express'
import logger from '../services/LoggerService'
import { asyncHandler } from '../middleware/errorHandler'

const router = Router()

interface LoggedRequest extends Request {
  requestId?: string
}

/**
 * 프론트엔드에서 에러 보고 수신
 */
router.post('/errors', asyncHandler(async (req: LoggedRequest, res: Response) => {
  const { errors } = req.body

  if (!Array.isArray(errors) || errors.length === 0) {
    res.status(400).json({
      success: false,
      message: 'errors 배열이 필요합니다.'
    })
    return
  }

  // 각 에러 처리
  for (const errorReport of errors) {
    const { message, stack, level, context, fingerprint } = errorReport

    // 프론트엔드 에러 컨텍스트에 추가 정보 포함
    const enhancedContext = {
      ...context,
      source: 'frontend',
      requestId: req.requestId,
      fingerprint,
      serverTimestamp: new Date().toISOString()
    }

    // 로그 레벨에 따라 적절한 로깅 메소드 호출
    switch (level) {
      case 'error':
        logger.error(`Frontend Error: ${message}`, enhancedContext, {
          name: 'FrontendError',
          message,
          stack
        })
        break
      case 'warn':
        logger.warn(`Frontend Warning: ${message}`, enhancedContext)
        break
      case 'info':
      default:
        logger.info(`Frontend Info: ${message}`, enhancedContext)
        break
    }
  }

  logger.info('Frontend error batch processed', {
    errorCount: errors.length,
    requestId: req.requestId,
    source: 'frontend'
  })

  res.json({
    success: true,
    message: `${errors.length}개의 에러가 처리되었습니다.`,
    processed: errors.length
  })
}))

/**
 * 사용자 액션 로깅
 */
router.post('/user-actions', asyncHandler(async (req: LoggedRequest, res: Response) => {
  const { action, context } = req.body

  if (!action) {
    res.status(400).json({
      success: false,
      message: 'action이 필요합니다.'
    })
    return
  }

  logger.audit(`User action: ${action}`, {
    ...context,
    source: 'frontend',
    requestId: req.requestId,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    sessionId: (req as any).sessionID
  })

  res.json({
    success: true,
    message: '사용자 액션이 기록되었습니다.'
  })
}))

/**
 * 성능 메트릭 로깅
 */
router.post('/metrics', asyncHandler(async (req: LoggedRequest, res: Response) => {
  const { metrics } = req.body

  if (!Array.isArray(metrics) || metrics.length === 0) {
    res.status(400).json({
      success: false,
      message: 'metrics 배열이 필요합니다.'
    })
    return
  }

  for (const metric of metrics) {
    const { name, value, context } = metric

    logger.metric(name, value, {
      ...context,
      source: 'frontend',
      requestId: req.requestId
    })
  }

  res.json({
    success: true,
    message: `${metrics.length}개의 메트릭이 기록되었습니다.`,
    processed: metrics.length
  })
}))

/**
 * 로그 통계 조회 (관리자용)
 */
router.get('/stats', asyncHandler(async (req: Request, res: Response) => {
  const stats = logger.getLogStats()

  res.json({
    success: true,
    data: {
      ...stats,
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  })
}))

/**
 * 로그 레벨 동적 변경 (관리자용)
 */
router.put('/level', asyncHandler(async (req: Request, res: Response) => {
  const { level } = req.body

  const validLevels = ['error', 'warn', 'info', 'http', 'debug']
  if (!level || !validLevels.includes(level)) {
    res.status(400).json({
      success: false,
      message: `유효하지 않은 로그 레벨입니다. 사용 가능한 레벨: ${validLevels.join(', ')}`
    })
    return
  }

  logger.setLogLevel(level)

  res.json({
    success: true,
    message: `로그 레벨이 '${level}'로 변경되었습니다.`,
    newLevel: level
  })
}))

/**
 * 시스템 헬스체크 (로깅 포함)
 */
router.get('/health', asyncHandler(async (req: Request, res: Response) => {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    pid: process.pid,
    version: process.version,
    environment: process.env.NODE_ENV || 'development'
  }

  // 헬스체크도 로깅
  logger.info('Health check requested', {
    source: 'api',
    ...healthData
  })

  res.json({
    success: true,
    data: healthData
  })
}))

/**
 * 실시간 로그 스트림 (Server-Sent Events)
 */
router.get('/stream', (req: Request, res: Response) => {
  // SSE 헤더 설정
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  })

  // 연결 확인 메시지
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date() })}\n\n`)

  // 로그 이벤트 리스너 (실제 구현에서는 로그 스트림에 연결)
  const logListener = (logData: any) => {
    res.write(`data: ${JSON.stringify({ type: 'log', data: logData })}\n\n`)
  }

  // 클라이언트 연결 해제 처리
  req.on('close', () => {
    logger.info('Log stream client disconnected', {
      ip: req.ip,
      userAgent: req.get('User-Agent')
    })
  })

  // 주기적으로 heartbeat 전송
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date() })}\n\n`)
  }, 30000)

  req.on('close', () => {
    clearInterval(heartbeat)
  })
})

export default router