import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Admin, Staff, UserRole } from '@/types';
import { api } from '@/services/api';
import { API_BASE_URL } from '@/constants';

const debugLog = async (tag: string, data: any) => {
  try {
    await fetch(`${API_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, data, timestamp: new Date().toISOString() }),
    });
  } catch (e) {}
};

interface AuthState {
  // 현재 역할
  role: UserRole | null;
  // 관리자 정보 (관리자 모드)
  admin: Admin | null;
  // 배송담당자 정보 (배송담당자 모드)
  staff: Staff | null;
  // 인증 토큰
  token: string | null;
  // 로딩 상태
  isLoading: boolean;
  // 인증 여부
  isAuthenticated: boolean;
}

interface AuthActions {
  // 역할 선택
  setRole: (role: UserRole) => void;
  // 관리자 로그인
  loginAdmin: (admin: Admin, token: string) => Promise<void>;
  // 배송담당자 로그인
  loginStaff: (staff: Staff, token: string) => Promise<void>;
  // 로그아웃
  logout: () => Promise<void>;
  // 저장된 세션 복원
  restoreSession: () => Promise<void>;
  // 모든 데이터 강제 초기화
  hardReset: () => Promise<void>;
}

const STORAGE_KEYS = {
  ROLE: 'auth_role',
  TOKEN: 'auth_token',
  ADMIN: 'auth_admin',
  STAFF: 'auth_staff',
};

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  role: null,
  admin: null,
  staff: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,

  setRole: (role) => {
    set({ role });
  },

  loginAdmin: async (admin, token) => {
    await debugLog('AUTH_STORE', { step: 'A1', message: 'loginAdmin start' });
    await SecureStore.setItemAsync(STORAGE_KEYS.ROLE, 'admin');
    await debugLog('AUTH_STORE', { step: 'A2', message: 'ROLE saved' });
    await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
    await debugLog('AUTH_STORE', { step: 'A3', message: 'TOKEN saved' });
    await SecureStore.setItemAsync(STORAGE_KEYS.ADMIN, JSON.stringify(admin));
    await debugLog('AUTH_STORE', { step: 'A4', message: 'ADMIN saved' });

    // API 서비스에 토큰 설정
    api.setToken(token);
    await debugLog('AUTH_STORE', { step: 'A5', message: 'api.setToken done' });

    try {
      await debugLog('AUTH_STORE', { step: 'A5.5', message: 'calling set()' });
      set({
        role: 'admin',
        admin,
        token,
        isAuthenticated: true,
      });
      await debugLog('AUTH_STORE', { step: 'A6', message: 'set() returned' });
    } catch (error) {
      await debugLog('AUTH_STORE_ERROR', { step: 'A6_ERR', error: String(error) });
      throw error;
    }
    await debugLog('AUTH_STORE', { step: 'A7', message: 'loginAdmin completing' });
  },

  loginStaff: async (staff, token) => {
    await SecureStore.setItemAsync(STORAGE_KEYS.ROLE, 'staff');
    await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
    await SecureStore.setItemAsync(STORAGE_KEYS.STAFF, JSON.stringify(staff));

    // API 서비스에 토큰 설정
    api.setToken(token);

    set({
      role: 'staff',
      staff,
      token,
      isAuthenticated: true,
    });
  },

  logout: async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(STORAGE_KEYS.ROLE),
        SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN),
        SecureStore.deleteItemAsync(STORAGE_KEYS.STAFF),
      ]);
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
    }

    // API 서비스에서 토큰 제거
    api.setToken(null);

    set({
      role: null,
      admin: null,
      staff: null,
      token: null,
      isAuthenticated: false,
    });
  },

  restoreSession: async () => {
    try {
      const [role, token, adminStr, staffStr] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.ROLE),
        SecureStore.getItemAsync(STORAGE_KEYS.TOKEN),
        SecureStore.getItemAsync(STORAGE_KEYS.ADMIN),
        SecureStore.getItemAsync(STORAGE_KEYS.STAFF),
      ]);

      if (role && token) {
        // API 서비스에 토큰 설정 (상태 업데이트 전에 먼저 설정)
        api.setToken(token);

        if (role === 'admin' && adminStr) {
          const admin = JSON.parse(adminStr) as Admin;
          set({
            role: 'admin',
            admin,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } else if (role === 'staff' && staffStr) {
          const staff = JSON.parse(staffStr) as Staff;
          set({
            role: 'staff',
            staff,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          set({ isLoading: false });
        }
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },
  hardReset: async () => {
    try {
      await Promise.all(
        Object.values(STORAGE_KEYS).map((key) => SecureStore.deleteItemAsync(key))
      );
    } catch (error) {
      console.error('Failed to hard reset storage:', error);
    }
    api.setToken(null);
    set({
      role: null,
      admin: null,
      staff: null,
      token: null,
      isAuthenticated: false,
    });
  },
}));
