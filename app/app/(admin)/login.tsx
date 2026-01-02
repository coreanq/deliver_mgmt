import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  useColorScheme,
  StyleSheet,
  Keyboard,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  withSequence,
  interpolate,
  Extrapolation,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import { TEST_EMAILS } from '@/constants';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminLoginScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loginAdmin } = useAuthStore();
  const inputRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  // Animation values
  const headerOpacity = useSharedValue(0);
  const headerTranslateY = useSharedValue(-30);
  const formOpacity = useSharedValue(0);
  const formTranslateY = useSharedValue(40);
  const successScale = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const inputFocused = useSharedValue(0);
  const shakeX = useSharedValue(0);

  useEffect(() => {
    // Entrance animations
    headerOpacity.value = withDelay(100, withTiming(1, { duration: 500 }));
    headerTranslateY.value = withDelay(100, withSpring(0, { damping: 15, stiffness: 100 }));
    formOpacity.value = withDelay(250, withTiming(1, { duration: 500 }));
    formTranslateY.value = withDelay(250, withSpring(0, { damping: 15, stiffness: 100 }));
  }, []);

  const headerStyle = useAnimatedStyle(() => ({
    opacity: headerOpacity.value,
    transform: [{ translateY: headerTranslateY.value }],
  }));

  const formStyle = useAnimatedStyle(() => ({
    opacity: formOpacity.value,
    transform: [
      { translateY: formTranslateY.value },
      { translateX: shakeX.value },
    ],
  }));

  const successStyle = useAnimatedStyle(() => ({
    transform: [{ scale: successScale.value }],
    opacity: successScale.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const inputContainerStyle = useAnimatedStyle(() => {
    const borderColor = interpolate(
      inputFocused.value,
      [0, 1],
      [0, 1],
      Extrapolation.CLAMP
    );
    return {
      borderWidth: 2,
      borderColor: isDark
        ? `rgba(59, 130, 246, ${borderColor * 0.5 + 0.1})`
        : `rgba(59, 130, 246, ${borderColor * 0.6 + 0.15})`,
    };
  });

  const isValidEmail = EMAIL_REGEX.test(email);

  const handleInputFocus = () => {
    inputFocused.value = withSpring(1, { damping: 15, stiffness: 200 });
  };

  const handleInputBlur = () => {
    inputFocused.value = withSpring(0, { damping: 15, stiffness: 200 });
  };

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const handleSendMagicLink = async () => {
    Keyboard.dismiss();
    setError('');

    if (!isValidEmail) {
      triggerShake();
      setError('유효한 이메일 주소를 입력하세요');
      return;
    }

    // Test email bypass - 로그인 후 _layout.tsx가 자동으로 대시보드로 리다이렉트
    if (TEST_EMAILS.includes(email.toLowerCase())) {
      setIsLoading(true);
      try {
        await loginAdmin(
          { id: 'test-admin', email: email.toLowerCase(), createdAt: new Date().toISOString() },
          'test-token-123'
        );
        // _layout.tsx의 보호 로직이 isAuthenticated 변경 감지 후 자동 리다이렉트
      } catch (error) {
        console.error('Test login failed:', error);
        setError('로그인 실패');
        setIsLoading(false);
      }
      return;
    }

    setIsLoading(true);
    const result = await api.sendMagicLink(email);

    if (result.success) {
      successScale.value = withSpring(1, { damping: 12, stiffness: 100 });
      setIsSent(true);
    } else {
      triggerShake();
      setError(result.error || '이메일 발송에 실패했습니다');
    }
    setIsLoading(false);
  };

  const handleButtonPressIn = () => {
    buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handleButtonPressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const bgColors = isDark
    ? ['#0a0a12', '#0d0d1a', '#0a0a12'] as const
    : ['#f0f4f8', '#e8eef5', '#f0f4f8'] as const;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <LinearGradient colors={bgColors} style={styles.container}>
        {/* Back Button */}
        <Pressable
        style={styles.backButton}
        onPress={() => router.back()}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <View style={[styles.backButtonInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M19 12H5M5 12L12 19M5 12L12 5"
              stroke={isDark ? '#fff' : '#1a1a2e'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </Pressable>

      <View style={styles.content}>
        {/* Header */}
        <Animated.View style={[styles.header, headerStyle]}>
          <LinearGradient
            colors={['#3b82f6', '#1d4ed8']}
            style={styles.iconBg}
          >
            <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
              <Path
                d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path
                d="M22 6L12 13L2 6"
                stroke="#fff"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </LinearGradient>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            관리자 로그인
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#666680' : '#64748b' }]}>
            이메일로 로그인하세요
          </Text>
        </Animated.View>

        {/* Form or Success Message */}
        {!isSent ? (
          <Animated.View style={[styles.form, formStyle]}>
            {/* Email Input */}
            <Animated.View
              style={[
                styles.inputContainer,
                { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : '#fff' },
                inputContainerStyle,
              ]}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none" style={styles.inputIcon}>
                <Path
                  d="M4 4H20C21.1 4 22 4.9 22 6V18C22 19.1 21.1 20 20 20H4C2.9 20 2 19.1 2 18V6C2 4.9 2.9 4 4 4Z"
                  stroke={isDark ? '#666' : '#94a3b8'}
                  strokeWidth="1.5"
                />
                <Path
                  d="M22 6L12 13L2 6"
                  stroke={isDark ? '#666' : '#94a3b8'}
                  strokeWidth="1.5"
                />
              </Svg>
              <TextInput
                ref={inputRef}
                style={[styles.input, { color: isDark ? '#fff' : '#1a1a2e' }]}
                placeholder="이메일 주소"
                placeholderTextColor={isDark ? '#555' : '#94a3b8'}
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                }}
                onFocus={handleInputFocus}
                onBlur={handleInputBlur}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
              />
            </Animated.View>

            {/* Error Message */}
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : null}

            {/* Submit Button */}
            <AnimatedPressable
              style={[
                styles.button,
                buttonAnimatedStyle,
                (!isValidEmail || isLoading) && styles.buttonDisabled,
              ]}
              onPress={handleSendMagicLink}
              onPressIn={handleButtonPressIn}
              onPressOut={handleButtonPressOut}
              disabled={!isValidEmail || isLoading}
            >
              <LinearGradient
                colors={isValidEmail && !isLoading ? ['#3b82f6', '#1d4ed8'] : ['#64748b', '#475569']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {isLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        stroke="#fff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={styles.buttonText}>이메일로 로그인</Text>
                  </>
                )}
              </LinearGradient>
            </AnimatedPressable>

          </Animated.View>
        ) : (
          <Animated.View style={[styles.successContainer, successStyle]}>
            <View style={styles.successIconContainer}>
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.successIconBg}
              >
                <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 6L9 17L4 12"
                    stroke="#fff"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </LinearGradient>
            </View>
            <Text style={[styles.successTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>
              이메일을 확인하세요!
            </Text>
            <Text style={[styles.successSubtitle, { color: isDark ? '#666680' : '#64748b' }]}>
              {email}로{'\n'}로그인 링크를 보냈습니다.
            </Text>
            <Pressable
              style={[styles.resendButton, { borderColor: isDark ? '#333' : '#e2e8f0' }]}
              onPress={() => setIsSent(false)}
            >
              <Text style={[styles.resendText, { color: isDark ? '#3b82f6' : '#1d4ed8' }]}>
                다시 보내기
              </Text>
            </Pressable>
          </Animated.View>
        )}
      </View>
      </LinearGradient>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconBg: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: -8,
  },
  button: {
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonDisabled: {
    shadowOpacity: 0,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  successContainer: {
    alignItems: 'center',
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.3,
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  resendButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  resendText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
