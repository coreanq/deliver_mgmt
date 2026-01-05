import { View, Pressable, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type CardVariant = 'default' | 'elevated' | 'outlined' | 'glass';

interface CardProps {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  delay?: number;
  animate?: boolean;
  animationDirection?: 'up' | 'down';
  style?: ViewStyle;
}

export function Card({
  children,
  variant = 'default',
  onPress,
  delay = 0,
  animate = true,
  animationDirection = 'down',
  style,
}: CardProps) {
  const { colors, radius, shadows, springs, isDark } = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    if (!onPress) return {};
    const scale = interpolate(pressed.value, [0, 1], [1, 0.98], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
  });

  const handlePressIn = () => {
    if (onPress) {
      pressed.value = withSpring(1, springs.snappy);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      pressed.value = withSpring(0, springs.snappy);
    }
  };

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.surfaceElevated,
          ...shadows.lg,
        };
      case 'outlined':
        return {
          backgroundColor: colors.surface,
          borderWidth: 1.5,
          borderColor: colors.border,
        };
      case 'glass':
        return {
          backgroundColor: isDark ? 'rgba(26, 31, 43, 0.8)' : 'rgba(255, 255, 255, 0.9)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
          ...shadows.lg,
        };
      default:
        return {
          backgroundColor: colors.surface,
          ...shadows.md,
        };
    }
  };

  const cardStyle: ViewStyle = {
    borderRadius: radius['2xl'],
    padding: 20,
    ...getVariantStyle(),
  };

  const EnteringAnimation = animationDirection === 'up' ? FadeInUp : FadeInDown;

  const content = (
    <Animated.View
      entering={animate ? EnteringAnimation.delay(delay).duration(400).springify() : undefined}
      style={[cardStyle, animatedStyle, style]}
    >
      {children}
    </Animated.View>
  );

  if (onPress) {
    return (
      <AnimatedPressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={animatedStyle}
      >
        <Animated.View
          entering={animate ? EnteringAnimation.delay(delay).duration(400).springify() : undefined}
          style={[cardStyle, style]}
        >
          {children}
        </Animated.View>
      </AnimatedPressable>
    );
  }

  return content;
}

// Card with gradient border
interface GradientCardProps {
  children: React.ReactNode;
  gradientColors?: [string, string];
  onPress?: () => void;
  delay?: number;
  animate?: boolean;
  style?: ViewStyle;
}

export function GradientCard({
  children,
  gradientColors,
  onPress,
  delay = 0,
  animate = true,
  style,
}: GradientCardProps) {
  const { colors, radius, shadows, springs } = useTheme();
  const pressed = useSharedValue(0);
  const gradient = gradientColors || colors.gradientPrimary;

  const animatedStyle = useAnimatedStyle(() => {
    if (!onPress) return {};
    const scale = interpolate(pressed.value, [0, 1], [1, 0.98], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
  });

  const handlePressIn = () => {
    if (onPress) {
      pressed.value = withSpring(1, springs.snappy);
    }
  };

  const handlePressOut = () => {
    if (onPress) {
      pressed.value = withSpring(0, springs.snappy);
    }
  };

  const content = (
    <Animated.View
      entering={animate ? FadeInDown.delay(delay).duration(400).springify() : undefined}
      style={[styles.gradientWrapper, shadows.lg, animatedStyle, style]}
    >
      <LinearGradient
        colors={gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.gradientBorder, { borderRadius: radius['2xl'] }]}
      >
        <View style={[styles.gradientInner, { backgroundColor: colors.surface, borderRadius: radius['2xl'] - 2 }]}>
          {children}
        </View>
      </LinearGradient>
    </Animated.View>
  );

  if (onPress) {
    return (
      <AnimatedPressable onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut}>
        {content}
      </AnimatedPressable>
    );
  }

  return content;
}

// Card Header
export function CardHeader({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.header, style]}>{children}</View>;
}

// Card Content
export function CardContent({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.content, style]}>{children}</View>;
}

// Card Footer with divider
export function CardFooter({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.footer, { borderTopColor: colors.divider }, style]}>
      {children}
    </View>
  );
}

// Stat Card - For displaying metrics
interface StatCardProps {
  value: string | number;
  label: string;
  color?: string;
  delay?: number;
}

export function StatCard({ value, label, color, delay = 0 }: StatCardProps) {
  const { colors, typography, radius, shadows } = useTheme();

  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={[
        styles.statCard,
        {
          backgroundColor: colors.surface,
          borderRadius: radius.xl,
        },
        shadows.sm,
      ]}
    >
      <Animated.Text
        style={[
          typography.metric,
          { color: color || colors.text },
        ]}
      >
        {value}
      </Animated.Text>
      <Animated.Text style={[typography.caption, { color: colors.textSecondary, marginTop: 4 }]}>
        {label}
      </Animated.Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 16,
  },
  content: {
    marginVertical: 8,
  },
  footer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  gradientWrapper: {
    overflow: 'hidden',
  },
  gradientBorder: {
    padding: 2,
  },
  gradientInner: {
    padding: 18,
  },
  statCard: {
    flex: 1,
    padding: 16,
    alignItems: 'center',
  },
});
