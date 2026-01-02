import { useEffect, useState, useCallback, useMemo } from 'react';
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
  Modal,
  TextInput,
  Alert,
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
  FadeIn,
  Layout,
} from 'react-native-reanimated';
import Svg, { Path, Circle, Rect } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';
import type { Delivery, DeliveryStatus } from '@/types';
import { DELIVERY_STATUS_LABELS, DELIVERY_STATUS_COLORS } from '@/constants';
import { VersionInfo } from '@/components/VersionInfo';

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

// 필터 타입
type FilterType = 'all' | 'status' | 'staff';

export default function AdminDashboard() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const { admin, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      '로그아웃',
      '로그아웃하면 다시 로그인해야 합니다.\n로그아웃 하시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '로그아웃',
          style: 'destructive',
          onPress: async () => {
            await logout();
            // 루트로 이동
            router.replace('/');
          },
        },
      ]
    );
  };

  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // QR 모달 상태
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrData, setQrData] = useState<string>('');
  const [isQRLoading, setIsQRLoading] = useState(false);

  // 필터링 상태
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  const fabScale = useSharedValue(0);

  // 담당자 목록
  const [staffList, setStaffList] = useState<string[]>([]);

  useEffect(() => {
    fabScale.value = withDelay(500, withSpring(1, { damping: 12, stiffness: 100 }));
  }, []);

  // 인증 상태 체크: 로그아웃되면 홈으로 이동
  useEffect(() => {
    if (!isLoading && !admin) {
      router.replace('/');
    }
  }, [isLoading, admin, router]);

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

  // 담당자 목록 조회
  const fetchStaffList = useCallback(async () => {
    try {
      const result = await api.getStaffList();
      if (result.success && result.data) {
        setStaffList(result.data.staff);
      }
    } catch (error) {
      console.error('Failed to fetch staff list:', error);
    }
  }, []);

  useEffect(() => {
    fetchDeliveries();
    fetchStaffList();
  }, [fetchDeliveries, fetchStaffList]);

  // 필터링된 배송 목록
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      // 상태 필터
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      // 담당자 필터
      if (staffFilter !== 'all' && d.staffName !== staffFilter) return false;
      // 검색어 필터 (수령인, 주소, 상품명)
      if (searchText) {
        const search = searchText.toLowerCase();
        const matchRecipient = d.recipientName.toLowerCase().includes(search);
        const matchAddress = d.recipientAddress.toLowerCase().includes(search);
        const matchProduct = d.productName.toLowerCase().includes(search);
        if (!matchRecipient && !matchAddress && !matchProduct) return false;
      }
      return true;
    });
  }, [deliveries, statusFilter, staffFilter, searchText]);

  // QR 토큰 생성 (API 호출)
  const generateQRToken = useCallback(async () => {
    setIsQRLoading(true);
    setQrData('');
    try {
      const result = await api.generateQRToken(selectedDate);
      if (result.success && result.data?.token) {
        const qrPayload = JSON.stringify({
          token: result.data.token,
          date: selectedDate,
        });
        setQrData(qrPayload);
      } else {
        Alert.alert('오류', result.error || 'QR 코드 생성에 실패했습니다.');
      }
    } catch {
      Alert.alert('오류', 'QR 코드 생성에 실패했습니다.');
    } finally {
      setIsQRLoading(false);
    }
  }, [selectedDate]);

  // QR 모달이 열릴 때 토큰 생성
  useEffect(() => {
    if (showQRModal) {
      generateQRToken();
    }
  }, [showQRModal, generateQRToken]);

  // 활성 필터 개수
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (staffFilter !== 'all') count++;
    if (searchText) count++;
    return count;
  }, [statusFilter, staffFilter, searchText]);

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

  // 전체 통계 (필터 무관)
  const totalStats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    in_transit: deliveries.filter((d) => d.status === 'in_transit').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
  };

  // 필터 초기화
  const clearFilters = () => {
    setStatusFilter('all');
    setStaffFilter('all');
    setSearchText('');
  };

  const bgColors = isDark ? ['#0a0a12', '#12121f'] as const : ['#f0f4f8', '#e8eef5'] as const;

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
          onPress={handleLogout}
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
          value={totalStats.total}
          color={isDark ? '#fff' : '#1a1a2e'}
          bgColor={isDark ? '#1a1a2e' : '#fff'}
          delay={200}
        />
        <StatCard
          label="준비"
          value={totalStats.pending}
          color="#f59e0b"
          bgColor={isDark ? '#f59e0b15' : '#fef3c7'}
          delay={250}
        />
        <StatCard
          label="배송"
          value={totalStats.in_transit}
          color="#3b82f6"
          bgColor={isDark ? '#3b82f615' : '#dbeafe'}
          delay={300}
        />
        <StatCard
          label="완료"
          value={totalStats.completed}
          color="#10b981"
          bgColor={isDark ? '#10b98115' : '#d1fae5'}
          delay={350}
        />
      </View>

      {/* Filter Bar */}
      <Animated.View
        entering={FadeInDown.delay(200).springify()}
        style={styles.filterBar}
      >
        {/* Search Input */}
        <View style={[styles.searchContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              stroke={isDark ? '#666' : '#94a3b8'}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Svg>
          <TextInput
            style={[styles.searchInput, { color: isDark ? '#fff' : '#1a1a2e' }]}
            placeholder="검색 (수령인, 주소, 상품)"
            placeholderTextColor={isDark ? '#666' : '#94a3b8'}
            value={searchText}
            onChangeText={setSearchText}
          />
          {searchText ? (
            <Pressable onPress={() => setSearchText('')}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M18 6L6 18M6 6l12 12"
                  stroke={isDark ? '#666' : '#94a3b8'}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
            </Pressable>
          ) : null}
        </View>

        {/* Filter Button */}
        <Pressable
          style={[
            styles.filterButton,
            { backgroundColor: isDark ? '#1a1a2e' : '#fff' },
            activeFilterCount > 0 && styles.filterButtonActive,
          ]}
          onPress={() => setShowFilterModal(true)}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 4h18M7 9h10M10 14h4"
              stroke={activeFilterCount > 0 ? '#3b82f6' : (isDark ? '#888' : '#64748b')}
              strokeWidth="2"
              strokeLinecap="round"
            />
          </Svg>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </Pressable>
      </Animated.View>

      {/* Active Filters Display */}
      {activeFilterCount > 0 && (
        <Animated.View entering={FadeIn.springify()} style={styles.activeFilters}>
          {statusFilter !== 'all' && (
            <View style={[styles.filterChip, { backgroundColor: `${DELIVERY_STATUS_COLORS[statusFilter]}20` }]}>
              <Text style={[styles.filterChipText, { color: DELIVERY_STATUS_COLORS[statusFilter] }]}>
                {DELIVERY_STATUS_LABELS[statusFilter]}
              </Text>
              <Pressable onPress={() => setStatusFilter('all')}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke={DELIVERY_STATUS_COLORS[statusFilter]} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
          )}
          {staffFilter !== 'all' && (
            <View style={[styles.filterChip, { backgroundColor: isDark ? '#3b82f620' : '#dbeafe' }]}>
              <Text style={[styles.filterChipText, { color: '#3b82f6' }]}>{staffFilter}</Text>
              <Pressable onPress={() => setStaffFilter('all')}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>
          )}
          <Pressable onPress={clearFilters} style={styles.clearAllButton}>
            <Text style={styles.clearAllText}>전체 해제</Text>
          </Pressable>
        </Animated.View>
      )}

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
        ) : filteredDeliveries.length === 0 ? (
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
              {activeFilterCount > 0 ? '필터 조건에 맞는 배송이 없습니다' : '배송 데이터가 없습니다'}
            </Text>
            <Text style={[styles.emptyHint, { color: isDark ? '#444' : '#cbd5e1' }]}>
              {activeFilterCount > 0 ? '필터를 조정해보세요' : 'PC 웹에서 엑셀을 업로드하세요'}
            </Text>
          </Animated.View>
        ) : (
          filteredDeliveries.map((delivery, index) => (
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
            onPress={() => Linking.openURL('https://deliver-mgmt-worker.coreanq.workers.dev')}
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

        <VersionInfo />
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* FAB - Show QR */}
      <AnimatedPressable
        style={[styles.fab, fabStyle]}
        onPress={() => setShowQRModal(true)}
      >
        <LinearGradient
          colors={['#3b82f6', '#1d4ed8']}
          style={styles.fabGradient}
        >
          <Svg width={28} height={28} viewBox="0 0 24 24" fill="none">
            <Rect x="3" y="3" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2" />
            <Rect x="14" y="3" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2" />
            <Rect x="3" y="14" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2" />
            <Rect x="14" y="14" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2" />
          </Svg>
        </LinearGradient>
      </AnimatedPressable>

      {/* QR Modal */}
      <Modal
        visible={showQRModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowQRModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowQRModal(false)}
        >
          <Pressable
            style={[styles.qrModalContent, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.qrModalHeader}>
              <Text style={[styles.qrModalTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>
                배송담당자 QR
              </Text>
              <Pressable onPress={() => setShowQRModal(false)}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke={isDark ? '#888' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>

            <View style={styles.qrWrapper}>
              {qrData ? (
                <QRCode
                  value={qrData}
                  size={200}
                  backgroundColor={isDark ? '#1a1a2e' : '#fff'}
                  color={isDark ? '#fff' : '#1a1a2e'}
                />
              ) : (
                <Text style={{ color: isDark ? '#666' : '#94a3b8' }}>QR 생성 중...</Text>
              )}
            </View>

            <View style={styles.qrInfo}>
              <View style={[styles.qrInfoItem, { backgroundColor: isDark ? '#0f0f1a' : '#f8fafc' }]}>
                <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                  <Path d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" />
                </Svg>
                <Text style={[styles.qrInfoText, { color: isDark ? '#888' : '#64748b' }]}>
                  {dateInfo.month}월 {dateInfo.day}일 ({dateInfo.weekday})
                </Text>
              </View>
            </View>

            <Text style={[styles.qrHint, { color: isDark ? '#666' : '#94a3b8' }]}>
              배송담당자가 이 QR을 스캔하면{'\n'}이름 입력 후 배송 목록을 확인할 수 있습니다
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowFilterModal(false)}
        >
          <Pressable
            style={[styles.filterModalContent, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.filterModalHeader}>
              <Text style={[styles.filterModalTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>
                필터
              </Text>
              <Pressable onPress={() => setShowFilterModal(false)}>
                <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                  <Path d="M18 6L6 18M6 6l12 12" stroke={isDark ? '#888' : '#64748b'} strokeWidth="2" strokeLinecap="round" />
                </Svg>
              </Pressable>
            </View>

            {/* Status Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: isDark ? '#888' : '#64748b' }]}>상태</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
                <Pressable
                  style={[
                    styles.filterOption,
                    { backgroundColor: isDark ? '#0f0f1a' : '#f8fafc' },
                    statusFilter === 'all' && styles.filterOptionActive,
                  ]}
                  onPress={() => setStatusFilter('all')}
                >
                  <Text style={[styles.filterOptionText, statusFilter === 'all' && styles.filterOptionTextActive]}>전체</Text>
                </Pressable>
                {(['pending', 'in_transit', 'completed'] as DeliveryStatus[]).map((status) => (
                  <Pressable
                    key={status}
                    style={[
                      styles.filterOption,
                      { backgroundColor: isDark ? '#0f0f1a' : '#f8fafc' },
                      statusFilter === status && { backgroundColor: `${DELIVERY_STATUS_COLORS[status]}20`, borderColor: DELIVERY_STATUS_COLORS[status] },
                    ]}
                    onPress={() => setStatusFilter(status)}
                  >
                    <Text style={[styles.filterOptionText, statusFilter === status && { color: DELIVERY_STATUS_COLORS[status] }]}>
                      {DELIVERY_STATUS_LABELS[status]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Staff Filter */}
            <View style={styles.filterSection}>
              <Text style={[styles.filterSectionTitle, { color: isDark ? '#888' : '#64748b' }]}>담당자</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterOptions}>
                <Pressable
                  style={[
                    styles.filterOption,
                    { backgroundColor: isDark ? '#0f0f1a' : '#f8fafc' },
                    staffFilter === 'all' && styles.filterOptionActive,
                  ]}
                  onPress={() => setStaffFilter('all')}
                >
                  <Text style={[styles.filterOptionText, staffFilter === 'all' && styles.filterOptionTextActive]}>전체</Text>
                </Pressable>
                {staffList.map((staff) => (
                  <Pressable
                    key={staff}
                    style={[
                      styles.filterOption,
                      { backgroundColor: isDark ? '#0f0f1a' : '#f8fafc' },
                      staffFilter === staff && styles.filterOptionActive,
                    ]}
                    onPress={() => setStaffFilter(staff)}
                  >
                    <Text style={[styles.filterOptionText, staffFilter === staff && styles.filterOptionTextActive]}>{staff}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>

            {/* Apply Button */}
            <Pressable
              style={styles.applyFilterButton}
              onPress={() => setShowFilterModal(false)}
            >
              <LinearGradient colors={['#3b82f6', '#1d4ed8']} style={styles.applyFilterGradient}>
                <Text style={styles.applyFilterText}>적용하기</Text>
              </LinearGradient>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  // Filter styles
  filterBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 12,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  filterButtonActive: {
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: '#3b82f6',
    width: 16,
    height: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  activeFilters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  clearAllButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    textDecorationLine: 'underline',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrModalContent: {
    width: SCREEN_WIDTH - 48,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  qrModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 24,
  },
  qrModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
  },
  qrInfo: {
    width: '100%',
    marginBottom: 16,
  },
  qrInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 8,
  },
  qrInfoText: {
    fontSize: 15,
    fontWeight: '600',
  },
  qrHint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
  },
  // Filter Modal styles
  filterModalContent: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  filterModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  filterModalTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  filterSection: {
    marginBottom: 20,
  },
  filterSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
  },
  filterOptions: {
    flexDirection: 'row',
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  filterOptionActive: {
    backgroundColor: '#3b82f620',
    borderColor: '#3b82f6',
  },
  filterOptionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  filterOptionTextActive: {
    color: '#3b82f6',
  },
  applyFilterButton: {
    marginTop: 8,
    borderRadius: 14,
    overflow: 'hidden',
  },
  applyFilterGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  applyFilterText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
