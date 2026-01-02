import React, { createContext, useContext, useEffect, useCallback, useMemo, useRef } from 'react';
import { useActor } from '@xstate/react';
import { useRouter } from 'expo-router';
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
  const router = useRouter();
  // useRef로 router 참조를 안정적으로 유지 (머신 재생성 방지)
  const routerRef = useRef(router);
  routerRef.current = router;

  // 라우팅 액션을 주입한 머신 생성 (한 번만 생성)
  const machineWithRouter = useMemo(
    () =>
      authMachine.provide({
        actions: {
          navigateToHome: () => {
            routerRef.current.replace('/');
          },
          navigateToAdmin: () => {
            routerRef.current.replace('/(admin)');
          },
          navigateToStaff: () => {
            routerRef.current.replace('/(staff)');
          },
        },
      }),
    [] // 의존성 제거 - 머신은 한 번만 생성
  );

  const [state, send] = useActor(machineWithRouter);

  // 이전 상태 추적 (로그아웃 감지용)
  const prevStateRef = useRef<string | null>(null);

  // Derived state
  const isLoading = selectIsLoading(state);
  const isAuthenticated = selectIsAuthenticated(state);
  const isAdmin = selectIsAdmin(state);
  const isStaff = selectIsStaff(state);
  const role = selectRole(state);
  const admin = selectAdmin(state);
  const staff = selectStaff(state);
  const token = selectToken(state);

  // 현재 상태를 문자열로 변환
  const currentStateName = typeof state.value === 'string'
    ? state.value
    : JSON.stringify(state.value);

  // 상태 전이 기반 라우팅
  useEffect(() => {
    const prevState = prevStateRef.current;
    debugLog('FSM', { prev: prevState, current: currentStateName });
    prevStateRef.current = currentStateName;

    // loggingOut → unauthenticated 전이 시 홈으로 이동
    if (prevState === 'loggingOut' && state.matches('unauthenticated')) {
      debugLog('FSM', { action: 'navigateToHome' });
      // expo-router에서 그룹 라우트에서 루트로 나가려면 dismissAll 필요
      if (routerRef.current.canDismiss()) {
        routerRef.current.dismissAll();
      }
      routerRef.current.replace('/');
    }
  }, [currentStateName, state]);

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
