import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUploadStore } from '../stores/upload';
import { useAuthStore } from '../stores/auth';
import DeliveryDatePicker from '../components/DeliveryDatePicker';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8787';

interface CustomFieldDef {
  id: string;
  field_key: string;
  field_name: string;
  field_order: number;
  is_editable_by_staff: number;
}

interface CachedMappingData {
  mapping: Record<string, string>;
  customFieldMapping: Record<string, string>;
}

const getMappingCacheKey = (headers: string[], customFieldKeys: string[]) => {
  // 헤더 + 커스텀 필드 키를 기준으로 캐시 키 생성
  const headerPart = headers.slice().sort().join('|');
  const customPart = customFieldKeys.slice().sort().join('|');
  return `mapping_cache_v2_${headerPart}_cf_${customPart}`;
};

const getCachedMapping = (headers: string[], customFieldKeys: string[]): CachedMappingData | null => {
  try {
    const cached = localStorage.getItem(getMappingCacheKey(headers, customFieldKeys));
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedMappingData;

    // 기본 필드 매핑 검증
    const validMapping: Record<string, string> = {};
    for (const [targetField, sourceColumn] of Object.entries(parsed.mapping || {})) {
      if (headers.includes(sourceColumn as string)) {
        validMapping[targetField] = sourceColumn as string;
      }
    }

    // 커스텀 필드 매핑 검증
    const validCustomFieldMapping: Record<string, string> = {};
    for (const [fieldKey, sourceColumn] of Object.entries(parsed.customFieldMapping || {})) {
      if (headers.includes(sourceColumn as string) && customFieldKeys.includes(fieldKey)) {
        validCustomFieldMapping[fieldKey] = sourceColumn as string;
      }
    }

    if (Object.keys(validMapping).length === 0 && Object.keys(validCustomFieldMapping).length === 0) {
      return null;
    }

    return { mapping: validMapping, customFieldMapping: validCustomFieldMapping };
  } catch {
    return null;
  }
};

const saveMappingToCache = (
  headers: string[],
  customFieldKeys: string[],
  mapping: Record<string, string>,
  customFieldMapping: Record<string, string>
) => {
  try {
    const data: CachedMappingData = { mapping, customFieldMapping };
    localStorage.setItem(getMappingCacheKey(headers, customFieldKeys), JSON.stringify(data));
  } catch {}
};

const STANDARD_FIELDS = [
  { key: 'recipientName', label: '수령인 이름', required: true },
  { key: 'recipientPhone', label: '연락처', required: true },
  { key: 'recipientAddress', label: '주소', required: true },
  { key: 'productName', label: '상품명', required: true },
  { key: 'staffName', label: '배송담당자', required: true },
  { key: 'memo', label: '메모', required: false },
];

