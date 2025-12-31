import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Admin, Staff, UserRole } from '@/types';
import { api } from '@/services/api';

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
    await SecureStore.setItemAsync(STORAGE_KEYS.ROLE, 'admin');
    await SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, token);
    await SecureStore.setItemAsync(STORAGE_KEYS.ADMIN, JSON.stringify(admin));

    // API 서비스에 토큰 설정
    api.setToken(token);

    set({
      role: 'admin',
      admin,
      token,
      isAuthenticated: true,
    });
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
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ROLE);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN);
    await SecureStore.deleteItemAsync(STORAGE_KEYS.STAFF);

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
}));
