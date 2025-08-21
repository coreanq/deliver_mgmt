import { google } from 'googleapis'
import TokenService from './TokenService'

export interface DeliveryData {
  customerName: string
  phoneNumber: string
  address: string
  status: '대기' | '준비중' | '출발' | '완료'
}

export interface SheetRow {
  rowIndex: number
  customerName: string
  phoneNumber: string
  address: string
  status: string
}

export class GoogleSheetsService {
  private sheets: any

  constructor() {
    this.sheets = google.sheets({ version: 'v4' })
  }

  /**
   * 스프레드시트 목록 조회
   */
  async listSpreadsheets(tokens: any): Promise<any[]> {
    try {
      const { client } = await TokenService.getAuthenticatedClient(tokens)
      const drive = google.drive({ version: 'v3', auth: client })

      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: 'files(id, name, createdTime, modifiedTime)',
        orderBy: 'modifiedTime desc',
        pageSize: 50
      })

      return response.data.files || []
    } catch (error) {
      console.error('스프레드시트 목록 조회 실패:', error)
      throw new Error('스프레드시트 목록을 가져올 수 없습니다.')
    }
  }

  /**
   * 스프레드시트 정보 조회
   */
  async getSpreadsheetInfo(tokens: any, spreadsheetId: string): Promise<any> {
    try {
      const { client } = await TokenService.getAuthenticatedClient(tokens)
      
      const response = await this.sheets.spreadsheets.get({
        auth: client,
        spreadsheetId,
        fields: 'properties,sheets(properties)'
      })

      return response.data
    } catch (error) {
      console.error('스프레드시트 정보 조회 실패:', error)
      throw new Error('스프레드시트 정보를 가져올 수 없습니다.')
    }
  }

  /**
   * 배달담당자별 시트 생성
   */
  async createDeliveryStaffSheet(tokens: any, spreadsheetId: string, staffName: string): Promise<boolean> {
    try {
      const { client } = await TokenService.getAuthenticatedClient(tokens)

      // 시트가 이미 존재하는지 확인
      const spreadsheetInfo = await this.getSpreadsheetInfo(tokens, spreadsheetId)
      const existingSheet = spreadsheetInfo.sheets?.find((sheet: any) => 
        sheet.properties.title === staffName
      )

      if (existingSheet) {
        console.log(`시트 '${staffName}'이 이미 존재합니다.`)
        return true
      }

      // 새 시트 생성
      await this.sheets.spreadsheets.batchUpdate({
        auth: client,
        spreadsheetId,
        resource: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: staffName,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 4
                  }
                }
              }
            }
          ]
        }
      })

      // 헤더 설정
      await this.sheets.spreadsheets.values.update({
        auth: client,
        spreadsheetId,
        range: `${staffName}!A1:D1`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [['고객명', '연락처', '주소', '배달상태']]
        }
      })

      console.log(`시트 '${staffName}'이 성공적으로 생성되었습니다.`)
      return true
    } catch (error) {
      console.error(`시트 '${staffName}' 생성 실패:`, error)
      throw new Error(`배달담당자 시트 생성에 실패했습니다: ${staffName}`)
    }
  }

  /**
   * 시트의 배달 데이터 조회
   */
  async getDeliveryData(tokens: any, spreadsheetId: string, sheetName: string): Promise<SheetRow[]> {
    try {
      const { client } = await TokenService.getAuthenticatedClient(tokens)

      const response = await this.sheets.spreadsheets.values.get({
        auth: client,
        spreadsheetId,
        range: `${sheetName}!A2:D1000`, // 헤더 제외하고 데이터만
        valueInputOption: 'FORMATTED_VALUE'
      })

      const rows = response.data.values || []
      const deliveryData: SheetRow[] = []

      rows.forEach((row: any[], index: number) => {
        if (row.length >= 3 && row[0] && row[0].trim()) { // 고객명이 있는 행만
          deliveryData.push({
            rowIndex: index + 2, // 실제 시트의 행 번호 (헤더 고려)
            customerName: row[0] || '',
            phoneNumber: row[1] || '',
            address: row[2] || '',
            status: row[3] || '대기'
          })
        }
      })

      return deliveryData
    } catch (error) {
      console.error(`시트 '${sheetName}' 데이터 조회 실패:`, error)
      throw new Error(`배달 데이터를 가져올 수 없습니다: ${sheetName}`)
    }
  }

  /**
   * 배달 상태 업데이트
   */
  async updateDeliveryStatus(
    tokens: any, 
    spreadsheetId: string, 
    sheetName: string, 
    rowIndex: number, 
    status: string
  ): Promise<boolean> {
    try {
      const { client } = await TokenService.getAuthenticatedClient(tokens)

      await this.sheets.spreadsheets.values.update({
        auth: client,
        spreadsheetId,
        range: `${sheetName}!D${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[status]]
        }
      })

      console.log(`시트 '${sheetName}'의 ${rowIndex}행 상태를 '${status}'로 업데이트했습니다.`)
      return true
    } catch (error) {
      console.error(`상태 업데이트 실패:`, error)
      throw new Error(`배달 상태 업데이트에 실패했습니다.`)
    }
  }

  /**
   * 새로운 배달 주문 추가
   */
  async addDeliveryOrder(
    tokens: any, 
    spreadsheetId: string, 
    sheetName: string, 
    deliveryData: DeliveryData
  ): Promise<boolean> {
    try {
      const { client } = await TokenService.getAuthenticatedClient(tokens)

      // 다음 빈 행 찾기
      const existingData = await this.getDeliveryData(tokens, spreadsheetId, sheetName)
      const nextRow = existingData.length + 2 // 헤더 다음부터

      await this.sheets.spreadsheets.values.update({
        auth: client,
        spreadsheetId,
        range: `${sheetName}!A${nextRow}:D${nextRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[
            deliveryData.customerName,
            deliveryData.phoneNumber,
            deliveryData.address,
            deliveryData.status
          ]]
        }
      })

      console.log(`시트 '${sheetName}'에 새 주문이 추가되었습니다: ${deliveryData.customerName}`)
      return true
    } catch (error) {
      console.error(`주문 추가 실패:`, error)
      throw new Error(`새 주문 추가에 실패했습니다.`)
    }
  }

  /**
   * 시트의 모든 배달담당자 목록 조회
   */
  async getDeliveryStaffList(tokens: any, spreadsheetId: string): Promise<string[]> {
    try {
      const spreadsheetInfo = await this.getSpreadsheetInfo(tokens, spreadsheetId)
      const staffList: string[] = []

      spreadsheetInfo.sheets?.forEach((sheet: any) => {
        const sheetName = sheet.properties.title
        // 기본 시트('Sheet1' 등)가 아닌 경우만 배달담당자로 간주
        if (sheetName && !sheetName.match(/^(Sheet\d+|시트\d+)$/)) {
          staffList.push(sheetName)
        }
      })

      return staffList
    } catch (error) {
      console.error('배달담당자 목록 조회 실패:', error)
      throw new Error('배달담당자 목록을 가져올 수 없습니다.')
    }
  }
}

export default new GoogleSheetsService()