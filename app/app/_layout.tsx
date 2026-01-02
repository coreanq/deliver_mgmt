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

    const inAdminGroup = segments[0] === '(admin)';
    const inStaffGroup = segments[0] === '(staff)';
    const inProtectedGroup = inAdminGroup || inStaffGroup;

    if (!isAuthenticated && inProtectedGroup) {
      // 인증이 필요한 그룹에 있는데 인증 정보가 없는 경우 홈으로 리디렉션
      router.replace('/');
    } else if (isAuthenticated && (segments[0] as any) !== 'auth') {
      // 이미 인증된 상태인데 다른 위치에 있는 경우 (홈 등)
      if (inAdminGroup && role !== 'admin') {
        // 권한이 없는 관리자 그룹 진입 시도 시 홈으로
        router.replace('/');
      } else if (inStaffGroup && role !== 'staff') {
        // 권한이 없는 담당자 그룹 진입 시도 시 홈으로
        router.replace('/');
      } else if (!inProtectedGroup) {
        // 인증되었으나 보호된 그룹 밖(홈 등)에 있는 경우 해당 대시보드로 이동
        if (role === 'admin') {
          router.replace('/(admin)');
        } else if (role === 'staff') {
          router.replace('/(staff)');
        }
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
