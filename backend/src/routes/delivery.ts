import { Router, Response } from 'express'
import GoogleSheetsService from '../services/GoogleSheetsService'
import TokenService from '../services/TokenService'
import SheetMappingService from '../services/SheetMappingService'
import SecurityService from '../services/SecurityService'
import SolapiService from '../services/SolapiService'
import { DeliveryStatusService } from '../services/DeliveryStatusService'
import logger from '../services/LoggerService'
import { requireGoogleAuth, optionalGoogleAuth, requireStaffAuth, requireSheetAccess } from '../middleware/auth'
import { validateStaffName, validateDeliveryStatus, validateQrToken } from '../middleware/validation'
import { qrGenerateRateLimit, deliveryUpdateRateLimit } from '../middleware/rateLimiter'
import { 
  asyncHandler, 
  ValidationError, 
  AuthenticationError, 
  NotFoundError, 
  QrCodeError,
  handleGoogleSheetsError,
  QrErrorTypes,
  SheetMappingErrorTypes
} from '../middleware/errorHandler'

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
 * QR 코드 로그인 API
 * POST /api/delivery/qr-login
 */
router.post('/qr-login', qrGenerateRateLimit, asyncHandler(async (req: CustomRequest, res: Response) => {
  const { staffName, token, workDate } = req.body

  // 입력값 검증
  if (!staffName || !token) {
    throw new ValidationError('배달기사 이름과 토큰이 필요합니다.', {
      missingFields: [
        !staffName && 'staffName',
        !token && 'token'
      ].filter(Boolean)
    })
  }

  // QR 코드 토큰 검증
  try {
    const isValidQr = TokenService.validateQrCodeData(staffName, token)
    if (!isValidQr) {
      throw new QrCodeError(QrErrorTypes.INVALID_FORMAT)
    }
  } catch (error: any) {
    if (error.message && error.message.includes('expired')) {
      throw new QrCodeError(QrErrorTypes.EXPIRED_TOKEN)
    }
    if (error.message && error.message.includes('signature')) {
      throw new QrCodeError(QrErrorTypes.INVALID_SIGNATURE)
    }
    throw new QrCodeError(QrErrorTypes.INVALID_FORMAT, { originalError: error.message || String(error) })
  }

  // 토큰에서 작업 날짜 추출
  let tokenData
  try {
    tokenData = TokenService.verifyStaffToken(token)
  } catch (error: any) {
    throw new QrCodeError('토큰 검증에 실패했습니다.', { originalError: error.message || String(error) })
  }

  const targetDate = workDate || tokenData.workDate || new Date().toISOString().split('T')[0]

  // 날짜 형식 검증
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
    throw new ValidationError(SheetMappingErrorTypes.INVALID_DATE_FORMAT, { 
      providedDate: targetDate 
    })
  }

  // 배달기사 등록 확인 제거 - 날짜별 시트 방식에서는 스프레드시트 이름에서 자동으로 배달기사 정보를 추출합니다.

  // 해당 날짜의 스프레드시트 조회
  const spreadsheetId = await SheetMappingService.getSheetMapping(targetDate)
  if (!spreadsheetId) {
    throw new NotFoundError(SheetMappingErrorTypes.DATE_NOT_MAPPED, {
      targetDate,
      suggestion: '관리자에게 해당 날짜의 스프레드시트 연결을 요청하세요.'
    })
  }

  // 마지막 접근 시간 업데이트
  await SheetMappingService.updateLastAccessed(targetDate)

  // 세션에 인증 정보 저장
  req.session.deliveryAuth = {
    staffName,
    staffId: staffName, // 배달기사 ID는 이름으로 사용
    workDate: targetDate,
    spreadsheetId,
    loginTime: new Date().toISOString(),
    tokenData
  }

  return res.json({
    success: true,
    message: `${staffName}님, 로그인되었습니다.`,
    data: {
      staffName,
      workDate: targetDate,
      staffInfo: {
        id: staffName,
        name: staffName,
        phone: ''
      }
    }
  })
}))

