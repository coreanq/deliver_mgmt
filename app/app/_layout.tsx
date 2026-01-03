import { useEffect, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from 'react-native';
import { AuthProvider, useAuth } from '@/providers/AuthProvider';
import { api } from '@/services/api';
import { debugLog } from '@/utils/debugLog';

function RootLayoutInner() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const { token, stateName } = useAuth();

  // 이전 FSM 상태 추적
  const prevStateRef = useRef<string | null>(null);

  // Sync API token
  useEffect(() => {
    api.setToken(token);
  }, [token]);

  // FSM 상태 전이 감지 - loggingOut → unauthenticated 시 홈으로 이동
  useEffect(() => {
    const prevState = prevStateRef.current;
    prevStateRef.current = stateName;

    // loggingOut → unauthenticated 전이 감지
    if (prevState === '"loggingOut"' && stateName === '"unauthenticated"') {
      debugLog('LAYOUT_FSM', { action: 'logout_transition', prevState, stateName, segments });
      router.dismissTo('/');
    }
  }, [stateName, router, segments]);

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

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutInner />
    </AuthProvider>
  );
}
