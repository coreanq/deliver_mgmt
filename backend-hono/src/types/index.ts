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
  accessToken?: string;
  refreshToken?: string;
  connectedAt?: string;
  expiryDate?: number;
  email?: string; // Google 계정 이메일
  solapiTokens?: {
    accessToken: string;
    refreshToken: string;
    connectedAt: string;
    expiryDate: number;
  };
}

// 통합 사용자 데이터 구조 (해시 기반 보안 키 사용)
export interface UnifiedUserData {
  email: string;
  emailHash: string; // 보안을 위한 이메일 해시값
  googleTokens: GoogleTokens;
  solapiTokens?: {
    accessToken: string;
    refreshToken: string;
    connectedAt: string;
    expiryDate: number;
  };
  automationRules: AutomationRule[];
  lastLoginAt: string;
  createdAt: string;
  updatedAt: string;
}

// Google 계정 기반 사용자 프로필 (하위 호환성)
export interface UserProfile {
  email: string;
  googleTokens: GoogleTokens;
  solapiTokens?: {
    accessToken: string;
    refreshToken: string;
    connectedAt: string;
    expiryDate: number;
  };
  lastLoginAt: string;
  createdAt: string;
}

// 사용자별 세션 관리
export interface UserSession {
  email: string;
  sessionId: string;
  createdAt: string;
  lastAccessAt: string;
  userAgent?: string;
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

// Automation Types
export interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  spreadsheetId?: string; // 특정 스프레드시트만 대상 (사용자별 구분)
  targetDate?: string; // 특정 날짜 시트만 대상 (YYYYMMDD 형식, 예: "20250825")
  userEmail?: string; // 규칙을 생성한 Google 계정 이메일
  conditions: {
    columnName: string; // 감시할 컬럼명
    triggerValue: string; // 트리거 값 (예: "결제 완료")
    operator: 'equals' | 'contains' | 'changes_to';
  };
  actions: {
    type: 'sms' | 'kakao';
    senderNumber: string;
    recipientColumn: string; // 수신자 전화번호 컬럼
    messageTemplate: string; // 메시지 템플릿 with 변수
  };
  createdAt: string;
  updatedAt: string;
}

export interface AutomationTriggerEvent {
  ruleId: string;
  sheetName: string;
  rowIndex: number;
  columnName: string;
  oldValue: string;
  newValue: string;
  rowData: { [key: string]: any };
  timestamp: string;
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
  EMAIL_HASH_SALT: string; // 이메일 해시화를 위한 SALT
  JWT_SECRET: string; // QR 토큰 서명을 위한 시크릿
  NODE_ENV?: string;
}

// Context variables for Hono
export interface Variables {
  sessionData: GoogleTokens;
  sessionId: string;
}