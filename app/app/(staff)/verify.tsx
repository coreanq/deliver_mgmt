import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  useColorScheme,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  FadeInDown,
} from 'react-native-reanimated';
import Svg, { Path, Circle } from 'react-native-svg';
import { api } from '@/services/api';
import { useAuthStore } from '@/stores/auth';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export default function StaffVerifyScreen() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const router = useRouter();
  const params = useLocalSearchParams<{ adminId: string; date: string }>();
  const { loginStaff } = useAuthStore();

  const [inputName, setInputName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const buttonScale = useSharedValue(1);
  const shakeX = useSharedValue(0);

  const buttonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const inputStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
  };

  const handleVerify = async () => {
    if (!inputName.trim()) {
      setError('이름을 입력하세요.');
      triggerShake();
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      // 담당자 로그인 API 호출
      const result = await api.staffLogin(
        params.adminId || '',
        params.date || '',
        inputName.trim()
      );

      if (result.success && result.data) {
        // 로그인 성공
        loginStaff(
          {
            id: result.data.staff.id,
            name: result.data.staff.name,
            adminId: params.adminId || '',
            createdAt: new Date().toISOString(),
          },
          result.data.token
        );
        api.setToken(result.data.token);
        router.replace('/(staff)');
      } else {
        setError(result.error || '해당 날짜에 배송이 없습니다.');
        triggerShake();
      }
    } catch (err) {
      setError('인증에 실패했습니다. 다시 시도해주세요.');
      triggerShake();
    } finally {
      setIsLoading(false);
    }
  };

  const bgColors = isDark
    ? ['#0a0a12', '#0d0d1a', '#0a0a12'] as const
    : ['#f0f4f8', '#e8eef5', '#f0f4f8'] as const;

  return (
    <LinearGradient colors={bgColors} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Back Button */}
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <View style={[styles.backButtonInner, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)' }]}>
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

        <View style={styles.content}>
          {/* Icon */}
          <Animated.View entering={FadeInDown.delay(100).springify()}>
            <LinearGradient
              colors={['#10b981', '#059669']}
              style={styles.iconBg}
            >
              <Svg width={32} height={32} viewBox="0 0 24 24" fill="none">
                <Circle cx="12" cy="8" r="4" stroke="#fff" strokeWidth="2" />
                <Path
                  d="M4 20c0-4 4-6 8-6s8 2 8 6"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </Svg>
            </LinearGradient>
          </Animated.View>

          {/* Title */}
          <Animated.Text
            entering={FadeInDown.delay(150).springify()}
            style={[styles.title, { color: isDark ? '#fff' : '#1a1a2e' }]}
          >
            이름 입력
          </Animated.Text>

          <Animated.Text
            entering={FadeInDown.delay(200).springify()}
            style={[styles.subtitle, { color: isDark ? '#666680' : '#64748b' }]}
          >
            배송담당자 이름을 입력하세요
          </Animated.Text>

          {/* Date Display */}
          <Animated.View
            entering={FadeInDown.delay(250).springify()}
            style={[styles.dateContainer, { backgroundColor: isDark ? '#1a1a2e' : '#fff' }]}
          >
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                stroke="#3b82f6"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </Svg>
            <Text style={[styles.dateText, { color: isDark ? '#fff' : '#1a1a2e' }]}>
              {params.date ? formatDate(params.date) : '날짜 정보 없음'}
            </Text>
          </Animated.View>

          {/* Input */}
          <Animated.View
            entering={FadeInDown.delay(300).springify()}
            style={[
              styles.inputContainer,
              inputStyle,
              { backgroundColor: isDark ? '#1a1a2e' : '#fff' },
              error ? { borderColor: '#ef4444', borderWidth: 2 } : {},
            ]}
          >
            <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
              <Circle cx="12" cy="8" r="4" stroke={isDark ? '#666' : '#94a3b8'} strokeWidth="1.5" />
              <Path
                d="M4 20c0-4 4-6 8-6s8 2 8 6"
                stroke={isDark ? '#666' : '#94a3b8'}
                strokeWidth="1.5"
              />
            </Svg>
            <TextInput
              style={[styles.input, { color: isDark ? '#fff' : '#1a1a2e' }]}
              placeholder="이름 입력"
              placeholderTextColor={isDark ? '#555' : '#94a3b8'}
              value={inputName}
              onChangeText={(text) => {
                setInputName(text);
                setError('');
              }}
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="done"
              onSubmitEditing={handleVerify}
            />
          </Animated.View>

          {/* Error */}
          {error ? (
            <Animated.Text
              entering={FadeInDown.springify()}
              style={styles.errorText}
            >
              {error}
            </Animated.Text>
          ) : null}

          {/* Button */}
          <Animated.View entering={FadeInDown.delay(350).springify()}>
            <AnimatedPressable
              style={[styles.button, buttonStyle]}
              onPress={handleVerify}
              onPressIn={() => {
                buttonScale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
              }}
              onPressOut={() => {
                buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
              }}
              disabled={isLoading}
            >
              <LinearGradient
                colors={['#10b981', '#059669']}
                style={styles.buttonGradient}
              >
                {isLoading ? (
                  <Text style={styles.buttonText}>확인 중...</Text>
                ) : (
                  <>
                    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
                      <Path
                        d="M20 6L9 17l-5-5"
                        stroke="#fff"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </Svg>
                    <Text style={styles.buttonText}>확인</Text>
                  </>
                )}
              </LinearGradient>
            </AnimatedPressable>
          </Animated.View>
        </View>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 10,
  },
  backButtonInner: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  iconBg: {
    width: 72,
    height: 72,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    marginBottom: 32,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginBottom: 24,
    gap: 10,
  },
  dateText: {
    fontSize: 16,
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  input: {
    flex: 1,
    fontSize: 17,
    fontWeight: '500',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '500',
    marginTop: 12,
  },
  button: {
    marginTop: 24,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  buttonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    height: 56,
    gap: 10,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
