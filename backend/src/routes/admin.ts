import { Router, Response } from 'express'
import SheetMappingService from '../services/SheetMappingService'
import GoogleDriveService from '../services/GoogleDriveService'
import FilterPreferencesService from '../services/FilterPreferencesService'
import { requireGoogleAuth } from '../middleware/auth'
import { 
  asyncHandler, 
  ValidationError, 
  NotFoundError,
  StaffManagementError,
  handleGoogleSheetsError,
  StaffErrorTypes,
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
 * 인증 상태 확인 API
 * GET /api/admin/auth-status
 */
router.get('/auth-status', asyncHandler(async (req: CustomRequest, res: Response) => {
  const isAuthenticated = !!(req.session?.googleTokens && req.session.googleTokens.access_token)
  
  res.json({
    authenticated: isAuthenticated,
    tokenExists: !!req.session?.googleTokens,
    sessionId: req.session?.id
  })
}))

/**
 * 세션 기반 인증 확인 API (OAuth 팝업 후 세션 연결용)
 * POST /api/admin/auth-status/check-session
 */
router.post('/auth-status/check-session', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { sessionId } = req.body
  
  if (!sessionId) {
    return res.json({
      authenticated: false,
      message: '세션 ID가 필요합니다.'
    })
  }
  
  // 현재 세션에 토큰이 있는지 확인
  const isAuthenticated = !!(req.session?.googleTokens && req.session.googleTokens.access_token)
  
  if (isAuthenticated) {
    return res.json({
      authenticated: true,
      sessionId: req.session?.id,
      message: '이미 인증되었습니다.'
    })
  }
  
  // TODO: 실제 환경에서는 Redis나 DB를 사용해서 세션 간 토큰 공유
  // 개발환경에서는 세션 ID 매칭으로 간단히 처리
  return res.json({
    authenticated: false,
    sessionId: req.session?.id,
    message: '인증되지 않았습니다. 다시 시도해주세요.'
  })
}))

/**
 * 구글 OAuth 인증 URL 생성 API
 * GET /api/admin/google-auth-url
 */
router.get('/google-auth-url', asyncHandler(async (req: CustomRequest, res: Response) => {
  // 동적 리다이렉트 URI 생성
  const serverIp = process.env.SERVER_IP || 'localhost'
  const serverPort = process.env.SERVER_PORT || '5000'
  const redirectUri = `http://${serverIp}:${serverPort}/api/auth/google/callback`
  
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=https://www.googleapis.com/auth/drive.readonly&response_type=code&access_type=offline`
  
  res.json({
    authUrl,
    redirectUri,
    serverInfo: {
      ip: serverIp,
      port: serverPort
    }
  })
}))

/**
 * 배송자 등록 API
 * POST /api/admin/staff
 */
router.post('/staff', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { name, phone, active = true } = req.body

  // 입력값 검증
  if (!name || !phone) {
    throw new ValidationError('배송자 이름과 연락처가 필요합니다.', {
      missingFields: [
        !name && 'name',
        !phone && 'phone'
      ].filter(Boolean)
    })
  }

  // 이름 유효성 검사
  if (name.length < 2) {
    throw new ValidationError('배송자 이름은 최소 2글자 이상이어야 합니다.', {
      providedName: name
    })
  }

  // 전화번호 형식 검사 (간단한 패턴)
  const phonePattern = /^010-?\d{4}-?\d{4}$/
  if (!phonePattern.test(phone.replace(/\s/g, ''))) {
    throw new ValidationError('올바른 전화번호 형식이 아닙니다.', {
      providedPhone: phone,
      expectedFormat: '010-1234-5678'
    })
  }

  // 중복 배송자 확인
  const existingStaff = await SheetMappingService.getDeliveryStaffByName(name)
  if (existingStaff) {
    const error = new StaffManagementError('이미 등록된 배송자입니다.', {
      staffName: name,
      existingId: existingStaff.id
    })
    throw error
  }

  // 배송자 등록
  const newStaff = await SheetMappingService.addDeliveryStaff({
    name: name.trim(),
    phone: phone.replace(/\s/g, ''),
    active: Boolean(active)
  })

  if (!newStaff) {
    throw new StaffManagementError('배송자 등록에 실패했습니다.')
  }

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  return res.status(201).json({
    success: true,
    message: `${name}님이 성공적으로 등록되었습니다.`,
    data: newStaff
  })
}))

