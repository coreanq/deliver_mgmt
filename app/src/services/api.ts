import Constants from 'expo-constants';
import type {
  ApiResponse,
  MagicLinkResponse,
  QRGenerateResponse,
  StaffLoginResponse,
  DeliveryListResponse,
  Delivery,
} from '../types';

export const WEB_URL = 'https://delivermgmt.try-dabble.com';

const getApiBase = (): string => {
  const extra = Constants.expoConfig?.extra;
  if (extra?.apiUrl) {
    return extra.apiUrl;
  }

  if (__DEV__) {
    return 'http://localhost:8787';
  }

  return WEB_URL;
};

const API_BASE = getApiBase();

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const url = `${API_BASE}${endpoint}`;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json();
    return data as ApiResponse<T>;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

function withAuth(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
  };
}

export const authApi = {
  sendMagicLink: (email: string) =>
    request<MagicLinkResponse>('/api/auth/magic-link/send', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  verifyMagicLink: (token: string) =>
    request<MagicLinkResponse>('/api/auth/magic-link/verify', {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),

  generateQR: (token: string, date: string, expiresIn = 86400) =>
    request<QRGenerateResponse>('/api/auth/qr/generate', {
      method: 'POST',
      headers: withAuth(token),
      body: JSON.stringify({ date, expiresIn }),
    }),

  staffLogin: (qrToken: string, name: string) =>
    request<StaffLoginResponse>('/api/auth/staff/login', {
      method: 'POST',
      body: JSON.stringify({ token: qrToken, name }),
    }),

  deleteAccount: (token: string) =>
    request<{ message: string }>('/api/auth/account', {
      method: 'DELETE',
      headers: withAuth(token),
    }),
};

export const deliveryApi = {
  getList: (token: string, date: string, staffName?: string) => {
    const params = new URLSearchParams({ date });
    if (staffName) params.append('staffName', staffName);

    return request<DeliveryListResponse>(`/api/delivery/list?${params}`, {
      headers: withAuth(token),
    });
  },

  getStaffList: (token: string) =>
    request<{ staff: string[] }>('/api/delivery/staff-list', {
      headers: withAuth(token),
    }),

  getStaffDeliveries: (token: string, name: string) =>
    request<DeliveryListResponse>(`/api/delivery/staff/${encodeURIComponent(name)}`, {
      headers: withAuth(token),
    }),

  updateStatus: (token: string, deliveryId: string, status: string) =>
    request<Delivery>(`/api/delivery/${deliveryId}/status`, {
      method: 'PUT',
      headers: withAuth(token),
      body: JSON.stringify({ status }),
    }),

  complete: (token: string, deliveryId: string, photoBase64: string) =>
    request<Delivery>(`/api/delivery/${deliveryId}/complete`, {
      method: 'POST',
      headers: withAuth(token),
      body: JSON.stringify({ photoBase64 }),
    }),
};

export const subscriptionApi = {
  getStatus: (token: string, date?: string) => {
    const params = date ? `?date=${date}` : '';
    return request<{
      type: string;
      retentionDays: number;
      expiresAt: string | null;
      isPro: boolean;
      dailyLimit: number;
      currentUsage: number;
      remaining: number;
      deliveryDate: string;
    }>(`/api/subscription/status${params}`, {
      headers: withAuth(token),
    });
  },
};

export const smsTemplateApi = {
  getDefault: (token: string) =>
    request<{
      template: {
        id: string;
        name: string;
        content: string;
        use_ai: number;
        is_default: number;
      } | null;
      isPro: boolean;
    }>('/api/sms-template/default', {
      headers: withAuth(token),
    }),

  generate: (token: string, templateContent: string, variables: Record<string, string>) =>
    request<{ message: string }>('/api/sms-template/generate', {
      method: 'POST',
      headers: withAuth(token),
      body: JSON.stringify({ templateContent, variables }),
    }),
};

export const logApi = {
  send: (data: Record<string, unknown>) =>
    request('/api/log', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
};

export const healthCheck = () =>
  request<{ status: string; buildDate: string }>('/api/health');
