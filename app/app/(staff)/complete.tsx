import { useState, useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable,
  Image,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions, CameraType } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as SMS from 'expo-sms';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { useDeliveryStore } from '../../src/stores/delivery';
import { Button, Loading, LoadingOverlay } from '../../src/components';
import { useTheme } from '../../src/theme';

export default function CompleteDeliveryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string }>();
  const { colors, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { token } = useAuthStore();
  const { deliveries, completeDelivery, isLoading } = useDeliveryStore();
  
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const cameraRef = useRef<CameraView>(null);

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
        }
      }
    } catch (error) {
      console.error('Camera error:', error);
      Alert.alert('오류', '사진 촬영에 실패했습니다.');
    }
  };

  const handleRetake = () => {
    setPhoto(null);
  };

  const handleComplete = async () => {
    if (!token || !params.orderId || !photo || !delivery) return;

    setUploading(true);

    const success = await completeDelivery(token, params.orderId, photo);

    if (success) {
      const isSmsAvailable = await SMS.isAvailableAsync();
      
      if (isSmsAvailable) {
        const message = `[배송완료] ${delivery.recipientName}님, ${delivery.productName} 배송이 완료되었습니다. 좋은 하루 되세요!`;
        
        try {
          await SMS.sendSMSAsync(
            [delivery.recipientPhone],
            message
          );
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
            배송 완료 사진을 촬영하려면 카메라 권한을 허용해주세요
          </Text>
          <Button title="권한 허용하기" onPress={requestPermission} style={styles.permissionButton} />
          <Button title="취소" onPress={handleClose} variant="ghost" />
        </Animated.View>
      </View>
    );
  }

  return (
    <View style={styles.cameraContainer}>
      {uploading && <LoadingOverlay message="배송 완료 처리 중..." />}

      {!photo ? (
        <>
          <CameraView
            ref={cameraRef}
            style={StyleSheet.absoluteFillObject}
            facing="back"
          />

          <View style={[styles.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
            <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.header}>
              <Pressable onPress={handleClose} style={styles.closeButton}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
              <Text style={styles.title}>배송 완료 사진</Text>
              <View style={styles.placeholder} />
            </Animated.View>

            <View style={styles.cameraContent}>
              {delivery && (
                <Animated.View 
                  entering={FadeInDown.delay(300).duration(400)} 
                  style={[
                    styles.deliveryInfo,
                    { borderRadius: radius.lg }
                  ]}
                >
                  <Text style={styles.deliveryName}>{delivery.recipientName}</Text>
                  <Text style={styles.deliveryProduct}>
                    {delivery.productName} x {delivery.quantity}
                  </Text>
                </Animated.View>
              )}
            </View>

            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.footer}>
              <Pressable style={styles.captureButton} onPress={handleTakePhoto}>
                <View style={styles.captureInner} />
              </Pressable>
            </Animated.View>
          </View>
        </>
      ) : (
        <View style={[styles.previewContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.header, { paddingTop: insets.top + 16 }]}>
            <Pressable onPress={handleClose} style={styles.closeButtonAlt}>
              <Text style={[styles.closeTextAlt, { color: colors.textSecondary }]}>취소</Text>
            </Pressable>
            <Text style={[styles.titleAlt, { color: colors.text }]}>
              사진 확인
            </Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.imageContainer}>
            <Image 
              source={{ uri: photo }} 
              style={[styles.previewImage, { borderRadius: radius.xl }]} 
              resizeMode="contain" 
            />
          </View>

          <View style={[styles.bottomActions, { paddingBottom: insets.bottom + 16 }]}>
            <Button 
              title="다시 촬영" 
              onPress={handleRetake} 
              variant="outline"
              style={styles.actionButton}
            />
            <Button 
              title="완료 + SMS 전송" 
              onPress={handleComplete}
              loading={uploading || isLoading}
              style={styles.actionButton}
            />
          </View>
        </View>
      )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#ffffff',
    fontSize: 20,
  },
  closeButtonAlt: {
    padding: 8,
  },
  closeTextAlt: {
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  titleAlt: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 40,
  },
  cameraContent: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingBottom: 40,
  },
  deliveryInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    padding: 16,
    alignItems: 'center',
  },
  deliveryName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  deliveryProduct: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 14,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: '#ffffff',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#ffffff',
  },
  previewContainer: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
    padding: 16,
  },
  previewImage: {
    flex: 1,
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
  },
  actionButton: {
    flex: 1,
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
