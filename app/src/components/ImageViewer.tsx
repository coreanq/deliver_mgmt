import { useState } from 'react';
import {
  View,
  Image,
  Modal,
  StyleSheet,
  Pressable,
  Text,
  Dimensions,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from 'react-native-gesture-handler';
import { useTheme } from '../theme';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageViewerProps {
  visible: boolean;
  imageUrl: string | null;
  onClose: () => void;
}

export function ImageViewer({ visible, imageUrl, onClose }: ImageViewerProps) {
  const { radius } = useTheme();
  const [imageSize, setImageSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT * 0.7 });

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetTransform = () => {
    scale.value = withSpring(1);
    savedScale.value = 1;
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  const handleClose = () => {
    resetTransform();
    onClose();
  };

  // 핀치 줌 제스처
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else if (scale.value > 4) {
        scale.value = withSpring(4);
        savedScale.value = 4;
      } else {
        savedScale.value = scale.value;
      }
    });

  // 팬 제스처 (드래그)
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  // 더블 탭 제스처
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (savedScale.value > 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        scale.value = withTiming(2.5);
        savedScale.value = 2.5;
      }
    });

  // 제스처 조합
  const composedGesture = Gesture.Simultaneous(
    pinchGesture,
    Gesture.Race(doubleTapGesture, panGesture)
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  // 이미지 로드 시 원본 비율 계산
  const handleImageLoad = () => {
    if (imageUrl) {
      Image.getSize(
        imageUrl,
        (width, height) => {
          const aspectRatio = width / height;
          const maxWidth = SCREEN_WIDTH;
          const maxHeight = SCREEN_HEIGHT * 0.8;

          let finalWidth = maxWidth;
          let finalHeight = maxWidth / aspectRatio;

          if (finalHeight > maxHeight) {
            finalHeight = maxHeight;
            finalWidth = maxHeight * aspectRatio;
          }

          setImageSize({ width: finalWidth, height: finalHeight });
        },
        () => {}
      );
    }
  };

  if (!visible || !imageUrl) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.overlay}>
          {/* 닫기 버튼 */}
          <Pressable
            style={[styles.closeBtn, { borderRadius: radius.full }]}
            onPress={handleClose}
          >
            <Text style={styles.closeIcon}>✕</Text>
          </Pressable>

          {/* 줌 힌트 */}
          <View style={[styles.hintContainer, { borderRadius: radius.lg }]}>
            <Text style={styles.hintText}>핀치로 확대/축소 · 더블탭으로 확대</Text>
          </View>

          {/* 이미지 */}
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={[styles.imageContainer, animatedStyle]}>
              <Image
                source={{ uri: imageUrl }}
                style={[styles.image, { width: imageSize.width, height: imageSize.height }]}
                resizeMode="contain"
                onLoad={handleImageLoad}
              />
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 44,
    height: 44,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeIcon: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  hintContainer: {
    position: 'absolute',
    bottom: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    zIndex: 10,
  },
  hintText: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  imageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    maxWidth: SCREEN_WIDTH,
  },
});
