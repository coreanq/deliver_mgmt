import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';
import { debugLog } from '@/utils/debugLog';

export default function StaffLayout() {
  debugLog('STAFF_LAYOUT', { step: 'SL1', message: 'StaffLayout rendering' });
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
      <Stack.Screen name="scan" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="index" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
