import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import type { Admin, Staff, UserRole } from '../types';
import { authApi } from '../services/api';

const secureStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
    }
  },
};

interface AuthStore {
  state: 'idle' | 'roleSelected' | 'authenticating' | 'authenticated';
  role: UserRole | null;
  admin: Admin | null;
  staff: Staff | null;
  token: string | null;
  error: string | null;
  isLoading: boolean;
  hasHydrated: boolean;
  
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  
  selectRole: (role: UserRole) => void;
  loginAdmin: (email: string) => Promise<boolean>;
  verifyMagicLink: (token: string) => Promise<boolean>;
  loginStaff: (qrToken: string, name: string) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
  restore: () => Promise<void>;
  setHasHydrated: (value: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      state: 'idle',
      role: null,
      admin: null,
      staff: null,
      token: null,
      error: null,
      isLoading: false,
      hasHydrated: false,
      
      get isAuthenticated() {
        return get().state === 'authenticated' && get().token !== null;
      },
      get isAdmin() {
        return get().role === 'admin' && get().admin !== null;
      },
      get isStaff() {
        return get().role === 'staff' && get().staff !== null;
      },
      
      selectRole: (role) => {
        set({ role, state: 'roleSelected', error: null });
      },

      loginAdmin: async (email) => {
        set({ isLoading: true, error: null, state: 'authenticating' });
        
        try {
          const result = await authApi.sendMagicLink(email);
          
          if (result.success && result.data) {
            if (result.data.token && result.data.admin) {
              set({
                state: 'authenticated',
                admin: result.data.admin,
                token: result.data.token,
                isLoading: false,
              });
              return true;
            }
            set({ state: 'roleSelected', isLoading: false });
            return true;
          } else {
            set({ 
              error: result.error || '로그인에 실패했습니다.',
              state: 'roleSelected',
              isLoading: false,
            });
            return false;
          }
        } catch (error) {
          set({ 
            error: '네트워크 오류가 발생했습니다.',
            state: 'roleSelected',
            isLoading: false,
          });
          return false;
        }
      },

      verifyMagicLink: async (magicToken) => {
        set({ isLoading: true, error: null, state: 'authenticating' });
        
        try {
          const result = await authApi.verifyMagicLink(magicToken);
          
          if (result.success && result.data?.token && result.data?.admin) {
            set({
              state: 'authenticated',
              admin: result.data.admin,
              token: result.data.token,
              role: 'admin',
              isLoading: false,
            });
            return true;
          } else {
            set({ 
              error: result.error || '링크가 만료되었습니다.',
              state: 'roleSelected',
              isLoading: false,
            });
            return false;
          }
        } catch (error) {
          set({ 
            error: '인증에 실패했습니다.',
            state: 'roleSelected',
            isLoading: false,
          });
          return false;
        }
      },

      loginStaff: async (qrToken, name) => {
        set({ isLoading: true, error: null, state: 'authenticating' });
        
        try {
          const result = await authApi.staffLogin(qrToken, name);
          
          if (result.success && result.data) {
            set({
              state: 'authenticated',
              staff: result.data.staff,
              token: result.data.token,
              isLoading: false,
            });
            return true;
          } else {
            set({ 
              error: result.error || '로그인에 실패했습니다.',
              state: 'roleSelected',
              isLoading: false,
            });
            return false;
          }
        } catch (error) {
          set({ 
            error: '네트워크 오류가 발생했습니다.',
            state: 'roleSelected',
            isLoading: false,
          });
          return false;
        }
      },

      logout: () => {
        set({
          state: 'idle',
          role: null,
          admin: null,
          staff: null,
          token: null,
          error: null,
          isLoading: false,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      restore: async () => {
        const { token, role } = get();
        if (token && role) {
          set({ state: 'authenticated' });
        }
      },

      setHasHydrated: (value: boolean) => {
        set({ hasHydrated: value });
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({
        role: state.role,
        admin: state.admin,
        staff: state.staff,
        token: state.token,
        state: state.state,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hasHydrated: true });
      },
    }
  )
);
