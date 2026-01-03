export type UserRole = 'admin' | 'staff';

export type DeliveryStatus = 'pending' | 'in_transit' | 'completed';

export interface Admin {
  id: string;
  email: string;
  createdAt: string;
}

export interface Staff {
  id: string;
  name: string;
  adminId: string;
}

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

export interface Subscription {
  id: string;
  adminId: string;
  type: 'free' | 'basic' | 'pro';
  retentionDays: number;
  expiresAt: string | null;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  needsConfirmation?: boolean;
  existingCount?: number;
}

export interface MagicLinkResponse {
  token?: string;
  admin?: Admin;
  message?: string;
}

export interface QRGenerateResponse {
  token: string;
  expiresAt: string;
}

export interface StaffLoginResponse {
  token: string;
  staff: Staff;
}

export interface DeliveryListResponse {
  deliveries: Delivery[];
  total: number;
}

export type DateString = string;

export type Theme = 'light' | 'dark' | 'system';

export type AuthState = 
  | 'idle'
  | 'loading'
  | 'authenticated'
  | 'unauthenticated'
  | 'error';

export interface QRScanData {
  token: string;
  date: string;
}

export interface CompleteDeliveryRequest {
  photoBase64: string;
}
