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
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  FadeInDown,
  FadeInUp,
  FadeIn,
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
import { StatusBadge, Loading, Button } from '../../src/components';
import { useTheme } from '../../src/theme';
import type { Delivery } from '../../src/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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

type FilterType = 'all' | 'pending' | 'in_transit' | 'completed';

// Stat card component - clickable for filtering
function StatCard({ value, label, color, delay, isSelected, onPress }: {
  value: number;
  label: string;
  color: string;
  delay: number;
  isSelected: boolean;
  onPress: () => void;
}) {
  const { colors, typography, radius, isDark, springs } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      entering={FadeInDown.delay(delay).duration(400).springify()}
      style={[styles.statCard, animatedStyle]}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.95, springs.snappy); }}
      onPressOut={() => { scale.value = withSpring(1, springs.snappy); }}
    >
      <View
        style={[
          styles.statCardInner,
          {
            backgroundColor: isSelected
              ? (isDark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.95)')
              : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.8)'),
            borderColor: isSelected
              ? color
              : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)'),
            borderWidth: isSelected ? 2 : 1,
            borderRadius: radius.xl,
          },
        ]}
      >
        <Text style={[typography.h2, { color, fontSize: 28, letterSpacing: -1 }]}>{value}</Text>
        <Text style={[typography.caption, { color: isSelected ? color : colors.textMuted, marginTop: 4 }]}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

