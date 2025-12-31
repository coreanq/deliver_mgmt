import { useState, useEffect } from 'react';
import { View, Text, Pressable, useColorScheme, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  FadeIn,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

export default function StaffScanScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { loginStaff } = useAuthStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Scanning animation
  const scanLineY = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  useEffect(() => {
    scanLineY.value = withRepeat(
      withTiming(200, { duration: 2000 }),
      -1,
      true
    );
    pulseScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  const scanLineStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scanLineY.value }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const handleBarCodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isProcessing) return;

    setScanned(true);
    setIsProcessing(true);

    try {
      const result = await api.verifyQR(data);

      if (result.success && result.data) {
        // Store staff info temporarily for verification
        api.setToken(result.data.token);
        router.push({
          pathname: '/(staff)/verify',
          params: {
            staffName: result.data.staff.name,
            token: result.data.token,
            adminId: result.data.staff.adminId,
          },
        });
      } else {
        Alert.alert('오류', result.error || 'QR 코드가 유효하지 않습니다.', [
          { text: '다시 스캔', onPress: () => setScanned(false) },
        ]);
      }
    } catch (error) {
      Alert.alert('오류', 'QR 코드 검증에 실패했습니다.', [
        { text: '다시 스캔', onPress: () => setScanned(false) },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a12' : '#f0f4f8' }]}>
        <Text style={[styles.permissionText, { color: isDark ? '#666' : '#64748b' }]}>
          카메라 권한을 확인하는 중...
        </Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient
        colors={isDark ? ['#0a0a12', '#12121f'] : ['#f0f4f8', '#e8eef5']}
        style={styles.container}
      >
        <View style={styles.permissionContainer}>
          <Animated.View entering={FadeIn.delay(100).springify()} style={styles.permissionIcon}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.iconGradient}
            >
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <Path
                  d="M12 17a4 4 0 100-8 4 4 0 000 8z"
                  stroke="#fff"
                  strokeWidth="2"
                />
              </Svg>
            </LinearGradient>
          </Animated.View>

          <Animated.Text
            entering={FadeIn.delay(200).springify()}
            style={[styles.permissionTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}
          >
            카메라 권한이 필요합니다
          </Animated.Text>

          <Animated.Text
            entering={FadeIn.delay(300).springify()}
            style={[styles.permissionDesc, { color: isDark ? '#666' : '#64748b' }]}
          >
            QR 코드를 스캔하려면{'\n'}카메라 접근 권한을 허용해주세요.
          </Animated.Text>

          <Animated.View entering={FadeIn.delay(400).springify()}>
            <Pressable onPress={requestPermission}>
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.permissionButton}
              >
                <Text style={styles.permissionButtonText}>권한 허용하기</Text>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        </View>

        {/* Back Button */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backButtonInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 12H5M5 12L12 19M5 12L12 5"
                stroke={isDark ? '#fff' : '#1a1a2e'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </Pressable>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* Overlay */}
      <View style={styles.overlay}>
        {/* Top */}
        <View style={styles.overlayTop}>
          <Pressable style={styles.backButton} onPress={() => router.back()}>
            <View style={styles.backButtonDark}>
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M19 12H5M5 12L12 19M5 12L12 5"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            </View>
          </Pressable>
        </View>

        {/* Center with Scanner Frame */}
        <View style={styles.overlayCenterRow}>
          <View style={styles.overlaySide} />
          <Animated.View style={[styles.scannerFrame, pulseStyle]}>
            {/* Corner Decorations */}
            <View style={[styles.corner, styles.cornerTL]} />
            <View style={[styles.corner, styles.cornerTR]} />
            <View style={[styles.corner, styles.cornerBL]} />
            <View style={[styles.corner, styles.cornerBR]} />

            {/* Scan Line */}
            <Animated.View style={[styles.scanLine, scanLineStyle]}>
              <LinearGradient
                colors={['transparent', '#10b981', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.scanLineGradient}
              />
            </Animated.View>
          </Animated.View>
          <View style={styles.overlaySide} />
        </View>

        {/* Bottom */}
        <View style={styles.overlayBottom}>
          <View style={styles.instructionContainer}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Rect x="3" y="3" width="7" height="7" rx="1" stroke="#fff" strokeWidth="1.5" />
              <Rect x="14" y="3" width="7" height="7" rx="1" stroke="#fff" strokeWidth="1.5" />
              <Rect x="3" y="14" width="7" height="7" rx="1" stroke="#fff" strokeWidth="1.5" />
              <Rect x="14" y="14" width="7" height="7" rx="1" stroke="#fff" strokeWidth="1.5" />
            </Svg>
            <Text style={styles.instructionText}>
              관리자가 제공한 QR 코드를{'\n'}프레임 안에 맞춰주세요
            </Text>
          </View>

          {isProcessing && (
            <View style={styles.processingContainer}>
              <Text style={styles.processingText}>검증 중...</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionIcon: {
    marginBottom: 24,
  },
  iconGradient: {
    width: 80,
    height: 80,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionDesc: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 16,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  permissionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonDark: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  overlayTop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayCenterRow: {
    flexDirection: 'row',
  },
  overlaySide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#10b981',
    borderWidth: 4,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 12,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 12,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 12,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 12,
  },
  scanLine: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 3,
  },
  scanLineGradient: {
    flex: 1,
    borderRadius: 2,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    paddingTop: 40,
  },
  instructionContainer: {
    alignItems: 'center',
    gap: 12,
  },
  instructionText: {
    color: '#fff',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    opacity: 0.9,
  },
  processingContainer: {
    marginTop: 24,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  processingText: {
    color: '#10b981',
    fontSize: 15,
    fontWeight: '600',
  },
});
