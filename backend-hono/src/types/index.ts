// Common types for the delivery management system

export interface DeliveryOrder {
  rowIndex?: number;
  staffName?: string;
  [key: string]: any; // Allow dynamic properties from sheet headers
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

export interface GoogleTokens {
  accessToken: string;
  refreshToken: string;
  connectedAt?: string;
  expiryDate?: number;
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

// Cloudflare Workers environment bindings
export interface Env {
  SESSIONS: KVNamespace;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GOOGLE_REDIRECT_URL: string;
  SOLAPI_CLIENT_ID: string;
  SOLAPI_CLIENT_SECRET: string;
  SOLAPI_REDIRECT_URL: string;
  FRONTEND_URL: string;
  NODE_ENV?: string;
}

// Context variables for Hono
export interface Variables {
  sessionData: GoogleTokens;
  sessionId: string;
}