// Delivery item component
function DeliveryItem({ delivery, index }: { delivery: Delivery; index: number }) {
  const { colors, radius, typography, isDark, springs } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View
      entering={FadeInDown.delay(200 + index * 50).duration(400)}
      style={animatedStyle}
    >
      <Pressable
        onPressIn={() => { scale.value = withSpring(0.98, springs.snappy); }}
        onPressOut={() => { scale.value = withSpring(1, springs.snappy); }}
      >
        <View
          style={[
            styles.deliveryCard,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
              borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
              borderRadius: radius.xl,
            },
          ]}
        >
          <View style={styles.deliveryHeader}>
            <View style={styles.deliveryInfo}>
              <Text style={[typography.h4, { color: colors.text, letterSpacing: -0.3 }]}>
                {delivery.recipientName}
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 3 }]}>
                {delivery.recipientPhone}
              </Text>
            </View>
            <StatusBadge status={delivery.status} size="sm" />
          </View>

          <Text
            style={[typography.bodySmall, { color: colors.textSecondary, marginTop: 12, lineHeight: 20 }]}
            numberOfLines={2}
          >
            {delivery.recipientAddress}
          </Text>

          <View style={styles.deliveryFooter}>
            <View
              style={[
                styles.productPill,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderRadius: radius.md,
                },
              ]}
            >
              <Text style={[typography.caption, { color: colors.textSecondary }]}>
                {delivery.productName} × {delivery.quantity}
              </Text>
            </View>
            {delivery.staffName && (
              <Text style={[typography.caption, { color: colors.textMuted }]}>
                {delivery.staffName}
              </Text>
            )}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function AdminDashboardScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const rootNavigation = navigation.getParent();
  const { colors, radius, typography, isDark, springs } = useTheme();
  const insets = useSafeAreaInsets();

  const { admin, token, logout } = useAuthStore();
  const { deliveries, isLoading, error, fetchDeliveries } = useDeliveryStore();

  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');

  // 날짜 변경 함수
  const changeDate = (days: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + days);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setSelectedDate(`${year}-${month}-${day}`);
    setSelectedFilter('all'); // 날짜 변경 시 필터 초기화
  };

  const isToday = selectedDate === getTodayString();

  const fabScale = useSharedValue(1);

  useEffect(() => {
    if (token) {
      fetchDeliveries(token, selectedDate);
    }
  }, [token, selectedDate, fetchDeliveries]);

  const stats = useMemo(
    () => ({
      total: deliveries.length,
      pending: deliveries.filter((d) => d.status === 'pending').length,
      inTransit: deliveries.filter((d) => d.status === 'in_transit').length,
      completed: deliveries.filter((d) => d.status === 'completed').length,
    }),
    [deliveries]
  );

  // Filter deliveries based on selected filter
  const filteredDeliveries = useMemo(() => {
    if (selectedFilter === 'all') return deliveries;
    return deliveries.filter((d) => d.status === selectedFilter);
  }, [deliveries, selectedFilter]);

  const handleRefresh = async () => {
    if (!token) return;
    setRefreshing(true);
    await fetchDeliveries(token, selectedDate);
    setRefreshing(false);
  };

  const handleLogout = () => {
    logout();
    rootNavigation?.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'index' }],
      })
    );
  };

  const handleGenerateQR = () => {
    router.push('/(admin)/qr-generate');
  };

  const fabAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: fabScale.value }],
  }));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background orbs */}
      <View style={styles.orbContainer} pointerEvents="none">
        <FloatingOrb color={colors.primary} size={160} initialX={-10} initialY={-5} delay={0} />
        <FloatingOrb color={colors.accent} size={100} initialX={80} initialY={8} delay={200} />
      </View>

      {/* Gradient overlay */}
      <LinearGradient
        colors={[
          'transparent',
          isDark ? 'rgba(12, 15, 20, 0.9)' : 'rgba(250, 250, 252, 0.95)',
          colors.background,
        ]}
        locations={[0, 0.3, 0.5]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* Header */}
      <Animated.View
        entering={FadeInUp.duration(500)}
        style={[styles.header, { paddingTop: insets.top + 16 }]}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={[typography.overline, { color: colors.textMuted }]}>관리자</Text>
            <Text style={[typography.body, { color: colors.text, marginTop: 2 }]} numberOfLines={1}>
              {admin?.email}
            </Text>
          </View>
          <Pressable
            style={[
              styles.logoutBtn,
              {
                backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                borderColor: isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)',
                borderRadius: radius.lg,
              },
            ]}
            onPress={handleLogout}
          >
            <Text style={[typography.caption, { color: colors.error, fontWeight: '600' }]}>로그아웃</Text>
          </Pressable>
        </View>

        {/* 날짜 네비게이션 */}
        <View style={styles.dateNav}>
          <Pressable
            style={[
              styles.dateNavBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                borderRadius: radius.lg,
              },
            ]}
            onPress={() => changeDate(-1)}
          >
            <Text style={[styles.dateNavIcon, { color: colors.textSecondary }]}>‹</Text>
          </Pressable>

          <Pressable
            style={styles.dateTextContainer}
            onPress={() => !isToday && setSelectedDate(getTodayString())}
          >
            <Text
              style={[
                typography.h1,
                {
                  color: colors.text,
                  fontSize: 26,
                  letterSpacing: -1,
                },
              ]}
            >
              {formatDate(selectedDate)}
            </Text>
            {!isToday && (
              <Text style={[typography.caption, { color: colors.primary, marginTop: 2 }]}>
                오늘로 이동
              </Text>
            )}
          </Pressable>

          <Pressable
            style={[
              styles.dateNavBtn,
              {
                backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                borderRadius: radius.lg,
              },
            ]}
            onPress={() => changeDate(1)}
          >
            <Text style={[styles.dateNavIcon, { color: colors.textSecondary }]}>›</Text>
          </Pressable>
        </View>

        {/* Stats - clickable filters */}
        <View style={styles.statsRow}>
          <StatCard
            value={stats.total}
            label="전체"
            color={colors.text}
            delay={100}
            isSelected={selectedFilter === 'all'}
            onPress={() => setSelectedFilter('all')}
          />
          <StatCard
            value={stats.pending}
            label="준비"
            color={colors.statusPending}
            delay={150}
            isSelected={selectedFilter === 'pending'}
            onPress={() => setSelectedFilter('pending')}
          />
          <StatCard
            value={stats.inTransit}
            label="배송중"
            color={colors.statusInTransit}
            delay={200}
            isSelected={selectedFilter === 'in_transit'}
            onPress={() => setSelectedFilter('in_transit')}
          />
          <StatCard
            value={stats.completed}
            label="완료"
            color={colors.statusCompleted}
            delay={250}
            isSelected={selectedFilter === 'completed'}
            onPress={() => setSelectedFilter('completed')}
          />
        </View>
      </Animated.View>

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {isLoading && !refreshing ? (
          <Loading message="배송 목록을 불러오는 중..." />
        ) : error ? (
          <View style={styles.errorBox}>
            <Text style={[typography.body, { color: colors.error, marginBottom: 16 }]}>{error}</Text>
            <Button title="다시 시도" onPress={handleRefresh} variant="outline" />
          </View>
        ) : deliveries.length === 0 ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.emptyBox}>
            <View
              style={[
                styles.emptyIcon,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text style={{ fontSize: 36 }}>📦</Text>
            </View>
            <Text style={[typography.h4, { color: colors.text, marginTop: 20 }]}>
              배송 데이터가 없습니다
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>
              PC에서 엑셀을 업로드하세요
            </Text>
          </Animated.View>
        ) : filteredDeliveries.length === 0 ? (
          <Animated.View entering={FadeIn.duration(400)} style={styles.emptyBox}>
            <View
              style={[
                styles.emptyIcon,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  borderRadius: radius.full,
                },
              ]}
            >
              <Text style={{ fontSize: 36 }}>🔍</Text>
            </View>
            <Text style={[typography.h4, { color: colors.text, marginTop: 20 }]}>
              해당 상태의 배송이 없습니다
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>
              다른 필터를 선택하세요
            </Text>
          </Animated.View>
        ) : (
          filteredDeliveries.map((delivery, index) => (
            <DeliveryItem key={delivery.id} delivery={delivery} index={index} />
          ))
        )}
      </ScrollView>

      {/* FAB */}
      <Animated.View
        entering={FadeInUp.delay(400).duration(500)}
        style={[styles.fabContainer, { bottom: insets.bottom + 24 }]}
      >
        <AnimatedPressable
          style={fabAnimatedStyle}
          onPress={handleGenerateQR}
          onPressIn={() => { fabScale.value = withSpring(0.94, springs.snappy); }}
          onPressOut={() => { fabScale.value = withSpring(1, springs.snappy); }}
        >
          <LinearGradient
            colors={[colors.primary, colors.accent]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={[styles.fab, { borderRadius: radius.full }]}
          >
            <Text style={styles.fabIcon}>⎔</Text>
            <Text style={[typography.button, { color: '#FFFFFF' }]}>QR 생성</Text>
          </LinearGradient>
        </AnimatedPressable>
      </Animated.View>
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
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  logoutBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  dateNavBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavIcon: {
    fontSize: 28,
    fontWeight: '300',
  },
  dateTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
  },
  statCard: {
    flex: 1,
  },
  statCardInner: {
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  deliveryCard: {
    padding: 16,
    borderWidth: 1,
  },
  deliveryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  deliveryInfo: {
    flex: 1,
    marginRight: 12,
  },
  deliveryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  productPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  errorBox: {
    alignItems: 'center',
    padding: 32,
  },
  emptyBox: {
    alignItems: 'center',
    padding: 48,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabContainer: {
    position: 'absolute',
    right: 20,
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingVertical: 16,
    gap: 10,
  },
  fabIcon: {
    fontSize: 20,
    color: '#FFFFFF',
  },
});
