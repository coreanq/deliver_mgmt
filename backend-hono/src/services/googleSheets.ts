import { GoogleAuthService } from './googleAuth';
import type { DeliveryOrder, DeliveryStatus, Env } from '../types';

export class GoogleSheetsService {
  private googleAuth: GoogleAuthService;
  private env: Env;

  constructor(env: Env) {
    this.googleAuth = new GoogleAuthService(env);
    this.env = env;
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

      console.log(`Found ${spreadsheets.length} spreadsheets`);
      return spreadsheets;
    } catch (error: any) {
      console.error('Failed to get spreadsheets:', error);
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

      console.log(`Found ${sheetList.length} sheets in spreadsheet ${spreadsheetId}`);
      return sheetList;
    } catch (error) {
      console.error('Failed to get sheets:', error);
      throw new Error('시트 목록을 가져오는데 실패했습니다.');
    }
  }

  /**
   * Read delivery orders from a specific sheet using actual sheet headers
   */
  async getDeliveryOrders(spreadsheetId: string, sheetName: string): Promise<DeliveryOrder[]> {
    try {
      const sheets = this.googleAuth.getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      const rows = response.data.values || [];
      
      if (rows.length === 0) {
        return [];
      }

      // Use first row as headers
      const headers = rows[0] || [];
      const dataRows = rows.slice(1);
      
      const orders: DeliveryOrder[] = dataRows.map((row, index) => {
        const order: any = {
          rowIndex: index + 2, // +2 because we start from row 2 (after header)
        };
        
        // Map actual headers to data
        headers.forEach((header, colIndex) => {
          const cellValue = row[colIndex] || '';
          order[header] = cellValue;
        });

        return order as DeliveryOrder;
      }).filter(order => {
        // Filter out empty rows
        return Object.keys(order).some(key => 
          key !== 'rowIndex' && order[key] && order[key].toString().trim()
        );
      });

      console.log(`Loaded ${orders.length} orders from sheet ${sheetName} with headers: ${headers.join(', ')}`);
      return orders;
    } catch (error) {
      console.error('Failed to get delivery orders:', error);
      throw new Error('배달 주문 목록을 가져오는데 실패했습니다.');
    }
  }

  /**
   * Read delivery orders grouped by delivery staff
   */
  async getDeliveryOrdersByStaff(spreadsheetId: string, sheetName: string): Promise<{ [staffName: string]: DeliveryOrder[] }> {
    try {
      const allOrders = await this.getDeliveryOrders(spreadsheetId, sheetName);
      
      if (allOrders.length === 0) {
        return {};
      }

      const sheets = this.googleAuth.getSheetsClient();
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!A:Z`,
      });

      const rows = response.data.values || [];
      if (rows.length === 0) {
        return {};
      }

      const headers = rows[0] || [];
      const groupedOrders: { [staffName: string]: DeliveryOrder[] } = {};

      // Look for delivery staff column
      const staffColumnNames = ['배달 담당자', '담당자', '배달담당자', '배송담당자'];
      let staffColumnName = '';
      
      for (const colName of staffColumnNames) {
        if (headers.includes(colName)) {
          staffColumnName = colName;
          break;
        }
      }
      
      if (staffColumnName) {
        // Group by actual staff names from the staff column
        allOrders.forEach(order => {
          const staffName = (order as any)[staffColumnName];
          if (staffName && typeof staffName === 'string' && staffName.trim()) {
            const groupKey = staffName.trim();
            
            if (!groupedOrders[groupKey]) {
              groupedOrders[groupKey] = [];
            }
            
            groupedOrders[groupKey].push({
              ...order,
              staffName: groupKey,
            });
          }
        });
      } else {
        // Fallback: group by any Korean name found in data
        allOrders.forEach(order => {
          let groupKey = '미분류';
          
          Object.keys(order).forEach(key => {
            const value = (order as any)[key];
            if (typeof value === 'string' && value.trim() && this.isLikelyStaffName(value)) {
              groupKey = value.trim();
            }
          });

          if (!groupedOrders[groupKey]) {
            groupedOrders[groupKey] = [];
          }
          
          groupedOrders[groupKey].push({
            ...order,
            staffName: groupKey,
          });
        });
      }

      // Remove empty groups
      Object.keys(groupedOrders).forEach(staffName => {
        if (groupedOrders[staffName].length === 0) {
          delete groupedOrders[staffName];
        }
      });

      console.log(`Loaded orders for ${Object.keys(groupedOrders).length} groups from sheet ${sheetName}`);
      return groupedOrders;
    } catch (error) {
      console.error('Failed to get delivery orders by staff:', error);
      throw new Error('배달담당자별 주문 목록을 가져오는데 실패했습니다.');
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
      
      // Get the header row to find the status column
      const headerResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${sheetName}!1:1`,
      });

      const headers = headerResponse.data.values?.[0] || [];
      
      // Find the status column index
      let statusColumnIndex = -1;
      const statusColumnNames = ['배송상태', '배달상태', '상태', '배송 상태', '배달 상태'];
      
      for (let i = 0; i < headers.length; i++) {
        const header = headers[i];
        if (statusColumnNames.some(statusName => 
          header && header.toString().toLowerCase().includes(statusName.toLowerCase())
        )) {
          statusColumnIndex = i;
          break;
        }
      }

      if (statusColumnIndex === -1) {
        // Fallback to column D (index 3) if status column not found
        statusColumnIndex = 3;
        console.warn(`Status column not found in headers: ${headers.join(', ')}, using default column D`);
      }

      // Convert column index to letter (A=0, B=1, C=2, D=3, etc.)
      const statusColumn = String.fromCharCode(65 + statusColumnIndex);
      const range = `${sheetName}!${statusColumn}${rowIndex}`;

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[status]],
        },
      });

      console.log(`Updated status to ${status} for row ${rowIndex} in column ${statusColumn} in sheet ${sheetName}`);
    } catch (error) {
      console.error('Failed to update delivery status:', error);
      throw new Error('배달 상태 업데이트에 실패했습니다.');
    }
  }

  /**
   * Check if a name looks like a Korean staff name
   */
  private isLikelyStaffName(name: string): boolean {
    // Korean name pattern: typically 2-4 characters, contains Korean characters
    const koreanNamePattern = /^[가-힣]{2,4}$/;
    return koreanNamePattern.test(name.trim());
  }
}