import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { Loading } from '../../src/components';
import { useTheme } from '../../src/theme';

export default function AuthVerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string }>();
  const { colors, typography, radius } = useTheme();
  const insets = useSafeAreaInsets();

  const { verifyMagicLink, error, clearError } = useAuthStore();
  const [verifying, setVerifying] = useState(true);

  useEffect(() => {
    const verify = async () => {
      if (!params.token) {
        setVerifying(false);
        return;
      }

      clearError();
      const success = await verifyMagicLink(params.token);

      if (success) {
        router.replace('/(admin)');
      } else {
        setVerifying(false);
      }
    };

    verify();
  }, [params.token]);

  if (verifying) {
    return <Loading fullScreen message="로그인 중..." />;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Animated.View entering={FadeIn.duration(400)} style={styles.content}>
        <View
          style={[
            styles.iconBox,
            { backgroundColor: 'rgba(239,68,68,0.15)', borderRadius: radius.full },
          ]}
        >
          <Text style={styles.icon}>!</Text>
        </View>

        <Text style={[typography.h2, { color: colors.text, marginTop: 24, textAlign: 'center' }]}>
          링크가 만료되었습니다
        </Text>

        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 12, textAlign: 'center' }]}>
          {error || '다시 로그인해 주세요'}
        </Text>

        <Text
          style={[typography.button, { color: colors.primary, marginTop: 32 }]}
          onPress={() => router.replace('/(admin)/login')}
        >
          로그인 화면으로
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconBox: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 40,
    fontWeight: '700',
    color: '#EF4444',
  },
});