export default function Mapping() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { headers, rows, mapping, setMapping, updateMapping, reset } = useUploadStore();

  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');
  const [aiError, setAiError] = useState<{ show: boolean; canRetry: boolean }>({ show: false, canRetry: false });
  const [confirmOverwrite, setConfirmOverwrite] = useState<{ show: boolean; existingCount: number }>({
    show: false,
    existingCount: 0,
  });
  const [usage, setUsage] = useState<{ current: number; limit: number; remaining: number } | null>(null);

  // 커스텀 필드 정의
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [customFieldMapping, setCustomFieldMapping] = useState<Record<string, string>>({});
  const [customFieldsLoaded, setCustomFieldsLoaded] = useState(false);

  // 전체 타겟 필드 (기본 + 커스텀)
  const TARGET_FIELDS = useMemo(() => {
    const customFields = customFieldDefs.map(f => ({
      key: `custom_${f.field_key}`,
      label: f.field_name,
      required: false,
      isCustom: true,
      fieldKey: f.field_key,
    }));
    return [...STANDARD_FIELDS.map(f => ({ ...f, isCustom: false, fieldKey: f.key })), ...customFields];
  }, [customFieldDefs]);

  // 데이터가 없으면 업로드 페이지로 리다이렉트
  useEffect(() => {
    if (headers.length === 0) {
      navigate('/upload');
    }
  }, [headers, navigate]);

  // 커스텀 필드 정의 조회
  useEffect(() => {
    const fetchCustomFields = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/custom-field`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (result.success) {
          setCustomFieldDefs(result.data.fields || []);
        }
      } catch (err) {
        console.error('Failed to fetch custom fields:', err);
      } finally {
        setCustomFieldsLoaded(true);
      }
    };
    if (token) {
      fetchCustomFields();
    } else {
      setCustomFieldsLoaded(true);
    }
  }, [token]);

  // 커스텀 필드 정의 로드 후 캐시 확인 및 AI 매핑 요청
  useEffect(() => {
    if (headers.length === 0 || Object.keys(mapping).length > 0 || !customFieldsLoaded) return;

    const customFieldKeys = customFieldDefs.map((f) => f.field_key);
    const cached = getCachedMapping(headers, customFieldKeys);
    if (cached) {
      setMapping(cached.mapping);
      setCustomFieldMapping(cached.customFieldMapping);
      return;
    }

    fetchMappingSuggestion();
  }, [headers, customFieldsLoaded]);

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/subscription/status?date=${deliveryDate}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const result = await response.json();
        if (result.success) {
          setUsage({
            current: result.data.currentUsage,
            limit: result.data.dailyLimit,
            remaining: result.data.remaining,
          });
        }
      } catch (err) {
        console.error('Usage fetch error:', err);
      }
    };

    if (token && deliveryDate) {
      fetchUsage();
    }
  }, [token, deliveryDate]);

  const fetchMappingSuggestion = async (retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 30000; // 30초 타임아웃

    setIsLoadingSuggestion(true);
    setAiError({ show: false, canRetry: false });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(`${API_BASE}/api/upload/mapping/suggest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          headers,
          sampleRows: rows.slice(0, 3),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await response.json();
      if (result.success && result.data.suggestions) {
        const newMapping: Record<string, string> = {};
        const newCustomFieldMapping: Record<string, string> = {};
        const customFieldKeys = customFieldDefs.map((f) => f.field_key);

        for (const suggestion of result.data.suggestions) {
          if (suggestion.confidence >= 0.5) {
            // 커스텀 필드인지 확인 (custom_fieldKey 형태)
            if (suggestion.targetField.startsWith('custom_')) {
              const fieldKey = suggestion.targetField.replace('custom_', '');
              if (customFieldKeys.includes(fieldKey)) {
                newCustomFieldMapping[fieldKey] = suggestion.sourceColumn;
              }
            } else {
              newMapping[suggestion.targetField] = suggestion.sourceColumn;
            }
          }
        }
        setMapping(newMapping);
        setCustomFieldMapping(newCustomFieldMapping);
        saveMappingToCache(headers, customFieldKeys, newMapping, newCustomFieldMapping);
        setAiError({ show: false, canRetry: false });
      } else {
        throw new Error(result.error || 'AI 매핑 추천 실패');
      }
    } catch (err) {
      console.error(`Mapping suggestion error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err);

      if (retryCount < MAX_RETRIES - 1) {
        // 재시도 (1초 딜레이)
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchMappingSuggestion(retryCount + 1);
      } else {
        // 3번 실패 - 수동 매핑 안내
        setAiError({ show: true, canRetry: false });
      }
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const handleRetryAiMapping = () => {
    setAiError({ show: false, canRetry: false });
    fetchMappingSuggestion(0);
  };

  const handleSave = async (overwrite = false) => {
    // 필수 필드 확인 (기본 필드만)
    const missingFields = STANDARD_FIELDS.filter(
      (field) => field.required && !mapping[field.key]
    ).map((field) => field.label);

    if (missingFields.length > 0) {
      setError(`필수 필드를 매핑하세요: ${missingFields.join(', ')}`);
      return;
    }

    setIsSaving(true);
    setError('');
    setConfirmOverwrite({ show: false, existingCount: 0 });

    // 커스텀 필드 매핑 추출
    const customFieldsMapping: Record<string, string> = {};
    for (const [key, value] of Object.entries(customFieldMapping)) {
      if (value) {
        customFieldsMapping[key] = value;
      }
    }

    // 최종 매핑 객체 구성
    const finalMapping = {
      ...mapping,
      customFields: Object.keys(customFieldsMapping).length > 0 ? customFieldsMapping : undefined,
    };

    try {
      const response = await fetch(`${API_BASE}/api/upload/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          headers,
          rows,
          mapping: finalMapping,
          deliveryDate,
          overwrite,
        }),
      });

      const result = await response.json();
      if (result.success) {
        const customFieldKeys = customFieldDefs.map((f) => f.field_key);
        saveMappingToCache(headers, customFieldKeys, mapping, customFieldMapping);
        reset();
        navigate('/', {
          state: {
            message: `${result.data.insertedCount}건의 배송 데이터를 저장했습니다.`,
            deliveryDate: deliveryDate,
          },
        });
      } else if (result.needsConfirmation) {
        // 기존 데이터 덮어쓰기 확인 필요
        setConfirmOverwrite({ show: true, existingCount: result.existingCount });
      } else {
        setError(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Save error:', err);
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmOverwrite = () => {
    handleSave(true);
  };

  const handleCancelOverwrite = () => {
    setConfirmOverwrite({ show: false, existingCount: 0 });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/upload"
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              돌아가기
            </Link>

            <button onClick={() => handleSave(false)} disabled={isSaving} className="btn-primary">
              {isSaving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  저장하기
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">컬럼 매핑</h1>
          <p className="text-gray-500 dark:text-gray-400">
            엑셀 컬럼을 배송 데이터 필드에 매핑하세요.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* AI 매핑 실패 안내 */}
        {aiError.show && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-900/20 dark:border-amber-800">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <p className="text-amber-800 dark:text-amber-200 font-medium">AI 매핑 추천을 불러올 수 없습니다</p>
                <p className="text-amber-600 dark:text-amber-400 text-sm mt-1">
                  네트워크 연결을 확인하거나, 아래에서 직접 컬럼을 매핑해주세요.
                </p>
                <button
                  onClick={handleRetryAiMapping}
                  className="mt-3 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-700 dark:text-amber-200 rounded-lg text-sm font-medium transition-colors"
                >
                  다시 시도
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delivery Date & Usage */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-stretch gap-4">
          <div className="flex-1 flex">
            <div className="w-full">
              <DeliveryDatePicker
                value={deliveryDate}
                onChange={setDeliveryDate}
                description="이 날짜로 모든 배송 데이터가 저장됩니다"
              />
            </div>
          </div>
          
          {usage && (
            <div className={`sm:w-72 card p-6 flex flex-col justify-center bg-gradient-to-r ${
              usage.current > 0 
                ? 'from-amber-50 to-orange-50 border-2 border-amber-200 dark:from-amber-900/20 dark:to-orange-900/20 dark:border-amber-700'
                : 'from-emerald-50 to-teal-50 border-2 border-emerald-200 dark:from-emerald-900/20 dark:to-teal-900/20 dark:border-emerald-700'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  usage.current > 0 
                    ? 'bg-amber-100 dark:bg-amber-900/50' 
                    : 'bg-emerald-100 dark:bg-emerald-900/50'
                }`}>
                  <svg className={`w-5 h-5 ${usage.current > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    {usage.current > 0 ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    )}
                  </svg>
                </div>
                <div className="flex-1">
                  {usage.current > 0 ? (
                    <>
                      <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">기존 데이터 있음</p>
                      <p className="text-xl font-bold text-amber-900 dark:text-amber-100">
                        {usage.current}<span className="text-sm font-normal text-amber-600 dark:text-amber-400 ml-1">건 삭제 예정</span>
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">기존 데이터 없음</p>
                      <p className="text-xl font-bold text-emerald-900 dark:text-emerald-100">신규 등록</p>
                    </>
                  )}
                </div>
              </div>
              
              <div className="flex items-center justify-between text-xs pt-2 border-t border-gray-200 dark:border-gray-600">
                <span className="text-gray-600 dark:text-gray-400">
                  신규 <span className="font-bold">{rows.length}건</span>
                </span>
                {usage.limit === -1 ? (
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-full font-medium">
                    한도 무제한
                  </span>
                ) : rows.length <= usage.limit ? (
                  <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-800 text-emerald-700 dark:text-emerald-300 rounded-full font-medium">
                    한도 {usage.limit}건 이내
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400 rounded-full font-medium">
                    한도 초과 (+{rows.length - usage.limit})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Mapping Grid - 기본 필드 */}
        <div className="grid gap-4">
          {STANDARD_FIELDS.map((field) => (
            <div key={field.key} className="card p-4 flex items-center gap-4">
              <div className="flex-1">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {field.label}
                  {field.required && <span className="text-red-500 ml-1">*</span>}
                </span>
              </div>

              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>

              <div className="flex-1">
                <select
                  value={mapping[field.key] || ''}
                  onChange={(e) => updateMapping(field.key, e.target.value)}
                  className="input-field"
                >
                  <option value="">선택 안 함</option>
                  {headers.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}
        </div>

        {/* 사용자 정의 컬럼 Mapping */}
        {customFieldDefs.length > 0 && (
          <div className="mt-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <svg className="w-5 h-5 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
              </svg>
              사용자 정의 컬럼
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">(선택사항)</span>
            </h2>
            <div className="grid gap-4">
              {customFieldDefs.map((field) => (
                <div key={field.id} className="card p-4 flex items-center gap-4 border-l-4 border-cyan-400">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {field.field_name}
                    </span>
                    {field.is_editable_by_staff === 1 && (
                      <span className="ml-2 text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 rounded-full">
                        편집 가능
                      </span>
                    )}
                  </div>

                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                  </svg>

                  <div className="flex-1">
                    <select
                      value={customFieldMapping[field.field_key] || ''}
                      onChange={(e) => setCustomFieldMapping(prev => ({ ...prev, [field.field_key]: e.target.value }))}
                      className="input-field"
                    >
                      <option value="">선택 안 함</option>
                      {headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {rows.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              데이터 미리보기 (처음 5행)
            </h2>
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900/50">
                  <tr>
                    {headers.map((header) => (
                      <th key={header} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rows.slice(0, 5).map((row, idx) => (
                    <tr key={idx}>
                      {headers.map((header) => (
                        <td key={header} className="px-4 py-3 text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 전체 화면 로딩 오버레이 (AI 분석 중 또는 저장 중) */}
      {(isLoadingSuggestion || isSaving) && !confirmOverwrite.show && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="relative mx-auto w-16 h-16 mb-6">
              <div className="absolute inset-0 bg-primary-100 dark:bg-primary-900/50 rounded-xl"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                {isLoadingSuggestion ? (
                  <svg className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                )}
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 rounded-full animate-ping"></div>
            </div>

            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              {isLoadingSuggestion ? 'AI가 분석 중입니다' : '데이터 저장 중'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {isLoadingSuggestion
                ? '엑셀 헤더와 샘플 데이터를 분석하여 최적의 매핑을 추천합니다...'
                : '배송 데이터를 저장하고 있습니다...'}
            </p>

            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-primary-200 border-t-primary-600"></div>
            </div>
          </div>
        </div>
      )}

      {/* 덮어쓰기 확인 모달 */}
      {confirmOverwrite.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">기존 데이터 덮어쓰기</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{deliveryDate}</p>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              해당 날짜에 <span className="font-bold text-amber-600 dark:text-amber-400">{confirmOverwrite.existingCount}건</span>의 기존 배송 데이터가 있습니다.
              <br /><br />
              기존 데이터를 <span className="font-bold text-red-500">삭제</span>하고 <span className="font-bold text-emerald-600">{rows.length}건</span>을 새로 등록하시겠습니까?
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleCancelOverwrite}
                className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleConfirmOverwrite}
                disabled={isSaving}
                className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
              >
                {isSaving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    덮어쓰기
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
