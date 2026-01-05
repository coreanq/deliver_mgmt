import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { Button } from '../../src/components';
import { useTheme } from '../../src/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Floating orb background decoration
function FloatingOrb({ color, size, initialX, initialY, delay }: {
  color: string;
  size: number;
  initialX: number;
  initialY: number;
  delay: number;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 1000 }));
    translateY.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(-15, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(15, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.5,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          left: `${initialX}%`,
          top: `${initialY}%`,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
}

export default function AdminLoginScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const rootNavigation = navigation.getParent();
  const { colors, radius, shadows, typography, isDark, springs } = useTheme();
  const insets = useSafeAreaInsets();

  const { loginAdmin, logout, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);

  const backScale = useSharedValue(1);

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
    rootNavigation?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'index' }],
      })
    );
    setTimeout(() => logout(), 100);
  };

  const handleResend = () => {
    setEmailSent(false);
    clearError();
  };

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* Background decorations */}
      <View style={styles.orbContainer} pointerEvents="none">
        <FloatingOrb color={colors.primary} size={180} initialX={-15} initialY={5} delay={0} />
        <FloatingOrb color={colors.accent} size={120} initialX={75} initialY={15} delay={300} />
      </View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={[
          'transparent',
          isDark ? 'rgba(12, 15, 20, 0.85)' : 'rgba(250, 250, 252, 0.9)',
          colors.background,
        ]}
        locations={[0, 0.4, 0.8]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
        bounces={true}
      >
        {/* Back Button */}
        <Animated.View entering={FadeIn.delay(100).duration(300)}>
          <AnimatedPressable
            style={[
              styles.backButton,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                borderRadius: radius.lg,
              },
              backAnimatedStyle,
            ]}
            onPress={handleBack}
            onPressIn={() => { backScale.value = withSpring(0.95, springs.snappy); }}
            onPressOut={() => { backScale.value = withSpring(1, springs.snappy); }}
          >
            <Text style={[styles.backIcon, { color: colors.textSecondary }]}>←</Text>
          </AnimatedPressable>
        </Animated.View>

        {/* Header */}
        <Animated.View entering={FadeInUp.delay(150).duration(600)} style={styles.header}>
          <View
            style={[
              styles.logoMark,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderRadius: radius['2xl'],
              },
            ]}
          >
            <LinearGradient
              colors={[colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.logoGradient, { borderRadius: radius.xl }]}
            >
              <Text style={styles.logoText}>관</Text>
            </LinearGradient>
          </View>
          <Text
            style={[
              typography.h1,
              {
                color: colors.text,
                marginTop: 24,
                fontSize: 32,
                letterSpacing: -1,
                fontWeight: '700',
              },
            ]}
          >
            관리자 로그인
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 10, textAlign: 'center' }]}>
            이메일로 로그인 링크를 받으세요
          </Text>
        </Animated.View>

        {!emailSent ? (
          <Animated.View entering={FadeInDown.delay(300).duration(500)} style={styles.form}>
            {/* Glass Card */}
            <View
              style={[
                styles.formCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderRadius: radius['2xl'],
                },
              ]}
            >
              {/* Email Input */}
              <View style={styles.inputContainer}>
                <Text style={[typography.label, { color: colors.textMuted, marginBottom: 10 }]}>
                  이메일 주소
                </Text>
                <View
                  style={[
                    styles.inputWrapper,
                    {
                      backgroundColor: isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.9)',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
                      borderRadius: radius.xl,
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.input,
                      typography.body,
                      { color: colors.text },
                    ]}
                    placeholder="admin@example.com"
                    placeholderTextColor={colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Error Message */}
              {error && (
                <Animated.View
                  entering={FadeIn.duration(200)}
                  style={[
                    styles.errorContainer,
                    {
                      backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                      borderRadius: radius.lg,
                    },
                  ]}
                >
                  <Text style={[typography.bodySmall, { color: colors.error, textAlign: 'center' }]}>
                    {error}
                  </Text>
                </Animated.View>
              )}

              {/* Submit Button */}
              <Button
                title="로그인 링크 받기"
                onPress={handleLogin}
                loading={isLoading}
                disabled={!email.trim()}
                size="lg"
                fullWidth
              />
            </View>

            {/* Dev hint */}
            {__DEV__ && (
              <View
                style={[
                  styles.hintPill,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
                  테스트: dev@test.com
                </Text>
              </View>
            )}
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(400)} style={styles.successContainer}>
            <View
              style={[
                styles.successCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderRadius: radius['2xl'],
                },
              ]}
            >
              <View
                style={[
                  styles.successIcon,
                  {
                    backgroundColor: isDark ? 'rgba(34,197,94,0.2)' : 'rgba(34,197,94,0.15)',
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text style={[styles.successEmoji, { color: colors.success }]}>✓</Text>
              </View>
              <Text style={[typography.h3, { color: colors.text, marginTop: 20, letterSpacing: -0.5 }]}>
                이메일을 확인하세요
              </Text>
              <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 22 }]}>
                {email}로{'\n'}로그인 링크를 보냈습니다
              </Text>
              <View style={{ marginTop: 28, width: '100%' }}>
                <Button
                  title="다시 보내기"
                  onPress={handleResend}
                  variant="outline"
                  fullWidth
                />
              </View>
            </View>
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  orbContainer: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  logoMark: {
    padding: 6,
  },
  logoGradient: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  form: {
    gap: 20,
  },
  formCard: {
    padding: 24,
    borderWidth: 1,
    gap: 20,
  },
  inputContainer: {},
  inputWrapper: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  input: {
    height: 56,
    paddingHorizontal: 18,
  },
  errorContainer: {
    padding: 14,
  },
  hintPill: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  successContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingBottom: 60,
  },
  successCard: {
    padding: 32,
    borderWidth: 1,
    alignItems: 'center',
  },
  successIcon: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successEmoji: {
    fontSize: 32,
    fontWeight: '700',
  },
});
