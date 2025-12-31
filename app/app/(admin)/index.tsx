import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  RefreshControl,
  useColorScheme,
  StyleSheet,
  Dimensions,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withDelay,
  withTiming,
  FadeInDown,
  FadeInUp,
  Layout,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { Delivery, DeliveryStatus } from '@/types';
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from '@/constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// Status icons
const StatusIcon = ({ status }: { status: DeliveryStatus }) => {
  const color = DELIVERY_STATUS_COLORS[status];

  if (status === 'pending') {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
        <Path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </Svg>
    );
  }
  if (status === 'in_transit') {
    return (
      <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
        <Path d="M1 12h16M12 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    );
  }
  return (
    <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
      <Path d="M20 6L9 17l-5-5" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  color: string;
  bgColor: string;
  delay: number;
}

function StatCard({ label, value, color, bgColor, delay }: StatCardProps) {
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).springify()}
      style={[styles.statCard, { backgroundColor: bgColor }]}
    >
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Animated.View>
  );
}

interface DeliveryCardProps {
  delivery: Delivery;
  index: number;
  isDark: boolean;
}

function DeliveryCard({ delivery, index, isDark }: DeliveryCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(100 + index * 50).springify()}
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
      {/* Status Badge */}
      <View style={[styles.statusBadge, { backgroundColor: `${DELIVERY_STATUS_COLORS[delivery.status]}15` }]}>
        <StatusIcon status={delivery.status} />
        <Text style={[styles.statusText, { color: DELIVERY_STATUS_COLORS[delivery.status] }]}>
          {DELIVERY_STATUS_LABELS[delivery.status]}
        </Text>
      </View>

      {/* Recipient Info */}
      <View style={styles.recipientRow}>
        <Text style={[styles.recipientName, { color: isDark ? '#fff' : '#1a1a2e' }]}>
          {delivery.recipientName}
        </Text>
        {delivery.staffName && (
          <View style={[styles.staffBadge, { backgroundColor: isDark ? '#2a2a3e' : '#f0f4f8' }]}>
            <Text style={[styles.staffName, { color: isDark ? '#888' : '#64748b' }]}>
              {delivery.staffName}
            </Text>
          </View>
        )}
      </View>

      {/* Address */}
      <Text
        style={[styles.address, { color: isDark ? '#666' : '#64748b' }]}
        numberOfLines={2}
      >
        {delivery.recipientAddress}
      </Text>

      {/* Product */}
      <View style={styles.productRow}>
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
    </AnimatedPressable>
  );
}

