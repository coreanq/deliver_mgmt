import express, { Request, Response } from 'express'
import TokenService from '../services/TokenService'
import GoogleSheetsService from '../services/GoogleSheetsService'
import GoogleDriveService from '../services/GoogleDriveService'
import SecurityService from '../services/SecurityService'
import { requireGoogleAuth } from '../middleware/auth'
import { validateStaffName, validateQrToken } from '../middleware/validation'
import { qrGenerateRateLimit } from '../middleware/rateLimiter'
import { parseMultipleSheetNames } from '../utils/sheetNameParser'

const router = express.Router()

/**
 * QR 코드 생성 API (관리자 전용)
 * POST /api/qr/generate
 */
router.post('/generate', requireGoogleAuth, qrGenerateRateLimit, async (req: Request, res: Response) => {
  try {
    const { staffName, sheetName } = req.body

    if (!staffName) {
      return res.status(400).json({
        success: false,
        message: '배달기사 이름이 필요합니다.'
      })
    }

    // 입력값 새니타이제이션 및 검증
    const sanitizedStaffName = SecurityService.sanitizeInput(staffName)
    const sanitizedSheetName = sheetName ? SecurityService.sanitizeInput(sheetName) : null

    if (!sanitizedStaffName || sanitizedStaffName.length === 0) {
      return res.status(400).json({
        success: false,
        message: '유효하지 않은 배달기사 이름입니다.'
      })
    }

    // 보안 감사 로그
    SecurityService.createAuditLog('QR_CODE_GENERATION', (req as any).session?.user?.id || 'admin', {
      staffName: sanitizedStaffName,
      sheetName: sanitizedSheetName,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    })

    // QR 코드 생성 (새니타이즈된 값 사용)
    const qrCodeDataUrl = await TokenService.generateStaffQrCode(sanitizedStaffName, sanitizedSheetName || undefined)
    const qrCodeUrl = TokenService.generateStaffQrUrl(sanitizedStaffName, sanitizedSheetName || undefined)

    return res.json({
      success: true,
      data: {
        staffName,
        sheetName: sheetName || staffName,
        qrCodeDataUrl,
        qrCodeUrl,
        expiresIn: '7일'
      }
    })

  } catch (error: any) {
    console.error('QR 코드 생성 오류:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'QR 코드 생성에 실패했습니다.'
    })
  }
})

/**
 * QR 코드 토큰 검증 API
 * POST /api/qr/verify
 */
router.post('/verify', (req: Request, res: Response) => {
  try {
    const { staffName, token } = req.body

    if (!staffName || !token) {
      return res.status(400).json({
        success: false,
        message: '배달기사 이름과 토큰이 필요합니다.'
      })
    }

    // 토큰 검증
    const isValid = TokenService.validateQrCodeData(staffName, token)

    if (!isValid) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 QR 코드입니다.'
      })
    }

    // 토큰 정보 추출
    const tokenData = TokenService.verifyStaffToken(token)

    return res.json({
      success: true,
      message: 'QR 코드 인증 성공',
      data: {
        staffName: tokenData.staff,
        sheetName: tokenData.sheet,
        issuedDate: tokenData.date,
        tokenType: tokenData.type
      }
    })

  } catch (error: any) {
    console.error('QR 코드 검증 오류:', error)
    return res.status(401).json({
      success: false,
      message: error.message || 'QR 코드 검증에 실패했습니다.'
    })
  }
})

/**
 * 배달기사 토큰 정보 조회 API
 * GET /api/qr/token-info/:token
 */
router.get('/token-info/:token', (req: Request, res: Response) => {
  try {
    const { token } = req.params

    if (!token) {
      return res.status(400).json({
        success: false,
        message: '토큰이 필요합니다.'
      })
    }

    // 토큰 정보 추출
    const tokenData = TokenService.verifyStaffToken(token)

    return res.json({
      success: true,
      data: {
        staffName: tokenData.staff,
        sheetName: tokenData.sheet,
        issuedDate: tokenData.date,
        tokenType: tokenData.type,
        issuedAt: new Date(tokenData.iat * 1000).toISOString(),
        expiresAt: new Date(tokenData.exp * 1000).toISOString()
      }
    })

  } catch (error: any) {
    console.error('토큰 정보 조회 오류:', error)
    return res.status(401).json({
      success: false,
      message: error.message || '토큰 정보 조회에 실패했습니다.'
    })
  }
})

