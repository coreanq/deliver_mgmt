import { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  StyleSheet, 
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { Button } from '../../src/components';
import { useTheme } from '../../src/theme';

export default function AdminLoginScreen() {
  const router = useRouter();
  const { colors, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { loginAdmin, isLoading, error, clearError } = useAuthStore();
  
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) return;
    
    clearError();
    const success = await loginAdmin(email.trim().toLowerCase());
    
    if (success) {
      const { state, token } = useAuthStore.getState();
      if (state === 'authenticated' && token) {
        router.replace('/(admin)');
      } else {
        setEmailSent(true);
      }
    }
  };

  const handleBack = () => {
    router.replace('/');
  };

  const handleResend = () => {
    setEmailSent(false);
    clearError();
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>
            🏠
          </Text>
        </Pressable>

        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.header}>
          <View style={[styles.logoContainer, { borderRadius: radius.xl }]}>
            <Image 
              source={require('../../assets/icon.png')} 
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={[styles.title, { color: colors.text }]}>
            관리자 로그인
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            이메일로 로그인 링크를 받으세요
          </Text>
        </Animated.View>

        {!emailSent ? (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.form}>
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textSecondary }]}>
                이메일 주소
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    color: colors.text,
                    borderColor: colors.border,
                    borderRadius: radius.lg,
                  },
                  shadows.sm,
                ]}
                placeholder="admin@example.com"
                placeholderTextColor={colors.textTertiary}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!isLoading}
              />
            </View>

            {error && (
              <View style={[
                styles.errorContainer, 
                { 
                  backgroundColor: colors.errorLight,
                  borderRadius: radius.lg,
                }
              ]}>
                <Text style={[styles.errorText, { color: colors.error }]}>
                  {error}
                </Text>
              </View>
            )}

            <Button
              title="로그인 링크 받기"
              onPress={handleLogin}
              loading={isLoading}
              disabled={!email.trim()}
              style={styles.button}
            />

            {__DEV__ && (
              <Text style={[styles.devHint, { color: colors.textTertiary }]}>
                테스트: dev@test.com 또는 dev@example.com
              </Text>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.successContainer}>
            <View style={[
              styles.successIcon, 
              { 
                backgroundColor: colors.successLight,
                borderRadius: radius.full,
              }
            ]}>
              <Text style={styles.successEmoji}>✉️</Text>
            </View>
            <Text style={[styles.successTitle, { color: colors.text }]}>
              이메일을 확인하세요!
            </Text>
            <Text style={[styles.successDescription, { color: colors.textSecondary }]}>
              {email}로{'\n'}로그인 링크를 보냈습니다.
            </Text>
            <Button
              title="다시 보내기"
              onPress={handleResend}
              variant="outline"
              style={styles.resendButton}
            />
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 24,
  },
  backText: {
    fontSize: 24,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 16,
    overflow: 'hidden',
  },
  logo: {
    width: 64,
    height: 64,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    height: 52,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorContainer: {
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    marginTop: 8,
  },
  devHint: {
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
  successContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successEmoji: {
    fontSize: 40,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 12,
  },
  successDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  resendButton: {
    paddingHorizontal: 32,
  },
});
