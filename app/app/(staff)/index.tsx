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
        <Text style={[typography.h2, { color, fontSize: 26, letterSpacing: -1 }]}>{value}</Text>
        <Text style={[typography.caption, { color: isSelected ? color : colors.textMuted, marginTop: 4 }]}>{label}</Text>
      </View>
    </AnimatedPressable>
  );
}

// Delivery item component
function DeliveryItem({ delivery, index, onPress }: {
  delivery: Delivery;
  index: number;
  onPress: () => void;
}) {
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
        onPress={onPress}
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
          <View style={styles.cardHeader}>
            <LinearGradient
              colors={[colors.accent, colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={[styles.indexBadge, { borderRadius: radius.full }]}
            >
              <Text style={styles.indexText}>{index + 1}</Text>
            </LinearGradient>
            <StatusBadge status={delivery.status} size="sm" showPulse={delivery.status === 'in_transit'} />
          </View>

          <Text style={[typography.h4, { color: colors.text, marginTop: 14, letterSpacing: -0.3 }]}>
            {delivery.recipientName}
          </Text>
          <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
            {delivery.recipientPhone}
          </Text>

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
          </View>

          {delivery.memo && (
            <Text style={[typography.caption, { color: colors.textMuted, marginTop: 10, fontStyle: 'italic' }]}>
              {delivery.memo}
            </Text>
          )}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export default function StaffDeliveryListScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const rootNavigation = navigation.getParent();
  const { colors, radius, typography, isDark, springs } = useTheme();
  const insets = useSafeAreaInsets();

  const { staff, token, logout } = useAuthStore();
  const { deliveries, isLoading, error, fetchStaffDeliveries } = useDeliveryStore();

  const [refreshing, setRefreshing] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<FilterType>('all');
  const logoutScale = useSharedValue(1);

  useEffect(() => {
    if (token && staff?.name) {
      fetchStaffDeliveries(token, staff.name);
    }
  }, [token, staff, fetchStaffDeliveries]);

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
    if (!token || !staff?.name) return;
    setRefreshing(true);
    await fetchStaffDeliveries(token, staff.name);
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

  const handleDeliveryPress = (delivery: Delivery) => {
    router.push({
      pathname: '/(staff)/[orderId]',
      params: { orderId: delivery.id },
    });
  };

  const logoutAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoutScale.value }],
  }));

  const todayDate = deliveries[0]?.deliveryDate || new Date().toISOString().split('T')[0];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background orbs */}
      <View style={styles.orbContainer} pointerEvents="none">
        <FloatingOrb color={colors.accent} size={160} initialX={-10} initialY={-5} delay={0} />
        <FloatingOrb color={colors.primary} size={100} initialX={80} initialY={8} delay={200} />
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
            <Text style={[typography.overline, { color: colors.textMuted }]}>배송담당자</Text>
            <Text style={[typography.h4, { color: colors.text, marginTop: 4 }]}>
              {staff?.name}님
            </Text>
          </View>
          <AnimatedPressable
            style={[
              styles.logoutBtn,
              {
                backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                borderColor: isDark ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)',
                borderRadius: radius.lg,
              },
              logoutAnimatedStyle,
            ]}
            onPress={handleLogout}
            onPressIn={() => { logoutScale.value = withSpring(0.95, springs.snappy); }}
            onPressOut={() => { logoutScale.value = withSpring(1, springs.snappy); }}
          >
            <Text style={[typography.caption, { color: colors.error, fontWeight: '600' }]}>로그아웃</Text>
          </AnimatedPressable>
        </View>

        <Text
          style={[
            typography.h1,
            {
              color: colors.text,
              fontSize: 28,
              letterSpacing: -1,
              marginTop: 16,
            },
          ]}
        >
          {formatDate(todayDate)}
        </Text>

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
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
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
              오늘 배송이 없습니다
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8 }]}>
              관리자에게 문의하세요
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  indexBadge: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  indexText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  deliveryFooter: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