export default function AdminDashboard() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { admin, logout } = useAuthStore();

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fabScale = useSharedValue(0);

  useEffect(() => {
    fabScale.value = withDelay(500, withSpring(1, { damping: 12, stiffness: 100 }));
  }, []);

  const fabStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  const fetchDeliveries = useCallback(async () => {
    try {
      const result = await api.getDeliveryList(selectedDate);
      if (result.success && result.data) {
        setDeliveries(result.data.deliveries);
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchDeliveries();
  }, [fetchDeliveries]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDeliveries();
  }, [fetchDeliveries]);

  const handleDateChange = (days: number) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + days);
    setSelectedDate(date.toISOString().split('T')[0]);
    setIsLoading(true);
  };

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    in_transit: deliveries.filter((d) => d.status === 'in_transit').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
  };

  const bgColors = isDark ? ['#0a0a12', '#12121f'] : ['#f0f4f8', '#e8eef5'];

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return { month, day, weekday };
  };

  const dateInfo = formatDate(selectedDate);
  const isToday = selectedDate === new Date().toISOString().split('T')[0];

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
            안녕하세요
          </Text>
          <Text style={[styles.email, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            {admin?.email}
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

      {/* Date Selector */}
      <Animated.View
        entering={FadeInDown.delay(150).springify()}
        style={styles.dateSelector}
      >
        <Pressable onPress={() => handleDateChange(-1)} style={styles.dateArrow}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M15 18l-6-6 6-6"
              stroke={isDark ? '#888' : '#64748b'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>

        <View style={styles.dateDisplay}>
          <Text style={[styles.dateMonth, { color: isDark ? '#666' : '#94a3b8' }]}>
            {dateInfo.month}월
          </Text>
          <Text style={[styles.dateDay, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            {dateInfo.day}
          </Text>
          <View style={styles.dateWeekdayContainer}>
            <Text style={[styles.dateWeekday, { color: isDark ? '#3b82f6' : '#1d4ed8' }]}>
              {dateInfo.weekday}
            </Text>
            {isToday && (
              <View style={styles.todayBadge}>
                <Text style={styles.todayText}>오늘</Text>
              </View>
            )}
          </View>
        </View>

        <Pressable onPress={() => handleDateChange(1)} style={styles.dateArrow}>
          <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
            <Path
              d="M9 18l6-6-6-6"
              stroke={isDark ? '#888' : '#64748b'}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
      </Animated.View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <StatCard
          label="전체"
          value={stats.total}
          color={isDark ? '#fff' : '#1a1a2e'}
          bgColor={isDark ? '#1a1a2e' : '#fff'}
          delay={200}
        />
        <StatCard
          label="준비"
          value={stats.pending}
          color="#f59e0b"
          bgColor={isDark ? '#f59e0b15' : '#fef3c7'}
          delay={250}
        />
        <StatCard
          label="배송"
          value={stats.in_transit}
          color="#3b82f6"
          bgColor={isDark ? '#3b82f615' : '#dbeafe'}
          delay={300}
        />
        <StatCard
          label="완료"
          value={stats.completed}
          color="#10b981"
          bgColor={isDark ? '#10b98115' : '#d1fae5'}
          delay={350}
        />
      </View>

      {/* Deliveries List */}
      <ScrollView
        style={styles.listContainer}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? '#3b82f6' : '#1d4ed8'}
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
                d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                stroke={isDark ? '#333' : '#cbd5e1'}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
            <Text style={[styles.emptyText, { color: isDark ? '#555' : '#94a3b8' }]}>
              배송 데이터가 없습니다
            </Text>
            <Text style={[styles.emptyHint, { color: isDark ? '#444' : '#cbd5e1' }]}>
              PC 웹에서 엑셀을 업로드하세요
            </Text>
          </Animated.View>
        ) : (
          deliveries.map((delivery, index) => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              index={index}
              isDark={isDark}
            />
          ))
        )}

        {/* PC Web Link */}
        <Animated.View entering={FadeInDown.delay(400).springify()}>
          <Pressable
            style={[styles.pcWebLink, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
            onPress={() => Linking.openURL('https://try-dabble.com')}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M21 12a9 9 0 11-18 0 9 9 0 0118 0zM3.6 9h16.8M3.6 15h16.8"
                stroke={isDark ? '#3b82f6' : '#1d4ed8'}
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <Path
                d="M12 3a15.3 15.3 0 014 9 15.3 15.3 0 01-4 9 15.3 15.3 0 01-4-9 15.3 15.3 0 014-9z"
                stroke={isDark ? '#3b82f6' : '#1d4ed8'}
                strokeWidth="1.5"
              />
            </Svg>
            <Text style={[styles.pcWebText, { color: isDark ? '#3b82f6' : '#1d4ed8' }]}>
              PC 웹에서 엑셀 업로드하기
            </Text>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path
                d="M7 17L17 7M17 7H7M17 7v10"
                stroke={isDark ? '#3b82f6' : '#1d4ed8'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB - Generate QR */}
      <AnimatedPressable
        style={[styles.fab, fabStyle]}
        onPress={() => router.push('/(admin)/qr-generate')}
      >
        <LinearGradient
          colors={['#3b82f6', '#1d4ed8']}
          style={styles.fabGradient}
        >
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 3h6v6H3V3zM15 3h6v6h-6V3zM3 15h6v6H3v-6zM15 15h6v6h-6v-6z"
              stroke="#fff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </LinearGradient>
      </AnimatedPressable>
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
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  greeting: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  email: {
    fontSize: 17,
    fontWeight: '700',
  },
  logoutBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 24,
  },
  dateArrow: {
    padding: 8,
  },
  dateDisplay: {
    alignItems: 'center',
  },
  dateMonth: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 2,
  },
  dateDay: {
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1,
  },
  dateWeekdayContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  dateWeekday: {
    fontSize: 14,
    fontWeight: '600',
  },
  todayBadge: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  todayText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    padding: 12,
    borderRadius: 14,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#64748b',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
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
  emptyHint: {
    fontSize: 13,
    marginTop: 4,
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
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  recipientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  recipientName: {
    fontSize: 17,
    fontWeight: '700',
  },
  staffBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  staffName: {
    fontSize: 11,
    fontWeight: '600',
  },
  address: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 10,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  productText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pcWebLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  pcWebText: {
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 32,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  fabGradient: {
    width: 64,
    height: 64,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
