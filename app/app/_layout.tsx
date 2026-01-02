import { useEffect } from 'react';
import { Stack, useRouter, useRootNavigationState } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/services/api';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const { restoreSession, token } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    api.setToken(token);
  }, [token]);

  const router = useRouter();
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isLoading: authLoading, role } = useAuthStore();

  // 세션 복원 후 자동 리다이렉트
  useEffect(() => {
    if (!navigationState?.key || authLoading) return;

    // 인증된 상태면 해당 대시보드로
    if (isAuthenticated && role) {
      if (role === 'admin') {
        router.replace('/(admin)');
      } else if (role === 'staff') {
        router.replace('/(staff)');
      }
    }
  }, [isAuthenticated, authLoading, role, router, navigationState?.key]);

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