/**
 * 모든 배송자 조회 API
 * GET /api/admin/staff
 */
router.get('/staff', asyncHandler(async (req: CustomRequest, res: Response) => {
  const staffList = await SheetMappingService.getAllDeliveryStaff()

  return res.json({
    success: true,
    data: staffList,
    count: staffList.length,
    message: `총 ${staffList.length}명의 배송자를 조회했습니다.`
  })
}))

/**
 * 배송자 정보 업데이트 API
 * PUT /api/admin/staff/:id
 */
router.put('/staff/:id', asyncHandler(async (req: CustomRequest, res: Response) => {
  const staffId = parseInt(req.params.id)
  const updates = req.body

  if (isNaN(staffId) || staffId < 1) {
    throw new ValidationError('유효하지 않은 배송자 ID입니다.', {
      providedId: req.params.id
    })
  }

  // 전화번호 업데이트 시 유효성 검사
  if (updates.phone) {
    const phonePattern = /^010-?\d{4}-?\d{4}$/
    if (!phonePattern.test(updates.phone.replace(/\s/g, ''))) {
      throw new ValidationError('올바른 전화번호 형식이 아닙니다.', {
        providedPhone: updates.phone,
        expectedFormat: '010-1234-5678'
      })
    }
    updates.phone = updates.phone.replace(/\s/g, '')
  }

  // 이름 업데이트 시 유효성 검사
  if (updates.name && updates.name.length < 2) {
    throw new ValidationError('배송자 이름은 최소 2글자 이상이어야 합니다.', {
      providedName: updates.name
    })
  }

  const success = await SheetMappingService.updateDeliveryStaff(staffId, updates)
  
  if (!success) {
    throw new NotFoundError('해당 배송자를 찾을 수 없습니다.', {
      staffId
    })
  }

  return res.json({
    success: true,
    message: '배송자 정보가 업데이트되었습니다.',
    data: { id: staffId, ...updates }
  })
}))

/**
 * 배송자 삭제 API
 * DELETE /api/admin/staff/:id
 */
router.delete('/staff/:id', asyncHandler(async (req: CustomRequest, res: Response) => {
  const staffId = parseInt(req.params.id)

  if (isNaN(staffId) || staffId < 1) {
    throw new ValidationError('유효하지 않은 배송자 ID입니다.', {
      providedId: req.params.id
    })
  }

  const success = await SheetMappingService.removeDeliveryStaff(staffId)
  
  if (!success) {
    throw new NotFoundError('해당 배송자를 찾을 수 없습니다.', {
      staffId
    })
  }

  return res.json({
    success: true,
    message: '배송자가 삭제되었습니다.',
    data: { id: staffId }
  })
}))

/**
 * 스프레드시트 매핑 생성 API
 * POST /api/admin/sheet-mapping
 */
router.post('/sheet-mapping', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { date, spreadsheetId, title } = req.body

  // 입력값 검증
  if (!date || !spreadsheetId) {
    throw new ValidationError('날짜와 스프레드시트 ID가 필요합니다.', {
      missingFields: [
        !date && 'date',
        !spreadsheetId && 'spreadsheetId'
      ].filter(Boolean)
    })
  }

  // 날짜 형식 검증
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError(SheetMappingErrorTypes.INVALID_DATE_FORMAT, {
      providedDate: date,
      expectedFormat: 'YYYY-MM-DD'
    })
  }

  // 스프레드시트 ID 기본 유효성 검사
  if (spreadsheetId.length < 10) {
    throw new ValidationError('유효하지 않은 스프레드시트 ID입니다.', {
      providedId: spreadsheetId,
      suggestion: '구글 시트 URL에서 /d/ 뒤의 긴 문자열을 사용하세요.'
    })
  }

  // 기존 매핑 확인
  const existingMapping = await SheetMappingService.getSheetMapping(date)
  if (existingMapping) {
    // 기존 매핑이 있으면 업데이트
    const success = await SheetMappingService.setSheetMapping({
      date,
      spreadsheetId: spreadsheetId.trim(),
      title: title || `${date} 배송 시트`,
      status: 'connected'
    })

    if (!success) {
      throw new Error('스프레드시트 매핑 업데이트에 실패했습니다.')
    }

    return res.json({
      success: true,
      message: `${date} 날짜의 스프레드시트 매핑이 업데이트되었습니다.`,
      data: { date, spreadsheetId, title, status: 'connected' }
    })
  }

  // 새 매핑 생성
  const success = await SheetMappingService.setSheetMapping({
    date,
    spreadsheetId: spreadsheetId.trim(),
    title: title || `${date} 배송 시트`,
    status: 'connected'
  })

  if (!success) {
    throw new Error('스프레드시트 매핑 생성에 실패했습니다.')
  }

  return res.status(201).json({
    success: true,
    message: `${date} 날짜의 스프레드시트가 성공적으로 연결되었습니다.`,
    data: { date, spreadsheetId, title: title || `${date} 배송 시트`, status: 'connected' }
  })
}))

