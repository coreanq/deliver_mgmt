import { GoogleAuthService } from './googleAuth';
import { logger } from '../utils/logger';
import type { DeliveryOrder, DeliveryStatus } from '../types/index.js';

export class GoogleSheetsService {
  private googleAuth: GoogleAuthService;

  constructor() {
    this.googleAuth = new GoogleAuthService();
  }

  /**
   * Initialize with tokens
   */
  init(accessToken: string, refreshToken: string): void {
    this.googleAuth.setCredentials(accessToken, refreshToken);
  }

  /**
   * Get list of available spreadsheets
   */
  async getSpreadsheets(): Promise<Array<{ id: string; name: string; url: string }>> {
    try {
      const drive = this.googleAuth.getDriveClient();
      const response = await drive.files.list({
        q: "mimeType='application/vnd.google-apps.spreadsheet'",
        fields: 'files(id, name, webViewLink)',
        pageSize: 50,
      });

      const spreadsheets = response.data.files?.map(file => ({
        id: file.id!,
        name: file.name!,
        url: file.webViewLink!,
      })) || [];

      logger.info(`Found ${spreadsheets.length} spreadsheets`);
      return spreadsheets;
    } catch (error) {
      logger.error('Failed to get spreadsheets:', error);
      throw new Error('스프레드시트 목록을 가져오는데 실패했습니다.');
    }
  }

  /**
   * Get sheets within a spreadsheet
   */
  async getSheets(spreadsheetId: string): Promise<Array<{ sheetId: number; title: string }>> {
    try {
      const sheets = this.googleAuth.getSheetsClient();
      const response = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: 'sheets.properties(sheetId,title,gridProperties)',
      });

      const sheetList = response.data.sheets?.map(sheet => ({
        sheetId: sheet.properties!.sheetId!,
        title: sheet.properties!.title!,
      })) || [];

      logger.info(`Found ${sheetList.length} sheets in spreadsheet ${spreadsheetId}`);
      return sheetList;
    } catch (error) {
      logger.error('Failed to get sheets:', error);
      throw new Error('시트 목록을 가져오는데 실패했습니다.');
    }
  }

  /**
   * Read delivery orders from a specific sheet
   */
  async getDeliveryOrders(spreadsheetId: string, sheetName: string): Promise<DeliveryOrder[]> {
    try {
      const sheets = this.googleAuth.getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:D`,
      });

      const rows = response.data.values || [];
      
      // Skip header row if exists
      const dataRows = rows.length > 0 && this.isHeaderRow(rows[0]) ? rows.slice(1) : rows;
      
      const orders: DeliveryOrder[] = dataRows.map((row, index) => ({
        customerName: row[0] || '',
        phone: row[1] || '',
        address: row[2] || '',
        status: (row[3] as DeliveryStatus) || '대기',
        rowIndex: index + (rows.length > dataRows.length ? 2 : 1), // Account for header
      }));

      logger.info(`Loaded ${orders.length} orders from sheet ${sheetName}`);
      return orders;
    } catch (error) {
      logger.error('Failed to get delivery orders:', error);
      throw new Error('배달 주문 목록을 가져오는데 실패했습니다.');
    }
  }

  /**
   * Update delivery status in spreadsheet
   */
  async updateDeliveryStatus(
    spreadsheetId: string,
    sheetName: string,
    rowIndex: number,
    status: DeliveryStatus
  ): Promise<void> {
    try {
      const sheets = this.googleAuth.getSheetsClient();
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!D${rowIndex}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[status]],
        },
      });

      logger.info(`Updated status to ${status} for row ${rowIndex} in sheet ${sheetName}`);
    } catch (error) {
      logger.error('Failed to update delivery status:', error);
      throw new Error('배달 상태 업데이트에 실패했습니다.');
    }
  }

  /**
   * Create a new sheet for delivery staff
   */
  async createStaffSheet(spreadsheetId: string, staffName: string): Promise<void> {
    try {
      const sheets = this.googleAuth.getSheetsClient();
      
      // Create new sheet
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: staffName,
                  gridProperties: {
                    rowCount: 1000,
                    columnCount: 4,
                  },
                },
              },
            },
          ],
        },
      });

      // Add header row
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${staffName}!A1:D1`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [['고객명', '연락처', '주소', '배달상태']],
        },
      });

      logger.info(`Created new sheet for staff: ${staffName}`);
    } catch (error) {
      logger.error('Failed to create staff sheet:', error);
      throw new Error('배달담당자 시트 생성에 실패했습니다.');
    }
  }

  /**
   * Check if row is a header row
   */
  private isHeaderRow(row: string[]): boolean {
    const headerKeywords = ['고객명', '연락처', '주소', '배달상태', 'customer', 'phone', 'address', 'status'];
    return row.some(cell => 
      headerKeywords.some(keyword => 
        cell.toLowerCase().includes(keyword.toLowerCase())
      )
    );
  }
}