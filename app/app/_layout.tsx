import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
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

  const segments = useSegments();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading, role } = useAuthStore();

  useEffect(() => {
    if (authLoading) return;

    const inAuthGroup = segments[0] === '(admin)' || segments[0] === '(staff)';

    if (!isAuthenticated && inAuthGroup) {
      // 인증이 필요한 그룹에 있는데 인증 정보가 없는 경우 홈으로 리디렉션
      // 단, 로그인 화면(/(admin)/login)이나 스캔 화면(/(staff)/scan)은 예외 처리할 수 있으나 
      // 현재 구조상 로그아웃 직후 확실한 처리를 위해 루트로 보냄
      router.replace('/');
    } else if (isAuthenticated && !inAuthGroup && (segments[0] as any) !== 'auth') {
      // 이미 인증된 상태인데 역할 선택 화면 등에 있는 경우 해당 대시보드로 이동
      if (role === 'admin') {
        router.replace('/(admin)');
      } else if (role === 'staff') {
        router.replace('/(staff)');
      }
    }
  }, [isAuthenticated, authLoading, segments, role, router]);

  return (
    <>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? '#0f0f1a' : '#f5f5f5',
          },
          animation: 'slide_from_right',
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