/**
 * 여러 배달기사 QR 코드 일괄 생성 API
 * POST /api/qr/generate-batch
 */
router.post('/generate-batch', async (req: Request, res: Response) => {
  try {
    const { staffList } = req.body

    if (!Array.isArray(staffList) || staffList.length === 0) {
      return res.status(400).json({
        success: false,
        message: '배달기사 목록이 필요합니다.'
      })
    }

    const results = []

    for (const staff of staffList) {
      try {
        const staffName = typeof staff === 'string' ? staff : staff.name
        const sheetName = typeof staff === 'object' ? staff.sheetName : undefined

        if (!staffName) {
          results.push({
            staffName: '알 수 없음',
            success: false,
            error: '배달기사 이름이 없습니다.'
          })
          continue
        }

        const qrCodeDataUrl = await TokenService.generateStaffQrCode(staffName, sheetName)
        const qrCodeUrl = TokenService.generateStaffQrUrl(staffName, sheetName)

        results.push({
          staffName,
          sheetName: sheetName || staffName,
          success: true,
          qrCodeDataUrl,
          qrCodeUrl
        })

      } catch (error: any) {
        results.push({
          staffName: typeof staff === 'string' ? staff : staff.name || '알 수 없음',
          success: false,
          error: error.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return res.json({
      success: true,
      message: `QR 코드 일괄 생성 완료 (성공: ${successCount}, 실패: ${failCount})`,
      data: {
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount
        }
      }
    })

  } catch (error: any) {
    console.error('QR 코드 일괄 생성 오류:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'QR 코드 일괄 생성에 실패했습니다.'
    })
  }
})

/**
 * 구글 시트에서 배달담당자 목록을 가져와서 QR 코드 자동 생성 API
 * POST /api/qr/generate-from-sheets
 */
router.post('/generate-from-sheets', async (req: Request, res: Response) => {
  try {
    const { tokens, spreadsheetId } = req.body

    if (!tokens || !spreadsheetId) {
      return res.status(400).json({
        success: false,
        message: '구글 시트 토큰과 스프레드시트 ID가 필요합니다.'
      })
    }

    // 구글 시트에서 배달담당자 목록 가져오기
    const staffList = await GoogleSheetsService.getDeliveryStaffList(tokens, spreadsheetId)

    if (staffList.length === 0) {
      return res.status(404).json({
        success: false,
        message: '구글 시트에서 배달담당자를 찾을 수 없습니다.'
      })
    }

    const results = []

    // 각 배달담당자별 QR 코드 생성
    for (const staffName of staffList) {
      try {
        const qrCodeDataUrl = await TokenService.generateStaffQrCode(staffName, staffName)
        const qrCodeUrl = TokenService.generateStaffQrUrl(staffName, staffName)

        results.push({
          staffName,
          sheetName: staffName,
          success: true,
          qrCodeDataUrl,
          qrCodeUrl
        })

      } catch (error: any) {
        results.push({
          staffName,
          success: false,
          error: error.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return res.json({
      success: true,
      message: `구글 시트 배달담당자 QR 코드 생성 완료 (성공: ${successCount}, 실패: ${failCount})`,
      data: {
        spreadsheetId,
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount
        }
      }
    })

  } catch (error: any) {
    console.error('구글 시트 QR 코드 생성 오류:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '구글 시트에서 QR 코드 생성에 실패했습니다.'
    })
  }
})

/**
 * 구글 시트의 배달담당자 목록만 조회 API
 * GET /api/qr/staff-list/:spreadsheetId
 */
router.post('/staff-list', async (req: Request, res: Response) => {
  try {
    const { tokens, spreadsheetId } = req.body

    if (!tokens || !spreadsheetId) {
      return res.status(400).json({
        success: false,
        message: '구글 시트 토큰과 스프레드시트 ID가 필요합니다.'
      })
    }

    const staffList = await GoogleSheetsService.getDeliveryStaffList(tokens, spreadsheetId)

    return res.json({
      success: true,
      data: {
        spreadsheetId,
        staffList,
        count: staffList.length
      }
    })

  } catch (error: any) {
    console.error('배달담당자 목록 조회 오류:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '배달담당자 목록 조회에 실패했습니다.'
    })
  }
})

/**
 * 날짜별 스프레드시트에서 배달기사 정보를 추출하고 QR 코드 생성 API
 * POST /api/qr/generate-from-sheets-by-date
 */
router.post('/generate-from-sheets-by-date', requireGoogleAuth, async (req: Request, res: Response) => {
  try {
    const tokens = (req as any).session?.googleTokens

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: '구글 인증 토큰이 필요합니다.'
      })
    }

    // 구글 드라이브에서 스프레드시트 목록 가져오기
    const sheetsResult = await GoogleDriveService.getSpreadsheetsList(tokens, {
      query: 'mimeType="application/vnd.google-apps.spreadsheet"',
      pageSize: 100
    })

    const sheetNames = sheetsResult.files.map((file: any) => file.name)
    
    // 스프레드시트 이름에서 날짜와 배달기사 정보 추출
    const parsedSheets = parseMultipleSheetNames(sheetNames)

    if (parsedSheets.length === 0) {
      return res.status(404).json({
        success: false,
        message: '날짜별 배달기사 스프레드시트를 찾을 수 없습니다.'
      })
    }

    const results = []

    // 각 배달기사별 QR 코드 생성
    for (const sheet of parsedSheets) {
      try {
        // 날짜+배달기사명으로 QR 토큰 생성
        const tokenData = `${sheet.date}_${sheet.staffName}`
        const qrCodeDataUrl = await TokenService.generateStaffQrCode(sheet.staffName, tokenData)
        const qrCodeUrl = TokenService.generateStaffQrUrl(sheet.staffName, tokenData)

        results.push({
          staffName: sheet.staffName,
          date: sheet.date,
          sheetName: sheet.originalName,
          tokenData,
          success: true,
          qrCodeDataUrl,
          qrCodeUrl
        })

      } catch (error: any) {
        results.push({
          staffName: sheet.staffName,
          date: sheet.date,
          sheetName: sheet.originalName,
          success: false,
          error: error.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return res.json({
      success: true,
      message: `날짜별 배달기사 QR 코드 생성 완료 (성공: ${successCount}, 실패: ${failCount})`,
      data: {
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount,
          totalSheets: parsedSheets.length,
          uniqueStaff: [...new Set(parsedSheets.map(s => s.staffName))].length,
          dateRange: {
            from: parsedSheets[parsedSheets.length - 1]?.date,
            to: parsedSheets[0]?.date
          }
        }
      }
    })

  } catch (error: any) {
    console.error('날짜별 스프레드시트 QR 코드 생성 오류:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '날짜별 스프레드시트에서 QR 코드 생성에 실패했습니다.'
    })
  }
})

/**
 * 특정 날짜의 배달기사 목록 조회 API
 * GET /api/qr/staff-by-date/:date
 */
router.get('/staff-by-date/:date', requireGoogleAuth, async (req: Request, res: Response) => {
  try {
    const { date } = req.params
    const tokens = (req as any).session?.googleTokens

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: '구글 인증 토큰이 필요합니다.'
      })
    }

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        message: '올바른 날짜 형식이 필요합니다 (YYYY-MM-DD).'
      })
    }

    // 구글 드라이브에서 스프레드시트 목록 가져오기
    const sheetsResult = await GoogleDriveService.getSpreadsheetsList(tokens, {
      query: 'mimeType="application/vnd.google-apps.spreadsheet"',
      pageSize: 100
    })

    const sheetNames = sheetsResult.files.map((file: any) => file.name)
    const parsedSheets = parseMultipleSheetNames(sheetNames)
    
    // 특정 날짜의 배달기사 목록 필터링
    const dateStaff = parsedSheets.filter(sheet => sheet.date === date)

    return res.json({
      success: true,
      data: {
        date,
        staffList: dateStaff,
        count: dateStaff.length
      }
    })

  } catch (error: any) {
    console.error('날짜별 배달기사 목록 조회 오류:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '날짜별 배달기사 목록 조회에 실패했습니다.'
    })
  }
})

