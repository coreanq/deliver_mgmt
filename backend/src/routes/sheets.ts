import { Router, Response } from 'express'
import GoogleSheetsService, { DeliveryData } from '../services/GoogleSheetsService'
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
 * 스프레드시트 목록 조회
 */
router.get('/list', async (req: CustomRequest, res: Response) => {
  try {
    const spreadsheets = await GoogleSheetsService.listSpreadsheets(req.googleTokens)
    
    return res.json({
      success: true,
      data: spreadsheets,
      message: '스프레드시트 목록을 성공적으로 조회했습니다.'
    })
  } catch (error: any) {
    console.error('스프레드시트 목록 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '스프레드시트 목록 조회에 실패했습니다.'
    })
  }
})

/**
 * 스프레드시트 정보 조회
 */
router.get('/info/:spreadsheetId', async (req: CustomRequest, res: Response) => {
  try {
    const { spreadsheetId } = req.params
    const info = await GoogleSheetsService.getSpreadsheetInfo(req.googleTokens, spreadsheetId)
    
    return res.json({
      success: true,
      data: info,
      message: '스프레드시트 정보를 성공적으로 조회했습니다.'
    })
  } catch (error: any) {
    console.error('스프레드시트 정보 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '스프레드시트 정보 조회에 실패했습니다.'
    })
  }
})

/**
 * 배달담당자 시트 생성
 */
router.post('/create-staff-sheet', async (req: CustomRequest, res: Response) => {
  try {
    const { spreadsheetId, staffName } = req.body

    if (!spreadsheetId || !staffName) {
      return res.status(400).json({
        success: false,
        message: '스프레드시트 ID와 배달담당자 이름이 필요합니다.'
      })
    }

    const result = await GoogleSheetsService.createDeliveryStaffSheet(
      req.googleTokens, 
      spreadsheetId, 
      staffName
    )

    return res.json({
      success: true,
      data: { created: result },
      message: `배달담당자 '${staffName}' 시트가 생성되었습니다.`
    })
  } catch (error: any) {
    console.error('배달담당자 시트 생성 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '배달담당자 시트 생성에 실패했습니다.'
    })
  }
})

/**
 * 배달담당자 목록 조회
 */
router.get('/staff-list/:spreadsheetId', async (req: CustomRequest, res: Response) => {
  try {
    const { spreadsheetId } = req.params
    const staffList = await GoogleSheetsService.getDeliveryStaffList(req.googleTokens, spreadsheetId)
    
    return res.json({
      success: true,
      data: staffList,
      message: '배달담당자 목록을 성공적으로 조회했습니다.'
    })
  } catch (error: any) {
    console.error('배달담당자 목록 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '배달담당자 목록 조회에 실패했습니다.'
    })
  }
})

/**
 * 시트의 배달 데이터 조회
 */
router.get('/data/:spreadsheetId/:sheetName', async (req: CustomRequest, res: Response) => {
  try {
    const { spreadsheetId, sheetName } = req.params
    const deliveryData = await GoogleSheetsService.getDeliveryData(
      req.googleTokens, 
      spreadsheetId, 
      sheetName
    )
    
    return res.json({
      success: true,
      data: deliveryData,
      message: `시트 '${sheetName}'의 배달 데이터를 성공적으로 조회했습니다.`
    })
  } catch (error: any) {
    console.error('배달 데이터 조회 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '배달 데이터 조회에 실패했습니다.'
    })
  }
})

/**
 * 배달 상태 업데이트
 */
router.put('/update-status', async (req: CustomRequest, res: Response) => {
  try {
    const { spreadsheetId, sheetName, rowIndex, status } = req.body

    if (!spreadsheetId || !sheetName || !rowIndex || !status) {
      return res.status(400).json({
        success: false,
        message: '스프레드시트 ID, 시트명, 행 번호, 상태가 모두 필요합니다.'
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

    const result = await GoogleSheetsService.updateDeliveryStatus(
      req.googleTokens,
      spreadsheetId,
      sheetName,
      rowIndex,
      status
    )

    return res.json({
      success: true,
      data: { updated: result.updated },
      message: `배달 상태가 '${status}'로 업데이트되었습니다.`
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
 * 새 배달 주문 추가
 */
router.post('/add-order', async (req: CustomRequest, res: Response) => {
  try {
    const { spreadsheetId, sheetName, customerName, phoneNumber, address } = req.body

    if (!spreadsheetId || !sheetName || !customerName || !phoneNumber || !address) {
      return res.status(400).json({
        success: false,
        message: '스프레드시트 ID, 시트명, 고객명, 연락처, 주소가 모두 필요합니다.'
      })
    }

    const deliveryData: DeliveryData = {
      customerName,
      phoneNumber,
      address,
      status: '대기'
    }

    const result = await GoogleSheetsService.addDeliveryOrder(
      req.googleTokens,
      spreadsheetId,
      sheetName,
      deliveryData
    )

    return res.json({
      success: true,
      data: { added: result },
      message: `새 주문이 추가되었습니다: ${customerName}`
    })
  } catch (error: any) {
    console.error('주문 추가 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '주문 추가에 실패했습니다.'
    })
  }
})

/**
 * 스프레드시트 연결 설정 저장
 */
router.post('/connect', async (req: CustomRequest, res: Response) => {
  try {
    const { spreadsheetId } = req.body

    if (!spreadsheetId) {
      return res.status(400).json({
        success: false,
        message: '스프레드시트 ID가 필요합니다.'
      })
    }

    // 스프레드시트 접근 가능한지 확인
    const info = await GoogleSheetsService.getSpreadsheetInfo(req.googleTokens, spreadsheetId)

    // 세션에 연결된 스프레드시트 정보 저장
    req.session.connectedSpreadsheet = {
      id: spreadsheetId,
      title: info.properties?.title || '제목 없음',
      connectedAt: new Date().toISOString()
    }

    return res.json({
      success: true,
      data: {
        spreadsheetId,
        title: info.properties?.title,
        sheets: info.sheets?.map((sheet: any) => ({
          id: sheet.properties.sheetId,
          title: sheet.properties.title
        }))
      },
      message: '스프레드시트가 성공적으로 연결되었습니다.'
    })
  } catch (error: any) {
    console.error('스프레드시트 연결 실패:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '스프레드시트 연결에 실패했습니다.'
    })
  }
})

/**
 * 현재 연결된 스프레드시트 정보 조회
 */
router.get('/connection', (req: CustomRequest, res: Response) => {
  const connectedSpreadsheet = req.session.connectedSpreadsheet

  return res.json({
    success: true,
    data: connectedSpreadsheet || null,
    message: connectedSpreadsheet ? 
      '연결된 스프레드시트가 있습니다.' : 
      '연결된 스프레드시트가 없습니다.'
  })
})

export default router