/**
 * 모든 스프레드시트 매핑 조회 API
 * GET /api/admin/sheet-mappings
 */
router.get('/sheet-mappings', asyncHandler(async (req: CustomRequest, res: Response) => {
  const mappings = await SheetMappingService.getAllSheetMappings()

  // 날짜순 정렬 (최신순)
  mappings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())

  return res.json({
    success: true,
    data: mappings,
    count: mappings.length,
    message: `총 ${mappings.length}개의 스프레드시트 매핑을 조회했습니다.`
  })
}))

/**
 * 특정 날짜 스프레드시트 매핑 조회 API
 * GET /api/admin/sheet-mapping/:date
 */
router.get('/sheet-mapping/:date', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { date } = req.params

  // 날짜 형식 검증
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError(SheetMappingErrorTypes.INVALID_DATE_FORMAT, {
      providedDate: date,
      expectedFormat: 'YYYY-MM-DD'
    })
  }

  const mapping = await SheetMappingService.getSheetMapping(date)
  
  if (!mapping) {
    throw new NotFoundError(SheetMappingErrorTypes.DATE_NOT_MAPPED, {
      date
    })
  }

  return res.json({
    success: true,
    data: { date, spreadsheetId: mapping },
    message: `${date} 날짜의 스프레드시트 매핑을 조회했습니다.`
  })
}))

/**
 * 스프레드시트 매핑 삭제 API
 * DELETE /api/admin/sheet-mapping/:date
 */
router.delete('/sheet-mapping/:date', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { date } = req.params

  // 날짜 형식 검증
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError(SheetMappingErrorTypes.INVALID_DATE_FORMAT, {
      providedDate: date,
      expectedFormat: 'YYYY-MM-DD'
    })
  }

  const success = await SheetMappingService.removeSheetMapping(date)
  
  if (!success) {
    throw new NotFoundError(SheetMappingErrorTypes.DATE_NOT_MAPPED, {
      date
    })
  }

  return res.json({
    success: true,
    message: `${date} 날짜의 스프레드시트 매핑이 삭제되었습니다.`,
    data: { date }
  })
}))

/**
 * 시스템 상태 조회 API
 * GET /api/admin/status
 */
router.get('/status', asyncHandler(async (req: CustomRequest, res: Response) => {
  const staffCount = (await SheetMappingService.getAllDeliveryStaff()).length
  const mappingCount = (await SheetMappingService.getAllSheetMappings()).length
  const activeStaffCount = (await SheetMappingService.getAllDeliveryStaff())
    .filter(staff => staff.active).length

  return res.json({
    success: true,
    data: {
      totalStaff: staffCount,
      activeStaff: activeStaffCount,
      inactiveStaff: staffCount - activeStaffCount,
      totalMappings: mappingCount,
      systemStatus: 'operational',
      lastUpdated: new Date().toISOString()
    },
    message: '시스템 상태를 조회했습니다.'
  })
}))

/**
 * 구글 드라이브 스프레드시트 목록 조회 API
 * GET /api/admin/spreadsheets
 */
