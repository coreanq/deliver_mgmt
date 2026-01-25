import { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  Image,
  Linking,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
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
import { StatusBadge, Loading, Button, ImageViewer } from '../../src/components';
import { useTheme } from '../../src/theme';
import { subscriptionApi, authApi, WEB_URL } from '../../src/services/api';
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
function DeliveryItem({ delivery, index, onPhotoPress }: {
  delivery: Delivery;
  index: number;
  onPhotoPress?: (url: string) => void;
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

          {/* 배송 완료 사진 썸네일 */}
          {delivery.photoUrl && (
            <Pressable
              style={[
                styles.photoThumbnail,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  borderRadius: radius.lg,
                },
              ]}
              onPress={() => onPhotoPress?.(delivery.photoUrl!)}
            >
              <Image
                source={{ uri: delivery.photoUrl }}
                style={[styles.thumbnailImage, { borderRadius: radius.md }]}
                resizeMode="cover"
              />
              <Text style={[typography.caption, { color: colors.textMuted, marginLeft: 10 }]}>
                배송 완료 사진
              </Text>
            </Pressable>
          )}
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
  const [fullScreenPhoto, setFullScreenPhoto] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [subscriptionInfo, setSubscriptionInfo] = useState<{
    type: string;
    dailyLimit: number;
    currentUsage: number;
  } | null>(null);

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

  useEffect(() => {
    const fetchSubscription = async () => {
      if (!token) return;
      const result = await subscriptionApi.getStatus(token, selectedDate);
      if (result.success && result.data) {
        setSubscriptionInfo({
          type: result.data.type,
          dailyLimit: result.data.dailyLimit,
          currentUsage: result.data.currentUsage,
        });
      }
    };
    fetchSubscription();
  }, [token, selectedDate]);

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

  const handleDeleteAccount = () => {
    Alert.alert(
      '회원 탈퇴',
      '정말로 탈퇴하시겠습니까?\n\n모든 배송 데이터, 사진, 설정이 즉시 삭제되며 복구할 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '탈퇴하기',
          style: 'destructive',
          onPress: async () => {
            if (!token) return;
            setIsDeletingAccount(true);
            try {
              const result = await authApi.deleteAccount(token);
              if (result.success) {
                Alert.alert('완료', '계정이 삭제되었습니다.', [
                  {
                    text: '확인',
                    onPress: () => {
                      logout();
                      rootNavigation?.dispatch(
                        CommonActions.reset({
                          index: 0,
                          routes: [{ name: 'index' }],
                        })
                      );
                    },
                  },
                ]);
              } else {
                Alert.alert('오류', result.error ?? '계정 삭제에 실패했습니다.');
              }
            } catch {
              Alert.alert('오류', '네트워크 오류가 발생했습니다.');
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const handleGenerateQR = () => {
    router.push(`/(admin)/qr-generate?date=${selectedDate}`);
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
          <View style={styles.headerActions}>
            {subscriptionInfo && (
              <View
                style={[
                  styles.usageBadge,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                    borderRadius: radius.lg,
                  },
                ]}
              >
                <Text style={[typography.caption, { color: colors.primary, fontWeight: '600' }]}>
                  {subscriptionInfo.currentUsage}/{subscriptionInfo.dailyLimit}
                </Text>
              </View>
            )}
            <Pressable
              style={[
                styles.settingsBtn,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                  borderRadius: radius.lg,
                },
              ]}
              onPress={() => setShowSettings(true)}
            >
              <Text style={styles.settingsIcon}>⚙️</Text>
            </Pressable>
          </View>
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
            <Pressable
              onPress={() => Linking.openURL(WEB_URL)}
            >
              <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8, textDecorationLine: 'underline' }]}>
                엑셀 업로드는 PC의 브라우저에서 진행하세요
              </Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4, textAlign: 'center' }]}>
                {WEB_URL}
              </Text>
            </Pressable>
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
              onPhotoPress={setFullScreenPhoto}
            />
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

      {/* 전체 화면 사진 뷰어 */}
      <ImageViewer
        visible={!!fullScreenPhoto}
        imageUrl={fullScreenPhoto}
        onClose={() => setFullScreenPhoto(null)}
      />

      <Modal
        visible={showSettings}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[typography.h3, { color: colors.text }]}>설정</Text>
            <Pressable onPress={() => setShowSettings(false)}>
              <Text style={[typography.body, { color: colors.primary }]}>닫기</Text>
            </Pressable>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.settingsSection}>
              <Text style={[typography.overline, { color: colors.textMuted, marginBottom: 12 }]}>
                계정
              </Text>
              <View
                style={[
                  styles.settingsCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    borderRadius: radius.xl,
                  },
                ]}
              >
                <View style={styles.settingsItem}>
                  <Text style={[typography.body, { color: colors.textSecondary }]}>이메일</Text>
                  <Text style={[typography.body, { color: colors.text }]}>{admin?.email}</Text>
                </View>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={[typography.overline, { color: colors.textMuted, marginBottom: 12 }]}>
                법적 고지
              </Text>
              <View
                style={[
                  styles.settingsCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    borderRadius: radius.xl,
                  },
                ]}
              >
                <Pressable
                  style={styles.settingsItem}
                  onPress={() => Linking.openURL('https://periwinkle-foam-a5a.notion.site/2e10f396f354808b85f6dcce7412a3c2')}
                >
                  <Text style={[typography.body, { color: colors.text }]}>개인정보 처리방침</Text>
                  <Text style={[typography.body, { color: colors.textMuted }]}>→</Text>
                </Pressable>
                <View style={[styles.settingsDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  style={styles.settingsItem}
                  onPress={() => Linking.openURL('https://periwinkle-foam-a5a.notion.site/2e10f396f35480c3a5a8c6e4bb1c27fc')}
                >
                  <Text style={[typography.body, { color: colors.text }]}>고객 지원</Text>
                  <Text style={[typography.body, { color: colors.textMuted }]}>→</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={[typography.overline, { color: colors.textMuted, marginBottom: 12 }]}>
                계정 관리
              </Text>
              <View
                style={[
                  styles.settingsCard,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.8)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    borderRadius: radius.xl,
                  },
                ]}
              >
                <Pressable style={styles.settingsItem} onPress={handleLogout}>
                  <Text style={[typography.body, { color: colors.text }]}>로그아웃</Text>
                  <Text style={[typography.body, { color: colors.textMuted }]}>→</Text>
                </Pressable>
                <View style={[styles.settingsDivider, { backgroundColor: colors.border }]} />
                <Pressable
                  style={styles.settingsItem}
                  onPress={handleDeleteAccount}
                  disabled={isDeletingAccount}
                >
                  <Text style={[typography.body, { color: colors.error }]}>
                    {isDeletingAccount ? '처리 중...' : '회원 탈퇴'}
                  </Text>
                  <Text style={[typography.body, { color: colors.error }]}>→</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  usageBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  photoThumbnail: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    padding: 8,
  },
  thumbnailImage: {
    width: 48,
    height: 48,
  },
  settingsBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsIcon: {
    fontSize: 18,
  },
  modalContainer: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  settingsSection: {
    marginBottom: 24,
  },
  settingsCard: {
    borderWidth: 1,
    overflow: 'hidden',
  },
  settingsItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  settingsDivider: {
    height: 1,
    marginLeft: 16,
  },
});
