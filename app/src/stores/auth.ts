import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { createMachine, assign } from 'xstate';
import type { Admin, Staff, UserRole } from '../types';
import { authApi } from '../services/api';

type AuthContext = {
  role: UserRole | null;
  admin: Admin | null;
  staff: Staff | null;
  token: string | null;
  error: string | null;
};

type AuthEvent =
  | { type: 'SELECT_ROLE'; role: UserRole }
  | { type: 'LOGIN_ADMIN'; email: string }
  | { type: 'LOGIN_ADMIN_SUCCESS'; admin: Admin; token: string }
  | { type: 'LOGIN_STAFF'; qrToken: string; name: string }
  | { type: 'LOGIN_STAFF_SUCCESS'; staff: Staff; token: string }
  | { type: 'LOGIN_ERROR'; error: string }
  | { type: 'LOGOUT' }
  | { type: 'RESTORE'; admin?: Admin; staff?: Staff; token: string; role: UserRole };

export const authMachine = createMachine({
  id: 'auth',
  initial: 'idle',
  context: {
    role: null,
    admin: null,
    staff: null,
    token: null,
    error: null,
  } as AuthContext,
  states: {
    idle: {
      on: {
        SELECT_ROLE: {
          target: 'roleSelected',
          actions: assign({ role: ({ event }) => event.role }),
        },
        RESTORE: {
          target: 'authenticated',
          actions: assign({
            role: ({ event }) => event.role,
            admin: ({ event }) => event.admin ?? null,
            staff: ({ event }) => event.staff ?? null,
            token: ({ event }) => event.token,
          }),
        },
      },
    },
    roleSelected: {
      on: {
        LOGIN_ADMIN: 'authenticating',
        LOGIN_STAFF: 'authenticating',
        SELECT_ROLE: {
          target: 'roleSelected',
          actions: assign({ role: ({ event }) => event.role }),
        },
      },
    },
    authenticating: {
      on: {
        LOGIN_ADMIN_SUCCESS: {
          target: 'authenticated',
          actions: assign({
            admin: ({ event }) => event.admin,
            token: ({ event }) => event.token,
            error: null,
          }),
        },
        LOGIN_STAFF_SUCCESS: {
          target: 'authenticated',
          actions: assign({
            staff: ({ event }) => event.staff,
            token: ({ event }) => event.token,
            error: null,
          }),
        },
        LOGIN_ERROR: {
          target: 'roleSelected',
          actions: assign({ error: ({ event }) => event.error }),
        },
      },
    },
    authenticated: {
      on: {
        LOGOUT: {
          target: 'idle',
          actions: assign({
            role: null,
            admin: null,
            staff: null,
            token: null,
            error: null,
          }),
        },
      },
    },
  },
});

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
        const { token, role, admin, staff } = get();
        if (token && role) {
          set({ state: 'authenticated' });
        }
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
    }
  )
);