/**
 * QR 코드 토큰으로 배달 리스트 조회 API
 * POST /api/qr/get-delivery-list
 */
router.post('/get-delivery-list', async (req: Request, res: Response) => {
  try {
    const { qrToken } = req.body

    if (!qrToken) {
      return res.status(400).json({
        success: false,
        message: 'QR 토큰이 필요합니다.'
      })
    }

    // QR 토큰 검증 및 정보 추출
    const tokenData = TokenService.verifyStaffToken(qrToken)
    
    if (!tokenData) {
      return res.status(401).json({
        success: false,
        message: '유효하지 않은 QR 코드입니다.'
      })
    }

    // 토큰 데이터에서 날짜와 배달기사 이름 추출
    // tokenData.sheet는 "날짜_배달기사명" 형태
    const [date, staffName] = tokenData.sheet.split('_')

    if (!date || !staffName) {
      return res.status(400).json({
        success: false,
        message: 'QR 코드에서 날짜와 배달기사 정보를 찾을 수 없습니다.'
      })
    }

    // Google 토큰 필요 (세션에서 가져오거나 별도 인증 필요)
    // 현재는 기본적으로 관리자 세션 사용
    const tokens = (req as any).session?.googleTokens

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'Google 인증이 필요합니다.'
      })
    }

    // 배달 데이터 조회
    const deliveryResult = await GoogleSheetsService.getDeliveryDataByStaffAndDate(
      tokens, 
      staffName, 
      date
    )

    if (!deliveryResult.staffInfo) {
      return res.status(404).json({
        success: false,
        message: '해당 날짜와 배달기사의 스프레드시트를 찾을 수 없습니다.',
        data: {
          date,
          staffName
        }
      })
    }

    return res.json({
      success: true,
      message: '배달 리스트를 성공적으로 조회했습니다.',
      data: {
        staffInfo: deliveryResult.staffInfo,
        deliveryList: deliveryResult.deliveryData,
        summary: {
          totalOrders: deliveryResult.deliveryData.length,
          pendingOrders: deliveryResult.deliveryData.filter(item => item.status === '대기').length,
          inProgressOrders: deliveryResult.deliveryData.filter(item => ['준비중', '출발'].includes(item.status)).length,
          completedOrders: deliveryResult.deliveryData.filter(item => item.status === '완료').length
        }
      }
    })

  } catch (error: any) {
    console.error('QR 코드 배달 리스트 조회 오류:', error)
    return res.status(500).json({
      success: false,
      message: error.message || 'QR 코드로 배달 리스트 조회에 실패했습니다.'
    })
  }
})

