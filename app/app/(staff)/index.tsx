import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  useColorScheme,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
  Layout,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { Delivery, DeliveryStatus } from '@/types';
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from '@/constants';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface DeliveryCardProps {
  delivery: Delivery;
  index: number;
  isDark: boolean;
  onPress: () => void;
  onStatusChange: (id: string, status: DeliveryStatus) => void;
}

function DeliveryCard({ delivery, index, isDark, onPress, onStatusChange }: DeliveryCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleStatusPress = () => {
    if (delivery.status === 'pending') {
      onStatusChange(delivery.id, 'in_transit');
    } else if (delivery.status === 'in_transit') {
      onPress();
    }
  };

  const handleCall = () => {
    Linking.openURL(`tel:${delivery.recipientPhone}`);
  };

  const getActionButton = () => {
    if (delivery.status === 'completed') {
      return (
        <View style={[styles.completedBadge, { backgroundColor: '#10b98120' }]}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M20 6L9 17l-5-5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.completedText}>완료</Text>
        </View>
      );
    }

    if (delivery.status === 'pending') {
      return (
        <Pressable onPress={handleStatusPress}>
          <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.actionButton}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12h14M12 5l7 7-7 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.actionButtonText}>출발</Text>
          </LinearGradient>
        </Pressable>
      );
    }

    return (
      <Pressable onPress={handleStatusPress}>
        <LinearGradient colors={['#10b981', '#059669']} style={styles.actionButton}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.actionButtonText}>완료</Text>
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(100 + index * 40).springify()}
      layout={Layout.springify()}
      style={[
        styles.deliveryCard,
        { backgroundColor: isDark ? '#1a1a2e' : '#fff' },
        animatedStyle,
      ]}
      onPressIn={() => {
        scale.value = withSpring(0.98, { damping: 15, stiffness: 400 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 400 });
      }}
    >
      {/* Header Row */}
      <View style={styles.cardHeader}>
        <View style={[styles.statusBadge, { backgroundColor: `${DELIVERY_STATUS_COLORS[delivery.status]}15` }]}>
          <View style={[styles.statusDot, { backgroundColor: DELIVERY_STATUS_COLORS[delivery.status] }]} />
          <Text style={[styles.statusText, { color: DELIVERY_STATUS_COLORS[delivery.status] }]}>
            {DELIVERY_STATUS_LABELS[delivery.status]}
          </Text>
        </View>
        <Text style={[styles.orderNumber, { color: isDark ? '#444' : '#cbd5e1' }]}>
          #{delivery.id.slice(-6).toUpperCase()}
        </Text>
      </View>

      {/* Recipient Info */}
      <View style={styles.recipientRow}>
        <Text style={[styles.recipientName, { color: isDark ? '#fff' : '#1a1a2e' }]}>
          {delivery.recipientName}
        </Text>
        <Pressable onPress={handleCall} style={styles.callButton}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"
              stroke="#10b981"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </View>

      {/* Phone */}
      <Text style={[styles.phone, { color: isDark ? '#666' : '#64748b' }]}>
        {delivery.recipientPhone}
      </Text>

      {/* Address */}
      <Text
        style={[styles.address, { color: isDark ? '#888' : '#475569' }]}
        numberOfLines={2}
      >
        {delivery.recipientAddress}
      </Text>

      {/* Product & Action */}
      <View style={styles.cardFooter}>
        <View style={styles.productInfo}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
              stroke={isDark ? '#555' : '#94a3b8'}
              strokeWidth="1.5"
            />
          </Svg>
          <Text style={[styles.productText, { color: isDark ? '#888' : '#64748b' }]}>
            {delivery.productName} × {delivery.quantity}
          </Text>
        </View>

        {getActionButton()}
      </View>

      {/* Memo */}
      {delivery.memo && (
        <View style={[styles.memoContainer, { backgroundColor: isDark ? '#0f0f1a' : '#f8fafc' }]}>
          <Text style={[styles.memoText, { color: isDark ? '#888' : '#64748b' }]}>
            {delivery.memo}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}

export default function StaffDeliveryList() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { staff, logout } = useAuthStore();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeliveries = useCallback(async () => {
    if (!staff?.name) return;

    try {
      const result = await api.getStaffDeliveries(staff.name);
      if (result.success && result.data) {
        setDeliveries(result.data.deliveries);
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [staff?.name]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDeliveries();
  }, [fetchDeliveries]);

  const handleStatusChange = async (id: string, status: DeliveryStatus) => {
    try {
      const result = await api.updateDeliveryStatus(id, status);
      if (result.success) {
        setDeliveries((prev) =>
          prev.map((d) => (d.id === id ? { ...d, status } : d))
        );
      }
    } catch (error) {
      Alert.alert('오류', '상태 변경에 실패했습니다.');
    }
  };

  const handleComplete = (delivery: Delivery) => {
    router.push({
      pathname: '/(staff)/complete',
      params: {
        deliveryId: delivery.id,
        recipientPhone: delivery.recipientPhone,
        recipientName: delivery.recipientName,
      },
    });
  };

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    in_transit: deliveries.filter((d) => d.status === 'in_transit').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
  };

  const bgColors = isDark ? ['#0a0a12', '#12121f'] : ['#f0f4f8', '#e8eef5'];

  return (
    <View style={styles.container}>
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(100).springify()}
        style={[styles.header, { borderBottomColor: isDark ? '#1a1a2e' : '#e2e8f0' }]}
      >
        <View>
          <Text style={[styles.greeting, { color: isDark ? '#666' : '#64748b' }]}>
            오늘의 배송
          </Text>
          <Text style={[styles.staffName, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            {staff?.name}님
          </Text>
        </View>
        <Pressable
          onPress={logout}
          style={[styles.logoutBtn, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
              stroke={isDark ? '#888' : '#64748b'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </Animated.View>

      {/* Stats Bar */}
      <Animated.View
        entering={FadeInDown.delay(150).springify()}
        style={[styles.statsBar, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
      >
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            {stats.total}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#666' : '#94a3b8' }]}>전체</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: isDark ? '#2a2a3e' : '#e2e8f0' }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.pending}</Text>
          <Text style={[styles.statLabel, { color: isDark ? '#666' : '#94a3b8' }]}>대기</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: isDark ? '#2a2a3e' : '#e2e8f0' }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.in_transit}</Text>
          <Text style={[styles.statLabel, { color: isDark ? '#666' : '#94a3b8' }]}>진행</Text>
        </View>
        <View style={[styles.statDivider, { backgroundColor: isDark ? '#2a2a3e' : '#e2e8f0' }]} />
        <View style={styles.statItem}>
          <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.completed}</Text>
          <Text style={[styles.statLabel, { color: isDark ? '#666' : '#94a3b8' }]}>완료</Text>
        </View>
      </Animated.View>

      {/* Deliveries List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#10b981' : '#059669'}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <Text style={[styles.loadingText, { color: isDark ? '#666' : '#94a3b8' }]}>
              로딩 중...
            </Text>
          </View>
        ) : deliveries.length === 0 ? (
          <Animated.View
            entering={FadeInDown.delay(200).springify()}
            style={styles.emptyContainer}
          >
            <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                stroke={isDark ? '#333' : '#cbd5e1'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={[styles.emptyText, { color: isDark ? '#555' : '#94a3b8' }]}>
              오늘 배송할 건이 없습니다
            </Text>
          </Animated.View>
        ) : (
          deliveries.map((delivery, index) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              index={index}
              isDark={isDark}
              onPress={() => handleComplete(delivery)}
              onStatusChange={handleStatusChange}
            />
          ))
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  staffName: {
    fontSize: 20,
    fontWeight: '700',
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsBar: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 16,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: '100%',
    marginHorizontal: 8,
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  deliveryCard: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  orderNumber: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '700',
  },
  callButton: {
    padding: 8,
  },
  phone: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 2,
    marginBottom: 8,
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
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productText: {
    fontSize: 13,
    fontWeight: '500',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  completedText: {
    color: '#10b981',
    fontSize: 13,
    fontWeight: '600',
  },
  memoContainer: {
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
  },
  memoText: {
    fontSize: 13,
    lineHeight: 18,
  },
});
