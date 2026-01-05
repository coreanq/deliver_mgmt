import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuthStore } from '../src/stores/auth';
import { Loading } from '../src/components';
import { darkColors, lightColors } from '../src/theme';

function useDeepLinking() {
  const verifyMagicLink = useAuthStore((s) => s.verifyMagicLink);

  useEffect(() => {
    const handleInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      if (url) handleUrl(url);
    };

    const subscription = Linking.addEventListener('url', (event) => {
      handleUrl(event.url);
    });

    const handleUrl = (url: string) => {
      const parsed = Linking.parse(url);
      if (parsed.path === 'auth/verify' && parsed.queryParams?.token) {
        const token = parsed.queryParams.token as string;
        verifyMagicLink(token);
      }
    };

    handleInitialUrl();
    return () => subscription.remove();
  }, [verifyMagicLink]);
}

function useAppInit() {
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  return hasHydrated;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isReady = useAppInit();
  const isDark = colorScheme === 'dark';
  const colors = isDark ? darkColors : lightColors;

  useDeepLinking();

  if (!isReady) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Loading fullScreen message="로딩 중..." />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Animated.View entering={FadeIn.duration(300)} style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: colors.background,
            },
            animation: 'slide_from_right',
            animationDuration: 250,
          }}
        />
      </Animated.View>
    </SafeAreaProvider>
  );
}