/**
 * 배송자 현재 작업 조회 API
 * GET /api/delivery/current-work
 */
router.get('/current-work', asyncHandler(async (req: CustomRequest, res: Response) => {
  const deliveryAuth = req.session?.deliveryAuth
  if (!deliveryAuth) {
    throw new AuthenticationError('로그인이 필요합니다.', {
      suggestion: 'QR 코드를 스캔하여 로그인하세요.'
    })
  }

  const { staffName, workDate, spreadsheetId } = deliveryAuth

  // 관리자 토큰이 필요함 (임시로 세션에서 가져오기)
  const tokens = req.session?.googleTokens
  if (!tokens) {
    throw new AuthenticationError('시스템 인증 오류가 발생했습니다.', {
      suggestion: '관리자에게 문의하세요.',
      errorType: 'SYSTEM_AUTH_ERROR'
    })
  }

  // 배송 데이터 조회
  let deliveryData
  try {
    deliveryData = await GoogleSheetsService.getDeliveryData(
      tokens,
      spreadsheetId,
      staffName
    )
  } catch (error) {
    throw handleGoogleSheetsError(error)
  }

  return res.json({
    success: true,
    data: {
      staffName,
      workDate,
      orders: deliveryData,
      totalOrders: deliveryData.length,
      completedOrders: deliveryData.filter(order => order.status === '완료').length,
      pendingOrders: deliveryData.filter(order => order.status !== '완료').length
    },
    message: `${staffName}님의 ${workDate} 배송 목록을 조회했습니다.`
  })
}))

/**
 * 배송 상태 업데이트 API (QR 인증 기반)
 * PUT /api/delivery/update-status
 */
