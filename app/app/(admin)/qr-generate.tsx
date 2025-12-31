import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  useColorScheme,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeInDown,
} from 'react-native-reanimated';
import Svg, { Path, Rect } from 'react-native-svg';
import QRCode from 'react-native-qrcode-svg';
import { api } from '@/services/api';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface StaffItem {
  name: string;
  selected: boolean;
}

export default function QRGenerateScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();

  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const [qrData, setQrData] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);

  const buttonScale = useSharedValue(1);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  useEffect(() => {
    fetchStaffList();
  }, []);

  const fetchStaffList = async () => {
    try {
      const result = await api.getStaffList();
      if (result.success && result.data) {
        setStaffList(result.data.staff.map((name: string) => ({ name, selected: false })));
      }
    } catch (error) {
      console.error('Failed to fetch staff list:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectStaff = (name: string) => {
    setSelectedStaff(selectedStaff === name ? null : name);
    setQrData(null);
  };

  const handleGenerateQR = async () => {
    if (!selectedStaff) {
      Alert.alert('알림', '배송담당자를 선택하세요.');
      return;
    }

    setIsGenerating(true);
    try {
      const result = await api.generateQR(selectedStaff);
      if (result.success && result.data) {
        setQrData(result.data.qrData);
      } else {
        Alert.alert('오류', result.error || 'QR 코드 생성에 실패했습니다.');
      }
    } catch (error) {
      Alert.alert('오류', 'QR 코드 생성에 실패했습니다.');
    } finally {
      setIsGenerating(false);
    }
  };

  const bgColors = isDark ? ['#0a0a12', '#12121f'] : ['#f0f4f8', '#e8eef5'];

  return (
    <View style={styles.container}>
      <LinearGradient colors={bgColors} style={StyleSheet.absoluteFill} />

      {/* Header */}
      <View style={[styles.header, { borderBottomColor: isDark ? '#1a1a2e' : '#e2e8f0' }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <View style={[styles.backButtonInner, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Path
                d="M19 12H5M5 12L12 19M5 12L12 5"
                stroke={isDark ? '#fff' : '#1a1a2e'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </View>
        </Pressable>
        <Text style={[styles.headerTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>
          QR 코드 생성
        </Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* QR Display Area */}
        {qrData ? (
          <Animated.View
            entering={FadeInDown.springify()}
            style={[styles.qrContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
          >
            <View style={styles.qrWrapper}>
              <QRCode
                value={qrData}
                size={200}
                backgroundColor={isDark ? '#1a1a2e' : '#fff'}
                color={isDark ? '#fff' : '#1a1a2e'}
              />
            </View>
            <Text style={[styles.qrStaffName, { color: isDark ? '#fff' : '#1a1a2e' }]}>
              {selectedStaff}
            </Text>
            <Text style={[styles.qrHint, { color: isDark ? '#666' : '#94a3b8' }]}>
              배송담당자가 이 QR 코드를 스캔합니다
            </Text>
            <View style={[styles.qrExpiryBadge, { backgroundColor: isDark ? '#3b82f620' : '#dbeafe' }]}>
              <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                <Path
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  stroke="#3b82f6"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
              <Text style={styles.qrExpiryText}>24시간 유효</Text>
            </View>
          </Animated.View>
        ) : (
          <View style={[styles.qrPlaceholder, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
            <Svg width={64} height={64} viewBox="0 0 24 24" fill="none">
              <Rect x="3" y="3" width="7" height="7" rx="1" stroke={isDark ? '#333' : '#cbd5e1'} strokeWidth="1.5" />
              <Rect x="14" y="3" width="7" height="7" rx="1" stroke={isDark ? '#333' : '#cbd5e1'} strokeWidth="1.5" />
              <Rect x="3" y="14" width="7" height="7" rx="1" stroke={isDark ? '#333' : '#cbd5e1'} strokeWidth="1.5" />
              <Rect x="14" y="14" width="7" height="7" rx="1" stroke={isDark ? '#333' : '#cbd5e1'} strokeWidth="1.5" />
            </Svg>
            <Text style={[styles.placeholderText, { color: isDark ? '#555' : '#94a3b8' }]}>
              담당자를 선택하고{'\n'}QR 코드를 생성하세요
            </Text>
          </View>
        )}

        {/* Staff List */}
        <Animated.View entering={FadeInDown.delay(100).springify()}>
          <Text style={[styles.sectionTitle, { color: isDark ? '#fff' : '#1a1a2e' }]}>
            배송담당자 선택
          </Text>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={[styles.loadingText, { color: isDark ? '#666' : '#94a3b8' }]}>
                로딩 중...
              </Text>
            </View>
          ) : staffList.length === 0 ? (
            <View style={[styles.emptyStaff, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}>
              <Text style={[styles.emptyText, { color: isDark ? '#666' : '#94a3b8' }]}>
                등록된 배송담당자가 없습니다.{'\n'}
                엑셀 업로드 시 담당자 컬럼을 매핑하세요.
              </Text>
            </View>
          ) : (
            <View style={styles.staffGrid}>
              {staffList.map((staff, index) => (
                <Animated.View
                  key={staff.name}
                  entering={FadeInDown.delay(150 + index * 30).springify()}
                >
                  <Pressable
                    onPress={() => handleSelectStaff(staff.name)}
                    style={[
                      styles.staffCard,
                      { backgroundColor: isDark ? '#1a1a2e' : '#fff' },
                      selectedStaff === staff.name && styles.staffCardSelected,
                    ]}
                  >
                    <View
                      style={[
                        styles.staffAvatar,
                        {
                          backgroundColor:
                            selectedStaff === staff.name
                              ? '#3b82f6'
                              : isDark
                              ? '#2a2a3e'
                              : '#f0f4f8',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.staffInitial,
                          {
                            color:
                              selectedStaff === staff.name
                                ? '#fff'
                                : isDark
                                ? '#888'
                                : '#64748b',
                          },
                        ]}
                      >
                        {staff.name.charAt(0)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.staffName,
                        {
                          color:
                            selectedStaff === staff.name
                              ? '#3b82f6'
                              : isDark
                              ? '#fff'
                              : '#1a1a2e',
                        },
                      ]}
                    >
                      {staff.name}
                    </Text>
                    {selectedStaff === staff.name && (
                      <View style={styles.checkIcon}>
                        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                          <Path
                            d="M20 6L9 17l-5-5"
                            stroke="#3b82f6"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </Svg>
                      </View>
                    )}
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          )}
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Generate Button */}
      {selectedStaff && (
        <Animated.View
          entering={FadeInDown.springify()}
          style={styles.bottomBar}
        >
          <AnimatedPressable
            style={[styles.generateButton, buttonStyle]}
            onPress={handleGenerateQR}
            onPressIn={() => {
              buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
            }}
            onPressOut={() => {
              buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
            }}
            disabled={isGenerating}
          >
            <LinearGradient
              colors={['#3b82f6', '#1d4ed8']}
              style={styles.generateGradient}
            >
              {isGenerating ? (
                <Text style={styles.generateText}>생성 중...</Text>
              ) : (
                <>
                  <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
                    <Rect x="3" y="3" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2" />
                    <Rect x="14" y="3" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2" />
                    <Rect x="3" y="14" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2" />
                    <Rect x="14" y="14" width="7" height="7" rx="1" stroke="#fff" strokeWidth="2" />
                  </Svg>
                  <Text style={styles.generateText}>QR 코드 생성</Text>
                </>
              )}
            </LinearGradient>
          </AnimatedPressable>
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
    paddingTop: 60,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {},
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  qrContainer: {
    padding: 32,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 32,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 4,
  },
  qrWrapper: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    marginBottom: 20,
  },
  qrStaffName: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 8,
  },
  qrHint: {
    fontSize: 14,
    marginBottom: 16,
  },
  qrExpiryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  qrExpiryText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3b82f6',
  },
  qrPlaceholder: {
    padding: 48,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 32,
  },
  placeholderText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
  },
  emptyStaff: {
    padding: 32,
    borderRadius: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
  },
  staffGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  staffCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  staffCardSelected: {
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  staffAvatar: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  staffInitial: {
    fontSize: 16,
    fontWeight: '700',
  },
  staffName: {
    fontSize: 16,
    fontWeight: '600',
  },
  checkIcon: {
    marginLeft: 4,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 36,
  },
  generateButton: {
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
    gap: 10,
  },
  generateText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