router.get('/spreadsheets', requireGoogleAuth, asyncHandler(async (req: CustomRequest, res: Response) => {
  const { 
    query = '', 
    pageSize = 20, 
    pageToken = '', 
    orderBy = 'modifiedTime desc',
    includeStarred = 'true'
  } = req.query

  const options = {
    query: query as string,
    pageSize: parseInt(pageSize as string),
    pageToken: pageToken as string,
    orderBy: orderBy as string,
    includeItemsFromAllDrives: true
  }

  const result = await GoogleDriveService.getSpreadsheetsList(req.googleTokens, options)

  // 검색어가 있으면 최근 검색어에 저장
  if (query && (query as string).trim()) {
    await FilterPreferencesService.saveRecentSearch(
      (query as string).trim(), 
      result.totalCount
    )
  }

  return res.json({
    success: true,
    data: result,
    message: `${result.totalCount}개의 스프레드시트를 조회했습니다.`
  })
}))

/**
 * 즐겨찾기 스프레드시트 조회 API
 * GET /api/admin/spreadsheets/starred
 */
router.get('/spreadsheets/starred', requireGoogleAuth, asyncHandler(async (req: CustomRequest, res: Response) => {
  const starredSheets = await GoogleDriveService.getStarredSpreadsheets(req.googleTokens)

  return res.json({
    success: true,
    data: starredSheets,
    count: starredSheets.length,
    message: `${starredSheets.length}개의 즐겨찾기 스프레드시트를 조회했습니다.`
  })
}))

/**
 * 최근 수정된 스프레드시트 조회 API
 * GET /api/admin/spreadsheets/recent
 */
router.get('/spreadsheets/recent', requireGoogleAuth, asyncHandler(async (req: CustomRequest, res: Response) => {
  const { limit = 10 } = req.query
  const recentSheets = await GoogleDriveService.getRecentSpreadsheets(
    req.googleTokens, 
    parseInt(limit as string)
  )

  return res.json({
    success: true,
    data: recentSheets,
    count: recentSheets.length,
    message: `최근 ${recentSheets.length}개의 스프레드시트를 조회했습니다.`
  })
}))

/**
 * 특정 스프레드시트 정보 조회 API
 * GET /api/admin/spreadsheets/:id
 */
router.get('/spreadsheets/:id', requireGoogleAuth, asyncHandler(async (req: CustomRequest, res: Response) => {
  const { id } = req.params

  const spreadsheetInfo = await GoogleDriveService.getSpreadsheetInfo(req.googleTokens, id)
  
  if (!spreadsheetInfo) {
    throw new NotFoundError('스프레드시트를 찾을 수 없습니다.', {
      spreadsheetId: id
    })
  }

  // 권한 정보도 함께 조회
  const accessInfo = await GoogleDriveService.checkSpreadsheetAccess(req.googleTokens, id)

  return res.json({
    success: true,
    data: {
      ...spreadsheetInfo,
      access: accessInfo
    },
    message: '스프레드시트 정보를 조회했습니다.'
  })
}))

/**
 * 복수 스프레드시트 일괄 연결 API
 * POST /api/admin/spreadsheets/bulk-connect
 */
router.post('/spreadsheets/bulk-connect', requireGoogleAuth, asyncHandler(async (req: CustomRequest, res: Response) => {
  const { spreadsheets, baseDateStr } = req.body

  if (!Array.isArray(spreadsheets) || spreadsheets.length === 0) {
    throw new ValidationError('연결할 스프레드시트 목록이 필요합니다.', {
      providedSpreadsheets: spreadsheets
    })
  }

  if (!baseDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(baseDateStr)) {
    throw new ValidationError('유효한 기준 날짜가 필요합니다.', {
      providedDate: baseDateStr,
      expectedFormat: 'YYYY-MM-DD'
    })
  }

  const results = []
  let successCount = 0
  let failCount = 0

  for (let i = 0; i < spreadsheets.length; i++) {
    const { id, name } = spreadsheets[i]
    
    try {
      // 기준 날짜에서 순차적으로 날짜 계산
      const targetDate = new Date(baseDateStr)
      targetDate.setDate(targetDate.getDate() + i)
      const dateStr = targetDate.toISOString().split('T')[0]

      // 스프레드시트 접근 권한 확인
      const accessInfo = await GoogleDriveService.checkSpreadsheetAccess(req.googleTokens, id)
      
      if (!accessInfo.canRead) {
        throw new Error('스프레드시트 읽기 권한이 없습니다.')
      }

      // 매핑 생성
      const success = await SheetMappingService.setSheetMapping({
        date: dateStr,
        spreadsheetId: id,
        title: name,
        status: 'connected'
      })

      if (!success) {
        throw new Error('매핑 저장에 실패했습니다.')
      }

      results.push({
        spreadsheetId: id,
        name,
        date: dateStr,
        success: true,
        access: accessInfo
      })
      successCount++

    } catch (error: any) {
      results.push({
        spreadsheetId: id,
        name,
        success: false,
        error: error.message
      })
      failCount++
    }
  }

  return res.json({
    success: true,
    data: {
      results,
      summary: {
        total: spreadsheets.length,
        success: successCount,
        failed: failCount
      }
    },
    message: `일괄 연결 완료: 성공 ${successCount}개, 실패 ${failCount}개`
  })
}))

