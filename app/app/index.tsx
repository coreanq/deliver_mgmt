import { View, Text, StyleSheet, Pressable, Image, Linking, Alert } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withDelay,
  withSequence,
  withTiming,
  withRepeat,
  interpolate,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useAuthStore } from '../src/stores/auth';
import { VersionInfo } from '../src/components';
import { useTheme } from '../src/theme';
import { WEB_URL } from '../src/services/api';

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
          withTiming(-20, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
          withTiming(20, { duration: 3000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.6,
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

// Modern role card with glass effect
interface RoleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onPress: () => void;
  index: number;
  accentColor: string;
}

function RoleCard({ title, description, icon, onPress, index, accentColor }: RoleCardProps) {
  const { colors, radius, typography, springs, isDark } = useTheme();
  const scale = useSharedValue(1);
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const accentLineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pressed.value, [0, 1], [0.5, 1]),
    transform: [{ scaleY: interpolate(pressed.value, [0, 1], [1, 1.2]) }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.98, springs.snappy);
    pressed.value = withSpring(1, springs.snappy);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, springs.snappy);
    pressed.value = withSpring(0, springs.snappy);
  };

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(300 + index * 150).duration(600).springify()}
      style={[styles.roleCard, animatedStyle]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View
        style={[
          styles.roleCardGlass,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.85)',
            borderRadius: radius['2xl'],
            borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)',
          },
        ]}
      >
        {/* Accent line */}
        <Animated.View
          style={[
            styles.accentLine,
            { backgroundColor: accentColor, borderRadius: radius.full },
            accentLineStyle,
          ]}
        />

        <View style={styles.roleCardContent}>
          {/* Icon */}
          <View
            style={[
              styles.iconWrapper,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                borderRadius: radius.xl,
              },
            ]}
          >
            {icon}
          </View>

          {/* Text */}
          <View style={styles.roleTextContainer}>
            <Text style={[typography.h3, { color: colors.text, letterSpacing: -0.5 }]}>
              {title}
            </Text>
            <Text
              style={[
                typography.bodySmall,
                { color: colors.textSecondary, marginTop: 6, lineHeight: 20 },
              ]}
            >
              {description}
            </Text>
          </View>

          {/* Arrow */}
          <View
            style={[
              styles.arrowCircle,
              {
                backgroundColor: accentColor,
                borderRadius: radius.full,
              },
            ]}
          >
            <Text style={styles.arrowIcon}>→</Text>
          </View>
        </View>
      </View>
    </AnimatedPressable>
  );
}

