import { View, StyleSheet, ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  delay?: number;
  animate?: boolean;
  variant?: 'default' | 'outlined';
}

export function Card({ 
  children, 
  style, 
  delay = 0, 
  animate = true,
  variant = 'default',
}: CardProps) {
  const { colors, radius, shadows } = useTheme();

  const cardStyle: ViewStyle = {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: 16,
    ...(variant === 'outlined' 
      ? { borderWidth: 1, borderColor: colors.border }
      : shadows.lg
    ),
  };

  if (animate) {
    return (
      <Animated.View 
        entering={FadeInDown.delay(delay).duration(350).springify()}
        style={[cardStyle, style]}
      >
        {children}
      </Animated.View>
    );
  }

  return (
    <View style={[cardStyle, style]}>
      {children}
    </View>
  );
}

export function CardHeader({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.header, style]}>
      {children}
    </View>
  );
}

export function CardContent({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.content, style]}>
      {children}
    </View>
  );
}

export function CardFooter({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();

  return (
    <View 
      style={[
        styles.footer, 
        { borderTopColor: colors.borderLight },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: 12,
  },
  content: {
    marginVertical: 8,
  },
  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
});
