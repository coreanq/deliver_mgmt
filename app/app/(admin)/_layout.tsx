import { Stack } from 'expo-router';
import { useColorScheme } from 'react-native';

export default function AdminLayout() {
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
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="index" options={{ animation: 'fade' }} />
      <Stack.Screen name="qr-generate" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
