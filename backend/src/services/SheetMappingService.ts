import fs from 'fs/promises'
import path from 'path'

export interface SheetMapping {
  date: string
  spreadsheetId: string
  title: string
  status: 'connected' | 'error' | 'pending'
  connectedAt: string
  lastAccessedAt?: string
}


export class SheetMappingService {
  private mappingFilePath: string

  constructor() {
    this.mappingFilePath = path.join(process.cwd(), 'data', 'sheet-mapping.json')
    this.ensureDataDirectory()
  }

  /**
   * 데이터 디렉토리 생성
   */
  private async ensureDataDirectory() {
    try {
      const dataDir = path.join(process.cwd(), 'data')
      await fs.mkdir(dataDir, { recursive: true })
    } catch (error) {
      // 디렉토리가 이미 존재하면 무시
    }
  }

  /**
   * 날짜별 스프레드시트 매핑 조회
   */
  async getSheetMapping(date: string): Promise<string | null> {
    try {
      const data = await this.loadMappingData()
      const mapping = data.find(m => m.date === date && m.status === 'connected')
      return mapping?.spreadsheetId || null
    } catch (error) {
      console.error('시트 매핑 조회 실패:', error)
      return null
    }
  }

  /**
   * 날짜별 스프레드시트 매핑 추가/업데이트
   */
  async setSheetMapping(mapping: Omit<SheetMapping, 'connectedAt'>): Promise<boolean> {
    try {
      const data = await this.loadMappingData()
      const existingIndex = data.findIndex(m => m.date === mapping.date)

      const newMapping: SheetMapping = {
        ...mapping,
        connectedAt: new Date().toISOString()
      }

      if (existingIndex >= 0) {
        data[existingIndex] = newMapping
      } else {
        data.push(newMapping)
      }

      await this.saveMappingData(data)
      return true
    } catch (error) {
      console.error('시트 매핑 저장 실패:', error)
      return false
    }
  }

  /**
   * 모든 시트 매핑 조회
   */
  async getAllSheetMappings(): Promise<SheetMapping[]> {
    try {
      return await this.loadMappingData()
    } catch (error) {
      console.error('모든 시트 매핑 조회 실패:', error)
      return []
    }
  }

  /**
   * 시트 매핑 삭제
   */
  async removeSheetMapping(date: string): Promise<boolean> {
    try {
      const data = await this.loadMappingData()
      const filteredData = data.filter(m => m.date !== date)
      await this.saveMappingData(filteredData)
      return true
    } catch (error) {
      console.error('시트 매핑 삭제 실패:', error)
      return false
    }
  }


  /**
   * 시트 매핑 데이터 로드
   */
  private async loadMappingData(): Promise<SheetMapping[]> {
    try {
      const content = await fs.readFile(this.mappingFilePath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      // 파일이 없으면 빈 배열 반환
      return []
    }
  }

  /**
   * 시트 매핑 데이터 저장
   */
  private async saveMappingData(data: SheetMapping[]): Promise<void> {
    await fs.writeFile(this.mappingFilePath, JSON.stringify(data, null, 2), 'utf8')
  }


  /**
   * 마지막 접근 시간 업데이트
   */
  async updateLastAccessed(date: string): Promise<void> {
    try {
      const data = await this.loadMappingData()
      const mapping = data.find(m => m.date === date)
      
      if (mapping) {
        mapping.lastAccessedAt = new Date().toISOString()
        await this.saveMappingData(data)
      }
    } catch (error) {
      console.error('마지막 접근 시간 업데이트 실패:', error)
    }
  }
}

export default new SheetMappingService()