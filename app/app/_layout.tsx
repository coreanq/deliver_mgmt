import { useEffect, useRef } from 'react';
import { Stack, useRouter, useRootNavigationState, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/services/api';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { restoreSession, token } = useAuthStore();
  const hasRedirected = useRef(false);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    api.setToken(token);
  }, [token]);

  const router = useRouter();
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isLoading: authLoading, role } = useAuthStore();

  // 세션 복원 후 자동 리다이렉트 (홈 화면에서만)
  useEffect(() => {
    if (!navigationState?.key || authLoading) return;

    // 현재 홈 화면(index)에 있을 때만 자동 리다이렉트
    const isOnHome = segments.length === 0 || segments[0] === 'index' || segments[0] === undefined;

    if (isAuthenticated && role && isOnHome && !hasRedirected.current) {
      hasRedirected.current = true;
      if (role === 'admin') {
        router.replace('/(admin)');
      } else if (role === 'staff') {
        router.replace('/(staff)');
      }
    }

    // 로그아웃 시 플래그 리셋
    if (!isAuthenticated) {
      hasRedirected.current = false;
    }
  }, [isAuthenticated, authLoading, role, router, navigationState?.key, segments]);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? '#0f0f1a' : '#f5f5f5',
          },
          animation: 'none',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(staff)" />
      </Stack>
    </>
  );
}