/**
 * 스프레드시트 즐겨찾기 토글 API
 * POST /api/admin/spreadsheets/:id/toggle-star
 */
router.post('/spreadsheets/:id/toggle-star', requireGoogleAuth, asyncHandler(async (req: CustomRequest, res: Response) => {
  const { id } = req.params

  const newStarredState = await GoogleDriveService.toggleSpreadsheetStar(req.googleTokens, id)

  return res.json({
    success: true,
    data: {
      spreadsheetId: id,
      starred: newStarredState
    },
    message: `스프레드시트가 ${newStarredState ? '즐겨찾기에 추가' : '즐겨찾기에서 제거'}되었습니다.`
  })
}))

/**
 * 필터 선호도 저장 API
 * POST /api/admin/filter-preferences
 */
router.post('/filter-preferences', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { name, query, orderBy, includeStarred, includeShared } = req.body

  if (!name || !query) {
    throw new ValidationError('필터 이름과 검색어가 필요합니다.', {
      missingFields: [
        !name && 'name',
        !query && 'query'
      ].filter(Boolean)
    })
  }

  const preference = await FilterPreferencesService.saveFilterPreference({
    name: name.trim(),
    query: query.trim(),
    orderBy: orderBy || 'modifiedTime desc',
    includeStarred: Boolean(includeStarred),
    includeShared: Boolean(includeShared)
  })

  return res.json({
    success: true,
    data: preference,
    message: '필터 선호도가 저장되었습니다.'
  })
}))

/**
 * 필터 선호도 목록 조회 API
 * GET /api/admin/filter-preferences
 */
router.get('/filter-preferences', asyncHandler(async (req: CustomRequest, res: Response) => {
  const preferences = await FilterPreferencesService.getAllFilterPreferences()

  return res.json({
    success: true,
    data: preferences,
    count: preferences.length,
    message: `${preferences.length}개의 필터 선호도를 조회했습니다.`
  })
}))

/**
 * 최근 검색어 조회 API
 * GET /api/admin/recent-searches
 */
router.get('/recent-searches', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { limit = 10 } = req.query
  const recentSearches = await FilterPreferencesService.getRecentSearches(parseInt(limit as string))

  return res.json({
    success: true,
    data: recentSearches,
    count: recentSearches.length,
    message: `최근 ${recentSearches.length}개의 검색어를 조회했습니다.`
  })
}))

/**
 * 인기 검색어 조회 API
 * GET /api/admin/popular-searches
 */
router.get('/popular-searches', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { limit = 10 } = req.query
  const popularSearches = await FilterPreferencesService.getPopularSearches(parseInt(limit as string))

  return res.json({
    success: true,
    data: popularSearches,
    count: popularSearches.length,
    message: `인기 검색어 ${popularSearches.length}개를 조회했습니다.`
  })
}))

/**
 * 필터 선호도 삭제 API
 * DELETE /api/admin/filter-preferences/:id
 */
router.delete('/filter-preferences/:id', asyncHandler(async (req: CustomRequest, res: Response) => {
  const { id } = req.params

  const success = await FilterPreferencesService.deleteFilterPreference(id)
  
  if (!success) {
    throw new NotFoundError('해당 필터 선호도를 찾을 수 없습니다.', {
      preferenceId: id
    })
  }

  return res.json({
    success: true,
    message: '필터 선호도가 삭제되었습니다.',
    data: { id }
  })
}))

export default router