import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuthStore } from '@/stores/auth';
import { api } from '@/services/api';

export default function AuthVerify() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const { loginAdmin } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('토큰이 없습니다.');
      return;
    }

    const verifyMagicLink = async () => {
      try {
        const result = await api.verifyMagicLink(token);
        if (result.success && result.data) {
          loginAdmin(result.data.admin, result.data.token);
          router.replace('/(admin)');
        } else {
          setError(result.error || '링크가 만료되었거나 유효하지 않습니다.');
        }
      } catch {
        setError('인증에 실패했습니다.');
      }
    };

    verifyMagicLink();
  }, [token, loginAdmin, router]);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a', padding: 20 }}>
        <Text style={{ color: '#ef4444', fontSize: 18, fontWeight: '600', marginBottom: 8 }}>
          인증 실패
        </Text>
        <Text style={{ color: '#94a3b8', fontSize: 14, textAlign: 'center' }}>
          {error}
        </Text>
        <Text
          style={{ color: '#3b82f6', fontSize: 14, marginTop: 20 }}
          onPress={() => router.replace('/')}
        >
          홈으로 돌아가기
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' }}>
      <ActivityIndicator size="large" color="#3b82f6" />
      <Text style={{ color: '#94a3b8', marginTop: 16, fontSize: 16 }}>
        인증 중...
      </Text>
    </View>
  );
}
