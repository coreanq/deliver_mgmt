import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Linking from 'expo-linking';
import { useAuthStore } from '../src/stores/auth';

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
  const [isReady, setIsReady] = useState(false);
  const restore = useAuthStore((s) => s.restore);

  useEffect(() => {
    const init = async () => {
      try {
        await restore();
      } catch (error) {
        console.error('App init error:', error);
      } finally {
        setIsReady(true);
      }
    };
    
    init();
  }, [restore]);

  return isReady;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const isReady = useAppInit();
  
  useDeepLinking();

  if (!isReady) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colorScheme === 'dark' ? '#111827' : '#f9fafb' }}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {
            backgroundColor: colorScheme === 'dark' ? '#111827' : '#f9fafb',
          },
          animation: 'slide_from_right',
        }}
      />
    </SafeAreaProvider>
  );
}
