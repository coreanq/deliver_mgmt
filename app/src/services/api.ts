import Constants from 'expo-constants';
import type {
  ApiResponse,
  MagicLinkResponse,
  QRGenerateResponse,
  StaffLoginResponse,
  DeliveryListResponse,
  Delivery,
  CustomFieldDefinition,
  FieldMapping,
  MappingSuggestion,
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
    remoteLog.error(`API Error [${endpoint}]`, error);
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

  updateCustomFields: (token: string, deliveryId: string, customFields: Record<string, string>) =>
    request<Delivery>(`/api/delivery/${deliveryId}/custom-fields`, {
      method: 'PUT',
      headers: withAuth(token),
      body: JSON.stringify({ customFields }),
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
        is_default: number;
      } | null;
    }>('/api/sms-template/default', {
      headers: withAuth(token),
    }),
};

export const customFieldApi = {
  getStaffFields: (token: string) =>
    request<{ fields: CustomFieldDefinition[] }>('/api/custom-field/staff', {
      headers: withAuth(token),
    }),
};

export const uploadApi = {
  parse: (token: string, headers: string[], rows: Record<string, string>[]) =>
    request<{ headers: string[]; rows: Record<string, string>[]; totalRows: number }>(
      '/api/upload/parse',
      {
        method: 'POST',
        headers: withAuth(token),
        body: JSON.stringify({ headers, rows }),
      }
    ),

  suggestMapping: (token: string, headers: string[], sampleRows: Record<string, string>[]) =>
    request<{ suggestions: MappingSuggestion[]; fromCache: boolean; cacheHit: boolean }>(
      '/api/upload/mapping/suggest',
      {
        method: 'POST',
        headers: withAuth(token),
        body: JSON.stringify({ headers, sampleRows }),
      }
    ),

  save: (
    token: string,
    rows: Record<string, string>[],
    mapping: FieldMapping,
    deliveryDate: string,
    overwrite?: boolean
  ) =>
    request<{ insertedCount: number; totalRows: number; deliveryDate: string }>(
      '/api/upload/save',
      {
        method: 'POST',
        headers: withAuth(token),
        body: JSON.stringify({ rows, mapping, deliveryDate, overwrite }),
      }
    ),
};

export const logApi = {
  send: (data: Record<string, unknown>) =>
    fetch(`${API_BASE}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).catch(() => {}), // 로그 실패는 무시
};

// 원격 로깅 유틸리티 (console.log/error 대체용)
export const remoteLog = {
  info: (message: string, data?: Record<string, unknown>) => {
    logApi.send({ level: 'info', message, ...data, timestamp: new Date().toISOString() });
  },
  error: (message: string, error?: unknown, data?: Record<string, unknown>) => {
    const errorInfo = error instanceof Error 
      ? { errorMessage: error.message, errorStack: error.stack }
      : { errorMessage: String(error) };
    logApi.send({ level: 'error', message, ...errorInfo, ...data, timestamp: new Date().toISOString() });
  },
  warn: (message: string, data?: Record<string, unknown>) => {
    logApi.send({ level: 'warn', message, ...data, timestamp: new Date().toISOString() });
  },
};

export const healthCheck = () =>
  request<{ status: string; buildDate: string }>('/api/health');
