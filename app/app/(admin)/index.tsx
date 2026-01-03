import { useEffect, useState, useMemo } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  Pressable,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { useDeliveryStore } from '../../src/stores/delivery';
import { Card, StatusBadge, Loading, Button } from '../../src/components';
import { useTheme } from '../../src/theme';
import type { Delivery } from '../../src/types';

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

interface DeliveryCardProps {
  delivery: Delivery;
  index: number;
}

function DeliveryCard({ delivery, index }: DeliveryCardProps) {
  const { colors, radius } = useTheme();

  return (
    <Card delay={index * 50} style={styles.deliveryCard}>
      <View style={styles.cardHeader}>
        <View style={styles.recipientInfo}>
          <Text style={[styles.recipientName, { color: colors.text }]}>
            {delivery.recipientName}
          </Text>
          <Text style={[styles.recipientPhone, { color: colors.textSecondary }]}>
            {delivery.recipientPhone}
          </Text>
        </View>
        <StatusBadge status={delivery.status} size="sm" />
      </View>

      <Text 
        style={[styles.address, { color: colors.textSecondary }]}
        numberOfLines={2}
      >
        {delivery.recipientAddress}
      </Text>

      <View style={styles.cardFooter}>
        <View style={[
          styles.productBadge, 
          { 
            backgroundColor: colors.surfaceSecondary,
            borderRadius: radius.md,
          }
        ]}>
          <Text style={[styles.productText, { color: colors.textSecondary }]}>
            {delivery.productName} x {delivery.quantity}
          </Text>
        </View>
        {delivery.staffName && (
          <Text style={[styles.staffName, { color: colors.textTertiary }]}>
            {delivery.staffName}
          </Text>
        )}
      </View>
    </Card>
  );
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const { colors, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { admin, token, logout, isAuthenticated } = useAuthStore();
  const { deliveries, isLoading, error, fetchDeliveries } = useDeliveryStore();
  
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (token) {
      fetchDeliveries(token, selectedDate);
    }
  }, [token, selectedDate, fetchDeliveries]);

  const stats = useMemo(() => ({
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    inTransit: deliveries.filter((d) => d.status === 'in_transit').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
  }), [deliveries]);

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    await fetchDeliveries(token, selectedDate);
    setRefreshing(false);
  };

  const handleLogout = () => {
    logout();
    router.replace('/(admin)/login');
  };

  const handleGenerateQR = () => {
    router.push('/(admin)/qr-generate');
  };

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
              안녕하세요
            </Text>
            <Text style={[styles.email, { color: colors.text }]} numberOfLines={1}>
              {admin?.email}
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
            {formatDate(selectedDate)}
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
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
            <Text style={styles.emptyEmoji}>📦</Text>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              배송 데이터가 없습니다
            </Text>
            <Text style={[styles.emptyDescription, { color: colors.textSecondary }]}>
              PC에서 엑셀을 업로드하세요
            </Text>
          </Animated.View>
        ) : (
          deliveries.map((delivery, index) => (
            <DeliveryCard key={delivery.id} delivery={delivery} index={index} />
          ))
        )}
      </ScrollView>

      <Animated.View 
        entering={FadeInUp.delay(300).duration(400)}
        style={[styles.fab, { bottom: insets.bottom + 24 }]}
      >
        <Pressable 
          style={[
            styles.fabButton,
            { 
              backgroundColor: colors.primary,
              borderRadius: radius.full,
            },
            shadows.lg,
          ]}
          onPress={handleGenerateQR}
        >
          <Text style={styles.fabIcon}>📱</Text>
          <Text style={[styles.fabText, { color: colors.textInverse }]}>QR 생성</Text>
        </Pressable>
      </Animated.View>
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
  email: {
    fontSize: 16,
    fontWeight: '600',
    maxWidth: 200,
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
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 60,
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
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  recipientInfo: {
    flex: 1,
    marginRight: 12,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  recipientPhone: {
    fontSize: 14,
  },
  address: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  productText: {
    fontSize: 13,
    fontWeight: '500',
  },
  staffName: {
    fontSize: 13,
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
  fab: {
    position: 'absolute',
    right: 20,
  },
  fabButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  fabIcon: {
    fontSize: 20,
  },
  fabText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
