import express, { Request, Response } from 'express'
import TokenService from '../services/TokenService'
import GoogleSheetsService from '../services/GoogleSheetsService'
import SecurityService from '../services/SecurityService'
import { requireGoogleAuth } from '../middleware/auth'
import { validateStaffName, validateQrToken } from '../middleware/validation'
import { qrGenerateRateLimit } from '../middleware/rateLimiter'

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

export default router