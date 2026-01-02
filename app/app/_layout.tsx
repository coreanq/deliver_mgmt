import { useEffect } from 'react';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
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
  const navigationState = useRootNavigationState();
  const { isAuthenticated, isLoading: authLoading, role } = useAuthStore();

  useEffect(() => {
    // 네비게이션이 준비되지 않았거나 인증 로딩 중이면 대기
    if (!navigationState?.key || authLoading) return;

    const inAdminGroup = segments[0] === '(admin)';
    const inStaffGroup = segments[0] === '(staff)';

    // 허용된 공개 페이지 (로그인/스캔 등)
    const isPublicAdminPage = inAdminGroup && segments[1] === 'login';
    const isPublicStaffPage = inStaffGroup && (segments[1] === 'scan' || segments[1] === 'verify');

    // 보호되어야 할 페이지인지 확인
    const isProtectedPage = (inAdminGroup && !isPublicAdminPage) || (inStaffGroup && !isPublicStaffPage);

    if (!isAuthenticated && isProtectedPage) {
      // 인증 없이 보호된 페이지 접근 시 홈으로
      router.replace('/');
    } else if (isAuthenticated && (segments[0] as any) !== 'auth') {
      // 이미 인증된 상태에서의 리디렉션 처리
      if (inAdminGroup && role !== 'admin') {
        router.replace('/');
      } else if (inStaffGroup && role !== 'staff') {
        router.replace('/');
      } else if (!inAdminGroup && !inStaffGroup) {
        // 이미 로그인했는데 홈 등에 있으면 대시보드로
        if (role === 'admin') {
          router.replace('/(admin)');
        } else if (role === 'staff') {
          router.replace('/(staff)');
        }
      }
    }
  }, [isAuthenticated, authLoading, segments, role, router, navigationState?.key]);

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
