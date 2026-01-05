import { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput,
  StyleSheet, 
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useAuthStore } from '../../src/stores/auth';
import { Button } from '../../src/components';
import { useTheme } from '../../src/theme';

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${month}월 ${day}일 (${weekday})`;
}

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string; date: string }>();
  const { colors, radius, shadows } = useTheme();
  const insets = useSafeAreaInsets();
  
  const { loginStaff, isLoading, error, clearError } = useAuthStore();
  
  const [name, setName] = useState('');

  const handleVerify = async () => {
    if (!name.trim() || !params.token) return;
    
    clearError();
    
    const success = await loginStaff(params.token, name.trim());
    
    if (success) {
      router.replace('/(staff)');
    }
  };

  const handleBack = () => {
    clearError();
    router.replace('/(staff)/scan');
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.content, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
        <Pressable onPress={handleBack} style={styles.backButton}>
          <Text style={[styles.backText, { color: colors.textSecondary }]}>
            ← 뒤로
          </Text>
        </Pressable>

        <Animated.View entering={FadeInUp.delay(100).duration(400)} style={styles.header}>
          <Text style={styles.headerEmoji}>🔐</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            본인 인증
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            배송담당자 이름을 입력하세요
          </Text>
          
          {params.date && (
            <View style={[
              styles.dateBadge, 
              { 
                backgroundColor: colors.surfaceSecondary,
                borderRadius: radius.full,
              }
            ]}>
              <Text style={[styles.dateText, { color: colors.text }]}>
                📅 {formatDate(params.date)}
              </Text>
            </View>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>
              담당자 이름
            </Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.surface,
                  color: colors.text,
                  borderColor: colors.border,
                  borderRadius: radius.lg,
                },
                shadows.sm,
              ]}
              placeholder="예: 홍길동"
              placeholderTextColor={colors.textTertiary}
              value={name}
              onChangeText={setName}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          {error && (
            <View style={[
              styles.errorContainer, 
              { 
                backgroundColor: colors.errorLight,
                borderRadius: radius.lg,
              }
            ]}>
              <Text style={[styles.errorText, { color: colors.error }]}>
                {error}
              </Text>
            </View>
          )}

          <Button
            title="확인"
            onPress={handleVerify}
            loading={isLoading}
            disabled={!name.trim()}
            style={styles.button}
          />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(300).duration(400)} style={styles.hint}>
          <Text style={[styles.hintText, { color: colors.textTertiary }]}>
            관리자가 등록한 이름과 정확히 일치해야 합니다
          </Text>
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    marginBottom: 24,
  },
  backText: {
    fontSize: 16,
    fontWeight: '500',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  headerEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
  },
  dateBadge: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dateText: {
    fontSize: 15,
    fontWeight: '500',
  },
  form: {
    gap: 20,
  },
  inputContainer: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    height: 52,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorContainer: {
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    marginTop: 8,
  },
  hint: {
    position: 'absolute',
    bottom: 40,
    left: 24,
    right: 24,
  },
  hintText: {
    fontSize: 13,
    textAlign: 'center',
  },
});