// Admin icon component
function AdminIcon() {
  const { colors } = useTheme();
  return (
    <View style={styles.iconInner}>
      <View style={[styles.adminGrid]}>
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={[
              styles.adminDot,
              { backgroundColor: i === 0 ? colors.primary : colors.textMuted },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

// Staff icon component
function StaffIcon() {
  const { colors } = useTheme();
  return (
    <View style={styles.iconInner}>
      <View style={[styles.qrFrame, { borderColor: colors.accent }]}>
        <View style={[styles.qrInner, { backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { colors, typography, radius, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { selectRole, role, state, token } = useAuthStore();
  const isAuthenticated = state === 'authenticated' && token !== null;

  // Redirect if already authenticated
  if (isAuthenticated && role === 'admin') {
    return <Redirect href="/(admin)" />;
  }
  if (isAuthenticated && role === 'staff') {
    return <Redirect href="/(staff)" />;
  }

  const handleSelectAdmin = () => {
    selectRole('admin');
    router.push('/(admin)/login');
  };

  const handleSelectStaff = () => {
    selectRole('staff');
    router.push('/(staff)/scan');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background decorations */}
      <View style={styles.orbContainer} pointerEvents="none">
        <FloatingOrb color={colors.primary} size={200} initialX={-10} initialY={10} delay={0} />
        <FloatingOrb color={colors.accent} size={150} initialX={70} initialY={60} delay={500} />
        <FloatingOrb color={colors.primary} size={100} initialX={80} initialY={5} delay={300} />
      </View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={[
          'transparent',
          isDark ? 'rgba(12, 15, 20, 0.8)' : 'rgba(250, 250, 252, 0.9)',
          colors.background,
        ]}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      <View
        style={[
          styles.content,
          { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 20 },
        ]}
      >
        {/* Header */}
        <Animated.View entering={FadeInUp.delay(100).duration(800)} style={styles.header}>
          {/* App icon */}
          <View
            style={[
              styles.logoMark,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderRadius: radius['2xl'],
              },
            ]}
          >
            <Image
              source={require('../assets/icon.png')}
              style={[styles.logoImage, { borderRadius: radius.xl }]}
            />
          </View>

          <Text
            style={[
              typography.h1,
              {
                color: colors.text,
                marginTop: 28,
                fontSize: 36,
                letterSpacing: -1.5,
                fontWeight: '700',
              },
            ]}
          >
            배매니저
          </Text>

          <Animated.Text
            entering={FadeIn.delay(400).duration(600)}
            style={[
              typography.body,
              {
                color: colors.textSecondary,
                marginTop: 12,
                textAlign: 'center',
                lineHeight: 24,
              },
            ]}
          >
            배송 관리의 새로운 기준
          </Animated.Text>
        </Animated.View>

        {/* Role selection */}
        <View style={styles.cardsSection}>
          <Animated.Text
            entering={FadeInDown.delay(200).duration(500)}
            style={[
              typography.overline,
              {
                color: colors.textMuted,
                marginBottom: 16,
                marginLeft: 4,
              },
            ]}
          >
            시작하기
          </Animated.Text>

          <View style={styles.cardsWrapper}>
            <RoleCard
              title="관리자"
              description="배송 데이터를 관리하고 QR 코드를 생성합니다"
              icon={<AdminIcon />}
              onPress={handleSelectAdmin}
              index={0}
              accentColor={colors.primary}
            />

            <RoleCard
              title="배송담당자"
              description="QR 스캔으로 오늘의 배송을 확인합니다"
              icon={<StaffIcon />}
              onPress={handleSelectStaff}
              index={1}
              accentColor={colors.accent}
            />
          </View>
        </View>

        {/* Footer */}
        <Animated.View
          entering={FadeInUp.delay(700).duration(500)}
          style={styles.footer}
        >
          <Pressable
            style={[
              styles.footerPill,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
                borderRadius: radius.full,
              },
            ]}
            onPress={async () => {
              await Clipboard.setStringAsync(WEB_URL);
              Alert.alert('링크 복사됨', 'PC 브라우저에서 접속하세요');
            }}
          >
            <Text style={[typography.caption, { color: colors.textMuted, textAlign: 'center' }]}>
              엑셀 업로드는 PC의 브라우저에서 진행하세요
            </Text>
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4, textAlign: 'center', fontSize: 11 }]}>
              {WEB_URL}
            </Text>
          </Pressable>

          <View style={styles.legalLinks}>
            <Pressable onPress={() => Linking.openURL('https://periwinkle-foam-a5a.notion.site/2e10f396f354808b85f6dcce7412a3c2')}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                개인정보 처리방침
              </Text>
            </Pressable>
            <Text style={[typography.caption, { color: colors.textMuted }]}>•</Text>
            <Pressable onPress={() => Linking.openURL('https://periwinkle-foam-a5a.notion.site/2e10f396f35480c3a5a8c6e4bb1c27fc')}>
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                고객 지원
              </Text>
            </Pressable>
          </View>

          <View style={{ marginTop: 16 }}>
            <VersionInfo />
          </View>
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
    alignItems: 'center',
    paddingTop: 20,
  },
  logoMark: {
    padding: 6,
  },
  logoImage: {
    width: 72,
    height: 72,
  },
  cardsSection: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 32,
  },
  cardsWrapper: {
    gap: 16,
  },
  roleCard: {
    overflow: 'hidden',
  },
  roleCardGlass: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    left: 0,
    top: 20,
    bottom: 20,
    width: 4,
  },
  roleCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingLeft: 24,
    gap: 16,
  },
  iconWrapper: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconInner: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adminGrid: {
    width: 24,
    height: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  adminDot: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
  qrFrame: {
    width: 24,
    height: 24,
    borderWidth: 2.5,
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrInner: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  roleTextContainer: {
    flex: 1,
  },
  arrowCircle: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrowIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 8,
  },
  footerPill: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  legalLinks: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
});
