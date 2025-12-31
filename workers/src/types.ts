// Cloudflare Workers 환경 타입
export interface Env {
  // D1 Database
  DB: D1Database;
  // R2 Storage
  STORAGE: R2Bucket;
  // KV Namespace
  KV_DELIVER_MGMT: KVNamespace;
  // 환경 변수
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  JWT_SECRET: string;
  AI_GATEWAY_TOKEN: string;
  BUILD_DATE: string;
}

// JWT 페이로드 타입
export interface JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  role: 'admin' | 'staff';
  adminId?: string;
  exp: number;
  iat: number;
}

// 사용자 역할 타입
export type UserRole = 'admin' | 'staff';

// 배송 상태 타입
export type DeliveryStatus = 'pending' | 'in_transit' | 'completed';

// 관리자 정보
export interface Admin {
  id: string;
  email: string;
  created_at: string;
  updated_at: string;
}

// 배송담당자 정보
export interface Staff {
  id: string;
  admin_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

// 배송 정보
export interface Delivery {
  id: string;
  admin_id: string;
  staff_name: string | null;
  recipient_name: string;
  recipient_phone: string;
  recipient_address: string;
  product_name: string;
  quantity: number;
  memo: string | null;
  status: DeliveryStatus;
  delivery_date: string;
  completed_at: string | null;
  photo_url: string | null;
  created_at: string;
  updated_at: string;
}

// 구독 정보
export interface Subscription {
  id: string;
  admin_id: string;
  type: 'free' | 'basic' | 'pro';
  retention_days: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

// Magic Link 토큰
export interface MagicLinkToken {
  id: string;
  email: string;
  token: string;
  expires_at: string;
  used: number;
  created_at: string;
}

// 매핑 패턴
export interface MappingPattern {
  id: string;
  admin_id: string;
  source_headers: string;
  field_mapping: string;
  use_count: number;
  created_at: string;
  updated_at: string;
}

// API 응답 타입
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// 필드 매핑 타입
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