router.put('/update-status', deliveryUpdateRateLimit, validateDeliveryStatus, asyncHandler(async (req: CustomRequest, res: Response) => {
  const deliveryAuth = req.session?.deliveryAuth
  if (!deliveryAuth) {
    throw new AuthenticationError('로그인이 필요합니다.', {
      suggestion: 'QR 코드를 스캔하여 로그인하세요.'
    })
  }

  const { rowIndex, status, customerName } = req.body
  const { staffName, spreadsheetId } = deliveryAuth

  // 입력값 검증
  if (!rowIndex || !status) {
    throw new ValidationError('주문 행 번호와 상태가 필요합니다.', {
      missingFields: [
        !rowIndex && 'rowIndex',
        !status && 'status'
      ].filter(Boolean)
    })
  }

  // 행 번호 유효성 검사
  if (!Number.isInteger(rowIndex) || rowIndex < 1) {
    throw new ValidationError('유효하지 않은 행 번호입니다.', {
      providedRowIndex: rowIndex,
      suggestion: '행 번호는 1 이상의 정수여야 합니다.'
    })
  }

  // 관리자 토큰 확인
  const tokens = req.session?.googleTokens
  if (!tokens) {
    throw new AuthenticationError('시스템 인증 오류가 발생했습니다.', {
      suggestion: '관리자에게 문의하세요.',
      errorType: 'SYSTEM_AUTH_ERROR'
    })
  }

  // 상태 유효성 검증
  if (!DeliveryStatusService.isValidStatus(status)) {
    throw new ValidationError(`유효하지 않은 상태입니다.`, {
      providedStatus: status,
      validStatuses: DeliveryStatusService.getValidStatuses(),
      suggestion: `다음 중 하나를 선택하세요: ${DeliveryStatusService.getValidStatuses().join(', ')}`
    })
  }

  // 현재 상태 조회 후 상태 전환 유효성 검증
  let currentOrderData
  try {
    const deliveryData = await GoogleSheetsService.getDeliveryData(tokens, spreadsheetId, staffName)
    currentOrderData = deliveryData.find(order => order.rowIndex === rowIndex)
    
    if (!currentOrderData) {
      throw new NotFoundError('해당 주문을 찾을 수 없습니다.', {
        rowIndex,
        staffName,
        suggestion: '올바른 주문 번호를 확인하세요.'
      })
    }
  } catch (error) {
    throw handleGoogleSheetsError(error)
  }

  const currentStatus = currentOrderData.status || '대기'
  
  // 상태 전환 유효성 검증
  if (!DeliveryStatusService.isValidTransition(currentStatus, status)) {
    const errorMessage = DeliveryStatusService.getTransitionError(currentStatus, status)
    throw new ValidationError(`상태 전환 오류: ${errorMessage}`, {
      currentStatus,
      requestedStatus: status,
      validNextStatuses: DeliveryStatusService.getNextValidStatuses(currentStatus),
      suggestion: currentStatus === status 
        ? '이미 해당 상태입니다.' 
        : `현재 '${currentStatus}' 상태에서 가능한 다음 상태: ${DeliveryStatusService.getNextValidStatuses(currentStatus).join(', ')}`
    })
  }

  logger.info('배달 상태 전환 시도', {
    staffName,
    rowIndex,
    customerName: currentOrderData.customerName,
    currentStatus,
    newStatus: status,
    isValidTransition: true,
    service: 'delivery'
  })

  // 배송 상태 업데이트
  let result
  try {
    result = await GoogleSheetsService.updateDeliveryStatus(
      tokens,
      spreadsheetId,
      staffName,
      rowIndex,
      status
    )
  } catch (error) {
    throw handleGoogleSheetsError(error)
  }

  // 배달 완료 시 자동 카카오톡 알림 발송
  let notificationResult = null
  if (status === '완료' && result && result.phone) {
    const notificationStartTime = Date.now()
    
    try {
      const solapiTokens = req.session?.solapiTokens
      if (solapiTokens) {
        // 발신번호는 설정에서 가져오거나 기본값 사용
        const senderNumber = req.session?.senderNumber || process.env.DEFAULT_SENDER_NUMBER || '1588-0000'
        const templateId = req.session?.kakaoTemplateId // 관리자가 설정한 템플릿 ID
        
        logger.info('배달 완료 알림 발송 시작', {
          staffName,
          customerName: customerName || result.customerName,
          phone: result.phone,
          senderNumber,
          templateId: templateId || 'SMS_FALLBACK',
          service: 'delivery'
        })
        
        notificationResult = await SolapiService.sendDeliveryCompleteNotification(
          solapiTokens,
          customerName || result.customerName || '고객',
          result.phone,
          senderNumber,
          templateId
        )

        const notificationDuration = Date.now() - notificationStartTime

        // 알림 발송 결과 로깅
        if (notificationResult.success) {
          logger.info('배달 완료 알림 발송 성공', {
            staffName,
            customerName: customerName || result.customerName,
            phone: result.phone,
            messageId: notificationResult.messageId,
            messageType: notificationResult.messageType || 'unknown',
            duration: notificationDuration,
            service: 'delivery',
            notification: true
          })
          
          // 성능 메트릭 기록
          logger.metric('delivery_notification_success', 1, {
            messageType: notificationResult.messageType,
            duration: notificationDuration,
            staffName
          })
        } else {
          logger.warn('배달 완료 알림 발송 실패', {
            staffName,
            customerName: customerName || result.customerName,
            phone: result.phone,
            error: notificationResult.errorMessage,
            errorCode: notificationResult.errorCode,
            duration: notificationDuration,
            service: 'delivery',
            notification: true
          })
          
          // 실패 메트릭 기록
          logger.metric('delivery_notification_failure', 1, {
            errorCode: notificationResult.errorCode || 'UNKNOWN',
            staffName
          })
        }
      } else {
        logger.warn('SOLAPI 토큰이 없어 알림 발송을 건너뜁니다', {
          staffName,
          customerName: customerName || result.customerName,
          phone: result.phone,
          suggestion: '관리자가 SOLAPI 인증을 완료해야 합니다',
          service: 'delivery'
        })
        
        // 설정 누락 메트릭
        logger.metric('delivery_notification_skipped', 1, {
          reason: 'NO_SOLAPI_TOKEN',
          staffName
        })
      }
    } catch (notificationError: any) {
      const notificationDuration = Date.now() - notificationStartTime
      
      logger.error('배달 완료 알림 발송 중 시스템 오류', {
        staffName,
        customerName: customerName || result.customerName,
        phone: result.phone,
        error: notificationError.message,
        stack: notificationError.stack,
        duration: notificationDuration,
        service: 'delivery'
      }, notificationError)
      
      // 시스템 에러 메트릭
      logger.metric('delivery_notification_system_error', 1, {
        errorType: notificationError.name || 'Error',
        staffName
      })
      
      // 알림 발송 실패는 전체 작업을 실패시키지 않음
    }
  } else if (status === '완료') {
    logger.warn('배달 완료로 변경되었지만 전화번호가 없어 알림을 발송할 수 없습니다', {
      staffName,
      customerName,
      hasResult: !!result,
      hasPhone: !!(result && result.phone),
      service: 'delivery'
    })
  }

  const responseMessage = `${customerName ? customerName + '님의 ' : ''}배달 상태가 '${status}'로 업데이트되었습니다.`
  
  return res.json({
    success: true,
    data: { 
      updated: result,
      staffName,
      status,
      customerName,
      rowIndex,
      workDate: deliveryAuth.workDate,
      notificationSent: notificationResult?.success || false
    },
    message: responseMessage,
    shouldSendNotification: status === '완료',
    notificationResult: notificationResult?.success 
      ? { sent: true, messageId: notificationResult.messageId }
      : notificationResult?.errorMessage
        ? { sent: false, error: notificationResult.errorMessage }
        : null
  })
}))

