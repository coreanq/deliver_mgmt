import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect } from 'react';
import { useTheme } from '../theme';
import type { DeliveryStatus } from '../types';

interface StatusBadgeProps {
  status: DeliveryStatus;
  size?: 'sm' | 'md' | 'lg';
  showPulse?: boolean;
}

interface StatusConfig {
  label: string;
  bgColor: string;
  textColor: string;
  icon: string;
}

export function StatusBadge({ status, size = 'md', showPulse = false }: StatusBadgeProps) {
  const { colors, radius, typography } = useTheme();
  const pulseOpacity = useSharedValue(1);

  useEffect(() => {
    if (showPulse && status === 'in_transit') {
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );
    }
  }, [showPulse, status]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  const getStatusConfig = (): StatusConfig => {
    switch (status) {
      case 'pending':
        return {
          label: '준비',
          bgColor: colors.statusPendingBg,
          textColor: colors.statusPending,
          icon: '○',
        };
      case 'in_transit':
        return {
          label: '배송중',
          bgColor: colors.statusInTransitBg,
          textColor: colors.statusInTransit,
          icon: '→',
        };
      case 'completed':
        return {
          label: '완료',
          bgColor: colors.statusCompletedBg,
          textColor: colors.statusCompleted,
          icon: '✓',
        };
      default:
        return {
          label: status,
          bgColor: colors.surfaceElevated,
          textColor: colors.textSecondary,
          icon: '•',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingHorizontal: 8,
          paddingVertical: 4,
          fontSize: typography.caption.fontSize,
          iconSize: 10,
        };
      case 'lg':
        return {
          paddingHorizontal: 16,
          paddingVertical: 8,
          fontSize: typography.body.fontSize,
          iconSize: 16,
        };
      default:
        return {
          paddingHorizontal: 12,
          paddingVertical: 6,
          fontSize: typography.bodySmall.fontSize,
          iconSize: 12,
        };
    }
  };

  const config = getStatusConfig();
  const sizeStyles = getSizeStyles();

  return (
    <Animated.View
      style={[
        styles.badge,
        {
          backgroundColor: config.bgColor,
          borderRadius: radius.full,
          paddingHorizontal: sizeStyles.paddingHorizontal,
          paddingVertical: sizeStyles.paddingVertical,
        },
        showPulse && status === 'in_transit' && pulseStyle,
      ]}
    >
      <Text
        style={[
          styles.icon,
          {
            color: config.textColor,
            fontSize: sizeStyles.iconSize,
          },
        ]}
      >
        {config.icon}
      </Text>
      <Text
        style={[
          styles.text,
          {
            color: config.textColor,
            fontSize: sizeStyles.fontSize,
          },
        ]}
      >
        {config.label}
      </Text>
    </Animated.View>
  );
}

// Compact status indicator (dot only)
interface StatusDotProps {
  status: DeliveryStatus;
  size?: 'sm' | 'md' | 'lg';
  pulse?: boolean;
}

export function StatusDot({ status, size = 'md', pulse = false }: StatusDotProps) {
  const { colors } = useTheme();
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    if (pulse) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.4, { duration: 600, easing: Easing.out(Easing.ease) }),
          withTiming(1, { duration: 600, easing: Easing.in(Easing.ease) })
        ),
        -1,
        false
      );
    }
  }, [pulse]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const getColor = () => {
    switch (status) {
      case 'pending': return colors.statusPending;
      case 'in_transit': return colors.statusInTransit;
      case 'completed': return colors.statusCompleted;
      default: return colors.textMuted;
    }
  };

  const getSizeValue = () => {
    switch (size) {
      case 'sm': return 8;
      case 'lg': return 14;
      default: return 10;
    }
  };

  const dotSize = getSizeValue();

  return (
    <View style={styles.dotContainer}>
      {pulse && (
        <Animated.View
          style={[
            styles.dotPulse,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              backgroundColor: getColor(),
            },
            animatedStyle,
          ]}
        />
      )}
      <View
        style={[
          styles.dot,
          {
            width: dotSize,
            height: dotSize,
            borderRadius: dotSize / 2,
            backgroundColor: getColor(),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 4,
  },
  icon: {
    fontWeight: '700',
  },
  text: {
    fontWeight: '600',
  },
  dotContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotPulse: {
    position: 'absolute',
    opacity: 0.3,
  },
  dot: {},
});
