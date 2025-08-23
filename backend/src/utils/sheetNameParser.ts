/**
 * 스프레드시트 이름에서 날짜와 배달기사 이름을 추출하는 유틸리티
 */

export interface ParsedSheetName {
  date: string
  staffName: string
  originalName: string
  isValid: boolean
}

/**
 * 스프레드시트 이름에서 날짜와 배달기사 이름 추출
 * 지원 패턴:
 * - YYYY-MM-DD_배달기사이름
 * - YYYY.MM.DD_배달기사이름  
 * - YYYYMMDD_배달기사이름
 * - YYYY-MM-DD-배달기사이름
 * - 배달기사이름_YYYY-MM-DD
 * - 배달기사이름-YYYY-MM-DD
 */
export function parseSheetName(sheetName: string): ParsedSheetName {
  const result: ParsedSheetName = {
    date: '',
    staffName: '',
    originalName: sheetName,
    isValid: false
  }

  if (!sheetName || typeof sheetName !== 'string') {
    return result
  }

  const name = sheetName.trim()
  
  // 날짜 패턴들
  const datePatterns = [
    // YYYY-MM-DD 형식
    /(\d{4}-\d{2}-\d{2})/,
    // YYYY.MM.DD 형식
    /(\d{4}\.\d{2}\.\d{2})/,
    // YYYYMMDD 형식
    /(\d{8})/
  ]

  let extractedDate = ''
  let dateMatch: RegExpMatchArray | null = null

  // 날짜 패턴 찾기
  for (const pattern of datePatterns) {
    dateMatch = name.match(pattern)
    if (dateMatch) {
      extractedDate = dateMatch[1]
      break
    }
  }

  if (!extractedDate) {
    return result
  }

  // 날짜를 표준 형식으로 변환 (YYYY-MM-DD)
  let standardDate = extractedDate
  if (extractedDate.includes('.')) {
    standardDate = extractedDate.replace(/\./g, '-')
  } else if (extractedDate.length === 8) {
    // YYYYMMDD -> YYYY-MM-DD
    standardDate = `${extractedDate.slice(0, 4)}-${extractedDate.slice(4, 6)}-${extractedDate.slice(6, 8)}`
  }

  // 배달기사 이름 추출
  let staffName = ''
  
  // 구분자로 분리
  const separators = ['_', '-']
  for (const sep of separators) {
    const parts = name.split(sep)
    if (parts.length >= 2) {
      // 날짜가 포함된 부분 찾기
      const datePartIndex = parts.findIndex(part => 
        datePatterns.some(pattern => pattern.test(part))
      )
      
      if (datePartIndex !== -1) {
        // 날짜가 아닌 다른 부분들을 배달기사 이름으로 간주
        const otherParts = parts.filter((_, index) => index !== datePartIndex)
        staffName = otherParts.join('').trim()
        break
      }
    }
  }

  // 구분자가 없는 경우, 날짜 부분을 제거하고 나머지를 배달기사 이름으로
  if (!staffName) {
    staffName = name.replace(extractedDate, '').replace(/[_\-]/g, '').trim()
  }

  // 유효성 검사
  const isValidDate = /^\d{4}-\d{2}-\d{2}$/.test(standardDate)
  const isValidStaffName = staffName.length >= 1 && staffName.length <= 20

  result.date = standardDate
  result.staffName = staffName
  result.isValid = isValidDate && isValidStaffName

  return result
}

/**
 * 날짜와 배달기사 이름으로 스프레드시트 이름 생성
 */
export function generateSheetName(date: string, staffName: string): string {
  return `${date}_${staffName}`
}

/**
 * 현재 날짜로 스프레드시트 이름 생성
 */
export function generateTodaySheetName(staffName: string): string {
  const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD
  return generateSheetName(today, staffName)
}

/**
 * 여러 스프레드시트 이름을 파싱하여 유효한 것들만 반환
 */
export function parseMultipleSheetNames(sheetNames: string[]): ParsedSheetName[] {
  return sheetNames
    .map(name => parseSheetName(name))
    .filter(parsed => parsed.isValid)
    .sort((a, b) => {
      // 날짜 순으로 정렬 (최신순)
      if (a.date !== b.date) {
        return b.date.localeCompare(a.date)
      }
      // 같은 날짜면 배달기사 이름 순
      return a.staffName.localeCompare(b.staffName)
    })
}

/**
 * 특정 배달기사의 스프레드시트들 필터링
 */
export function filterSheetsByStaff(parsedSheets: ParsedSheetName[], staffName: string): ParsedSheetName[] {
  return parsedSheets.filter(sheet => 
    sheet.staffName.toLowerCase() === staffName.toLowerCase()
  )
}

/**
 * 특정 날짜의 스프레드시트들 필터링  
 */
export function filterSheetsByDate(parsedSheets: ParsedSheetName[], date: string): ParsedSheetName[] {
  return parsedSheets.filter(sheet => sheet.date === date)
}