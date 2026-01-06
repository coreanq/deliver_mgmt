import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Share, Pressable } from 'react-native';
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
import QRCode from 'react-native-qrcode-svg';
import { useAuthStore } from '../../src/stores/auth';
import { authApi } from '../../src/services/api';
import { Loading, Button } from '../../src/components';
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

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

export default function QRGenerateScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const { colors, radius, typography, isDark, springs } = useTheme();
  const insets = useSafeAreaInsets();

  const { token } = useAuthStore();

  const selectedDate = date || getTodayString();
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const closeScale = useSharedValue(1);

  useEffect(() => {
    if (token) {
      generateQR();
    }
  }, [token, selectedDate]);

  const generateQR = async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await authApi.generateQR(token, selectedDate);

      if (result.success && result.data) {
        setQrToken(result.data.token);
        setExpiresAt(result.data.expiresAt);
      } else {
        setError(result.error || 'QR 코드 생성에 실패했습니다.');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleShare = async () => {
    if (!qrToken) return;

    try {
      await Share.share({
        message: `배송담당자 인증 코드: ${qrToken}\n날짜: ${formatDate(selectedDate)}`,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const qrValue = qrToken ? JSON.stringify({ token: qrToken, date: selectedDate }) : '';

  const closeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: closeScale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background orbs */}
      <View style={styles.orbContainer} pointerEvents="none">
        <FloatingOrb color={colors.primary} size={180} initialX={-15} initialY={5} delay={0} />
        <FloatingOrb color={colors.accent} size={140} initialX={65} initialY={55} delay={300} />
      </View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={[
          'transparent',
          isDark ? 'rgba(12, 15, 20, 0.85)' : 'rgba(250, 250, 252, 0.9)',
          colors.background,
        ]}
        locations={[0, 0.4, 0.7]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View style={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} style={styles.header}>
          <Text
            style={[
              typography.h1,
              {
                color: colors.text,
                fontSize: 28,
                letterSpacing: -1,
              },
            ]}
          >
            배송담당자 QR
          </Text>
          <AnimatedPressable
            style={[
              styles.closeButton,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                borderRadius: radius.lg,
              },
              closeAnimatedStyle,
            ]}
            onPress={handleClose}
            onPressIn={() => { closeScale.value = withSpring(0.95, springs.snappy); }}
            onPressOut={() => { closeScale.value = withSpring(1, springs.snappy); }}
          >
            <Text style={[styles.closeIcon, { color: colors.textSecondary }]}>✕</Text>
          </AnimatedPressable>
        </Animated.View>

        {/* Content */}
        <View style={styles.mainContent}>
          {isLoading ? (
            <Loading message="QR 코드 생성 중..." />
          ) : error ? (
            <Animated.View entering={FadeIn.duration(300)} style={styles.errorBox}>
              <Text style={[typography.body, { color: colors.error, textAlign: 'center', marginBottom: 20 }]}>
                {error}
              </Text>
              <Button title="다시 시도" onPress={generateQR} variant="outline" />
            </Animated.View>
          ) : qrToken ? (
            <Animated.View entering={FadeInDown.duration(500)} style={styles.qrSection}>
              {/* QR Card */}
              <View
                style={[
                  styles.qrCard,
                  {
                    backgroundColor: '#FFFFFF',
                    borderRadius: radius['3xl'],
                  },
                ]}
              >
                <QRCode
                  value={qrValue}
                  size={200}
                  color="#1a1f2b"
                  backgroundColor="#FFFFFF"
                />
              </View>

              {/* Date Badge */}
              <Animated.View
                entering={FadeInUp.delay(200).duration(400)}
                style={[
                  styles.dateBadge,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    borderRadius: radius.full,
                  },
                ]}
              >
                <Text style={[typography.button, { color: colors.text }]}>
                  {formatDate(selectedDate)}
                </Text>
              </Animated.View>

              {/* Expiry */}
              {expiresAt && (
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 12 }]}>
                  24시간 후 만료
                </Text>
              )}
            </Animated.View>
          ) : null}
        </View>

        {/* Footer */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.footer}>
          <View
            style={[
              styles.instructionCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderRadius: radius['2xl'],
              },
            ]}
          >
            <Text style={[typography.body, { color: colors.textSecondary, textAlign: 'center', lineHeight: 24 }]}>
              배송담당자가 이 QR을 스캔하면{'\n'}이름 입력 후 배송 목록을 확인할 수 있습니다
            </Text>
          </View>

          {qrToken && (
            <Button
              title="공유하기"
              onPress={handleShare}
              variant="secondary"
              size="lg"
              fullWidth
            />
          )}
        </Animated.View>
      </View>
    </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  closeButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '600',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrSection: {
    alignItems: 'center',
  },
  qrCard: {
    padding: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  dateBadge: {
    marginTop: 28,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  errorBox: {
    alignItems: 'center',
    padding: 24,
  },
  footer: {
    gap: 16,
  },
  instructionCard: {
    padding: 20,
    borderWidth: 1,
    marginBottom: 8,
  },
});
