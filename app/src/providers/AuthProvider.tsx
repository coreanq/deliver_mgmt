import React, { createContext, useContext, useEffect, useCallback, useMemo } from 'react';
import { useActor } from '@xstate/react';
import {
  authMachine,
  selectIsLoading,
  selectIsAuthenticated,
  selectIsAdmin,
  selectIsStaff,
  selectRole,
  selectAdmin,
  selectStaff,
  selectToken,
} from '@/machines/authMachine';
import { api } from '@/services/api';
import { debugLog } from '@/utils/debugLog';
import type { Admin, Staff, UserRole } from '@/types';

interface AuthContextValue {
  // State
  isLoading: boolean;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  role: UserRole | null;
  admin: Admin | null;
  staff: Staff | null;
  token: string | null;
  stateName: string;
  // Actions
  loginAdmin: (admin: Admin, token: string) => void;
  loginStaff: (staff: Staff, token: string) => void;
  logout: () => void;
  hardReset: () => void;
  setRole: (role: UserRole) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // 라우팅은 _layout.tsx에서 처리
  const machineWithRouter = useMemo(
    () =>
      authMachine.provide({
        actions: {
          // 라우팅 액션은 _layout.tsx에서 isAuthenticated 상태 변경으로 처리
          navigateToHome: () => {},
          navigateToAdmin: () => {},
          navigateToStaff: () => {},
        },
      }),
    []
  );

  const [state, send] = useActor(machineWithRouter);

  // Derived state
  const isLoading = selectIsLoading(state);
  const isAuthenticated = selectIsAuthenticated(state);
  const isAdmin = selectIsAdmin(state);
  const isStaff = selectIsStaff(state);
  const role = selectRole(state);
  const admin = selectAdmin(state);
  const staff = selectStaff(state);
  const token = selectToken(state);

  // 현재 상태를 문자열로 변환 (디버깅용)
  const currentStateName = typeof state.value === 'string'
    ? state.value
    : JSON.stringify(state.value);

  // 상태 변경 로깅
  useEffect(() => {
    debugLog('FSM', { current: currentStateName, isAuthenticated, isLoading });
  }, [currentStateName, isAuthenticated, isLoading]);

  // Start session restoration on mount
  useEffect(() => {
    if (state.matches('idle')) {
      send({ type: 'RESTORE' });
    }
  }, [state, send]);

  // Sync API token
  useEffect(() => {
    api.setToken(token);
  }, [token]);

  // Actions
  const loginAdmin = useCallback(
    (admin: Admin, token: string) => {
      send({ type: 'LOGIN_ADMIN', admin, token });
    },
    [send]
  );

  const loginStaff = useCallback(
    (staff: Staff, token: string) => {
      send({ type: 'LOGIN_STAFF', staff, token });
    },
    [send]
  );

  const logout = useCallback(() => {
    send({ type: 'LOGOUT' });
  }, [send]);

  const hardReset = useCallback(() => {
    send({ type: 'HARD_RESET' });
  }, [send]);

  const setRole = useCallback(
    (role: UserRole) => {
      send({ type: 'SET_ROLE', role });
    },
    [send]
  );

  const value: AuthContextValue = {
    isLoading,
    isAuthenticated,
    isAdmin,
    isStaff,
    role,
    admin,
    staff,
    token,
    stateName: JSON.stringify(state.value),
    loginAdmin,
    loginStaff,
    logout,
    hardReset,
    setRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
