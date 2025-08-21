import { Router, Response } from 'express'
import GoogleSheetsService from '../services/GoogleSheetsService'
import { requireGoogleAuth, optionalGoogleAuth } from '../middleware/auth'

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

/**
 * 배달담당자의 주문 목록 조회 (QR 코드 접근용)
 */
router.get('/orders/:staffName', optionalGoogleAuth, async (req: CustomRequest, res: Response) => {
  try {
    // 관리자 인증이 없는 경우 세션에서 연결된 스프레드시트 확인
    const connectedSpreadsheet = req.session?.connectedSpreadsheet
    
    if (!connectedSpreadsheet) {
      return res.status(400).json({
        success: false,
        message: '연결된 스프레드시트가 없습니다. 관리자가 먼저 설정해야 합니다.'
      })
    }

    const { staffName } = req.params
    
    if (!staffName) {
      return res.status(400).json({
        success: false,
        message: '배달담당자 이름이 필요합니다.'
      })
    }

    // 관리자 토큰이 있으면 사용, 없으면 세션의 토큰 사용
    let tokens = req.googleTokens
    if (!tokens && req.session?.googleTokens) {
      tokens = req.session.googleTokens
    }

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'Google 인증이 필요합니다.',
        requireAuth: true
      })
    }

    const deliveryData = await GoogleSheetsService.getDeliveryData(
      tokens,
      connectedSpreadsheet.id,
      staffName
    )

    return res.json({
      success: true,
      data: {
        staffName,
        orders: deliveryData,
        spreadsheetTitle: connectedSpreadsheet.title,
        totalOrders: deliveryData.length,
        completedOrders: deliveryData.filter(order => order.status === '완료').length
      },
      message: `${staffName}님의 배달 목록을 조회했습니다.`
    })
  } catch (error: any) {
    console.error('배달 목록 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '배달 목록 조회에 실패했습니다.'
    })
  }
})

/**
 * 배달 상태 업데이트 (배달담당자용)
 */
router.put('/update-status/:staffName', async (req: CustomRequest, res: Response) => {
  try {
    const { staffName } = req.params
    const { rowIndex, status, customerName } = req.body

    if (!staffName || !rowIndex || !status) {
      return res.status(400).json({
        success: false,
        message: '배달담당자명, 주문 행 번호, 상태가 필요합니다.'
      })
    }

    // 유효한 상태인지 확인
    const validStatuses = ['대기', '준비중', '출발', '완료']
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: `유효하지 않은 상태입니다. 가능한 상태: ${validStatuses.join(', ')}`
      })
    }

    const connectedSpreadsheet = req.session?.connectedSpreadsheet
    if (!connectedSpreadsheet) {
      return res.status(400).json({
        success: false,
        message: '연결된 스프레드시트가 없습니다.'
      })
    }

    // 관리자 토큰 사용
    let tokens = req.googleTokens || req.session?.googleTokens
    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다.',
        requireAuth: true
      })
    }

    const result = await GoogleSheetsService.updateDeliveryStatus(
      tokens,
      connectedSpreadsheet.id,
      staffName,
      rowIndex,
      status
    )

    return res.json({
      success: true,
      data: { 
        updated: result,
        staffName,
        status,
        customerName,
        rowIndex
      },
      message: `${customerName ? customerName + '님의 ' : ''}배달 상태가 '${status}'로 업데이트되었습니다.`,
      shouldSendNotification: status === '완료' // 완료 상태일 때만 알림 발송 필요
    })
  } catch (error: any) {
    console.error('배달 상태 업데이트 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '배달 상태 업데이트에 실패했습니다.'
    })
  }
})

/**
 * 배달담당자별 통계 조회
 */
router.get('/stats/:staffName', optionalGoogleAuth, async (req: CustomRequest, res: Response) => {
  try {
    const { staffName } = req.params
    const connectedSpreadsheet = req.session?.connectedSpreadsheet

    if (!connectedSpreadsheet) {
      return res.status(400).json({
        success: false,
        message: '연결된 스프레드시트가 없습니다.'
      })
    }

    let tokens = req.googleTokens || req.session?.googleTokens
    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: '인증이 필요합니다.',
        requireAuth: true
      })
    }

    const deliveryData = await GoogleSheetsService.getDeliveryData(
      tokens,
      connectedSpreadsheet.id,
      staffName
    )

    // 상태별 통계 계산
    const stats = {
      total: deliveryData.length,
      pending: deliveryData.filter(order => order.status === '대기').length,
      preparing: deliveryData.filter(order => order.status === '준비중').length,
      departed: deliveryData.filter(order => order.status === '출발').length,
      completed: deliveryData.filter(order => order.status === '완료').length
    }

    const completionRate = stats.total > 0 ? 
      Math.round((stats.completed / stats.total) * 100) : 0

    return res.json({
      success: true,
      data: {
        staffName,
        stats,
        completionRate,
        lastUpdated: new Date().toISOString()
      },
      message: `${staffName}님의 배달 통계를 조회했습니다.`
    })
  } catch (error: any) {
    console.error('배달 통계 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '배달 통계 조회에 실패했습니다.'
    })
  }
})

/**
 * 모든 배달담당자의 현재 상태 조회 (관리자용)
 */
router.get('/all-status', requireGoogleAuth, async (req: CustomRequest, res: Response) => {
  try {
    const connectedSpreadsheet = req.session?.connectedSpreadsheet

    if (!connectedSpreadsheet) {
      return res.status(400).json({
        success: false,
        message: '연결된 스프레드시트가 없습니다.'
      })
    }

    // 모든 배달담당자 목록 조회
    const staffList = await GoogleSheetsService.getDeliveryStaffList(
      req.googleTokens,
      connectedSpreadsheet.id
    )

    // 각 배달담당자별 데이터 조회
    const allStatus = []
    
    for (const staffName of staffList) {
      try {
        const deliveryData = await GoogleSheetsService.getDeliveryData(
          req.googleTokens,
          connectedSpreadsheet.id,
          staffName
        )

        const stats = {
          total: deliveryData.length,
          pending: deliveryData.filter(order => order.status === '대기').length,
          preparing: deliveryData.filter(order => order.status === '준비중').length,
          departed: deliveryData.filter(order => order.status === '출발').length,
          completed: deliveryData.filter(order => order.status === '완료').length
        }

        allStatus.push({
          staffName,
          stats,
          completionRate: stats.total > 0 ? 
            Math.round((stats.completed / stats.total) * 100) : 0,
          orders: deliveryData
        })
      } catch (staffError) {
        console.error(`배달담당자 '${staffName}' 데이터 조회 실패:`, staffError)
        // 개별 배달담당자 에러는 건너뛰고 계속 진행
        allStatus.push({
          staffName,
          error: '데이터 조회 실패',
          stats: { total: 0, pending: 0, preparing: 0, departed: 0, completed: 0 },
          completionRate: 0,
          orders: []
        })
      }
    }

    return res.json({
      success: true,
      data: {
        spreadsheetTitle: connectedSpreadsheet.title,
        staffCount: staffList.length,
        staffStatus: allStatus,
        lastUpdated: new Date().toISOString()
      },
      message: '전체 배달 현황을 조회했습니다.'
    })
  } catch (error: any) {
    console.error('전체 배달 현황 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '전체 배달 현황 조회에 실패했습니다.'
    })
  }
})

export default router