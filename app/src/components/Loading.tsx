import { View, Text, StyleSheet, ViewStyle, DimensionValue } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  SharedValue,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme } from '../theme';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

// Animated loading dots
function LoadingDots() {
  const { colors } = useTheme();
  const dot1 = useSharedValue(0);
  const dot2 = useSharedValue(0);
  const dot3 = useSharedValue(0);

  useEffect(() => {
    const animate = (sharedValue: SharedValue<number>, delay: number) => {
      sharedValue.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(1, { duration: 300, easing: Easing.ease }),
            withTiming(0, { duration: 300, easing: Easing.ease })
          ),
          -1,
          false
        )
      );
    };

    animate(dot1, 0);
    animate(dot2, 150);
    animate(dot3, 300);
  }, []);

  const createDotStyle = (animation: SharedValue<number>) =>
    useAnimatedStyle(() => ({
      opacity: 0.4 + animation.value * 0.6,
      transform: [{ scale: 0.8 + animation.value * 0.4 }],
    }));

  const dot1Style = createDotStyle(dot1);
  const dot2Style = createDotStyle(dot2);
  const dot3Style = createDotStyle(dot3);

  return (
    <View style={styles.dotsContainer}>
      <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dot1Style]} />
      <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dot2Style]} />
      <Animated.View style={[styles.dot, { backgroundColor: colors.primary }, dot3Style]} />
    </View>
  );
}

// Pulsing ring indicator
function PulsingRing({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  const sizeValue = size === 'sm' ? 32 : size === 'lg' ? 64 : 48;

  useEffect(() => {
    scale.value = withRepeat(
      withTiming(1.5, { duration: 1000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
    opacity.value = withRepeat(
      withTiming(0, { duration: 1000, easing: Easing.out(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={[styles.pulsingContainer, { width: sizeValue * 2, height: sizeValue * 2 }]}>
      <Animated.View
        style={[
          styles.pulsingRing,
          {
            width: sizeValue,
            height: sizeValue,
            borderRadius: sizeValue / 2,
            borderColor: colors.primary,
          },
          ringStyle,
        ]}
      />
      <View
        style={[
          styles.pulsingCore,
          {
            width: sizeValue * 0.4,
            height: sizeValue * 0.4,
            borderRadius: sizeValue * 0.2,
            backgroundColor: colors.primary,
          },
        ]}
      />
    </View>
  );
}

export function Loading({ message, fullScreen = false, size = 'md' }: LoadingProps) {
  const { colors, typography } = useTheme();

  const content = (
    <View style={styles.container}>
      <PulsingRing size={size} />
      {message && (
        <Text style={[typography.body, { color: colors.textSecondary, marginTop: 20 }]}>
          {message}
        </Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <Animated.View
        entering={FadeIn.duration(200)}
        exiting={FadeOut.duration(200)}
        style={[styles.fullScreen, { backgroundColor: colors.background }]}
      >
        {content}
      </Animated.View>
    );
  }

  return content;
}

// Loading Overlay with blur effect
export function LoadingOverlay({ message }: { message?: string }) {
  const { colors, radius, shadows, typography } = useTheme();

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(200)}
      style={[styles.overlay, { backgroundColor: colors.overlay }]}
    >
      <Animated.View
        style={[
          styles.overlayContent,
          {
            backgroundColor: colors.surface,
            borderRadius: radius['2xl'],
          },
          shadows.xl,
        ]}
      >
        <LoadingDots />
        {message && (
          <Text style={[typography.body, { color: colors.text, marginTop: 16 }]}>
            {message}
          </Text>
        )}
      </Animated.View>
    </Animated.View>
  );
}

// Skeleton loading placeholder
interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
}

export function Skeleton({ width = '100%', height = 20, borderRadius, style }: SkeletonProps) {
  const { colors, radius } = useTheme();
  const opacity = useSharedValue(0.3);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.3, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: borderRadius ?? radius.md,
          backgroundColor: colors.surfaceElevated,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  fullScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  overlayContent: {
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pulsingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingRing: {
    position: 'absolute',
    borderWidth: 3,
  },
  pulsingCore: {
    position: 'absolute',
  },
});
