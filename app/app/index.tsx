import { View, Text, StyleSheet, Image, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  FadeInDown, 
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useAuthStore } from '../src/stores/auth';
import { VersionInfo } from '../src/components';
import { useTheme } from '../src/theme';
import { useEffect } from 'react';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface RoleCardProps {
  title: string;
  description: string;
  icon: string;
  onPress: () => void;
  delay: number;
  accentColor: string;
}

function RoleCard({ title, description, icon, onPress, delay, accentColor }: RoleCardProps) {
  const { colors, radius, shadows } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.97, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={[
        styles.card,
        { 
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
        },
        shadows.lg,
        animatedStyle,
      ]}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <View style={[styles.iconContainer, { backgroundColor: accentColor }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.cardContent}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.cardDescription, { color: colors.textSecondary }]}>
          {description}
        </Text>
      </View>
      <View style={styles.arrowContainer}>
        <Text style={[styles.arrow, { color: colors.textTertiary }]}>
          →
        </Text>
      </View>
    </AnimatedPressable>
  );
}

export default function RoleSelectionScreen() {
  const router = useRouter();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { selectRole, isAuthenticated, role, state } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && state === 'authenticated') {
      if (role === 'admin') {
        router.replace('/(admin)');
      } else if (role === 'staff') {
        router.replace('/(staff)');
      }
    }
  }, [isAuthenticated, role, state, router]);

  const handleSelectAdmin = () => {
    selectRole('admin');
    router.push('/(admin)/login');
  };

  const handleSelectStaff = () => {
    selectRole('staff');
    router.push('/(staff)/scan');
  };

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: colors.background,
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 20,
      }
    ]}>
      <Animated.View 
        entering={FadeInUp.delay(100).duration(400)}
        style={styles.header}
      >
        <View style={[styles.logoContainer, { borderRadius: radius['2xl'] }]}>
          <Image 
            source={require('../assets/icon.png')} 
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>
          배매니저
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          배송 관리를 더 쉽고 빠르게
        </Text>
      </Animated.View>

      <View style={styles.cardsContainer}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>
          역할을 선택하세요
        </Text>

        <RoleCard
          title="관리자"
          description="배송 데이터 관리, QR 코드 생성"
          icon="👔"
          onPress={handleSelectAdmin}
          delay={200}
          accentColor={colors.primary}
        />

        <RoleCard
          title="배송담당자"
          description="QR 스캔으로 오늘 배송 확인"
          icon="🚚"
          onPress={handleSelectStaff}
          delay={300}
          accentColor={colors.success}
        />
      </View>

      <Animated.View 
        entering={FadeInUp.delay(400).duration(400)}
        style={styles.footer}
      >
        <Text style={[styles.footerText, { color: colors.textTertiary }]}>
          PC에서 엑셀 업로드는 웹에서 진행하세요
        </Text>
        <VersionInfo />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
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
    width: 80,
    height: 80,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
  },
  cardsContainer: {
    flex: 1,
    justifyContent: 'center',
    gap: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 28,
  },
  cardContent: {
    flex: 1,
    marginLeft: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 14,
  },
  arrowContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow: {
    fontSize: 20,
    fontWeight: '300',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 13,
    marginBottom: 8,
  },
});
