import { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, Image, Alert } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as SMS from 'expo-sms';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
  withDelay,
  Easing,
} from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { useDeliveryStore } from '../../src/stores/delivery';
import { Button, Loading, LoadingOverlay } from '../../src/components';
import { useTheme } from '../../src/theme';
import { smsTemplateApi } from '../../src/services/api';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Floating orb background
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

export default function CompleteDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string }>();
  const { colors, radius, typography, springs, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { token } = useAuthStore();
  const { deliveries, completeDelivery, isLoading } = useDeliveryStore();

  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

  const captureScale = useSharedValue(1);
  const closeScale = useSharedValue(1);

  const delivery = deliveries.find((d) => d.id === params.orderId);

  const handleClose = () => {
    router.back();
  };

  const handleTakePhoto = async () => {
    if (!cameraRef.current) return;

    try {
      const result = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: false,
      });

      if (result?.uri) {
        const manipulated = await ImageManipulator.manipulateAsync(
          result.uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );

        if (manipulated.base64) {
          setPhoto(`data:image/jpeg;base64,${manipulated.base64}`);
          setPhotoUri(manipulated.uri);
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('오류', '사진 촬영에 실패했습니다.');
    }
  };

  const handleRetake = () => {
    setPhoto(null);
    setPhotoUri(null);
  };

  const buildSmsMessage = async (): Promise<string> => {
    const fallbackMessage = `[배송완료] ${delivery?.recipientName}님, ${delivery?.productName} 배송이 완료되었습니다. 좋은 하루 되세요!`;
    
    if (!token || !delivery) return fallbackMessage;

    try {
      const result = await smsTemplateApi.getDefault(token);
      if (!result.success || !result.data?.template) {
        return fallbackMessage;
      }

      const { template, isPro } = result.data;
      const variables: Record<string, string> = {
        recipientName: delivery.recipientName,
        recipientPhone: delivery.recipientPhone,
        recipientAddress: delivery.recipientAddress,
        productName: delivery.productName,
        quantity: String(delivery.quantity),
        staffName: delivery.staffName || '',
        deliveryDate: delivery.deliveryDate,
        memo: delivery.memo || '',
      };

      if (template.use_ai && isPro) {
        const aiResult = await smsTemplateApi.generate(token, template.content, variables);
        if (aiResult.success && aiResult.data?.message) {
          return aiResult.data.message;
        }
      }

      let message = template.content;
      message = message.replace(/\$\{수령인\}/g, variables.recipientName);
      message = message.replace(/\$\{연락처\}/g, variables.recipientPhone);
      message = message.replace(/\$\{주소\}/g, variables.recipientAddress);
      message = message.replace(/\$\{상품명\}/g, variables.productName);
      message = message.replace(/\$\{수량\}/g, variables.quantity);
      message = message.replace(/\$\{배송담당자\}/g, variables.staffName);
      message = message.replace(/\$\{배송일\}/g, variables.deliveryDate);
      message = message.replace(/\$\{메모\}/g, variables.memo);
      
      return message;
    } catch (error) {
      console.log('SMS template error:', error);
      return fallbackMessage;
    }
  };

  const handleComplete = async () => {
    if (!token || !params.orderId || !photo || !delivery) return;

    setUploading(true);

    // 사진 업로드와 SMS 메시지 준비를 병렬로 처리
    const [success, isSmsAvailable, message] = await Promise.all([
      completeDelivery(token, params.orderId, photo),
      SMS.isAvailableAsync(),
      buildSmsMessage(),
    ]);

    if (success) {
      if (isSmsAvailable) {
        try {
          const smsOptions: SMS.SMSOptions = photoUri
            ? {
                attachments: {
                  uri: photoUri,
                  mimeType: 'image/jpeg',
                  filename: 'delivery_photo.jpg',
                },
              }
            : {};

          await SMS.sendSMSAsync([delivery.recipientPhone], message, smsOptions);
        } catch (error) {
          console.log('SMS open error:', error);
        }
      }

      Alert.alert('완료', '배송이 완료되었습니다.', [
        { text: '확인', onPress: () => router.back() },
      ]);
    } else {
      Alert.alert('오류', '배송 완료 처리에 실패했습니다.');
    }

    setUploading(false);
  };

  const captureAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: captureScale.value }],
  }));

  const closeAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: closeScale.value }],
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

        <View
          style={[
            styles.permissionContent,
            { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
          ]}
        >
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
              배송 완료 사진을 촬영하려면{'\n'}카메라 권한을 허용해주세요
            </Text>
            <View style={{ marginTop: 36, gap: 12, width: '100%' }}>
              <Button title="권한 허용하기" onPress={requestPermission} size="lg" fullWidth />
              <Button title="뒤로 가기" onPress={handleClose} variant="ghost" />
            </View>
          </Animated.View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      {uploading && <LoadingOverlay message="배송 완료 처리 중..." />}

      {!photo ? (
        <>
          <CameraView ref={cameraRef} style={StyleSheet.absoluteFillObject} facing="back" />

          {/* Camera Overlay */}
          <LinearGradient
            colors={['rgba(12, 15, 20, 0.85)', 'rgba(12, 15, 20, 0.3)', 'rgba(12, 15, 20, 0.85)']}
            locations={[0, 0.5, 1]}
            style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
          >
            {/* Header */}
            <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.header}>
              <AnimatedPressable
                style={[
                  styles.closeButton,
                  { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg },
                  closeAnimatedStyle,
                ]}
                onPress={handleClose}
                onPressIn={() => { closeScale.value = withSpring(0.95, springs.snappy); }}
                onPressOut={() => { closeScale.value = withSpring(1, springs.snappy); }}
              >
                <Text style={styles.closeIcon}>✕</Text>
              </AnimatedPressable>
              <Text style={[typography.h3, { color: '#FFFFFF', letterSpacing: -0.5 }]}>배송 완료 사진</Text>
              <View style={{ width: 44 }} />
            </Animated.View>

            {/* Delivery Info */}
            <View style={styles.cameraContent}>
              {delivery && (
                <Animated.View
                  entering={FadeInDown.delay(300).duration(400)}
                  style={[
                    styles.deliveryInfo,
                    {
                      backgroundColor: 'rgba(255,255,255,0.1)',
                      borderRadius: radius.xl,
                    },
                  ]}
                >
                  <Text style={[typography.h4, { color: '#FFFFFF' }]}>
                    {delivery.recipientName}
                  </Text>
                  <Text style={[typography.bodySmall, { color: 'rgba(255,255,255,0.7)', marginTop: 4 }]}>
                    {delivery.productName} × {delivery.quantity}
                  </Text>
                </Animated.View>
              )}
            </View>

            {/* Capture Button */}
            <Animated.View entering={FadeInUp.delay(400).duration(400)} style={styles.footer}>
              <AnimatedPressable
                style={[styles.captureButton, captureAnimatedStyle]}
                onPress={handleTakePhoto}
                onPressIn={() => { captureScale.value = withSpring(0.9, springs.snappy); }}
                onPressOut={() => { captureScale.value = withSpring(1, springs.snappy); }}
              >
                <LinearGradient
                  colors={[colors.accent, colors.primary]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.captureOuter}
                >
                  <View style={styles.captureInner} />
                </LinearGradient>
              </AnimatedPressable>
              <Text style={[typography.bodySmall, { color: 'rgba(255,255,255,0.6)', marginTop: 16 }]}>
                버튼을 눌러 사진을 촬영하세요
              </Text>
            </Animated.View>
          </LinearGradient>
        </>
      ) : (
        // Preview mode
        <View style={[styles.previewContainer, { backgroundColor: colors.background }]}>
          {/* Background orbs */}
          <View style={styles.orbContainer} pointerEvents="none">
            <FloatingOrb color={colors.primary} size={140} initialX={-10} initialY={5} delay={0} />
            <FloatingOrb color={colors.accent} size={100} initialX={75} initialY={70} delay={200} />
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

          {/* Preview Header */}
          <Animated.View
            entering={FadeIn.duration(300)}
            style={[styles.previewHeader, { paddingTop: insets.top + 16 }]}
          >
            <AnimatedPressable
              style={[
                styles.closeButton,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  borderRadius: radius.lg,
                },
                closeAnimatedStyle,
              ]}
              onPress={handleClose}
              onPressIn={() => { closeScale.value = withSpring(0.95, springs.snappy); }}
              onPressOut={() => { closeScale.value = withSpring(1, springs.snappy); }}
            >
              <Text style={[styles.closeIconDark, { color: colors.textSecondary }]}>✕</Text>
            </AnimatedPressable>
            <Text style={[typography.h3, { color: colors.text, letterSpacing: -0.5 }]}>사진 확인</Text>
            <View style={{ width: 44 }} />
          </Animated.View>

          {/* Image Preview */}
          <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.imageContainer}>
            <View
              style={[
                styles.imageWrapper,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderRadius: radius['2xl'],
                },
              ]}
            >
              <Image
                source={{ uri: photoUri || photo }}
                style={[styles.previewImage, { borderRadius: radius.xl }]}
                resizeMode="contain"
              />
            </View>
          </Animated.View>

          {/* Actions */}
          <Animated.View
            entering={FadeInUp.delay(200).duration(400)}
            style={[styles.previewActions, { paddingBottom: insets.bottom + 20 }]}
          >
            <AnimatedPressable
              style={{ flex: 1 }}
              onPress={handleRetake}
            >
              <View
                style={[
                  styles.retakeButton,
                  {
                    borderRadius: radius.xl,
                    borderColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
                  },
                ]}
              >
                <Text style={styles.retakeIcon}>📷</Text>
                <Text style={[typography.button, { color: colors.text }]}>
                  다시 촬영
                </Text>
              </View>
            </AnimatedPressable>
            <AnimatedPressable
              style={{ flex: 1 }}
              onPress={handleComplete}
              disabled={uploading || isLoading}
            >
              <LinearGradient
                colors={[colors.accent, colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.completeButton, { borderRadius: radius.xl }]}
              >
                <Text style={styles.completeIcon}>✓</Text>
                <Text style={[typography.button, { color: '#FFFFFF' }]}>
                  완료 + SMS
                </Text>
              </LinearGradient>
            </AnimatedPressable>
          </Animated.View>
        </View>
      )}
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
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  closeIconDark: {
    fontSize: 16,
    fontWeight: '600',
  },
  cameraContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 32,
  },
  deliveryInfo: {
    padding: 20,
    alignItems: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  captureButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureOuter: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#FFFFFF',
  },
  previewContainer: {
    flex: 1,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  imageContainer: {
    flex: 1,
    padding: 16,
  },
  imageWrapper: {
    flex: 1,
    padding: 12,
    borderWidth: 1,
  },
  previewImage: {
    flex: 1,
  },
  previewActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
    borderWidth: 1,
  },
  retakeIcon: {
    fontSize: 16,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  completeIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
