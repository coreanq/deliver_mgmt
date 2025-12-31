// 사용자 역할 타입
export type UserRole = 'admin' | 'staff';

// 배송 상태 타입
export type DeliveryStatus = 'pending' | 'in_transit' | 'completed';

// 관리자 정보
export interface Admin {
  id: string;
  email: string;
  createdAt: string;
}

// 배송담당자 정보
export interface Staff {
  id: string;
  name: string;
  adminId: string;
  createdAt: string;
}

// 배송 정보
export interface Delivery {
  id: string;
  adminId: string;
  staffName: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  productName: string;
  quantity: number;
  memo: string | null;
  status: DeliveryStatus;
  deliveryDate: string;
  completedAt: string | null;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

// 배송 목록 응답
export interface DeliveryListResponse {
  deliveries: Delivery[];
  total: number;
}

// Magic Link 요청
export interface MagicLinkRequest {
  email: string;
}

// Magic Link 검증 응답
export interface MagicLinkVerifyResponse {
  token: string;
  admin: Admin;
}

// QR 토큰 생성 요청
export interface QRGenerateRequest {
  staffName: string;
  expiresIn?: number; // 초 단위, 기본 24시간
}

// QR 토큰 생성 응답
export interface QRGenerateResponse {
  qrData: string;
  expiresAt: string;
}

// QR 토큰 검증 응답
export interface QRVerifyResponse {
  token: string;
  staff: Staff;
}

// 배송 상태 변경 요청
export interface DeliveryStatusRequest {
  status: DeliveryStatus;
}

// 배송 완료 요청
export interface DeliveryCompleteRequest {
  photoBase64: string;
}

// 엑셀 업로드 파싱 결과
export interface ExcelParseResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
}

// AI 매핑 제안
export interface MappingSuggestion {
  sourceColumn: string;
  targetField: string;
  confidence: number;
}

// 필드 매핑
export interface FieldMapping {
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  productName: string;
  quantity?: string;
  memo?: string;
  staffName?: string;
  deliveryDate?: string;
}

// 구독 상태
export type SubscriptionType = 'free' | 'basic' | 'pro';

export interface SubscriptionStatus {
  type: SubscriptionType;
  retentionDays: number;
  expiresAt: string | null;
}

// API 응답 공통 타입
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// 광고 설정
export interface AdConfig {
  bannerId: string;
  rewardedId: string;
  isTest: boolean;
}
