import { Pressable, Text, ActivityIndicator, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
  Extrapolation,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const AnimatedLinearGradient = Animated.createAnimatedComponent(LinearGradient);

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  style,
  textStyle,
}: ButtonProps) {
  const { colors, radius, shadows, springs, typography } = useTheme();
  const pressed = useSharedValue(0);

  const animatedContainerStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 0.96], Extrapolation.CLAMP);
    const translateY = interpolate(pressed.value, [0, 1], [0, 1], Extrapolation.CLAMP);

    return {
      transform: [{ scale }, { translateY }],
    };
  });

  const handlePressIn = () => {
    pressed.value = withSpring(1, springs.snappy);
  };

  const handlePressOut = () => {
    pressed.value = withSpring(0, springs.snappy);
  };

  const getVariantColors = () => {
    switch (variant) {
      case 'primary':
        return {
          gradient: colors.gradientPrimary,
          text: colors.textInverse,
          border: 'transparent',
        };
      case 'secondary':
        return {
          gradient: [colors.surfaceElevated, colors.surfaceElevated] as [string, string],
          text: colors.text,
          border: colors.border,
        };
      case 'outline':
        return {
          gradient: ['transparent', 'transparent'] as [string, string],
          text: colors.primary,
          border: colors.primary,
        };
      case 'ghost':
        return {
          gradient: ['transparent', 'transparent'] as [string, string],
          text: colors.text,
          border: 'transparent',
        };
      case 'danger':
        return {
          gradient: [colors.error, colors.errorDark] as [string, string],
          text: colors.textInverse,
          border: 'transparent',
        };
      case 'success':
        return {
          gradient: [colors.success, colors.successDark] as [string, string],
          text: colors.textInverse,
          border: 'transparent',
        };
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {
          paddingVertical: 10,
          paddingHorizontal: 16,
          textStyle: typography.buttonSmall,
          borderRadius: radius.md,
        };
      case 'lg':
        return {
          paddingVertical: 18,
          paddingHorizontal: 28,
          textStyle: typography.buttonLarge,
          borderRadius: radius.xl,
        };
      default:
        return {
          paddingVertical: 14,
          paddingHorizontal: 22,
          textStyle: typography.button,
          borderRadius: radius.lg,
        };
    }
  };

  const variantColors = getVariantColors();
  const sizeStyles = getSizeStyles();
  const isDisabled = disabled || loading;

  const containerStyle: ViewStyle = {
    borderRadius: sizeStyles.borderRadius,
    borderWidth: variant === 'outline' || variant === 'secondary' ? 1.5 : 0,
    borderColor: variantColors.border,
    overflow: 'hidden',
    alignSelf: fullWidth ? 'stretch' : 'center',
    ...(variant === 'primary' || variant === 'danger' || variant === 'success' ? shadows.md : {}),
  };

  const gradientStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: sizeStyles.paddingVertical,
    paddingHorizontal: sizeStyles.paddingHorizontal,
    gap: 8,
  };

  const buttonTextStyle: TextStyle = {
    ...sizeStyles.textStyle,
    color: isDisabled ? colors.textMuted : variantColors.text,
  };

  const content = (
    <>
      {loading ? (
        <ActivityIndicator color={variantColors.text} size="small" />
      ) : (
        <>
          {icon && iconPosition === 'left' && icon}
          <Text style={[buttonTextStyle, textStyle]}>{title}</Text>
          {icon && iconPosition === 'right' && icon}
        </>
      )}
    </>
  );

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={isDisabled}
      style={[containerStyle, animatedContainerStyle, isDisabled && styles.disabled, style]}
    >
      <LinearGradient
        colors={variantColors.gradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={gradientStyle}
      >
        {content}
      </LinearGradient>
    </AnimatedPressable>
  );
}

// Icon Button - Circular button with icon
interface IconButtonProps {
  icon: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: ButtonSize;
  disabled?: boolean;
  style?: ViewStyle;
}

export function IconButton({
  icon,
  onPress,
  variant = 'ghost',
  size = 'md',
  disabled = false,
  style,
}: IconButtonProps) {
  const { colors, radius, shadows, springs } = useTheme();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => {
    const scale = interpolate(pressed.value, [0, 1], [1, 0.9], Extrapolation.CLAMP);
    return { transform: [{ scale }] };
  });

  const handlePressIn = () => {
    pressed.value = withSpring(1, springs.snappy);
  };

  const handlePressOut = () => {
    pressed.value = withSpring(0, springs.snappy);
  };

  const getSizeValue = () => {
    switch (size) {
      case 'sm': return 36;
      case 'lg': return 56;
      default: return 44;
    }
  };

  const sizeValue = getSizeValue();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'primary':
        return {
          backgroundColor: colors.primary,
          ...shadows.sm,
        };
      case 'secondary':
        return {
          backgroundColor: colors.surfaceElevated,
          borderWidth: 1,
          borderColor: colors.border,
        };
      default:
        return {
          backgroundColor: 'transparent',
        };
    }
  };

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        {
          width: sizeValue,
          height: sizeValue,
          borderRadius: radius.full,
          alignItems: 'center',
          justifyContent: 'center',
        },
        getVariantStyle(),
        animatedStyle,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon}
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  disabled: {
    opacity: 0.5,
  },
});
