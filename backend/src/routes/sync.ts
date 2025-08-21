import { Router, Response } from 'express'
import SyncService, { SyncConfig } from '../services/SyncService'
import GoogleSheetsService from '../services/GoogleSheetsService'
import { requireGoogleAuth } from '../middleware/auth'

// 세션 타입 확장
interface CustomRequest {
  session: any
  googleAuth?: any
  googleTokens?: any
  body: any
  params: any
  query: any
}

const router = Router()

// 모든 라우트에 Google 인증 필요
router.use(requireGoogleAuth)

/**
 * 실시간 동기화 시작
 */
router.post('/start', async (req: CustomRequest, res: Response) => {
  try {
    const connectedSpreadsheet = req.session?.connectedSpreadsheet

    if (!connectedSpreadsheet) {
      return res.status(400).json({
        success: false,
        message: '연결된 스프레드시트가 없습니다.'
      })
    }

    // 배달담당자 목록 조회
    const staffList = await GoogleSheetsService.getDeliveryStaffList(
      req.googleTokens,
      connectedSpreadsheet.id
    )

    if (staffList.length === 0) {
      return res.status(400).json({
        success: false,
        message: '배달담당자 시트가 없습니다. 먼저 배달담당자를 등록해주세요.'
      })
    }

    const sessionId = req.session.id || `session-${Date.now()}`
    const syncConfig: SyncConfig = {
      spreadsheetId: connectedSpreadsheet.id,
      staffList,
      tokens: req.googleTokens,
      intervalMs: req.body.intervalMs || 30000 // 기본 30초
    }

    const started = SyncService.startSync(sessionId, syncConfig)

    if (started) {
      // 세션에 동기화 정보 저장
      req.session.syncActive = true
      req.session.syncSessionId = sessionId

      return res.json({
        success: true,
        data: {
          sessionId,
          spreadsheetTitle: connectedSpreadsheet.title,
          staffList,
          intervalMs: syncConfig.intervalMs
        },
        message: '실시간 동기화가 시작되었습니다.'
      })
    } else {
      return res.status(500).json({
        success: false,
        message: '동기화 시작에 실패했습니다.'
      })
    }
  } catch (error: any) {
    console.error('동기화 시작 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '동기화 시작에 실패했습니다.'
    })
  }
})

/**
 * 실시간 동기화 중지
 */
router.post('/stop', (req: CustomRequest, res: Response) => {
  try {
    const sessionId = req.session.syncSessionId

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: '활성화된 동기화가 없습니다.'
      })
    }

    const stopped = SyncService.stopSync(sessionId)

    if (stopped) {
      req.session.syncActive = false
      delete req.session.syncSessionId

      return res.json({
        success: true,
        message: '실시간 동기화가 중지되었습니다.'
      })
    } else {
      return res.status(500).json({
        success: false,
        message: '동기화 중지에 실패했습니다.'
      })
    }
  } catch (error: any) {
    console.error('동기화 중지 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '동기화 중지에 실패했습니다.'
    })
  }
})

/**
 * 동기화 상태 조회
 */
router.get('/status', (req: CustomRequest, res: Response) => {
  try {
    const sessionId = req.session.syncSessionId

    if (!sessionId) {
      return res.json({
        success: true,
        data: {
          isActive: false,
          message: '활성화된 동기화가 없습니다.'
        }
      })
    }

    const status = SyncService.getSyncStatus(sessionId)

    return res.json({
      success: true,
      data: {
        sessionId,
        ...status,
        connectedSpreadsheet: req.session.connectedSpreadsheet
      },
      message: '동기화 상태를 조회했습니다.'
    })
  } catch (error: any) {
    console.error('동기화 상태 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '동기화 상태 조회에 실패했습니다.'
    })
  }
})

/**
 * 캐시된 동기화 데이터 조회
 */
router.get('/data', (req: CustomRequest, res: Response) => {
  try {
    const sessionId = req.session.syncSessionId

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: '활성화된 동기화가 없습니다.'
      })
    }

    const cachedData = SyncService.getCachedData(sessionId)

    if (!cachedData) {
      return res.status(404).json({
        success: false,
        message: '캐시된 데이터가 없습니다. 동기화가 아직 수행되지 않았을 수 있습니다.'
      })
    }

    return res.json({
      success: true,
      data: cachedData,
      message: '캐시된 동기화 데이터를 조회했습니다.'
    })
  } catch (error: any) {
    console.error('캐시된 데이터 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '캐시된 데이터 조회에 실패했습니다.'
    })
  }
})

/**
 * 특정 배달담당자 데이터 즉시 동기화
 */
router.post('/refresh/:staffName', async (req: CustomRequest, res: Response) => {
  try {
    const { staffName } = req.params
    const sessionId = req.session.syncSessionId
    const connectedSpreadsheet = req.session?.connectedSpreadsheet

    if (!sessionId || !connectedSpreadsheet) {
      return res.status(400).json({
        success: false,
        message: '활성화된 동기화 또는 연결된 스프레드시트가 없습니다.'
      })
    }

    const syncConfig: SyncConfig = {
      spreadsheetId: connectedSpreadsheet.id,
      staffList: [staffName],
      tokens: req.googleTokens,
      intervalMs: 0 // 즉시 실행
    }

    const staffData = await SyncService.syncStaffData(sessionId, syncConfig, staffName)

    return res.json({
      success: true,
      data: {
        staffName,
        ...staffData
      },
      message: `${staffName}님의 데이터가 즉시 동기화되었습니다.`
    })
  } catch (error: any) {
    console.error('즉시 동기화 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '즉시 동기화에 실패했습니다.'
    })
  }
})

/**
 * 활성 동기화 목록 조회 (관리자용)
 */
router.get('/active', (req: CustomRequest, res: Response) => {
  try {
    const activeSyncs = SyncService.getActiveSyncs()

    return res.json({
      success: true,
      data: {
        activeCount: activeSyncs.length,
        activeSyncs,
        currentSession: req.session.syncSessionId || null
      },
      message: '활성 동기화 목록을 조회했습니다.'
    })
  } catch (error: any) {
    console.error('활성 동기화 목록 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '활성 동기화 목록 조회에 실패했습니다.'
    })
  }
})

export default router