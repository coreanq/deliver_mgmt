import { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Linking,
  Alert,
  Image,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
import { StatusBadge, Loading, ImageViewer } from '../../src/components';
import { useTheme } from '../../src/theme';
import type { DeliveryStatus } from '../../src/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const STATUS_FLOW: DeliveryStatus[] = ['pending', 'in_transit', 'completed'];

function getNextStatus(current: DeliveryStatus): DeliveryStatus | null {
  const currentIndex = STATUS_FLOW.indexOf(current);
  if (currentIndex < STATUS_FLOW.length - 1) {
    return STATUS_FLOW[currentIndex + 1];
  }
  return null;
}

function getStatusButtonConfig(nextStatus: DeliveryStatus | null) {
  switch (nextStatus) {
    case 'in_transit':
      return { label: '배송 출발', icon: '🚚' };
    case 'completed':
      return { label: '배송 완료', icon: '✓' };
    default:
      return null;
  }
}

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
          withTiming(-12, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(12, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value * 0.4,
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

export default function DeliveryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string }>();
  const { colors, radius, typography, springs, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const { token } = useAuthStore();
  const { deliveries, selectedDelivery, selectDelivery, updateDeliveryStatus, isLoading } =
    useDeliveryStore();

  const [updating, setUpdating] = useState(false);
  const [fullScreenPhoto, setFullScreenPhoto] = useState<string | null>(null);

  const backScale = useSharedValue(1);
  const fabScale = useSharedValue(1);

  useEffect(() => {
    const delivery = deliveries.find((d) => d.id === params.orderId);
    if (delivery) {
      selectDelivery(delivery);
    }
  }, [params.orderId, deliveries, selectDelivery]);

  const handleBack = () => {
    selectDelivery(null);
    router.back();
  };

  const handleCall = () => {
    if (!selectedDelivery) return;
    const phoneUrl = `tel:${selectedDelivery.recipientPhone}`;
    Linking.openURL(phoneUrl).catch(() => {
      Alert.alert('오류', '전화 앱을 열 수 없습니다.');
    });
  };

  const handleUpdateStatus = async () => {
    if (!token || !selectedDelivery) return;

    const nextStatus = getNextStatus(selectedDelivery.status);
    if (!nextStatus) return;

    if (nextStatus === 'completed') {
      router.push({
        pathname: '/(staff)/complete',
        params: { orderId: selectedDelivery.id },
      });
      return;
    }

    setUpdating(true);
    const success = await updateDeliveryStatus(token, selectedDelivery.id, nextStatus);
    setUpdating(false);

    if (success) {
      Alert.alert('완료', '배송 상태가 변경되었습니다.');
    }
  };

  const backAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: backScale.value }],
  }));

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  if (!selectedDelivery) {
    return <Loading fullScreen message="배송 정보를 불러오는 중..." />;
  }

  const nextStatus = getNextStatus(selectedDelivery.status);
  const buttonConfig = getStatusButtonConfig(nextStatus);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background orbs */}
      <View style={styles.orbContainer} pointerEvents="none">
        <FloatingOrb color={colors.primary} size={150} initialX={-15} initialY={5} delay={0} />
        <FloatingOrb color={colors.accent} size={100} initialX={75} initialY={50} delay={300} />
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

      {/* Header */}
      <Animated.View
        entering={FadeIn.duration(300)}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <AnimatedPressable
          style={[
            styles.backButton,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              borderRadius: radius.lg,
            },
            backAnimatedStyle,
          ]}
          onPress={handleBack}
          onPressIn={() => { backScale.value = withSpring(0.95, springs.snappy); }}
          onPressOut={() => { backScale.value = withSpring(1, springs.snappy); }}
        >
          <Text style={[styles.backIcon, { color: colors.textSecondary }]}>←</Text>
        </AnimatedPressable>
        <Text style={[typography.h3, { color: colors.text, letterSpacing: -0.5 }]}>배송 상세</Text>
        <View style={{ width: 44 }} />
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
      >
        {/* Main Card */}
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <View
            style={[
              styles.mainCard,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
                borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                borderRadius: radius['2xl'],
              },
            ]}
          >
            <StatusBadge status={selectedDelivery.status} size="lg" showPulse />

            <View style={styles.recipientSection}>
              <Text
                style={[
                  typography.h1,
                  { color: colors.text, marginTop: 20, fontSize: 28, letterSpacing: -1 },
                ]}
              >
                {selectedDelivery.recipientName}
              </Text>
              <Pressable onPress={handleCall} style={styles.phoneRow}>
                <LinearGradient
                  colors={[colors.primary, colors.accent]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.phoneBadge, { borderRadius: radius.full }]}
                >
                  <Text style={styles.phoneIcon}>📞</Text>
                  <Text style={[typography.label, { color: '#FFFFFF' }]}>
                    {selectedDelivery.recipientPhone}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>

            <View style={[styles.divider, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }]} />

            {/* Address */}
            <View style={styles.infoSection}>
              <Text style={[typography.overline, { color: colors.textMuted }]}>배송 주소</Text>
              <Text style={[typography.body, { color: colors.text, marginTop: 10, lineHeight: 24 }]}>
                {selectedDelivery.recipientAddress}
              </Text>
            </View>

            {/* Product */}
            <View style={styles.infoSection}>
              <Text style={[typography.overline, { color: colors.textMuted }]}>상품 정보</Text>
              <View
                style={[
                  styles.productBadge,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    borderRadius: radius.lg,
                    marginTop: 10,
                  },
                ]}
              >
                <Text style={[typography.body, { color: colors.text }]}>
                  {selectedDelivery.productName} × {selectedDelivery.quantity}
                </Text>
              </View>
            </View>

            {/* Memo */}
            {selectedDelivery.memo && (
              <View style={styles.infoSection}>
                <Text style={[typography.overline, { color: colors.textMuted }]}>메모</Text>
                <View
                  style={[
                    styles.memoCard,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                      borderRadius: radius.lg,
                      marginTop: 10,
                    },
                  ]}
                >
                  <Text
                    style={[
                      typography.body,
                      { color: colors.textSecondary, fontStyle: 'italic', lineHeight: 22 },
                    ]}
                  >
                    {selectedDelivery.memo}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </Animated.View>

        {/* Photo Card (if exists) */}
        {selectedDelivery.photoUrl && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <View
              style={[
                styles.photoCard,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)',
                  borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                  borderRadius: radius['2xl'],
                },
              ]}
            >
              <Text style={[typography.overline, { color: colors.textMuted }]}>배송 완료 사진</Text>
              <Pressable
                style={[
                  styles.photoWrapper,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                    borderRadius: radius.xl,
                    marginTop: 12,
                  },
                ]}
                onPress={() => setFullScreenPhoto(selectedDelivery.photoUrl)}
              >
                <Image
                  source={{ uri: selectedDelivery.photoUrl }}
                  style={[styles.photo, { borderRadius: radius.lg }]}
                  resizeMode="cover"
                />
                <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8, textAlign: 'center' }]}>
                  탭하여 크게 보기
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        )}
      </ScrollView>

      {/* Bottom Action */}
      {buttonConfig && (
        <Animated.View
          entering={FadeInUp.delay(300).duration(400)}
          style={[
            styles.bottomBar,
            {
              paddingBottom: insets.bottom + 16,
              backgroundColor: isDark ? 'rgba(12, 15, 20, 0.95)' : 'rgba(250, 250, 252, 0.95)',
              borderTopColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            },
          ]}
        >
          <AnimatedPressable
            style={[styles.actionButtonWrapper, fabAnimatedStyle]}
            onPress={handleUpdateStatus}
            onPressIn={() => { fabScale.value = withSpring(0.95, springs.snappy); }}
            onPressOut={() => { fabScale.value = withSpring(1, springs.snappy); }}
            disabled={updating || isLoading}
          >
            <LinearGradient
              colors={nextStatus === 'completed' ? [colors.accent, colors.primary] : [colors.primary, colors.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.actionButton, { borderRadius: radius.xl }]}
            >
              {updating || isLoading ? (
                <Loading size="sm" />
              ) : (
                <>
                  <Text style={styles.actionIcon}>{buttonConfig.icon}</Text>
                  <Text style={[typography.button, { color: '#FFFFFF', fontSize: 17 }]}>
                    {buttonConfig.label}
                  </Text>
                </>
              )}
            </LinearGradient>
          </AnimatedPressable>
        </Animated.View>
      )}

      {/* 전체 화면 사진 뷰어 */}
      <ImageViewer
        visible={!!fullScreenPhoto}
        imageUrl={fullScreenPhoto}
        onClose={() => setFullScreenPhoto(null)}
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 20,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  mainCard: {
    padding: 24,
    borderWidth: 1,
  },
  recipientSection: {
    marginTop: 8,
  },
  phoneRow: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  phoneBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  phoneIcon: {
    fontSize: 16,
  },
  divider: {
    height: 1,
    marginVertical: 24,
  },
  infoSection: {
    marginBottom: 20,
  },
  productBadge: {
    padding: 14,
    alignSelf: 'flex-start',
  },
  memoCard: {
    padding: 14,
  },
  photoCard: {
    padding: 20,
    borderWidth: 1,
  },
  photoWrapper: {
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: 250,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  actionButtonWrapper: {
    overflow: 'hidden',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  actionIcon: {
    fontSize: 20,
  },
});