/**
 * 오늘 날짜의 모든 배달기사 QR 코드 일괄 생성 API
 * POST /api/qr/generate-today-staff
 */
router.post('/generate-today-staff', requireGoogleAuth, async (req: Request, res: Response) => {
  try {
    const tokens = (req as any).session?.googleTokens

    if (!tokens) {
      return res.status(401).json({
        success: false,
        message: 'Google 인증이 필요합니다.'
      })
    }

    // 오늘 날짜의 배달기사 목록 조회
    const todayStaff = await GoogleSheetsService.getTodayDeliveryStaff(tokens)

    if (todayStaff.length === 0) {
      return res.status(404).json({
        success: false,
        message: '오늘 날짜의 배달기사 스프레드시트를 찾을 수 없습니다.'
      })
    }

    const results = []

    // 각 배달기사별 QR 코드 생성
    for (const staff of todayStaff) {
      try {
        const tokenData = `${staff.date}_${staff.staffName}`
        const qrCodeDataUrl = await TokenService.generateStaffQrCode(staff.staffName, tokenData)
        const qrCodeUrl = TokenService.generateStaffQrUrl(staff.staffName, tokenData)

        results.push({
          ...staff,
          success: true,
          qrCodeDataUrl,
          qrCodeUrl
        })

      } catch (error: any) {
        results.push({
          ...staff,
          success: false,
          error: error.message
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    return res.json({
      success: true,
      message: `오늘 배달기사 QR 코드 생성 완료 (성공: ${successCount}, 실패: ${failCount})`,
      data: {
        date: new Date().toISOString().split('T')[0],
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount
        }
      }
    })

  } catch (error: any) {
    console.error('오늘 배달기사 QR 코드 생성 오류:', error)
    return res.status(500).json({
      success: false,
      message: error.message || '오늘 배달기사 QR 코드 생성에 실패했습니다.'
    })
  }
})

export default router