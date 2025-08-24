// Common types for the delivery management system

export interface DeliveryOrder {
  customerName: string;
  phone: string;
  address: string;
  status: DeliveryStatus;
  rowIndex?: number;
}

export type DeliveryStatus = '대기' | '준비중' | '출발' | '완료';

export interface DeliveryStaff {
  name: string;
  sheetName: string;
  qrToken: string;
}

export interface GoogleSheetsConfig {
  spreadsheetId: string;
  accessToken: string;
  refreshToken: string;
}

export interface SolapiConfig {
  accessToken: string;
  refreshToken: string;
  senderId: string;
  templateId?: string;
}

export interface QRTokenPayload {
  staffName: string;
  timestamp: number;
  hash: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}