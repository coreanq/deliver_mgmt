import { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  useColorScheme,
  StyleSheet,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { api } from '@/services/api';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function CompleteDeliveryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{
    deliveryId: string;
    recipientPhone: string;
    recipientName: string;
  }>();

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [step, setStep] = useState<'camera' | 'preview' | 'complete'>('camera');

  const buttonScale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const takePhoto = async () => {
    if (!cameraRef.current || isCapturing) return;

    setIsCapturing(true);
    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (result?.base64) {
        setPhoto(`data:image/jpeg;base64,${result.base64}`);
        setStep('preview');
      }
    } catch (error) {
      Alert.alert('오류', '사진 촬영에 실패했습니다.');
    } finally {
      setIsCapturing(false);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0]?.base64) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setStep('preview');
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    setStep('camera');
  };

  const completeDelivery = async () => {
    if (!photo || !params.deliveryId) return;

    setIsUploading(true);
    try {
      const result = await api.completeDelivery(params.deliveryId, photo);

      if (result.success) {
        setStep('complete');
      } else {
        Alert.alert('오류', result.error || '완료 처리에 실패했습니다.');
      }
    } catch (error) {
      Alert.alert('오류', '완료 처리에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const sendSMS = () => {
    const message = `[배송완료] ${params.recipientName}님, 배송이 완료되었습니다. 감사합니다.`;
    const url = `sms:${params.recipientPhone}?body=${encodeURIComponent(message)}`;
    Linking.openURL(url);
  };

  const goBack = () => {
    router.replace('/(staff)');
  };

  const bgColors = isDark ? ['#0a0a12', '#12121f'] as const : ['#f0f4f8', '#e8eef5'] as const;

  if (!permission) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#0a0a12' : '#f0f4f8' }]}>
        <Text style={{ color: isDark ? '#666' : '#64748b' }}>권한 확인 중...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <LinearGradient colors={bgColors} style={styles.container}>
        <View style={styles.permissionContainer}>
          <Pressable onPress={requestPermission}>
            <LinearGradient colors={['#10b981', '#059669']} style={styles.permissionButton}>
              <Text style={styles.permissionButtonText}>카메라 권한 허용</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  if (step === 'complete') {
    return (
      <LinearGradient colors={bgColors} style={styles.container}>
        <Animated.View entering={FadeIn.springify()} style={styles.completeContainer}>
          <LinearGradient colors={['#10b981', '#059669']} style={styles.completeIcon}>
            <Svg width={48} height={48} viewBox="0 0 24 24" fill="none">
              <Path
                d="M20 6L9 17l-5-5"
                stroke="#fff"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </LinearGradient>

          <Text style={[styles.completeTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            배송 완료!
          </Text>
          <Text style={[styles.completeSubtitle, { color: isDark ? '#666' : '#64748b' }]}>
            {params.recipientName}님께 배송이 완료되었습니다.
          </Text>

          <View style={styles.completeActions}>
            <Pressable onPress={sendSMS}>
              <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.smsButton}>
                <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.smsButtonText}>SMS 보내기</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={goBack}
              style={[styles.backToListButton, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
            >
              <Text style={[styles.backToListText, { color: isDark ? '#fff' : '#1a1a2e' }]}>
                목록으로 돌아가기
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </LinearGradient>
    );
  }

  if (step === 'preview' && photo) {
    return (
      <LinearGradient colors={bgColors} style={styles.container}>
        {/* Back Button */}
        <Pressable style={styles.backButton} onPress={retakePhoto}>
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

        <View style={styles.previewContainer}>
          <Animated.Text
            entering={FadeInDown.delay(100).springify()}
            style={[styles.previewTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}
          >
            사진 확인
          </Animated.Text>

          <Animated.View entering={FadeInDown.delay(150).springify()} style={styles.photoPreview}>
            <Image source={{ uri: photo }} style={styles.photoImage} />
          </Animated.View>

          <View style={styles.previewActions}>
            <Pressable
              onPress={retakePhoto}
              style={[styles.retakeButton, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
            >
              <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"
                  stroke={isDark ? '#fff' : '#1a1a2e'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={[styles.retakeText, { color: isDark ? '#fff' : '#1a1a2e' }]}>다시 촬영</Text>
            </Pressable>

            <AnimatedPressable
              style={[styles.confirmButton, buttonStyle]}
              onPress={completeDelivery}
              onPressIn={() => {
                buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
              }}
              onPressOut={() => {
                buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
              }}
              disabled={isUploading}
            >
              <LinearGradient colors={['#10b981', '#059669']} style={styles.confirmGradient}>
                {isUploading ? (
                  <Text style={styles.confirmText}>업로드 중...</Text>
                ) : (
                  <>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M20 6L9 17l-5-5"
                        stroke="#fff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={styles.confirmText}>완료 처리</Text>
                  </>
                )}
              </LinearGradient>
            </AnimatedPressable>
          </View>
        </View>
      </LinearGradient>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />

      {/* Overlay */}
      <View style={styles.cameraOverlay}>
        {/* Back Button */}
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

        {/* Header */}
        <View style={styles.cameraHeader}>
          <Text style={styles.cameraTitle}>배송 완료 사진</Text>
          <Text style={styles.cameraSubtitle}>{params.recipientName}님</Text>
        </View>

        {/* Controls */}
        <View style={styles.cameraControls}>
          <Pressable onPress={pickImage} style={styles.galleryButton}>
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2z"
                stroke="#fff"
                strokeWidth="1.5"
              />
              <Path
                d="M8.5 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"
                stroke="#fff"
                strokeWidth="1.5"
              />
              <Path d="M21 15l-5-5L5 21" stroke="#fff" strokeWidth="1.5" />
            </Svg>
          </Pressable>

          <Pressable onPress={takePhoto} disabled={isCapturing}>
            <View style={styles.captureButton}>
              <View style={[styles.captureButtonInner, isCapturing && { backgroundColor: '#666' }]} />
            </View>
          </Pressable>

          <View style={{ width: 50 }} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionContainer: {
    padding: 24,
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
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  cameraHeader: {
    alignItems: 'center',
    paddingTop: 120,
  },
  cameraTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 4,
  },
  cameraSubtitle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
  },
  cameraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingBottom: 50,
    paddingHorizontal: 40,
  },
  galleryButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 4,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fff',
  },
  previewContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 80,
  },
  previewTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 24,
  },
  photoPreview: {
    width: '100%',
    aspectRatio: 3 / 4,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  retakeText: {
    fontSize: 16,
    fontWeight: '600',
  },
  confirmButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  confirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    gap: 8,
  },
  confirmText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  completeContainer: {
    alignItems: 'center',
    padding: 24,
  },
  completeIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 24,
    elevation: 12,
  },
  completeTitle: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
  },
  completeSubtitle: {
    fontSize: 16,
    marginBottom: 32,
  },
  completeActions: {
    gap: 12,
    width: '100%',
  },
  smsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 10,
  },
  smsButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  backToListButton: {
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  backToListText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
