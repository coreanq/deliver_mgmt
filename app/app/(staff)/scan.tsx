import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { Button, Loading } from '../../src/components';
import { useTheme } from '../../src/theme';
import { logApi } from '../../src/services/api';
import type { QRScanData } from '../../src/types';

export default function QRScanScreen() {
  const router = useRouter();
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { isAuthenticated, state } = useAuthStore();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [scanData, setScanData] = useState<QRScanData | null>(null);

  useEffect(() => {
    if (isAuthenticated && state === 'authenticated') {
      router.replace('/(staff)');
    }
  }, [isAuthenticated, state, router]);

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scanned) return;
    
    logApi.send({ 
      event: 'QR_SCAN_START', 
      rawData: result.data?.substring(0, 100),
      timestamp: new Date().toISOString(),
    });
    
    try {
      const data = JSON.parse(result.data) as QRScanData;
      
      logApi.send({ 
        event: 'QR_SCAN_PARSED', 
        hasToken: !!data.token,
        hasDate: !!data.date,
        date: data.date,
      });
      
      if (data.token && data.date) {
        setScanned(true);
        setScanData(data);
        
        logApi.send({ 
          event: 'QR_SCAN_NAVIGATING', 
          to: '/(staff)/verify',
          token: data.token.substring(0, 10) + '...',
          date: data.date,
        });
        
        router.push({
          pathname: '/(staff)/verify',
          params: { token: data.token, date: data.date },
        });
      } else {
        logApi.send({ event: 'QR_SCAN_INVALID', reason: 'missing_token_or_date' });
        Alert.alert('오류', '유효하지 않은 QR 코드입니다.');
      }
    } catch (error) {
      logApi.send({ 
        event: 'QR_SCAN_ERROR', 
        error: error instanceof Error ? error.message : String(error),
        rawData: result.data?.substring(0, 50),
      });
      Alert.alert('오류', 'QR 코드를 인식할 수 없습니다.');
    }
  };

  const handleBack = () => {
    router.back();
  };

  const handleRescan = () => {
    setScanned(false);
    setScanData(null);
  };

  if (!permission) {
    return <Loading fullScreen message="카메라 권한 확인 중..." />;
  }

  if (!permission.granted) {
    return (
      <View style={[
        styles.container, 
        { 
          backgroundColor: colors.background,
          paddingTop: insets.top + 20,
        }
      ]}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.permissionContainer}>
          <Text style={styles.permissionEmoji}>📷</Text>
          <Text style={[styles.permissionTitle, { color: colors.text }]}>
            카메라 권한이 필요합니다
          </Text>
          <Text style={[styles.permissionDescription, { color: colors.textSecondary }]}>
            QR 코드를 스캔하려면 카메라 권한을 허용해주세요
          </Text>
          <Button title="권한 허용하기" onPress={requestPermission} style={styles.permissionButton} />
          <Button title="뒤로 가기" onPress={handleBack} variant="ghost" />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['qr'],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      <View style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.header}>
          <Pressable onPress={handleBack} style={styles.backButton}>
            <Text style={styles.backText}>← 뒤로</Text>
          </Pressable>
          <Text style={styles.title}>QR 코드 스캔</Text>
          <View style={styles.placeholder} />
        </Animated.View>

        <View style={styles.scanArea}>
          <View style={styles.scanFrame}>
            <View style={[styles.corner, styles.topLeft, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.topRight, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.bottomLeft, { borderColor: colors.primary }]} />
            <View style={[styles.corner, styles.bottomRight, { borderColor: colors.primary }]} />
          </View>
        </View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.footer}>
          <Text style={styles.instruction}>
            관리자가 보여주는 QR 코드를{'\n'}화면 중앙에 맞춰주세요
          </Text>
          
          {scanned && (
            <Button 
              title="다시 스캔하기" 
              onPress={handleRescan} 
              variant="secondary"
              style={styles.rescanButton}
            />
          )}
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 60,
  },
  scanArea: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanFrame: {
    width: 280,
    height: 280,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
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
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  instruction: {
    color: '#ffffff',
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  rescanButton: {
    paddingHorizontal: 32,
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  permissionEmoji: {
    fontSize: 64,
    marginBottom: 24,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  permissionDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  permissionButton: {
    marginBottom: 16,
    paddingHorizontal: 48,
  },
});
