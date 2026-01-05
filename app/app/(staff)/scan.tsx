import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { Button, Loading } from '../../src/components';
import { useTheme } from '../../src/theme';
import type { QRScanData } from '../../src/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Floating orb for permission screen
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

function ScanFrame() {
  const { colors } = useTheme();
  const scanLineY = useSharedValue(0);

  useEffect(() => {
    scanLineY.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    top: `${scanLineY.value * 100}%`,
  }));

  return (
    <View style={styles.scanFrame}>
      {/* Corners */}
      <View style={[styles.corner, styles.topLeft, { borderColor: colors.accent }]} />
      <View style={[styles.corner, styles.topRight, { borderColor: colors.accent }]} />
      <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.accent }]} />
      <View style={[styles.corner, styles.bottomRight, { borderColor: colors.accent }]} />

      {/* Scan line */}
      <Animated.View style={[styles.scanLine, scanLineStyle]}>
        <LinearGradient
          colors={['transparent', colors.accent, 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.scanLineGradient}
        />
      </Animated.View>
    </View>
  );
}

export default function QRScanScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const rootNavigation = navigation.getParent();
  const { colors, radius, typography, isDark, springs } = useTheme();
  const insets = useSafeAreaInsets();

  const { isAuthenticated, state, logout } = useAuthStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const backScale = useSharedValue(1);

  useEffect(() => {
    if (isAuthenticated && state === 'authenticated') {
      router.replace('/(staff)');
    }
  }, [isAuthenticated, state, router]);

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned) return;

    try {
      const data = JSON.parse(result.data) as QRScanData;

      if (data.token && data.date) {
        setScanned(true);
        router.push({
          pathname: '/(staff)/verify',
          params: { token: data.token, date: data.date },
        });
      } else {
        Alert.alert('오류', '유효하지 않은 QR 코드입니다.');
      }
    } catch (error) {
      Alert.alert('오류', 'QR 코드를 인식할 수 없습니다.');
    }
  };

  const handleBack = () => {
    rootNavigation?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'index' }],
      })
    );
    setTimeout(() => logout(), 100);
  };

  const handleRescan = () => {
    setScanned(false);
  };

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  if (!permission) {
    return <Loading fullScreen message="카메라 권한 확인 중..." />;
  }

  if (!permission.granted) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Background orbs */}
        <View style={styles.orbContainer} pointerEvents="none">
          <FloatingOrb color={colors.accent} size={180} initialX={-15} initialY={10} delay={0} />
          <FloatingOrb color={colors.primary} size={120} initialX={70} initialY={60} delay={300} />
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

        <View style={[styles.permissionContent, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.permissionBox}>
            <View
              style={[
                styles.permissionIcon,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text style={{ fontSize: 44 }}>📷</Text>
            </View>
            <Text
              style={[
                typography.h2,
                { color: colors.text, marginTop: 28, fontSize: 26, letterSpacing: -0.5 },
              ]}
            >
              카메라 권한 필요
            </Text>
            <Text
              style={[
                typography.body,
                { color: colors.textSecondary, marginTop: 12, textAlign: 'center', lineHeight: 24 },
              ]}
            >
              QR 코드를 스캔하려면{'\n'}카메라 권한을 허용해주세요
            </Text>
            <View style={{ marginTop: 36, gap: 12, width: '100%' }}>
              <Button title="권한 허용하기" onPress={requestPermission} size="lg" fullWidth />
              <Button title="뒤로 가기" onPress={handleBack} variant="ghost" />
            </View>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <LinearGradient
        colors={['rgba(12, 15, 20, 0.85)', 'rgba(12, 15, 20, 0.3)', 'rgba(12, 15, 20, 0.85)']}
        locations={[0, 0.5, 1]}
        style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.header}>
          <AnimatedPressable
            style={[
              styles.backButton,
              { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg },
              backAnimatedStyle,
            ]}
            onPress={handleBack}
            onPressIn={() => { backScale.value = withSpring(0.95, springs.snappy); }}
            onPressOut={() => { backScale.value = withSpring(1, springs.snappy); }}
          >
            <Text style={styles.backIcon}>←</Text>
          </AnimatedPressable>
          <Text style={[typography.h3, { color: '#FFFFFF', letterSpacing: -0.5 }]}>QR 스캔</Text>
          <View style={{ width: 44 }} />
        </Animated.View>

        {/* Scan Area */}
        <View style={styles.scanArea}>
          <ScanFrame />
        </View>

        {/* Footer */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} style={styles.footer}>
          <View
            style={[
              styles.instructionCard,
              {
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: radius.xl,
              },
            ]}
          >
            <Text style={[typography.body, { color: 'rgba(255,255,255,0.9)', textAlign: 'center', lineHeight: 24 }]}>
              관리자가 보여주는 QR 코드를{'\n'}프레임 안에 맞춰주세요
            </Text>
          </View>

          {scanned && (
            <Button
              title="다시 스캔하기"
              onPress={handleRescan}
              variant="secondary"
            />
          )}
        </Animated.View>
      </LinearGradient>
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
  permissionContent: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  permissionBox: {
    alignItems: 'center',
  },
  permissionIcon: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 260,
    height: 260,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 36,
    height: 36,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    left: 8,
    right: 8,
    height: 2,
  },
  scanLineGradient: {
    flex: 1,
  },
  footer: {
    alignItems: 'center',
    gap: 20,
    paddingVertical: 24,
  },
  instructionCard: {
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
});