/**
 * 배송자 로그아웃 API
 * POST /api/delivery/logout
 */
router.post('/logout', async (req: CustomRequest, res: Response) => {
  try {
    const deliveryAuth = req.session?.deliveryAuth
    if (!deliveryAuth) {
      return res.json({
        success: true,
        message: '이미 로그아웃 상태입니다.'
      })
    }

    // 세션에서 배송자 인증 정보 제거
    delete req.session.deliveryAuth

    return res.json({
      success: true,
      message: '로그아웃되었습니다.'
    })

  } catch (error: any) {
    console.error('로그아웃 실패:', error)
    return res.status(500).json({
      success: false,
      message: '로그아웃에 실패했습니다.',
      errorType: 'SERVER_ERROR'
    })
  }
})

/**
 * 배달담당자의 주문 목록 조회 (QR 코드 접근용)
 */
router.get('/orders/:staffName', validateStaffName, requireStaffAuth, requireSheetAccess, async (req: CustomRequest, res: Response) => {
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
router.put('/update-status/:staffName', validateStaffName, validateDeliveryStatus, deliveryUpdateRateLimit, requireStaffAuth, requireSheetAccess, async (req: CustomRequest, res: Response) => {
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
        updated: result.updated,
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
router.get('/stats/:staffName', validateStaffName, requireStaffAuth, requireSheetAccess, async (req: CustomRequest, res: Response) => {
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

/**
 * 배달 상태 정보 조회 API
 * GET /api/delivery/status-info
 */
router.get('/status-info', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { current_status } = req.query

  const statusInfo: any = {
    validStatuses: DeliveryStatusService.getValidStatuses(),
    statusDescriptions: DeliveryStatusService.getValidStatuses().reduce((acc, status) => {
      acc[status] = {
        description: DeliveryStatusService.getStatusDescription(status),
        color: DeliveryStatusService.getStatusColor(status),
        icon: DeliveryStatusService.getStatusIcon(status)
      }
      return acc
    }, {} as Record<string, any>)
  }

  // 특정 상태가 주어진 경우 해당 상태에서 가능한 다음 상태들 포함
  if (current_status && typeof current_status === 'string') {
    const currentStatus = current_status as string
    statusInfo.nextValidStatuses = DeliveryStatusService.getNextValidStatuses(currentStatus)
    statusInfo.currentStatusInfo = {
      status: currentStatus,
      isValid: DeliveryStatusService.isValidStatus(currentStatus),
      description: DeliveryStatusService.getStatusDescription(currentStatus),
      color: DeliveryStatusService.getStatusColor(currentStatus),
      icon: DeliveryStatusService.getStatusIcon(currentStatus),
      isCompleted: DeliveryStatusService.isCompleted(currentStatus),
      isInProgress: DeliveryStatusService.isInProgress(currentStatus)
    }
  }

  return res.json({
    success: true,
    data: statusInfo,
    message: '배달 상태 정보를 조회했습니다.'
  })
}))

/**
 * 배달 상태 전환 유효성 검증 API
 * POST /api/delivery/validate-transition
 */
router.post('/validate-transition', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { currentStatus, newStatus } = req.body

  if (!currentStatus || !newStatus) {
    throw new ValidationError('현재 상태와 새로운 상태가 필요합니다.', {
      missingFields: [
        !currentStatus && 'currentStatus',
        !newStatus && 'newStatus'
      ].filter(Boolean)
    })
  }

  const isValid = DeliveryStatusService.isValidTransition(currentStatus, newStatus)
  const errorMessage = isValid ? null : DeliveryStatusService.getTransitionError(currentStatus, newStatus)

  return res.json({
    success: true,
    data: {
      currentStatus,
      newStatus,
      isValidTransition: isValid,
      errorMessage,
      validNextStatuses: DeliveryStatusService.getNextValidStatuses(currentStatus),
      transitionRules: {
        from: currentStatus,
        to: newStatus,
        allowed: isValid
      }
    },
    message: isValid ? '유효한 상태 전환입니다.' : '유효하지 않은 상태 전환입니다.'
  })
}))

/**
 * 주문별 상태 전환 히스토리 조회 API
 * GET /api/delivery/status-history/:staffName/:rowIndex
 */
router.get('/status-history/:staffName/:rowIndex', requireStaffAuth, asyncHandler(async (req: CustomRequest, res: Response) => {
  const { staffName, rowIndex } = req.params
  const deliveryAuth = req.session?.deliveryAuth

  if (!deliveryAuth) {
    throw new AuthenticationError('로그인이 필요합니다.')
  }

  const { spreadsheetId } = deliveryAuth
  const tokens = req.session?.googleTokens

  if (!tokens) {
    throw new AuthenticationError('시스템 인증 오류가 발생했습니다.')
  }

  try {
    const deliveryData = await GoogleSheetsService.getDeliveryData(tokens, spreadsheetId, staffName)
    const orderData = deliveryData.find(order => order.rowIndex === parseInt(rowIndex))

    if (!orderData) {
      throw new NotFoundError('해당 주문을 찾을 수 없습니다.')
    }

    const currentStatus = orderData.status || '대기'
    const statusHistory = [
      {
        status: currentStatus,
        timestamp: new Date().toISOString(),
        description: DeliveryStatusService.getStatusDescription(currentStatus),
        color: DeliveryStatusService.getStatusColor(currentStatus),
        icon: DeliveryStatusService.getStatusIcon(currentStatus)
      }
    ]

    return res.json({
      success: true,
      data: {
        orderInfo: orderData,
        currentStatus: {
          status: currentStatus,
          description: DeliveryStatusService.getStatusDescription(currentStatus),
          color: DeliveryStatusService.getStatusColor(currentStatus),
          icon: DeliveryStatusService.getStatusIcon(currentStatus),
          nextValidStatuses: DeliveryStatusService.getNextValidStatuses(currentStatus)
        },
        statusHistory,
        availableTransitions: DeliveryStatusService.getNextValidStatuses(currentStatus).map(status => ({
          status,
          description: DeliveryStatusService.getStatusDescription(status),
          color: DeliveryStatusService.getStatusColor(status),
          icon: DeliveryStatusService.getStatusIcon(status)
        }))
      },
      message: '주문 상태 정보를 조회했습니다.'
    })
  } catch (error) {
    throw handleGoogleSheetsError(error)
  }
}))

export default router