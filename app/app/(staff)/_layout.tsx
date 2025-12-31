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
          backgroundColor: isDark ? '#0f0f1a' : '#f5f5f5',
        },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="scan" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="index" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
