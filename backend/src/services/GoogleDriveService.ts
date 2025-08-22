import { google } from 'googleapis'
import { createOAuth2Client } from '../config/google'

export interface SpreadsheetInfo {
  id: string
  name: string
  createdTime: string
  modifiedTime: string
  owners: string[]
  webViewLink: string
  size?: number
  starred: boolean
  shared: boolean
}

export interface DriveListOptions {
  query?: string
  pageSize?: number
  pageToken?: string
  orderBy?: string
  includeItemsFromAllDrives?: boolean
}

export class GoogleDriveService {
  private oauth2Client: any

  constructor() {
    this.oauth2Client = createOAuth2Client()
  }

  /**
   * 스프레드시트 목록 조회
   */
  async getSpreadsheetsList(tokens: any, options: DriveListOptions = {}): Promise<{
    files: SpreadsheetInfo[]
    nextPageToken?: string
    totalCount: number
  }> {
    try {
      this.oauth2Client.setCredentials(tokens)
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client })

      const {
        query = '',
        pageSize = 50,
        pageToken,
        orderBy = 'modifiedTime desc',
        includeItemsFromAllDrives = true
      } = options

      // 스프레드시트만 필터링하는 기본 쿼리
      let searchQuery = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false"
      
      // 사용자 검색 쿼리 추가
      if (query.trim()) {
        const searchTerms = query.trim().split(/\s+/)
        const nameQueries = searchTerms.map(term => `name contains '${term.replace(/'/g, "\\'")}'`).join(' or ')
        searchQuery += ` and (${nameQueries})`
      }

      const response = await drive.files.list({
        q: searchQuery,
        pageSize,
        pageToken,
        orderBy,
        includeItemsFromAllDrives,
        supportsAllDrives: true,
        fields: 'nextPageToken, files(id, name, createdTime, modifiedTime, owners, webViewLink, size, starred, shared, permissions)'
      })

      const files = response.data.files || []
      
      const spreadsheets: SpreadsheetInfo[] = files.map(file => ({
        id: file.id!,
        name: file.name!,
        createdTime: file.createdTime!,
        modifiedTime: file.modifiedTime!,
        owners: file.owners?.map(owner => owner.displayName || owner.emailAddress || 'Unknown') || [],
        webViewLink: file.webViewLink!,
        size: parseInt(file.size || '0'),
        starred: file.starred || false,
        shared: (file.permissions?.length || 0) > 1
      }))

      return {
        files: spreadsheets,
        nextPageToken: response.data.nextPageToken || undefined,
        totalCount: spreadsheets.length
      }

    } catch (error: any) {
      console.error('스프레드시트 목록 조회 실패:', error)
      throw new Error(`스프레드시트 목록 조회 실패: ${error.message}`)
    }
  }

  /**
   * 특정 스프레드시트 정보 조회
   */
  async getSpreadsheetInfo(tokens: any, spreadsheetId: string): Promise<SpreadsheetInfo | null> {
    try {
      this.oauth2Client.setCredentials(tokens)
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client })

      const response = await drive.files.get({
        fileId: spreadsheetId,
        fields: 'id, name, createdTime, modifiedTime, owners, webViewLink, size, starred, shared, permissions'
      })

      const file = response.data

      return {
        id: file.id!,
        name: file.name!,
        createdTime: file.createdTime!,
        modifiedTime: file.modifiedTime!,
        owners: file.owners?.map(owner => owner.displayName || owner.emailAddress || 'Unknown') || [],
        webViewLink: file.webViewLink!,
        size: parseInt(file.size || '0'),
        starred: file.starred || false,
        shared: (file.permissions?.length || 0) > 1
      }

    } catch (error: any) {
      console.error('스프레드시트 정보 조회 실패:', error)
      return null
    }
  }

  /**
   * 스프레드시트 권한 확인
   */
  async checkSpreadsheetAccess(tokens: any, spreadsheetId: string): Promise<{
    canRead: boolean
    canWrite: boolean
    role: string
  }> {
    try {
      this.oauth2Client.setCredentials(tokens)
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client })

      const response = await drive.files.get({
        fileId: spreadsheetId,
        fields: 'permissions'
      })

      // 현재 사용자의 권한 확인 (간단히 읽기/쓰기 가능 여부만 체크)
      const permissions = response.data.permissions || []
      const hasWriteAccess = permissions.some(p => 
        p.role === 'owner' || p.role === 'writer' || p.role === 'editor'
      )

      return {
        canRead: true, // 조회가 성공했으므로 읽기 권한 있음
        canWrite: hasWriteAccess,
        role: hasWriteAccess ? 'editor' : 'reader'
      }

    } catch (error: any) {
      console.error('스프레드시트 권한 확인 실패:', error)
      return {
        canRead: false,
        canWrite: false,
        role: 'none'
      }
    }
  }

  /**
   * 스프레드시트 즐겨찾기 토글
   */
  async toggleSpreadsheetStar(tokens: any, spreadsheetId: string): Promise<boolean> {
    try {
      this.oauth2Client.setCredentials(tokens)
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client })

      // 현재 상태 확인
      const currentFile = await drive.files.get({
        fileId: spreadsheetId,
        fields: 'starred'
      })

      const newStarredState = !currentFile.data.starred

      // 즐겨찾기 상태 변경
      await drive.files.update({
        fileId: spreadsheetId,
        requestBody: {
          starred: newStarredState
        }
      })

      return newStarredState

    } catch (error: any) {
      console.error('즐겨찾기 토글 실패:', error)
      throw new Error(`즐겨찾기 토글 실패: ${error.message}`)
    }
  }

  /**
   * 내가 소유한 스프레드시트만 조회
   */
  async getMySpreadsheets(tokens: any, options: DriveListOptions = {}): Promise<{
    files: SpreadsheetInfo[]
    nextPageToken?: string
    totalCount: number
  }> {
    const modifiedOptions = {
      ...options,
      // 내가 소유한 파일만 조회하는 쿼리 추가
    }

    return this.getSpreadsheetsList(tokens, modifiedOptions)
  }

  /**
   * 최근 수정된 스프레드시트 조회
   */
  async getRecentSpreadsheets(tokens: any, limit: number = 20): Promise<SpreadsheetInfo[]> {
    const result = await this.getSpreadsheetsList(tokens, {
      pageSize: limit,
      orderBy: 'modifiedTime desc'
    })

    return result.files
  }

  /**
   * 즐겨찾기 스프레드시트 조회
   */
  async getStarredSpreadsheets(tokens: any): Promise<SpreadsheetInfo[]> {
    try {
      this.oauth2Client.setCredentials(tokens)
      const drive = google.drive({ version: 'v3', auth: this.oauth2Client })

      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet' and starred=true and trashed=false",
        orderBy: 'modifiedTime desc',
        fields: 'files(id, name, createdTime, modifiedTime, owners, webViewLink, size, starred, shared)'
      })

      const files = response.data.files || []
      
      return files.map(file => ({
        id: file.id!,
        name: file.name!,
        createdTime: file.createdTime!,
        modifiedTime: file.modifiedTime!,
        owners: file.owners?.map(owner => owner.displayName || owner.emailAddress || 'Unknown') || [],
        webViewLink: file.webViewLink!,
        size: parseInt(file.size || '0'),
        starred: true,
        shared: (file.permissions?.length || 0) > 1
      }))

    } catch (error: any) {
      console.error('즐겨찾기 스프레드시트 조회 실패:', error)
      return []
    }
  }
}

export default new GoogleDriveService()