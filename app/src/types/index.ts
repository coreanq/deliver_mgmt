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

// SMS 메시지 템플릿 타입
export type SmsTemplateType = 'delivery_complete' | 'delivery_start' | 'delivery_delay';

/**
 * SMS 템플릿 파라미터
 *
 * 사용 가능한 변수:
 * - {recipientName}  : 수령인 이름 (필수)
 * - {productName}    : 상품명
 * - {staffName}      : 배송담당자 이름
 * - {estimatedTime}  : 예상 도착 시간 (예: "오후 3시경")
 * - {delayReason}    : 지연 사유 (예: "교통 상황으로 인해")
 */
export interface SmsTemplateParams {
  recipientName: string;
  productName?: string;
  staffName?: string;
  estimatedTime?: string;
  delayReason?: string;
}

/**
 * SMS 메시지 템플릿
 *
 * 템플릿 수정 시 아래 파라미터들을 활용할 수 있습니다:
 * - params.recipientName  : 수령인 이름
 * - params.productName    : 상품명
 * - params.staffName      : 배송담당자 이름
 * - params.estimatedTime  : 예상 도착 시간
 * - params.delayReason    : 지연 사유
 */
export const SMS_TEMPLATES: Record<SmsTemplateType, (params: SmsTemplateParams) => string> = {
  /**
   * 배송 완료 템플릿
   * 사용 파라미터: recipientName, productName(선택), staffName(선택)
   * 예시: "[배송완료] 홍길동님, 봄날반찬 배송이 완료되었습니다. 감사합니다."
   */
  delivery_complete: (params) =>
    `[배송완료] ${params.recipientName}님, ${params.productName ? `${params.productName} ` : ''}배송이 완료되었습니다. 감사합니다.`,

  /**
   * 배송 출발 템플릿
   * 사용 파라미터: recipientName, productName(선택), estimatedTime(선택)
   * 예시: "[배송출발] 홍길동님, 주문하신 상품이 배송 출발했습니다. 곧 도착 예정입니다."
   */
  delivery_start: (params) =>
    `[배송출발] ${params.recipientName}님, 주문하신 상품이 배송 출발했습니다. 곧 도착 예정입니다.`,

  /**
   * 배송 지연 템플릿
   * 사용 파라미터: recipientName, delayReason(선택)
   * 예시: "[배송안내] 홍길동님, 배송이 지연되고 있습니다. 교통 상황으로 인해 양해 부탁드립니다."
   */
  delivery_delay: (params) =>
    `[배송안내] ${params.recipientName}님, 배송이 지연되고 있습니다. ${params.delayReason || '빠른 시일 내 배송하겠습니다.'} 양해 부탁드립니다.`,
};

// SMS 메시지 생성 헬퍼 함수
export const createSmsMessage = (
  type: SmsTemplateType,
  params: SmsTemplateParams
): string => {
  return SMS_TEMPLATES[type](params);
};
