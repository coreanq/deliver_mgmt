import { View, Text, Pressable, useColorScheme } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { debugLog } from '@/utils/debugLog';

export default function AdminDashboard() {
  debugLog('ADMIN_DASHBOARD', { step: 'D1', message: 'Minimal component started' });

  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const admin = useAuthStore((state) => state.admin);
  const logout = useAuthStore((state) => state.logout);

  debugLog('ADMIN_DASHBOARD', { step: 'D2', message: 'Hooks done', hasAdmin: !!admin });

  const handleLogout = async () => {
    await logout();
    router.replace('/');
  };

  debugLog('ADMIN_DASHBOARD', { step: 'D3', message: 'About to render' });

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: isDark ? '#0f0f1a' : '#f5f5f5' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: isDark ? '#fff' : '#000', marginBottom: 20 }}>
        관리자 대시보드 (테스트)
      </Text>
      <Text style={{ fontSize: 16, color: isDark ? '#888' : '#666', marginBottom: 40 }}>
        {admin?.email || '이메일 없음'}
      </Text>
      <Pressable
        onPress={handleLogout}
        style={{ backgroundColor: '#ef4444', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 }}
      >
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>로그아웃</Text>
      </Pressable>
    </View>
  );
}
