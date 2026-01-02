import { setup, assign, fromPromise } from 'xstate';
import * as SecureStore from 'expo-secure-store';
import type { Admin, Staff, UserRole } from '@/types';
import { api } from '@/services/api';

// Storage keys
const STORAGE_KEYS = {
  ROLE: 'auth_role',
  TOKEN: 'auth_token',
  ADMIN: 'auth_admin',
  STAFF: 'auth_staff',
} as const;

// Context type
export interface AuthContext {
  role: UserRole | null;
  admin: Admin | null;
  staff: Staff | null;
  token: string | null;
  error: string | null;
}

// Event types
export type AuthEvent =
  | { type: 'RESTORE' }
  | { type: 'LOGIN_ADMIN'; admin: Admin; token: string }
  | { type: 'LOGIN_STAFF'; staff: Staff; token: string }
  | { type: 'LOGOUT' }
  | { type: 'HARD_RESET' }
  | { type: 'SET_ROLE'; role: UserRole };

// Restored session type
interface RestoredSession {
  role: UserRole;
  token: string;
  admin: Admin | null;
  staff: Staff | null;
}

// Actor: Restore session from storage
const restoreSession = fromPromise<RestoredSession | null>(async () => {
  const [role, token, adminStr, staffStr] = await Promise.all([
    SecureStore.getItemAsync(STORAGE_KEYS.ROLE),
    SecureStore.getItemAsync(STORAGE_KEYS.TOKEN),
    SecureStore.getItemAsync(STORAGE_KEYS.ADMIN),
    SecureStore.getItemAsync(STORAGE_KEYS.STAFF),
  ]);

  if (!role || !token) {
    return null;
  }

  const admin = adminStr ? (JSON.parse(adminStr) as Admin) : null;
  const staff = staffStr ? (JSON.parse(staffStr) as Staff) : null;

  api.setToken(token);

  return {
    role: role as UserRole,
    token,
    admin,
    staff,
  };
});

// Actor: Save admin session
const saveAdminSession = fromPromise<void, { admin: Admin; token: string }>(
  async ({ input }) => {
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.ROLE, 'admin'),
      SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, input.token),
      SecureStore.setItemAsync(STORAGE_KEYS.ADMIN, JSON.stringify(input.admin)),
    ]);
    api.setToken(input.token);
  }
);

// Actor: Save staff session
const saveStaffSession = fromPromise<void, { staff: Staff; token: string }>(
  async ({ input }) => {
    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.ROLE, 'staff'),
      SecureStore.setItemAsync(STORAGE_KEYS.TOKEN, input.token),
      SecureStore.setItemAsync(STORAGE_KEYS.STAFF, JSON.stringify(input.staff)),
    ]);
    api.setToken(input.token);
  }
);

// Actor: Clear session
const clearSession = fromPromise<void>(async () => {
  console.log('[FSM] clearSession: started');
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.ROLE),
    SecureStore.deleteItemAsync(STORAGE_KEYS.TOKEN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.ADMIN),
    SecureStore.deleteItemAsync(STORAGE_KEYS.STAFF),
  ]);
  api.setToken(null);
  console.log('[FSM] clearSession: completed');
});

