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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
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

// Floating orb
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

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string; date: string }>();
  const { colors, radius, typography, isDark, springs } = useTheme();
  const insets = useSafeAreaInsets();

  const { loginStaff, isLoading, error, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const backScale = useSharedValue(1);

  const handleVerify = async () => {
    if (!name.trim() || !params.token) return;

    clearError();

    const success = await loginStaff(params.token, name.trim());

    if (success) {
      router.replace('/(staff)');
    }
  };

  const handleBack = () => {
    clearError();
    router.replace('/(staff)/scan');
  };

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      {/* Background orbs */}
      <View style={styles.orbContainer} pointerEvents="none">
        <FloatingOrb color={colors.accent} size={180} initialX={-15} initialY={5} delay={0} />
        <FloatingOrb color={colors.primary} size={120} initialX={75} initialY={15} delay={300} />
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
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 40 }]}
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
              colors={[colors.accent, colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.logoGradient, { borderRadius: radius.xl }]}
            >
              <Text style={styles.logoText}>인</Text>
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
            본인 인증
          </Text>
          <Text style={[typography.body, { color: colors.textSecondary, marginTop: 10, textAlign: 'center' }]}>
            배송담당자 이름을 입력하세요
          </Text>

          {params.date && (
            <View
              style={[
                styles.dateBadge,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text style={[typography.button, { color: colors.text }]}>
                {formatDate(params.date)}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Form */}
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
            {/* Name Input */}
            <View style={styles.inputContainer}>
              <Text style={[typography.label, { color: colors.textMuted, marginBottom: 10 }]}>
                담당자 이름
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
                  style={[styles.input, typography.body, { color: colors.text }]}
                  placeholder="예: 홍길동"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
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
              title="확인"
              onPress={handleVerify}
              loading={isLoading}
              disabled={!name.trim()}
              size="lg"
              fullWidth
            />
          </View>
        </Animated.View>

        {/* Hint */}
        <Animated.View entering={FadeInUp.delay(500).duration(400)} style={styles.hint}>
          <View
            style={[
              styles.hintCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderRadius: radius.xl,
              },
            ]}
          >
            <Text style={[typography.bodySmall, { color: colors.textMuted, textAlign: 'center' }]}>
              관리자가 등록한 이름과 정확히 일치해야 합니다
            </Text>
          </View>
        </Animated.View>
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
    marginBottom: 36,
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
  dateBadge: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
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
  hint: {
    marginTop: 'auto',
    paddingTop: 24,
  },
  hintCard: {
    padding: 16,
  },
});
