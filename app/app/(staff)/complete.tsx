import { useState, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  useColorScheme,
  StyleSheet,
  Image,
  Alert,
} from 'react-native';
import * as SMS from 'expo-sms';
import * as ImageManipulator from 'expo-image-manipulator';
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
import { createSmsMessage } from '@/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function CompleteDeliveryScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{
    deliveryId: string;
    recipientPhone: string;
    recipientName: string;
    productName: string;
  }>();

  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null); // 사진 URI (MMS 첨부용)
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

      if (result?.base64 && result?.uri) {
        setPhoto(`data:image/jpeg;base64,${result.base64}`);
        setPhotoUri(result.uri);
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

    if (!result.canceled && result.assets[0]?.base64 && result.assets[0]?.uri) {
      setPhoto(`data:image/jpeg;base64,${result.assets[0].base64}`);
      setPhotoUri(result.assets[0].uri);
      setStep('preview');
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    setPhotoUri(null);
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

  const sendSMS = async () => {
    const isAvailable = await SMS.isAvailableAsync();
    if (!isAvailable) {
      Alert.alert('알림', 'SMS 기능을 사용할 수 없습니다.');
      return;
    }

    const message = createSmsMessage('delivery_complete', {
      recipientName: params.recipientName || '',
      productName: params.productName || '',
    });

    // 사진이 있으면 MMS용으로 압축 후 첨부
    let options: SMS.SMSOptions | undefined;

    if (photoUri) {
      try {
        // MMS용 이미지 압축 (800px, 품질 60%)
        const compressed = await ImageManipulator.manipulateAsync(
          photoUri,
          [{ resize: { width: 800 } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG }
        );

        options = {
          attachments: {
            uri: compressed.uri,
            mimeType: 'image/jpeg',
            filename: 'delivery_photo.jpg',
          },
        };
      } catch (error) {
        console.error('Image compression failed:', error);
        // 압축 실패 시 원본 사용
        options = {
          attachments: {
            uri: photoUri,
            mimeType: 'image/jpeg',
            filename: 'delivery_photo.jpg',
          },
        };
      }
    }

    const { result } = await SMS.sendSMSAsync(
      [params.recipientPhone || ''],
      message,
      options
    );

    if (result === 'sent') {
      Alert.alert('완료', '문자가 전송되었습니다.');
    }
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
        {/* Background decoration circles */}
        <View style={styles.bgDecoration}>
          <Animated.View
            entering={FadeIn.delay(200).duration(800)}
            style={[styles.bgCircle, styles.bgCircle1, { backgroundColor: isDark ? 'rgba(16,185,129,0.08)' : 'rgba(16,185,129,0.12)' }]}
          />
          <Animated.View
            entering={FadeIn.delay(400).duration(800)}
            style={[styles.bgCircle, styles.bgCircle2, { backgroundColor: isDark ? 'rgba(59,130,246,0.06)' : 'rgba(59,130,246,0.08)' }]}
          />
          <Animated.View
            entering={FadeIn.delay(600).duration(800)}
            style={[styles.bgCircle, styles.bgCircle3, { backgroundColor: isDark ? 'rgba(16,185,129,0.04)' : 'rgba(16,185,129,0.06)' }]}
          />
        </View>

        <Animated.View entering={FadeInDown.delay(100).springify()} style={styles.completeContainer}>
          {/* Success Icon with glow effect */}
          <View style={styles.iconWrapper}>
            <View style={[styles.iconGlow, { shadowColor: '#10b981' }]} />
            <LinearGradient
              colors={['#34d399', '#10b981', '#059669']}
              style={styles.completeIcon}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Animated.View entering={FadeIn.delay(300).springify()}>
                <Svg width={52} height={52} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M20 6L9 17l-5-5"
                    stroke="#fff"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
              </Animated.View>
            </LinearGradient>
          </View>

          {/* Success Message */}
          <Animated.Text
            entering={FadeInDown.delay(200).springify()}
            style={[styles.completeTitle, { color: isDark ? '#fff' : '#0f172a' }]}
          >
            배송 완료
          </Animated.Text>

          <Animated.View
            entering={FadeInDown.delay(250).springify()}
            style={[styles.recipientCard, { backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)' }]}
          >
            <Text style={[styles.recipientLabel, { color: isDark ? '#666' : '#94a3b8' }]}>
              수령인
            </Text>
            <Text style={[styles.recipientName, { color: isDark ? '#fff' : '#1e293b' }]}>
              {params.recipientName}님
            </Text>
          </Animated.View>

          {/* Action Buttons */}
          <Animated.View
            entering={FadeInDown.delay(350).springify()}
            style={styles.completeActions}
          >
            <Pressable onPress={sendSMS} style={styles.actionButtonWrapper}>
              <LinearGradient
                colors={['#3b82f6', '#2563eb']}
                style={styles.smsButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                  <Path
                    d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"
                    stroke="#fff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </Svg>
                <Text style={styles.smsButtonText}>완료 문자 보내기</Text>
              </LinearGradient>
            </Pressable>

            <Pressable
              onPress={goBack}
              style={[
                styles.backToListButton,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#fff',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                }
              ]}
            >
              <Text style={[styles.backToListText, { color: isDark ? 'rgba(255,255,255,0.8)' : '#475569' }]}>
                목록으로 돌아가기
              </Text>
            </Pressable>
          </Animated.View>
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
    paddingHorizontal: 32,
    zIndex: 1,
  },
  bgDecoration: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 999,
  },
  bgCircle1: {
    width: 400,
    height: 400,
    top: -100,
    right: -150,
  },
  bgCircle2: {
    width: 300,
    height: 300,
    bottom: 100,
    left: -100,
  },
  bgCircle3: {
    width: 200,
    height: 200,
    bottom: -50,
    right: -50,
  },
  iconWrapper: {
    marginBottom: 32,
    position: 'relative',
  },
  iconGlow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 60,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 40,
    elevation: 20,
  },
  completeIcon: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.35,
    shadowRadius: 32,
    elevation: 16,
  },
  completeTitle: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  recipientCard: {
    paddingVertical: 24,
    paddingHorizontal: 48,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 48,
  },
  recipientLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  recipientName: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  completeActions: {
    gap: 14,
    alignItems: 'center',
  },
  actionButtonWrapper: {
    minWidth: 220,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  smsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 18,
    gap: 12,
  },
  smsButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  backToListButton: {
    minWidth: 220,
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 18,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  backToListText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