// Auth state machine
export const authMachine = setup({
  types: {
    context: {} as AuthContext,
    events: {} as AuthEvent,
  },
  actors: {
    restoreSession,
    saveAdminSession,
    saveStaffSession,
    clearSession,
  },
  actions: {
    clearContext: assign({
      role: null,
      admin: null,
      staff: null,
      token: null,
      error: null,
    }),
    setAdminContext: assign(({ event }) => {
      if (event.type !== 'LOGIN_ADMIN') return {};
      return {
        role: 'admin' as UserRole,
        admin: event.admin,
        token: event.token,
        staff: null,
        error: null,
      };
    }),
    setStaffContext: assign(({ event }) => {
      if (event.type !== 'LOGIN_STAFF') return {};
      return {
        role: 'staff' as UserRole,
        staff: event.staff,
        token: event.token,
        admin: null,
        error: null,
      };
    }),
    setRestoredContext: assign(({ event }) => {
      const output = (event as any).output as RestoredSession;
      return {
        role: output.role,
        admin: output.admin,
        staff: output.staff,
        token: output.token,
        error: null,
      };
    }),
    setRole: assign(({ event }) => {
      if (event.type !== 'SET_ROLE') return {};
      return { role: event.role };
    }),
    // 라우팅 액션 - AuthProvider에서 provide()로 구현
    navigateToHome: () => {},
    navigateToAdmin: () => {},
    navigateToStaff: () => {},
  },
  guards: {
    hasAdminSession: ({ event }) => {
      const output = (event as any).output as RestoredSession | null;
      return output !== null && output.role === 'admin' && output.admin !== null;
    },
    hasStaffSession: ({ event }) => {
      const output = (event as any).output as RestoredSession | null;
      return output !== null && output.role === 'staff' && output.staff !== null;
    },
  },
}).createMachine({
  id: 'auth',
  initial: 'idle',
  context: {
    role: null,
    admin: null,
    staff: null,
    token: null,
    error: null,
  },
  states: {
    idle: {
      on: {
        RESTORE: { target: 'restoring' },
      },
    },

    restoring: {
      invoke: {
        src: 'restoreSession',
        onDone: [
          {
            guard: 'hasAdminSession',
            target: 'authenticated.admin',
            actions: ['setRestoredContext', 'navigateToAdmin'],
          },
          {
            guard: 'hasStaffSession',
            target: 'authenticated.staff',
            actions: ['setRestoredContext', 'navigateToStaff'],
          },
          {
            target: 'unauthenticated',
          },
        ],
        onError: {
          target: 'unauthenticated',
        },
      },
    },

    unauthenticated: {
      entry: 'clearContext',
      on: {
        LOGIN_ADMIN: { target: 'loggingInAdmin' },
        LOGIN_STAFF: { target: 'loggingInStaff' },
        SET_ROLE: { actions: 'setRole' },
      },
    },

    loggingInAdmin: {
      entry: 'setAdminContext',
      invoke: {
        src: 'saveAdminSession',
        input: ({ event }) => {
          if (event.type !== 'LOGIN_ADMIN') throw new Error('Invalid event');
          return { admin: event.admin, token: event.token };
        },
        onDone: {
          target: 'authenticated.admin',
          actions: 'navigateToAdmin',
        },
        onError: {
          target: 'unauthenticated',
        },
      },
    },

    loggingInStaff: {
      entry: 'setStaffContext',
      invoke: {
        src: 'saveStaffSession',
        input: ({ event }) => {
          if (event.type !== 'LOGIN_STAFF') throw new Error('Invalid event');
          return { staff: event.staff, token: event.token };
        },
        onDone: {
          target: 'authenticated.staff',
          actions: 'navigateToStaff',
        },
        onError: {
          target: 'unauthenticated',
        },
      },
    },

    authenticated: {
      initial: 'admin',
      states: {
        admin: {
          tags: ['authenticated', 'admin'],
        },
        staff: {
          tags: ['authenticated', 'staff'],
        },
      },
      on: {
        LOGOUT: { target: 'loggingOut' },
        HARD_RESET: { target: 'loggingOut' },
      },
    },

    loggingOut: {
      invoke: {
        src: 'clearSession',
        onDone: {
          target: 'unauthenticated',
          actions: 'navigateToHome',
        },
        onError: {
          target: 'unauthenticated',
          actions: 'navigateToHome',
        },
      },
    },
  },
});

// State selectors
export const selectIsLoading = (state: any) =>
  state.matches('idle') || state.matches('restoring');

export const selectIsAuthenticated = (state: any) =>
  state.matches('authenticated');

export const selectIsAdmin = (state: any) =>
  state.matches({ authenticated: 'admin' });

export const selectIsStaff = (state: any) =>
  state.matches({ authenticated: 'staff' });

export const selectRole = (state: any) => state.context.role;
export const selectAdmin = (state: any) => state.context.admin;
export const selectStaff = (state: any) => state.context.staff;
export const selectToken = (state: any) => state.context.token;
