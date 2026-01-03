import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function StaffLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: {
          backgroundColor: isDark ? '#111827' : '#f9fafb',
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="scan" options={{ animation: 'fade' }} />
      <Stack.Screen name="verify" />
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="[orderId]" options={{ presentation: 'card' }} />
      <Stack.Screen name="complete" options={{ presentation: 'fullScreenModal' }} />
    </Stack>
  );
}
