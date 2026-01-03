import { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { useDeliveryStore } from '../../src/stores/delivery';
import { Card, StatusBadge, Loading, Button } from '../../src/components';
import { useTheme } from '../../src/theme';
import { logApi } from '../../src/services/api';
import type { Delivery } from '../../src/types';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

interface DeliveryItemProps {
  delivery: Delivery;
  index: number;
  onPress: () => void;
}

function DeliveryItem({ delivery, index, onPress }: DeliveryItemProps) {
  const { colors, radius } = useTheme();

  return (
    <Pressable onPress={onPress}>
      <Card delay={index * 50} style={styles.deliveryCard}>
        <View style={styles.cardHeader}>
          <View style={[styles.indexBadge, { backgroundColor: colors.primary }]}>
            <Text style={[styles.indexText, { color: colors.textInverse }]}>{index + 1}</Text>
          </View>
          <StatusBadge status={delivery.status} size="sm" />
        </View>

        <Text style={[styles.recipientName, { color: colors.text }]}>
          {delivery.recipientName}
        </Text>
        <Text style={[styles.phone, { color: colors.textSecondary }]}>
          {delivery.recipientPhone}
        </Text>
        
        <Text 
          style={[styles.address, { color: colors.textSecondary }]}
          numberOfLines={2}
        >
          {delivery.recipientAddress}
        </Text>

        <View style={[
          styles.productRow, 
          { 
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.md,
          }
        ]}>
          <Text style={[styles.productText, { color: colors.textSecondary }]}>
            📦 {delivery.productName} x {delivery.quantity}
          </Text>
        </View>

        {delivery.memo && (
          <Text style={[styles.memo, { color: colors.textTertiary }]}>
            💬 {delivery.memo}
          </Text>
        )}
      </Card>
    </Pressable>
  );
}

export default function StaffDeliveryListScreen() {
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { staff, token, logout } = useAuthStore();
  const { deliveries, isLoading, error, fetchStaffDeliveries } = useDeliveryStore();
  
  const [refreshing, setRefreshing] = useState(false);
  
  const hasAuth = !!token && !!staff;

  useEffect(() => {
    if (token && staff?.name) {
      logApi.send({
        event: 'STAFF_LIST_FETCHING',
        staffName: staff.name,
        timestamp: new Date().toISOString(),
      });
      fetchStaffDeliveries(token, staff.name).catch((err) => {
        logApi.send({
          event: 'STAFF_LIST_FETCH_ERROR',
          error: err instanceof Error ? err.message : String(err),
          timestamp: new Date().toISOString(),
        });
      });
    }
  }, [token, staff, fetchStaffDeliveries]);

  if (!hasAuth) {
    return <Redirect href="/" />;
  }

  const stats = useMemo(() => ({
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    inTransit: deliveries.filter((d) => d.status === 'in_transit').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
  }), [deliveries]);

  const handleRefresh = async () => {
    if (!token || !staff?.name) return;
    setRefreshing(true);
    await fetchStaffDeliveries(token, staff.name);
    setRefreshing(false);
  };

  const handleLogout = () => {
    logout();
  };

  const handleDeliveryPress = (delivery: Delivery) => {
    router.push({
      pathname: '/(staff)/[orderId]',
      params: { orderId: delivery.id },
    });
  };

  const todayDate = deliveries[0]?.deliveryDate || new Date().toISOString().split('T')[0];

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
        <View style={styles.headerTop}>
          <View>
            <Text style={[styles.greeting, { color: colors.textSecondary }]}>
              배송담당자
            </Text>
          <Text style={[styles.staffName, { color: colors.text }]}>
            {staff?.name}님
          </Text>
          </View>
          <Pressable onPress={handleLogout} style={styles.logoutButton}>
            <Text style={[styles.logoutText, { color: colors.textSecondary }]}>
              로그아웃
            </Text>
          </Pressable>
        </View>

        <View style={styles.dateContainer}>
          <Text style={[styles.dateLabel, { color: colors.text }]}>
            📅 {formatDate(todayDate)}
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={[styles.statItem, styles.statItemFirst]}>
            <Text style={[styles.statNumber, { color: colors.text }]}>
              {stats.total}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              전체
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.statusPending }]}>
              {stats.pending}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              준비
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.statusInTransit }]}>
              {stats.inTransit}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              배송중
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: colors.statusCompleted }]}>
              {stats.completed}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
              완료
            </Text>
          </View>
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading && !refreshing ? (
          <Loading message="배송 목록을 불러오는 중..." />
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error}
            </Text>
            <Button title="다시 시도" onPress={handleRefresh} variant="outline" />
          </View>
        ) : deliveries.length === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyContainer}>
            <Text style={styles.emptyEmoji}>🎉</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              오늘 배송이 없습니다
            </Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
              관리자에게 문의하세요
            </Text>
          </Animated.View>
        ) : (
          deliveries.map((delivery, index) => (
            <DeliveryItem 
              key={delivery.id} 
              delivery={delivery} 
              index={index}
              onPress={() => handleDeliveryPress(delivery)}
            />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 14,
    marginBottom: 4,
  },
  staffName: {
    fontSize: 20,
    fontWeight: '700',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dateContainer: {
    marginBottom: 16,
  },
  dateLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  statItemFirst: {
    alignItems: 'flex-start',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  deliveryCard: {
    marginBottom: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  indexBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 14,
    fontWeight: '600',
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  phone: {
    fontSize: 14,
    marginBottom: 8,
  },
  address: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  productRow: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
  },
  productText: {
    fontSize: 14,
    fontWeight: '500',
  },
  memo: {
    fontSize: 13,
    fontStyle: 'italic',
  },
  errorContainer: {
    alignItems: 'center',
    padding: 32,
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 48,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
  },
});
