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
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import { api } from '@/services/api';
import { useAuth } from '@/providers/AuthProvider';
import type { Delivery, DeliveryStatus } from '@/types';
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from '@/constants';
import { VersionInfo } from '@/components/VersionInfo';

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
        <View style={[styles.completedBadge, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)' }]}>
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M20 6L9 17l-5-5" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.completedText}>배송 완료</Text>
        </View>
      );
    }

    if (delivery.status === 'pending') {
      return (
        <Pressable onPress={handleStatusPress} style={styles.actionButtonWrapper}>
          <LinearGradient
            colors={['#3b82f6', '#2563eb']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.actionButton}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path d="M5 12h14M12 5l7 7-7 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.actionButtonText}>배송 출발</Text>
          </LinearGradient>
        </Pressable>
      );
    }

    return (
      <Pressable onPress={handleStatusPress} style={styles.actionButtonWrapper}>
        <LinearGradient
          colors={['#10b981', '#059669']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.actionButton}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
            <Path d="M5 13l4 4L19 7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={styles.actionButtonText}>배송 완료</Text>
        </LinearGradient>
      </Pressable>
    );
  };

  return (
    <Animated.View
      entering={FadeInDown.delay(100 + index * 40).springify()}
      layout={Layout.springify()}
    >
      <AnimatedPressable
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
          <View style={styles.recipientInfo}>
            <Text style={[styles.recipientName, { color: isDark ? '#fff' : '#1a1a2e' }]}>
              {delivery.recipientName}
            </Text>
            <Text style={[styles.phone, { color: isDark ? '#666' : '#64748b' }]}>
              {delivery.recipientPhone}
            </Text>
          </View>
          <Pressable
            onPress={handleCall}
            style={[styles.callButton, { backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : 'rgba(16,185,129,0.1)' }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
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

        {/* Address */}
        <View style={[styles.addressRow, { backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }]}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"
              stroke={isDark ? '#666' : '#94a3b8'}
              strokeWidth="1.5"
            />
            <Circle cx="12" cy="10" r="3" stroke={isDark ? '#666' : '#94a3b8'} strokeWidth="1.5" />
          </Svg>
          <Text
            style={[styles.address, { color: isDark ? '#999' : '#475569' }]}
            numberOfLines={2}
          >
            {delivery.recipientAddress}
          </Text>
        </View>

        {/* Product Info */}
        <View style={styles.productRow}>
          <View style={styles.productInfo}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"
                stroke={isDark ? '#555' : '#94a3b8'}
                strokeWidth="1.5"
              />
            </Svg>
            <Text style={[styles.productText, { color: isDark ? '#888' : '#64748b' }]}>
              {delivery.productName}
            </Text>
          </View>
          <View style={[styles.quantityBadge, { backgroundColor: isDark ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.1)' }]}>
            <Text style={[styles.quantityText, { color: '#3b82f6' }]}>×{delivery.quantity}</Text>
          </View>
        </View>

        {/* Memo */}
        {delivery.memo && (
          <View style={[styles.memoContainer, { backgroundColor: isDark ? 'rgba(251,191,36,0.08)' : 'rgba(251,191,36,0.1)' }]}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M12 9v4m0 4h.01M12 3l9.5 16.5H2.5L12 3z"
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={[styles.memoText, { color: isDark ? '#fbbf24' : '#b45309' }]}>
              {delivery.memo}
            </Text>
          </View>
        )}

        {/* Action Button - Full Width */}
        <View style={styles.cardFooter}>
          {getActionButton()}
        </View>
      </AnimatedPressable>
    </Animated.View>
  );
}

export default function StaffDeliveryList() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  // XState 기반 인증 상태 - 라우팅은 _layout.tsx에서 FSM 전이로 처리
  const { staff, logout } = useAuth();

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '로그아웃하면 다시 로그인해야 합니다.\n로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: () => logout(),
        },
      ]
    );
  };

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<'all' | DeliveryStatus>('all');

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
      } else {
        Alert.alert('오류', result.error || '상태 변경에 실패했습니다.');
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
        productName: delivery.productName,
      },
    });
  };

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    in_transit: deliveries.filter((d) => d.status === 'in_transit').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
  };

  // 선택된 필터에 따라 배송 목록 필터링
  const filteredDeliveries = selectedFilter === 'all'
    ? deliveries
    : deliveries.filter((d) => d.status === selectedFilter);

  const bgColors = isDark ? ['#0a0a12', '#12121f'] as const : ['#f0f4f8', '#e8eef5'] as const;

  // 날짜 포맷팅 (배송 목록의 날짜 또는 오늘 날짜)
  const formatDateHeader = () => {
    const targetDate = deliveries[0]?.deliveryDate
      ? new Date(deliveries[0].deliveryDate)
      : new Date();
    const month = targetDate.getMonth() + 1;
    const day = targetDate.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[targetDate.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <Animated.View
        entering={FadeInDown.delay(100).springify()}
        style={[styles.header, { borderBottomColor: isDark ? '#1a1a2e' : '#e2e8f0' }]}
      >
        <View>
          <Text style={[styles.dateText, { color: isDark ? '#10b981' : '#059669' }]}>
            {formatDateHeader()}
          </Text>
          <Text style={[styles.staffName, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            {staff?.name}님
          </Text>
        </View>
        <View style={styles.headerButtons}>
          {/* QR 다시 스캔 버튼 */}
          <Pressable
            onPress={() => router.push('/(staff)/scan')}
            style={[styles.headerBtnWithLabel, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Rect x="3" y="3" width="7" height="7" rx="1" stroke={isDark ? '#888' : '#64748b'} strokeWidth="2" />
              <Rect x="14" y="3" width="7" height="7" rx="1" stroke={isDark ? '#888' : '#64748b'} strokeWidth="2" />
              <Rect x="3" y="14" width="7" height="7" rx="1" stroke={isDark ? '#888' : '#64748b'} strokeWidth="2" />
              <Rect x="14" y="14" width="7" height="7" rx="1" stroke={isDark ? '#888' : '#64748b'} strokeWidth="2" />
            </Svg>
            <Text style={[styles.headerBtnText, { color: isDark ? '#888' : '#64748b' }]}>QR</Text>
          </Pressable>
          {/* 로그아웃 버튼 */}
          <Pressable
            onPress={handleLogout}
            style={[styles.headerBtnWithLabel, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
                stroke={isDark ? '#888' : '#64748b'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={[styles.headerBtnText, { color: isDark ? '#888' : '#64748b' }]}>로그아웃</Text>
          </Pressable>
        </View>
      </Animated.View>

      {/* Stats Bar - 필터링 가능 */}
      <Animated.View
        entering={FadeInDown.delay(150).springify()}
        style={[styles.statsBar, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
      >
        <Pressable
          style={[
            styles.statItem,
            selectedFilter === 'all' && styles.statItemSelected,
            selectedFilter === 'all' && { backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' },
          ]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.statValue, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            {stats.total}
          </Text>
          <Text style={[styles.statLabel, { color: isDark ? '#666' : '#94a3b8' }]}>전체</Text>
        </Pressable>
        <View style={[styles.statDivider, { backgroundColor: isDark ? '#2a2a3e' : '#e2e8f0' }]} />
        <Pressable
          style={[
            styles.statItem,
            selectedFilter === 'pending' && styles.statItemSelected,
            selectedFilter === 'pending' && { backgroundColor: 'rgba(245,158,11,0.15)' },
          ]}
          onPress={() => setSelectedFilter('pending')}
        >
          <Text style={[styles.statValue, { color: '#f59e0b' }]}>{stats.pending}</Text>
          <Text style={[styles.statLabel, { color: isDark ? '#666' : '#94a3b8' }]}>대기</Text>
        </Pressable>
        <View style={[styles.statDivider, { backgroundColor: isDark ? '#2a2a3e' : '#e2e8f0' }]} />
        <Pressable
          style={[
            styles.statItem,
            selectedFilter === 'in_transit' && styles.statItemSelected,
            selectedFilter === 'in_transit' && { backgroundColor: 'rgba(59,130,246,0.15)' },
          ]}
          onPress={() => setSelectedFilter('in_transit')}
        >
          <Text style={[styles.statValue, { color: '#3b82f6' }]}>{stats.in_transit}</Text>
          <Text style={[styles.statLabel, { color: isDark ? '#666' : '#94a3b8' }]}>진행</Text>
        </Pressable>
        <View style={[styles.statDivider, { backgroundColor: isDark ? '#2a2a3e' : '#e2e8f0' }]} />
        <Pressable
          style={[
            styles.statItem,
            selectedFilter === 'completed' && styles.statItemSelected,
            selectedFilter === 'completed' && { backgroundColor: 'rgba(16,185,129,0.15)' },
          ]}
          onPress={() => setSelectedFilter('completed')}
        >
          <Text style={[styles.statValue, { color: '#10b981' }]}>{stats.completed}</Text>
          <Text style={[styles.statLabel, { color: isDark ? '#666' : '#94a3b8' }]}>완료</Text>
        </Pressable>
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
          filteredDeliveries.map((delivery, index) => (
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

        {/* 버전 정보 */}
        <VersionInfo />
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
  dateText: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  staffName: {
    fontSize: 20,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerBtnWithLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 6,
  },
  headerBtnText: {
    fontSize: 13,
    fontWeight: '600',
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
    paddingVertical: 8,
    borderRadius: 10,
  },
  statItemSelected: {
    borderRadius: 10,
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
    padding: 18,
    borderRadius: 20,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
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
    marginBottom: 10,
  },
  recipientInfo: {
    flex: 1,
  },
  recipientName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 2,
  },
  callButton: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  phone: {
    fontSize: 14,
    fontWeight: '500',
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  address: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  productInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  productText: {
    fontSize: 14,
    fontWeight: '500',
  },
  quantityBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  quantityText: {
    fontSize: 14,
    fontWeight: '700',
  },
  cardFooter: {
    marginTop: 4,
  },
  actionButtonWrapper: {
    borderRadius: 14,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  completedText: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '700',
  },
  memoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  memoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
  },
});
