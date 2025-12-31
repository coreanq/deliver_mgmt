import { API_BASE_URL } from '@/constants';
import type {
  ApiResponse,
  Delivery,
  DeliveryListResponse,
  MagicLinkRequest,
  MagicLinkVerifyResponse,
  QRGenerateRequest,
  QRGenerateResponse,
  QRVerifyResponse,
  DeliveryStatusRequest,
  DeliveryCompleteRequest,
  SubscriptionStatus,
} from '@/types';

class ApiService {
  private baseUrl: string;
  private token: string | null = null;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  setToken(token: string | null) {
    this.token = token;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...(this.token && { Authorization: `Bearer ${this.token}` }),
      ...options.headers,
    };

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'API 요청에 실패했습니다.',
        };
      }

      // API 응답이 이미 {success, data} 형식이면 그대로 반환
      if (data && typeof data === 'object' && 'success' in data) {
        return data as ApiResponse<T>;
      }

      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '네트워크 오류가 발생했습니다.',
      };
    }
  }

  // 인증 API

  async sendMagicLink(email: string): Promise<ApiResponse<{ message: string }>> {
    return this.request('/api/auth/magic-link/send', {
      method: 'POST',
      body: JSON.stringify({ email } as MagicLinkRequest),
    });
  }

  async verifyMagicLink(token: string): Promise<ApiResponse<MagicLinkVerifyResponse>> {
    return this.request('/api/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });
  }

  // QR 토큰 생성 (관리자용)
  async generateQRToken(date: string): Promise<ApiResponse<{ token: string; expiresAt: string }>> {
    return this.request('/api/auth/qr/generate', {
      method: 'POST',
      body: JSON.stringify({ date }),
    });
  }

  // 배송담당자 로그인 (QR 토큰 + 이름)
  async staffLogin(
    token: string,
    name: string
  ): Promise<ApiResponse<{ token: string; staff: { id: string; name: string; adminId: string } }>> {
    return this.request('/api/auth/staff/login', {
      method: 'POST',
      body: JSON.stringify({ token, name }),
    });
  }

  // 배송 API

  async getDeliveryList(
    date?: string,
    staffName?: string
  ): Promise<ApiResponse<DeliveryListResponse>> {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (staffName) params.append('staffName', staffName);

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.request(`/api/delivery/list${query}`);
  }

  async getStaffList(): Promise<ApiResponse<{ staff: string[] }>> {
    return this.request('/api/delivery/staff-list');
  }

  async getStaffDeliveries(name: string): Promise<ApiResponse<DeliveryListResponse>> {
    return this.request(`/api/delivery/staff/${encodeURIComponent(name)}`);
  }

  async updateDeliveryStatus(
    id: string,
    status: DeliveryStatusRequest['status']
  ): Promise<ApiResponse<Delivery>> {
    return this.request(`/api/delivery/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status } as DeliveryStatusRequest),
    });
  }

  async completeDelivery(
    id: string,
    photoBase64: string
  ): Promise<ApiResponse<Delivery>> {
    return this.request(`/api/delivery/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ photoBase64 } as DeliveryCompleteRequest),
    });
  }

  // 구독 API

  async getSubscriptionStatus(): Promise<ApiResponse<SubscriptionStatus>> {
    return this.request('/api/subscription/status');
  }
}

export const api = new ApiService();
