import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useTheme } from '../theme';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
}

export function Loading({ message, fullScreen = false }: LoadingProps) {
  const { colors } = useTheme();

  const content = (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      {message && (
        <Text style={[styles.message, { color: colors.textSecondary }]}>
          {message}
        </Text>
      )}
    </View>
  );

  if (fullScreen) {
    return (
      <Animated.View 
        entering={FadeIn.duration(200)}
        style={[styles.fullScreen, { backgroundColor: colors.background }]}
      >
        {content}
      </Animated.View>
    );
  }

  return content;
}

export function LoadingOverlay({ message }: { message?: string }) {
  const { colors, radius, shadows } = useTheme();

  return (
    <Animated.View 
      entering={FadeIn.duration(200)}
      style={[styles.overlay, { backgroundColor: colors.overlay }]}
    >
      <View 
        style={[
          styles.overlayContent, 
          { 
            backgroundColor: colors.surface,
            borderRadius: radius.xl,
          },
          shadows.xl,
        ]}
      >
        <ActivityIndicator size="large" color={colors.primary} />
        {message && (
          <Text style={[styles.overlayMessage, { color: colors.text }]}>
            {message}
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
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
  },
  overlayMessage: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
  },
});
