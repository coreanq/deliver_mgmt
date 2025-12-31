import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme, Alert } from 'react-native';
import * as Linking from 'expo-linking';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/services/api';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const { restoreSession, token, loginAdmin } = useAuthStore();

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    api.setToken(token);
  }, [token]);

  // 딥링크 핸들링 (매직 링크 인증)
  useEffect(() => {
    const handleDeepLink = async (event: { url: string }) => {
      const { url } = event;
      const parsed = Linking.parse(url);

      // deliver-mgmt://auth/verify?token=xxx 형태 처리
      if (parsed.path === 'auth/verify' && parsed.queryParams?.token) {
        const magicToken = parsed.queryParams.token as string;

        try {
          const result = await api.verifyMagicLink(magicToken);
          if (result.success && result.data) {
            loginAdmin(result.data.admin, result.data.token);
            router.replace('/(admin)');
          } else {
            Alert.alert('인증 실패', result.error || '링크가 만료되었거나 유효하지 않습니다.');
          }
        } catch {
          Alert.alert('오류', '인증에 실패했습니다.');
        }
      }
    };

    // 앱이 이미 열려있을 때 딥링크 수신
    const subscription = Linking.addEventListener('url', handleDeepLink);

    // 앱이 딥링크로 시작된 경우
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => subscription.remove();
  }, [loginAdmin, router]);

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
        <Stack.Screen name="(admin)" />
        <Stack.Screen name="(staff)" />
      </Stack>
    </>
  );
}
