import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { File as ExpoFile } from 'expo-file-system';

// DocumentPicker 네이티브 모듈 안전 로드 (OTA 시 네이티브 빌드 미포함 대응)
let DocumentPicker: typeof import('expo-document-picker') | null = null;
try {
  DocumentPicker = require('expo-document-picker');
} catch {
  DocumentPicker = null;
}
import * as XLSX from 'xlsx';
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
import { useExcelUploadStore } from '../../src/stores/excelUpload';
import { Button, Loading, LoadingOverlay } from '../../src/components';
import { useTheme } from '../../src/theme';
import { uploadApi, remoteLog } from '../../src/services/api';
import type { FieldMapping, MappingSuggestion } from '../../src/types';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

// 배경 Floating Orb
function FloatingOrb({ color, size, initialX, initialY, delay: orbDelay }: {
  color: string;
  size: number;
  initialX: number;
  initialY: number;
  delay: number;
}) {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    opacity.value = withDelay(orbDelay, withTiming(1, { duration: 1000 }));
    translateY.value = withDelay(
      orbDelay,
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// 필수 필드 정의
const REQUIRED_FIELDS: { key: keyof FieldMapping; label: string }[] = [
  { key: 'recipientName', label: '수령인 이름' },
  { key: 'recipientPhone', label: '연락처' },
  { key: 'recipientAddress', label: '주소' },
  { key: 'productName', label: '상품명' },
  { key: 'staffName', label: '배송담당자' },
];

const OPTIONAL_FIELDS: { key: keyof FieldMapping; label: string }[] = [
  { key: 'memo', label: '메모' },
];

// confidence 색상
function getConfidenceColor(confidence: number, colors: { statusCompleted: string; statusPending: string; error: string }) {
  if (confidence >= 0.9) return colors.statusCompleted;
  if (confidence >= 0.7) return colors.statusPending;
  return colors.error;
}

// 소스 컬럼 선택 모달
function ColumnPickerModal({
  visible,
  onClose,
  columns,
  selectedColumn,
  onSelect,
  fieldLabel,
}: {
  visible: boolean;
  onClose: () => void;
  columns: string[];
  selectedColumn: string;
  onSelect: (column: string) => void;
  fieldLabel: string;
}) {
  const { colors, radius, typography, isDark } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
          <Text style={[typography.h3, { color: colors.text }]}>{fieldLabel}</Text>
          <Pressable onPress={onClose}>
            <Text style={[typography.body, { color: colors.primary }]}>닫기</Text>
          </Pressable>
        </View>
        <FlatList
          data={['', ...columns]}
          keyExtractor={(item) => item || '__none__'}
          renderItem={({ item }) => (
            <Pressable
              style={[
                styles.pickerItem,
                {
                  backgroundColor: item === selectedColumn
                    ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                    : 'transparent',
                },
              ]}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <Text style={[typography.body, { color: item === selectedColumn ? colors.primary : colors.text }]}>
                {item || '(선택 안함)'}
              </Text>
              {item === selectedColumn && (
                <Text style={[typography.body, { color: colors.primary }]}>✓</Text>
              )}
            </Pressable>
          )}
          contentContainerStyle={{ paddingBottom: 40 }}
        />
      </View>
    </Modal>
  );
}

// AI 분석 단계별 진행 표시
const ANALYSIS_STEPS = [
  { key: 'parsing', label: '파일 파싱', icon: '📄', description: '엑셀 데이터를 읽고 있습니다' },
  { key: 'analyzing', label: 'AI 분석', icon: '🤖', description: 'AI가 컬럼을 분석하고 있습니다' },
  { key: 'mapping', label: '매핑 생성', icon: '🔗', description: '매핑 결과를 생성하고 있습니다' },
] as const;

function AnalysisProgress({ phase, fileName }: { phase: 'parsing' | 'analyzing' | 'mapping'; fileName: string }) {
  const { colors, radius, typography, isDark } = useTheme();
  const currentIndex = ANALYSIS_STEPS.findIndex((s) => s.key === phase);

  // 현재 단계 펄스 애니메이션
  const pulseOpacity = useSharedValue(0.4);
  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 800, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      false
    );
  }, []);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: pulseOpacity.value,
  }));

  return (
    <Animated.View entering={FadeInDown.duration(400)}>
      <View
        style={[
          styles.card,
          {
            backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
            borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            borderRadius: radius.xl,
            paddingVertical: 24,
          },
        ]}
      >
        {/* 파일명 */}
        <View style={analysisStyles.fileRow}>
          <Text style={{ fontSize: 20 }}>📊</Text>
          <Text
            style={[typography.bodySmall, { color: colors.textSecondary, flex: 1 }]}
            numberOfLines={1}
          >
            {fileName}
          </Text>
        </View>

        {/* 단계 목록 */}
        <View style={analysisStyles.stepsList}>
          {ANALYSIS_STEPS.map((s, i) => {
            const isCompleted = i < currentIndex;
            const isActive = i === currentIndex;
            const isPending = i > currentIndex;

            return (
              <View key={s.key}>
                <View style={analysisStyles.stepRow}>
                  {/* 아이콘/상태 */}
                  <View
                    style={[
                      analysisStyles.stepIcon,
                      {
                        backgroundColor: isCompleted
                          ? colors.statusCompleted
                          : isActive
                            ? (isDark ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0.1)')
                            : 'transparent',
                        borderColor: isPending
                          ? (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)')
                          : 'transparent',
                        borderWidth: isPending ? 1.5 : 0,
                        borderRadius: 14,
                      },
                    ]}
                  >
                    {isCompleted ? (
                      <Text style={{ fontSize: 14, color: '#fff' }}>✓</Text>
                    ) : isActive ? (
                      <Animated.Text style={[{ fontSize: 16 }, pulseStyle]}>{s.icon}</Animated.Text>
                    ) : (
                      <Text style={{ fontSize: 14, opacity: 0.3 }}>{s.icon}</Text>
                    )}
                  </View>

                  {/* 라벨 */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        typography.bodySmall,
                        {
                          color: isActive ? colors.text : isPending ? colors.textMuted : colors.textSecondary,
                          fontWeight: isActive ? '600' : '400',
                        },
                      ]}
                    >
                      {s.label}
                    </Text>
                    {isActive && (
                      <Animated.Text
                        entering={FadeIn.duration(300)}
                        style={[typography.caption, { color: colors.textMuted, marginTop: 2 }]}
                      >
                        {s.description}
                      </Animated.Text>
                    )}
                  </View>
                </View>

                {/* 단계 사이 연결선 */}
                {i < ANALYSIS_STEPS.length - 1 && (
                  <View
                    style={[
                      analysisStyles.connector,
                      {
                        backgroundColor: isCompleted
                          ? colors.statusCompleted
                          : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                      },
                    ]}
                  />
                )}
              </View>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

export default function ExcelUploadScreen() {
  const router = useRouter();
  const { colors, radius, typography, isDark, springs } = useTheme();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);

  const {
    step, pendingFile, headers, rows, suggestions,
    mapping, deliveryDate, error, isLoading, savedCount,
    setParsingData, setSuggestions, setMapping, setDeliveryDate,
    setStep, setError, setIsLoading, setSavedCount, reset,
  } = useExcelUploadStore();

  const [pickerField, setPickerField] = useState<string | null>(null);
  const [localMapping, setLocalMapping] = useState<Record<string, string>>({});
  const [loadingPhase, setLoadingPhase] = useState<'parsing' | 'analyzing' | 'mapping' | null>(null);

  // 날짜 초기화
  useEffect(() => {
    if (!deliveryDate) {
      setDeliveryDate(getTodayString());
    }
  }, [deliveryDate, setDeliveryDate]);

  // 화면 진입 시 idle이면 자동으로 파일 선택 열기
  useEffect(() => {
    if (step === 'idle' && !pendingFile) {
      pickExcelFile();
    }
  }, []);

  // Document Picker로 엑셀 파일 선택
  const pickExcelFile = useCallback(async () => {
    if (!DocumentPicker) {
      Alert.alert(
        '업데이트 필요',
        '엑셀 업로드 기능을 사용하려면 앱을 최신 버전으로 업데이트해주세요.',
        [{ text: '확인', onPress: () => router.back() }]
      );
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.length) {
        // 파일 선택 취소 시 뒤로가기
        if (step === 'idle') router.back();
        return;
      }

      const asset = result.assets[0];
      const { setPendingFile } = useExcelUploadStore.getState();
      setPendingFile({
        path: asset.uri,
        fileName: asset.name,
        size: asset.size ?? 0,
        mimeType: asset.mimeType ?? '',
      });
    } catch (err) {
      remoteLog.error('Document picker error', err);
      setError('파일 선택에 실패했습니다.');
    }
  }, [step, router, setError]);

  // pendingFile이 설정되면 자동 파싱 시작
  useEffect(() => {
    if (step !== 'fileReceived' || !pendingFile || !token) return;

    const parseFile = async () => {
      setIsLoading(true);
      setError(null);
      setLoadingPhase('parsing');

      try {
        // 10MB 크기 제한 체크
        if (pendingFile.size > 10 * 1024 * 1024) {
          setError('파일 크기가 10MB를 초과합니다. 더 작은 파일을 사용해주세요.');
          setLoadingPhase(null);
          return;
        }

        // 파일 읽기 (ArrayBuffer → XLSX)
        const file = new ExpoFile(pendingFile.path);
        const arrayBuffer = await file.arrayBuffer();

        // XLSX 파싱
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(firstSheet, { defval: '' });

        if (jsonData.length === 0) {
          setError('엑셀 파일에 데이터가 없습니다.');
          setLoadingPhase(null);
          return;
        }

        const parsedHeaders = Object.keys(jsonData[0]);
        // string 값으로 변환
        const parsedRows = jsonData.map((row) => {
          const converted: Record<string, string> = {};
          for (const key of parsedHeaders) {
            converted[key] = String(row[key] ?? '');
          }
          return converted;
        });

        setParsingData(parsedHeaders, parsedRows);

        // AI 매핑 요청
        setLoadingPhase('analyzing');
        const sampleRows = parsedRows.slice(0, 3);
        const result = await uploadApi.suggestMapping(token, parsedHeaders, sampleRows);

        setLoadingPhase('mapping');

        if (result.success && result.data) {
          setSuggestions(result.data.suggestions);

          // suggestion으로 초기 매핑 생성
          const initialMapping: Record<string, string> = {};
          for (const s of result.data.suggestions) {
            initialMapping[s.targetField] = s.sourceColumn;
          }
          setLocalMapping(initialMapping);
        } else {
          // AI 매핑 실패해도 수동 매핑 가능하도록 step만 진행
          setSuggestions([]);
          setLocalMapping({});
        }

        setLoadingPhase(null);
        setIsLoading(false);
      } catch (err) {
        remoteLog.error('Excel parse error', err);
        setLoadingPhase(null);
        setError(err instanceof Error ? err.message : '파일 파싱에 실패했습니다.');
      }
    };

    parseFile();
  }, [step, pendingFile, token, setParsingData, setSuggestions, setIsLoading, setError]);

  // suggestions로 localMapping 동기화
  useEffect(() => {
    if (suggestions.length > 0 && Object.keys(localMapping).length === 0) {
      const initial: Record<string, string> = {};
      for (const s of suggestions) {
        initial[s.targetField] = s.sourceColumn;
      }
      setLocalMapping(initial);
    }
  }, [suggestions, localMapping]);

  const changeDate = (days: number) => {
    const current = new Date(deliveryDate || getTodayString());
    current.setDate(current.getDate() + days);
    const year = current.getFullYear();
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const day = String(current.getDate()).padStart(2, '0');
    setDeliveryDate(`${year}-${month}-${day}`);
  };

  const getConfidence = (targetField: string): number => {
    const suggestion = suggestions.find((s) => s.targetField === targetField);
    return suggestion?.confidence ?? 0;
  };

  const updateFieldMapping = useCallback((targetField: string, sourceColumn: string) => {
    setLocalMapping((prev) => ({ ...prev, [targetField]: sourceColumn }));
  }, []);

  // 필수 필드 매핑 완료 여부
  const isRequiredMappingComplete = useMemo(() => {
    return REQUIRED_FIELDS.every((f) => localMapping[f.key]);
  }, [localMapping]);

  // 데이터 미리보기 (상위 3행)
  const previewRows = useMemo(() => rows.slice(0, 3), [rows]);

  // 매핑 확정 후 저장
  const handleSave = async (overwrite = false) => {
    if (!token || !isRequiredMappingComplete) return;

    const fieldMapping: FieldMapping = {
      recipientName: localMapping.recipientName,
      recipientPhone: localMapping.recipientPhone,
      recipientAddress: localMapping.recipientAddress,
      productName: localMapping.productName,
      staffName: localMapping.staffName,
      memo: localMapping.memo || undefined,
    };

    setMapping(fieldMapping);
    setStep('saving');
    setIsLoading(true);
    setError(null);

    try {
      const targetDate = deliveryDate || getTodayString();
      const result = await uploadApi.save(token, rows, fieldMapping, targetDate, overwrite);

      if (result.success && result.data) {
        setSavedCount(result.data.insertedCount);
        setStep('complete');
        setIsLoading(false);
      } else if (result.needsConfirmation) {
        setIsLoading(false);
        setStep('mapped');
        Alert.alert(
          '⚠️ 기존 데이터 덮어쓰기',
          `${targetDate}에 이미 ${result.existingCount}건의 배송 데이터가 등록되어 있습니다.\n\n덮어쓰기를 선택하면 기존 데이터가 모두 삭제되고 새로운 ${rows.length}건으로 교체됩니다.`,
          [
            { text: '취소', style: 'cancel' },
            { text: `덮어쓰기 (${rows.length}건)`, style: 'destructive', onPress: () => handleSave(true) },
          ]
        );
      } else {
        setStep('mapped');
        setError(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      remoteLog.error('Upload save error', err);
      setStep('mapped');
      setError('네트워크 오류가 발생했습니다.');
    }
  };

  const handleGoToDashboard = () => {
    reset();
    router.replace('/(admin)');
  };

  const handleCancel = () => {
    reset();
    router.back();
  };

  // 현재 선택된 피커 필드의 소스 컬럼
  const pickerSelectedColumn = pickerField ? (localMapping[pickerField] || '') : '';
  const pickerFieldLabel = pickerField
    ? [...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].find((f) => f.key === pickerField)?.label || pickerField
    : '';

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Background orbs */}
      <View style={styles.orbContainer} pointerEvents="none">
        <FloatingOrb color={colors.primary} size={140} initialX={-5} initialY={-3} delay={0} />
        <FloatingOrb color={colors.accent} size={90} initialX={75} initialY={10} delay={200} />
      </View>

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
          <Pressable onPress={handleCancel}>
            <Text style={[typography.body, { color: colors.primary }]}>취소</Text>
          </Pressable>
          <Text style={[typography.h3, { color: colors.text }]}>엑셀 업로드</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* 스텝 인디케이터 */}
        <View style={styles.stepIndicator}>
          {['파일 확인', '매핑', '저장'].map((label, i) => {
            const stepIndex = step === 'fileReceived' || step === 'parsing' ? 0
              : step === 'mapped' ? 1
              : step === 'saving' || step === 'complete' ? 2
              : 0;
            const isActive = i <= stepIndex;
            return (
              <View key={label} style={styles.stepItem}>
                <View
                  style={[
                    styles.stepDot,
                    {
                      backgroundColor: isActive ? colors.primary : (isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)'),
                      borderRadius: 12,
                    },
                  ]}
                >
                  <Text style={[styles.stepDotText, { color: isActive ? '#fff' : colors.textMuted }]}>
                    {i + 1}
                  </Text>
                </View>
                <Text style={[typography.caption, { color: isActive ? colors.text : colors.textMuted, marginTop: 4 }]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </Animated.View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        {/* 에러 메시지 */}
        {error && (
          <Animated.View
            entering={FadeIn.duration(300)}
            style={[
              styles.errorBox,
              {
                backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.08)',
                borderRadius: radius.lg,
              },
            ]}
          >
            <Text style={[typography.body, { color: colors.error }]}>{error}</Text>
          </Animated.View>
        )}

        {/* AI 분석 진행 상태 */}
        {isLoading && loadingPhase && pendingFile && (
          <AnalysisProgress phase={loadingPhase} fileName={pendingFile.fileName} />
        )}

        {/* 일반 로딩 (loadingPhase 없는 경우 폴백) */}
        {isLoading && !loadingPhase && step !== 'saving' && (
          <Loading message="처리 중..." />
        )}

        {/* Step 0: 파일 선택 대기 (idle) */}
        {step === 'idle' && !isLoading && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Pressable
              onPress={pickExcelFile}
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  borderRadius: radius.xl,
                  borderStyle: 'dashed',
                  alignItems: 'center',
                  paddingVertical: 40,
                },
              ]}
            >
              <Text style={{ fontSize: 40, marginBottom: 12 }}>📂</Text>
              <Text style={[typography.h4, { color: colors.text }]}>엑셀 파일 선택</Text>
              <Text style={[typography.caption, { color: colors.textMuted, marginTop: 8 }]}>
                .xlsx, .xls 파일만 지원됩니다
              </Text>
            </Pressable>
          </Animated.View>
        )}

        {/* Step 1: 파일 정보 */}
        {(step === 'fileReceived' || step === 'parsing') && pendingFile && !isLoading && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
                  borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                  borderRadius: radius.xl,
                },
              ]}
            >
              <View style={styles.fileIconRow}>
                <View
                  style={[
                    styles.fileIcon,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                      borderRadius: radius.lg,
                    },
                  ]}
                >
                  <Text style={{ fontSize: 28 }}>📊</Text>
                </View>
                <View style={styles.fileInfo}>
                  <Text style={[typography.h4, { color: colors.text }]} numberOfLines={1}>
                    {pendingFile.fileName}
                  </Text>
                  <Text style={[typography.caption, { color: colors.textMuted, marginTop: 4 }]}>
                    {formatFileSize(pendingFile.size)}
                  </Text>
                </View>
              </View>
              {pendingFile.size > 10 * 1024 * 1024 && (
                <View style={[styles.warningBox, { backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: radius.md }]}>
                  <Text style={[typography.caption, { color: '#f59e0b' }]}>
                    파일 크기가 10MB를 초과합니다
                  </Text>
                </View>
              )}
            </View>
          </Animated.View>
        )}

        {/* Step 2: 컬럼 매핑 */}
        {step === 'mapped' && !isLoading && (
          <>
            {/* 날짜 선택 */}
            <Animated.View entering={FadeInDown.delay(100).duration(400)}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    borderRadius: radius.xl,
                  },
                ]}
              >
                <Text style={[typography.overline, { color: colors.textMuted, marginBottom: 12 }]}>배송일</Text>
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
                    onPress={() => setDeliveryDate(getTodayString())}
                  >
                    <Text style={[typography.h4, { color: colors.text, letterSpacing: -0.3 }]}>
                      {formatDate(deliveryDate || getTodayString())}
                    </Text>
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
              </View>
            </Animated.View>

            {/* 필수 필드 매핑 */}
            <Animated.View entering={FadeInDown.delay(200).duration(400)}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    borderRadius: radius.xl,
                  },
                ]}
              >
                <Text style={[typography.overline, { color: colors.textMuted, marginBottom: 12 }]}>필수 필드</Text>
                {REQUIRED_FIELDS.map((field) => {
                  const selectedCol = localMapping[field.key] || '';
                  const confidence = getConfidence(field.key);
                  const isMissing = !selectedCol;
                  return (
                    <Pressable
                      key={field.key}
                      style={[
                        styles.mappingRow,
                        {
                          borderBottomColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        },
                      ]}
                      onPress={() => setPickerField(field.key)}
                    >
                      <View style={styles.mappingLabel}>
                        <Text
                          style={[
                            typography.bodySmall,
                            {
                              color: isMissing ? colors.error : colors.text,
                              fontWeight: '600',
                            },
                          ]}
                        >
                          {field.label}
                        </Text>
                        {isMissing ? (
                          <View
                            style={[
                              styles.missingBadge,
                              {
                                backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.1)',
                                borderRadius: radius.sm,
                              },
                            ]}
                          >
                            <Text style={{ fontSize: 10, color: colors.error, fontWeight: '700' }}>필수</Text>
                          </View>
                        ) : confidence > 0 ? (
                          <View
                            style={[
                              styles.confidenceDot,
                              { backgroundColor: getConfidenceColor(confidence, colors) },
                            ]}
                          />
                        ) : null}
                      </View>
                      <View style={[
                        styles.mappingValue,
                        {
                          backgroundColor: isMissing
                            ? (isDark ? 'rgba(239,68,68,0.1)' : 'rgba(239,68,68,0.06)')
                            : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)'),
                          borderColor: isMissing ? colors.error : 'transparent',
                          borderWidth: isMissing ? 1 : 0,
                          borderRadius: radius.md,
                        },
                      ]}>
                        <Text
                          style={[
                            typography.caption,
                            { color: selectedCol ? colors.text : colors.error },
                          ]}
                          numberOfLines={1}
                        >
                          {selectedCol || '선택하세요'}
                        </Text>
                        <Text style={[typography.caption, { color: isMissing ? colors.error : colors.textMuted }]}>▼</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* 선택 필드 매핑 */}
            <Animated.View entering={FadeInDown.delay(300).duration(400)}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
                    borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    borderRadius: radius.xl,
                  },
                ]}
              >
                <Text style={[typography.overline, { color: colors.textMuted, marginBottom: 12 }]}>선택 필드</Text>
                {OPTIONAL_FIELDS.map((field) => {
                  const selectedCol = localMapping[field.key] || '';
                  return (
                    <Pressable
                      key={field.key}
                      style={[
                        styles.mappingRow,
                        { borderBottomColor: 'transparent' },
                      ]}
                      onPress={() => setPickerField(field.key)}
                    >
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                        {field.label}
                      </Text>
                      <View style={[
                        styles.mappingValue,
                        {
                          backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                          borderRadius: radius.md,
                        },
                      ]}>
                        <Text
                          style={[
                            typography.caption,
                            { color: selectedCol ? colors.text : colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {selectedCol || '(없음)'}
                        </Text>
                        <Text style={[typography.caption, { color: colors.textMuted }]}>▼</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </Animated.View>

            {/* 데이터 미리보기 */}
            {previewRows.length > 0 && (
              <Animated.View entering={FadeInDown.delay(400).duration(400)}>
                <View
                  style={[
                    styles.card,
                    {
                      backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.75)',
                      borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                      borderRadius: radius.xl,
                    },
                  ]}
                >
                  <Text style={[typography.overline, { color: colors.textMuted, marginBottom: 12 }]}>
                    미리보기 (상위 {previewRows.length}행 / 전체 {rows.length}행)
                  </Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator>
                    <View>
                      {/* 헤더 행 */}
                      <View style={styles.previewRow}>
                        {headers.map((h) => (
                          <View key={h} style={[styles.previewCell, styles.previewHeaderCell, {
                            backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
                          }]}>
                            <Text style={[typography.caption, { color: colors.text, fontWeight: '600' }]} numberOfLines={1}>
                              {h}
                            </Text>
                          </View>
                        ))}
                      </View>
                      {/* 데이터 행 */}
                      {previewRows.map((row, i) => (
                        <View key={i} style={[styles.previewRow, {
                          borderBottomColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                        }]}>
                          {headers.map((h) => (
                            <View key={h} style={styles.previewCell}>
                              <Text style={[typography.caption, { color: colors.textSecondary }]} numberOfLines={1}>
                                {row[h] || '-'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      ))}
                    </View>
                  </ScrollView>
                </View>
              </Animated.View>
            )}
          </>
        )}

        {/* Step 3: 완료 */}
        {step === 'complete' && (
          <Animated.View entering={FadeInDown.duration(500)} style={styles.completeContainer}>
            <View
              style={[
                styles.completeIcon,
                {
                  backgroundColor: isDark ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.1)',
                  borderRadius: 40,
                },
              ]}
            >
              <Text style={{ fontSize: 40 }}>✓</Text>
            </View>
            <Text style={[typography.h2, { color: colors.text, marginTop: 20 }]}>업로드 완료</Text>
            <Text style={[typography.body, { color: colors.textSecondary, marginTop: 8, textAlign: 'center' }]}>
              {savedCount}건이 {formatDate(deliveryDate || getTodayString())}에 저장되었습니다
            </Text>
          </Animated.View>
        )}
      </ScrollView>

      {/* 하단 버튼 */}
      <Animated.View
        entering={FadeInUp.delay(300).duration(400)}
        style={[
          styles.bottomBar,
          {
            paddingBottom: insets.bottom + 16,
            backgroundColor: isDark ? 'rgba(12,15,20,0.95)' : 'rgba(250,250,252,0.95)',
            borderTopColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          },
        ]}
      >
        {step === 'mapped' && (
          <View style={styles.bottomBtnRow}>
            <Pressable
              onPress={() => { reset(); pickExcelFile(); }}
              style={[
                styles.changeFileBtn,
                {
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                  borderRadius: radius.lg,
                },
              ]}
            >
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>파일 변경</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <Button
                title={`${rows.length}건 저장`}
                onPress={() => handleSave()}
                disabled={!isRequiredMappingComplete}
                loading={isLoading}
                fullWidth
              />
            </View>
          </View>
        )}
        {step === 'complete' && (
          <Button
            title="대시보드로 이동"
            onPress={handleGoToDashboard}
            fullWidth
          />
        )}
      </Animated.View>

      {/* 컬럼 선택 모달 */}
      <ColumnPickerModal
        visible={!!pickerField}
        onClose={() => setPickerField(null)}
        columns={headers}
        selectedColumn={pickerSelectedColumn}
        onSelect={(col) => {
          if (pickerField) updateFieldMapping(pickerField, col);
        }}
        fieldLabel={pickerFieldLabel}
      />

      {/* 저장 중 오버레이 */}
      {step === 'saving' && isLoading && (
        <LoadingOverlay message="배송 데이터를 저장하는 중..." />
      )}
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
    paddingBottom: 16,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 32,
    marginTop: 20,
  },
  stepItem: {
    alignItems: 'center',
  },
  stepDot: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepDotText: {
    fontSize: 12,
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 12,
  },
  errorBox: {
    padding: 14,
    marginBottom: 4,
  },
  card: {
    padding: 16,
    borderWidth: 1,
  },
  fileIconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  fileIcon: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  warningBox: {
    padding: 10,
    marginTop: 12,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateNavBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateNavIcon: {
    fontSize: 24,
    fontWeight: '300',
  },
  dateTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  mappingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  mappingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  confidenceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  missingBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  mappingValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    maxWidth: '55%',
  },
  previewRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
  },
  previewCell: {
    width: 120,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  previewHeaderCell: {
    paddingVertical: 10,
  },
  completeContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  completeIcon: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomBar: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  bottomBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  changeFileBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Modal styles
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
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
});

// AnalysisProgress 전용 스타일
const analysisStyles = StyleSheet.create({
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(128,128,128,0.1)',
  },
  stepsList: {
    gap: 0,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  stepIcon: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: {
    width: 2,
    height: 12,
    marginLeft: 13,
  },
});
