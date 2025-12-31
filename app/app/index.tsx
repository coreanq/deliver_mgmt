import { useEffect } from 'react';
import { View, Text, Pressable, useColorScheme, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useAuthStore } from '@/stores/auth';
import Svg, { Path, Circle, Rect } from 'react-native-svg';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - 48;

// Custom Icons
const BriefcaseIcon = ({ color = '#fff', size = 32 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Rect x="2" y="7" width="20" height="14" rx="2" stroke={color} strokeWidth="2" />
    <Path d="M16 7V5C16 3.89543 15.1046 3 14 3H10C8.89543 3 8 3.89543 8 5V7" stroke={color} strokeWidth="2" />
    <Path d="M12 12V14" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <Path d="M2 12H22" stroke={color} strokeWidth="2" />
  </Svg>
);

const TruckIcon = ({ color = '#fff', size = 32 }: { color?: string; size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <Path d="M1 12H16V18H1V12Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <Path d="M16 8H20L23 11V18H16V8Z" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    <Circle cx="5.5" cy="18.5" r="2.5" stroke={color} strokeWidth="2" />
    <Circle cx="18.5" cy="18.5" r="2.5" stroke={color} strokeWidth="2" />
    <Path d="M1 8H10" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </Svg>
);

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RoleCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  gradientColors: readonly [string, string, ...string[]];
  delay: number;
  onPress: () => void;
  isDark: boolean;
}

function RoleCard({ title, description, icon, gradientColors, delay, onPress, isDark }: RoleCardProps) {
  const progress = useSharedValue(0);
  const pressed = useSharedValue(1);

  useEffect(() => {
    progress.value = withDelay(
      delay,
      withSpring(1, {
        damping: 15,
        stiffness: 100,
        mass: 1,
      })
    );
  }, [delay, progress]);

  const animatedContainerStyle = useAnimatedStyle(() => {
    const translateY = interpolate(progress.value, [0, 1], [60, 0], Extrapolation.CLAMP);
    const opacity = interpolate(progress.value, [0, 1], [0, 1], Extrapolation.CLAMP);
    const scale = pressed.value;

    return {
      transform: [{ translateY }, { scale }],
      opacity,
    };
  });

  const handlePressIn = () => {
    pressed.value = withSpring(0.96, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    pressed.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[styles.cardContainer, animatedContainerStyle]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.cardGradient}
      >
        {/* Decorative elements */}
        <View style={styles.decorativeCircle} />
        <View style={styles.decorativeCircle2} />

        <View style={styles.cardContent}>
          <View style={styles.iconContainer}>
            {icon}
          </View>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={styles.cardDescription}>{description}</Text>

          <View style={styles.arrowContainer}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M5 12H19M19 12L12 5M19 12L12 19"
                stroke="rgba(255,255,255,0.9)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </View>
      </LinearGradient>
    </AnimatedPressable>
  );
}

export default function RoleSelectionScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { setRole, isLoading, isAuthenticated, role } = useAuthStore();

  const titleOpacity = useSharedValue(0);
  const titleTranslateY = useSharedValue(-20);

  useEffect(() => {
    titleOpacity.value = withDelay(100, withTiming(1, { duration: 600 }));
    titleTranslateY.value = withDelay(100, withSpring(0, { damping: 15, stiffness: 100 }));
  }, [titleOpacity, titleTranslateY]);

  useEffect(() => {
    // 이미 인증된 경우 해당 화면으로 이동
    if (!isLoading && isAuthenticated && role) {
      if (role === 'admin') {
        router.replace('/(admin)');
      } else {
        router.replace('/(staff)');
      }
    }
  }, [isLoading, isAuthenticated, role, router]);

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleTranslateY.value }],
  }));

  const handleAdminPress = () => {
    setRole('admin');
    router.push('/(admin)/login');
  };

  const handleStaffPress = () => {
    setRole('staff');
    router.push('/(staff)/scan');
  };

  const bgColors = isDark ? ['#0a0a12', '#12121f', '#0a0a12'] as const : ['#f0f4f8', '#e8eef5', '#f0f4f8'] as const;

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a12' : '#f0f4f8' }]}>
        <View style={styles.loadingContainer}>
          <Text style={[styles.loadingText, { color: isDark ? '#666' : '#999' }]}>로딩 중...</Text>
        </View>
      </View>
    );
  }

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      {/* Background decoration */}
      <View style={[styles.bgPattern, { opacity: isDark ? 0.03 : 0.05 }]}>
        <View style={styles.gridLine} />
        <View style={[styles.gridLine, { top: '25%' }]} />
        <View style={[styles.gridLine, { top: '50%' }]} />
        <View style={[styles.gridLine, { top: '75%' }]} />
      </View>

      <View style={styles.content}>
        {/* Header */}
        <Animated.View style={[styles.header, titleAnimatedStyle]}>
          <View style={styles.logoContainer}>
            <LinearGradient
              colors={['#3b82f6', '#1d4ed8']}
              style={styles.logoBg}
            >
              <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 2L2 7L12 12L22 7L12 2Z"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <Path
                  d="M2 17L12 22L22 17"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <Path
                  d="M2 12L12 17L22 12"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </Svg>
            </LinearGradient>
          </View>
          <Text style={[styles.title, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            배송관리
          </Text>
          <Text style={[styles.subtitle, { color: isDark ? '#666680' : '#64748b' }]}>
            역할을 선택하세요
          </Text>
        </Animated.View>

        {/* Cards */}
        <View style={styles.cardsContainer}>
          <RoleCard
            title="관리자"
            description="Magic Link로 로그인하여 배송 데이터를 관리하세요"
            icon={<BriefcaseIcon color="#fff" size={36} />}
            gradientColors={['#3b82f6', '#1e40af', '#1e3a8a']}
            delay={200}
            onPress={handleAdminPress}
            isDark={isDark}
          />

          <RoleCard
            title="배송담당자"
            description="QR 코드를 스캔하여 배송을 시작하세요"
            icon={<TruckIcon color="#fff" size={36} />}
            gradientColors={['#10b981', '#059669', '#047857']}
            delay={350}
            onPress={handleStaffPress}
            isDark={isDark}
          />
        </View>

        {/* Footer */}
        <Animated.Text
          style={[
            styles.footer,
            { color: isDark ? '#444' : '#94a3b8' },
            titleAnimatedStyle,
          ]}
        >
          try-dabble.com
        </Animated.Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '500',
  },
  bgPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: '#3b82f6',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    marginBottom: 20,
  },
  logoBg: {
    width: 56,
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 0.5,
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 20,
    marginTop: -40,
  },
  cardContainer: {
    width: CARD_WIDTH,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  cardGradient: {
    borderRadius: 24,
    padding: 28,
    minHeight: 180,
    overflow: 'hidden',
    position: 'relative',
  },
  decorativeCircle: {
    position: 'absolute',
    top: -40,
    right: -40,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  decorativeCircle2: {
    position: 'absolute',
    bottom: -60,
    left: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  cardContent: {
    flex: 1,
    zIndex: 1,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    letterSpacing: -0.3,
  },
  cardDescription: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
    lineHeight: 22,
    fontWeight: '400',
  },
  arrowContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    textAlign: 'center',
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 1,
  },
});
