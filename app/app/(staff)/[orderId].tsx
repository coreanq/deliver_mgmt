import { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  Pressable,
  Linking,
  Alert,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { useDeliveryStore } from '../../src/stores/delivery';
import { Card, StatusBadge, Loading, Button } from '../../src/components';
import { useTheme } from '../../src/theme';
import type { DeliveryStatus } from '../../src/types';

const STATUS_FLOW: DeliveryStatus[] = ['pending', 'in_transit', 'completed'];

function getNextStatus(current: DeliveryStatus): DeliveryStatus | null {
  const currentIndex = STATUS_FLOW.indexOf(current);
  if (currentIndex < STATUS_FLOW.length - 1) {
    return STATUS_FLOW[currentIndex + 1];
  }
  return null;
}

function getStatusButtonLabel(nextStatus: DeliveryStatus | null): string {
  switch (nextStatus) {
    case 'in_transit':
      return '🚗 배송 출발';
    case 'completed':
      return '📸 배송 완료';
    default:
      return '';
  }
}

export default function DeliveryDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId: string }>();
  const { colors, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { token } = useAuthStore();
  const { deliveries, selectedDelivery, selectDelivery, updateDeliveryStatus, isLoading } = useDeliveryStore();
  
  const [updating, setUpdating] = useState(false);

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

  if (!selectedDelivery) {
    return <Loading fullScreen message="배송 정보를 불러오는 중..." />;
  }

  const nextStatus = getNextStatus(selectedDelivery.status);
  const buttonLabel = getStatusButtonLabel(nextStatus);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View 
        entering={FadeInUp.duration(300)}
        style={[
          styles.header, 
          { 
            paddingTop: insets.top + 16,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
          shadows.sm,
        ]}
      >
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>
            ← 목록
          </Text>
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          배송 상세
        </Text>
        <View style={styles.placeholder} />
      </Animated.View>

      <ScrollView 
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        <Animated.View entering={FadeInDown.delay(100).duration(400)}>
          <Card style={styles.mainCard}>
            <View style={styles.statusRow}>
              <StatusBadge status={selectedDelivery.status} />
            </View>

            <View style={styles.recipientSection}>
              <Text style={[styles.recipientName, { color: colors.text }]}>
                {selectedDelivery.recipientName}
              </Text>
              <Pressable onPress={handleCall} style={styles.phoneRow}>
                <Text style={[styles.phone, { color: colors.primary }]}>
                  📞 {selectedDelivery.recipientPhone}
                </Text>
              </Pressable>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.borderLight }]} />

            <View style={styles.infoSection}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
                배송 주소
              </Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>
                {selectedDelivery.recipientAddress}
              </Text>
            </View>

            <View style={styles.infoSection}>
              <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
                상품 정보
              </Text>
              <View style={[
                styles.productBadge, 
                { 
                  backgroundColor: colors.surfaceSecondary,
                  borderRadius: radius.md,
                }
              ]}>
                <Text style={[styles.productText, { color: colors.textSecondary }]}>
                  📦 {selectedDelivery.productName} x {selectedDelivery.quantity}
                </Text>
              </View>
            </View>

            {selectedDelivery.memo && (
              <View style={styles.infoSection}>
                <Text style={[styles.infoLabel, { color: colors.textTertiary }]}>
                  메모
                </Text>
                <Text style={[styles.memo, { color: colors.textSecondary }]}>
                  {selectedDelivery.memo}
                </Text>
              </View>
            )}
          </Card>
        </Animated.View>

        {selectedDelivery.photoUrl && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)}>
            <Card style={styles.photoCard}>
              <Text style={[styles.photoLabel, { color: colors.textTertiary }]}>
                배송 완료 사진
              </Text>
              <View style={[
                styles.photoPlaceholder, 
                { 
                  backgroundColor: colors.primaryLight + '20',
                  borderRadius: radius.lg,
                }
              ]}>
                <Text style={styles.photoIcon}>📷</Text>
              </View>
            </Card>
          </Animated.View>
        )}
      </ScrollView>

      {nextStatus && (
        <Animated.View 
          entering={FadeInUp.delay(300).duration(400)}
          style={[
            styles.bottomBar,
            { 
              paddingBottom: insets.bottom + 16,
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
            },
            shadows.lg,
          ]}
        >
          <Button
            title={buttonLabel}
            onPress={handleUpdateStatus}
            loading={updating || isLoading}
            style={styles.actionButton}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  mainCard: {
    gap: 16,
  },
  statusRow: {
    alignItems: 'flex-start',
  },
  recipientSection: {
    gap: 8,
  },
  recipientName: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  phoneRow: {
    alignSelf: 'flex-start',
  },
  phone: {
    fontSize: 16,
    fontWeight: '500',
  },
  divider: {
    height: 1,
  },
  infoSection: {
    gap: 8,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 16,
    lineHeight: 24,
  },
  productBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  productText: {
    fontSize: 15,
    fontWeight: '500',
  },
  memo: {
    fontSize: 15,
    lineHeight: 22,
    fontStyle: 'italic',
  },
  photoCard: {
    gap: 12,
  },
  photoLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  photoPlaceholder: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoIcon: {
    fontSize: 48,
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
  actionButton: {
    width: '100%',
  },
});
