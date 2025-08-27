import { GoogleAuthService } from './googleAuth';
import { handleGoogleApiError } from '../middleware/auth';
import { logger } from '../utils/logger';
import type { DeliveryOrder, DeliveryStatus } from '../types/index.js';

export class GoogleSheetsService {
  private googleAuth: GoogleAuthService;
  private req: any; // Store request object for error handling

  constructor() {
    this.googleAuth = new GoogleAuthService();
  }

  /**
   * Initialize with tokens and request object
   */
  init(accessToken: string, refreshToken: string, req?: any): void {
    this.googleAuth.setCredentials(accessToken, refreshToken);
    this.req = req;
  }

  /**
   * Get list of available spreadsheets
   */
  async getSpreadsheets(): Promise<Array<{ id: string; name: string; url: string }>> {
    const makeApiCall = async () => {
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
    };

    try {
      return await makeApiCall();
    } catch (error) {
      if (this.req) {
        try {
          return await handleGoogleApiError(error, this.req, makeApiCall);
        } catch (retryError) {
          logger.error('Failed to get spreadsheets after retry:', retryError);
          throw new Error('스프레드시트 목록을 가져오는데 실패했습니다.');
        }
      }
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
        
        // Map actual headers to data - only use sheet headers, no additional fields
        headers.forEach((header, colIndex) => {
          const cellValue = row[colIndex] || '';
          order[header] = cellValue;
        });

        return order as DeliveryOrder;
      }).filter(order => {
        // Filter out empty rows - check if at least one cell has content
        return Object.keys(order).some(key => 
          key !== 'rowIndex' && order[key] && order[key].toString().trim()
        );
      });

      logger.info(`Loaded ${orders.length} orders from sheet ${sheetName} with headers: ${headers.join(', ')}`);
      return orders;
    } catch (error) {
      logger.error('Failed to get delivery orders:', error);
      throw new Error('배달 주문 목록을 가져오는데 실패했습니다.');
    }
  }

  /**
   * Read delivery orders grouped by delivery staff from header columns
   */
  async getDeliveryOrdersByStaff(spreadsheetId: string, sheetName: string): Promise<{ [staffName: string]: DeliveryOrder[] }> {
    try {
      // Get all orders with actual headers
      const allOrders = await this.getDeliveryOrders(spreadsheetId, sheetName);
      
      if (allOrders.length === 0) {
        return {};
      }

      // Get raw sheet data to analyze structure
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

      // Strategy 1: Look for staff names in headers (column-based grouping)
      const staffColumns = new Set<string>();
      headers.forEach(header => {
        if (header && !this.isStandardHeader(header) && this.isLikelyStaffName(header)) {
          staffColumns.add(header);
        }
      });

      // Strategy 2: If no staff columns found, group by data values in delivery staff column
      if (staffColumns.size === 0) {
        // Find the delivery staff column
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
      } else {
        // Use column-based grouping
        staffColumns.forEach(staffName => {
          groupedOrders[staffName] = allOrders.filter(order => {
            // Check if this order belongs to this staff member
            return Object.keys(order).some(key => {
              const value = (order as any)[key];
              return typeof value === 'string' && value.includes(staffName);
            });
          }).map(order => ({
            ...order,
            staffName,
          }));
        });
      }

      // Remove empty groups and duplicates
      Object.keys(groupedOrders).forEach(staffName => {
        if (groupedOrders[staffName].length === 0) {
          delete groupedOrders[staffName];
          return;
        }

        const uniqueOrders = new Map();
        groupedOrders[staffName].forEach(order => {
          const key = `${order.rowIndex}`;
          if (!uniqueOrders.has(key)) {
            uniqueOrders.set(key, order);
          }
        });
        groupedOrders[staffName] = Array.from(uniqueOrders.values());
      });

      logger.info(`Loaded orders for ${Object.keys(groupedOrders).length} groups from sheet ${sheetName}, headers: ${headers.join(', ')}`);
      logger.info(`Grouped orders keys: ${Object.keys(groupedOrders).join(', ')}`);
      Object.keys(groupedOrders).forEach(key => {
        logger.info(`Group "${key}": ${groupedOrders[key].length} orders`);
      });
      return groupedOrders;
    } catch (error) {
      logger.error('Failed to get delivery orders by staff:', error);
      throw new Error('배달담당자별 주문 목록을 가져오는데 실패했습니다.');
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

  /**
   * Check if a name looks like a location/area name
   */
  private isLocationName(name: string): boolean {
    // Location patterns: contains location keywords or ends with common location suffixes
    const locationKeywords = ['시', '구', '동', '면', '읍', '리', '로', '길', '아파트', '단지'];
    const locationPattern = /^[가-힣]{2,10}(시|구|동|면|읍|리|로|길|아파트|단지)$/;
    
    return locationPattern.test(name.trim()) || 
           locationKeywords.some(keyword => name.includes(keyword));
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
      
      // First, get the header row to find the status column
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
        logger.warn(`Status column not found in headers: ${headers.join(', ')}, using default column D`);
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

      logger.info(`Updated status to ${status} for row ${rowIndex} in column ${statusColumn} (${headers[statusColumnIndex]}) in sheet ${sheetName}`);
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

  /**
   * Check if a cell value is a standard header (not a staff name)
   */
  private isStandardHeader(cellValue: string): boolean {
    const standardHeaders = [
      '고객명', '연락처', '주소', '배달상태', '상태',
      'customer', 'phone', 'address', 'status',
      '번호', 'no', '순번', 'index',
      '날짜', 'date', '시간', 'time',
      '배송지', '배송상태', '배송', '배달상태', '배달',
      '담당자', '배달담당자', '배송담당자', '배달 담당자',
      'delivery', 'shipping', 'location'
    ];
    
    // Exact match for problematic headers
    const exactMatches = ['배송지', '배달 담당자', '배송상태'];
    if (exactMatches.includes(cellValue.trim())) {
      return true;
    }
    
    return standardHeaders.some(header => 
      cellValue.toLowerCase().includes(header.toLowerCase())
    );
  }
}