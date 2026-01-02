import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { debugLog } from '@/utils/debugLog';

export default function AdminLayout() {
  debugLog('ADMIN_LAYOUT', { step: 'AL1', message: 'AdminLayout rendering' });
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isDark ? '#0f0f1a' : '#f5f5f5',
        },
        animation: 'none',
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="index" />
      <Stack.Screen name="qr-generate" />
    </Stack>
  );
}
