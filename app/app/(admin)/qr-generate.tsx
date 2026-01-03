import { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Pressable,
  Share,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import QRCode from 'react-native-qrcode-svg';
import { useAuthStore } from '../../src/stores/auth';
import { authApi } from '../../src/services/api';
import { Loading, Button } from '../../src/components';
import { useTheme } from '../../src/theme';

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

export default function QRGenerateScreen() {
  const router = useRouter();
  const { colors, radius, shadows, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { token } = useAuthStore();
  
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [qrToken, setQrToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      generateQR();
    }
  }, [token, selectedDate]);

  const generateQR = async () => {
    if (!token) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await authApi.generateQR(token, selectedDate);
      
      if (result.success && result.data) {
        setQrToken(result.data.token);
        setExpiresAt(result.data.expiresAt);
      } else {
        setError(result.error || 'QR 코드 생성에 실패했습니다.');
      }
    } catch (err) {
      setError('네트워크 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    router.back();
  };

  const handleShare = async () => {
    if (!qrToken) return;
    
    try {
      await Share.share({
        message: `배송담당자 인증 코드: ${qrToken}\n날짜: ${formatDate(selectedDate)}`,
      });
    } catch (err) {
      console.error('Share error:', err);
    }
  };

  const qrValue = qrToken ? JSON.stringify({ token: qrToken, date: selectedDate }) : '';

  return (
    <View style={[
      styles.container, 
      { 
        backgroundColor: colors.background,
        paddingTop: insets.top + 16,
        paddingBottom: insets.bottom + 16,
      }
    ]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          배송담당자 QR
        </Text>
        <Pressable onPress={handleClose} style={styles.closeButton}>
          <Text style={[styles.closeText, { color: colors.textSecondary }]}>
            닫기
          </Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {isLoading ? (
          <Loading message="QR 코드 생성 중..." />
        ) : error ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.errorContainer}>
            <Text style={[styles.errorText, { color: colors.error }]}>
              {error}
            </Text>
            <Button title="다시 시도" onPress={generateQR} variant="outline" />
          </Animated.View>
        ) : qrToken ? (
          <Animated.View entering={FadeInDown.duration(400)} style={styles.qrContainer}>
            <View style={[
              styles.qrWrapper, 
              { 
                backgroundColor: '#ffffff',
                borderRadius: radius['2xl'],
              },
              shadows.xl,
            ]}>
              <QRCode
                value={qrValue}
                size={240}
                color="#1f2937"
                backgroundColor="#ffffff"
              />
            </View>

            <View style={[
              styles.dateTag, 
              { 
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
              }
            ]}>
              <Text style={[styles.dateTagText, { color: colors.text }]}>
                📅 {formatDate(selectedDate)}
              </Text>
            </View>

            {expiresAt && (
              <Text style={[styles.expiresText, { color: colors.textTertiary }]}>
                24시간 후 만료
              </Text>
            )}
          </Animated.View>
        ) : null}
      </View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.footer}>
        <Text style={[styles.instructionText, { color: colors.textSecondary }]}>
          배송담당자가 이 QR을 스캔하면{'\n'}이름 입력 후 배송 목록을 확인할 수 있습니다
        </Text>

        {qrToken && (
          <Button
            title="공유하기"
            onPress={handleShare}
            variant="secondary"
            style={styles.shareButton}
          />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 16,
    fontWeight: '500',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrWrapper: {
    padding: 24,
  },
  dateTag: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  dateTagText: {
    fontSize: 16,
    fontWeight: '600',
  },
  expiresText: {
    marginTop: 12,
    fontSize: 13,
  },
  errorContainer: {
    alignItems: 'center',
    gap: 16,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 32,
  },
  instructionText: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  shareButton: {
    paddingHorizontal: 48,
  },
});
