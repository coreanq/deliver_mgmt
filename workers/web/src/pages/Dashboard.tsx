import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';

interface Delivery {
  id: string;
  staffName: string | null;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  productName: string;
  quantity: number;
  status: 'pending' | 'in_transit' | 'completed';
  deliveryDate: string;
  memo: string | null;
  photoUrl: string | null;
  customFields: Record<string, string> | null;
}

interface CustomFieldDef {
  id: string;
  fieldName: string;
  fieldOrder: number;
  isEditableByStaff: boolean;
}

interface CachedMappingData {
  mapping: Record<string, string>;
  customFieldMapping: Record<string, string>;
}

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8787';

const STATUS_LABELS = {
  pending: '배송 준비',
  in_transit: '배송 중',
  completed: '완료',
};

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  in_transit: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  completed: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

const STANDARD_FIELDS = [
  { key: 'recipientName', label: '수령인 이름', required: true },
  { key: 'recipientPhone', label: '연락처', required: true },
  { key: 'recipientAddress', label: '주소', required: true },
  { key: 'productName', label: '상품명', required: true },
  { key: 'staffName', label: '배송담당자', required: true },
  { key: 'memo', label: '메모', required: false },
];

const getMappingCacheKey = (headers: string[], customFieldKeys: string[]) => {
  const headerPart = headers.slice().sort().join('|');
  const customPart = customFieldKeys.slice().sort().join('|');
  return `mapping_cache_v2_${headerPart}_cf_${customPart}`;
};

const getCachedMapping = (headers: string[], customFieldKeys: string[]): CachedMappingData | null => {
  try {
    const cached = localStorage.getItem(getMappingCacheKey(headers, customFieldKeys));
    if (!cached) return null;

    const parsed = JSON.parse(cached) as CachedMappingData;

    const validMapping: Record<string, string> = {};
    for (const [targetField, sourceColumn] of Object.entries(parsed.mapping || {})) {
      if (headers.includes(sourceColumn as string)) {
        validMapping[targetField] = sourceColumn as string;
      }
    }

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

export default function Dashboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const { admin, token, logout } = useAuthStore();

  const locationState = location.state as { deliveryDate?: string; message?: string } | null;
  const initialDate = locationState?.deliveryDate || new Date().toISOString().split('T')[0];

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [isLoading, setIsLoading] = useState(true);
  const [successMessage, setSuccessMessage] = useState<string | null>(locationState?.message || null);

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'in_transit' | 'completed'>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');

  // QR 모달 상태
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrImageUrl, setQrImageUrl] = useState<string>('');

  // 엑셀 다운로드 모달 상태
  const [showExcelModal, setShowExcelModal] = useState(false);

  // PRO 구독 상태
  const [isPro, setIsPro] = useState(false);
  const [dailyLimit, setDailyLimit] = useState<number>(100);
  const [todayUsage, setTodayUsage] = useState<number>(0);
  const [planType, setPlanType] = useState<string>('free');

  const [serverBuildDate, setServerBuildDate] = useState('');
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // 사진 확대 모달 상태
  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);

  // 드래그 앤 드롭 상태
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // 매핑 모달 상태
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [uploadedHeaders, setUploadedHeaders] = useState<string[]>([]);
  const [uploadedRows, setUploadedRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [customFieldMapping, setCustomFieldMapping] = useState<Record<string, string>>({});
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 인라인 편집 상태 (사용자 정의 컬럼 + 배송담당자)
  const [editingCell, setEditingCell] = useState<{ deliveryId: string; fieldId: string } | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isSavingCell, setIsSavingCell] = useState(false);
  const [mappingError, setMappingError] = useState('');
  const [aiError, setAiError] = useState<{ show: boolean; canRetry: boolean }>({ show: false, canRetry: false });
  const [confirmOverwrite, setConfirmOverwrite] = useState<{ show: boolean; existingCount: number }>({
    show: false,
    existingCount: 0,
  });

  // 웹훅 모달 상태
  const [showWebhookModal, setShowWebhookModal] = useState(false);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookEnabled, setWebhookEnabled] = useState(true);
  const [isSavingWebhook, setIsSavingWebhook] = useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = useState(false);

  useEffect(() => {
    fetchDeliveries();
  }, [selectedDate]);

  // 성공 메시지 표시 후 자동 숨김 및 location state 초기화
  useEffect(() => {
    if (successMessage) {
      window.history.replaceState({}, document.title);
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  // 구독 상태 조회
  useEffect(() => {
    const fetchSubscription = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/subscription/status?date=${selectedDate}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (response.status === 401) {
          logout();
          navigate('/login');
          return;
        }
        const result = await response.json();
        if (result.success) {
          setIsPro(result.data.isPro || false);
          setDailyLimit(result.data.dailyLimit ?? 100);
          setTodayUsage(result.data.currentUsage ?? 0);
          setPlanType(result.data.type ?? 'free');
        }
      } catch (error) {
        console.error('Failed to fetch subscription:', error);
      }
    };
    fetchSubscription();
  }, [token, selectedDate]);

  // 서버 빌드 날짜 조회
  useEffect(() => {
    const fetchServerBuildDate = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/health`);
        const result = await res.json();
        if (result.data?.buildDate) {
          setServerBuildDate(result.data.buildDate);
        }
      } catch {}
    };
    fetchServerBuildDate();
  }, []);

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
      }
    };
    if (token) {
      fetchCustomFields();
    }
  }, [token]);

  const fetchDeliveries = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/delivery/list?date=${selectedDate}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        logout();
        navigate('/login');
        return;
      }

      const result = await response.json();
      if (result.success) {
        setDeliveries(result.data.deliveries);
      }
    } catch (error) {
      console.error('Failed to fetch deliveries:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 파일 처리
  const processFile = useCallback(async (file: File) => {
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setFileError('엑셀 파일(.xlsx, .xls) 또는 CSV 파일만 업로드할 수 있습니다.');
      return;
    }

    setIsProcessingFile(true);
    setFileError(null);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json<Record<string, string>>(worksheet, {
        raw: false,
        defval: '',
      });

      if (jsonData.length === 0) {
        setFileError('파일에 데이터가 없습니다.');
        setIsProcessingFile(false);
        return;
      }

      const headers = Object.keys(jsonData[0]);
      setUploadedHeaders(headers);
      setUploadedRows(jsonData);
      setMapping({});
      setCustomFieldMapping({});
      setMappingError('');
      setShowMappingModal(true);

      // AI 매핑 추천 요청 (id를 키로 사용)
      const customFieldIds = customFieldDefs.map((f) => f.id);
      const cached = getCachedMapping(headers, customFieldIds);
      if (cached) {
        setMapping(cached.mapping);
        setCustomFieldMapping(cached.customFieldMapping);
      } else {
        fetchMappingSuggestion(headers, jsonData.slice(0, 3));
      }
    } catch (err) {
      console.error('File parse error:', err);
      setFileError('파일을 읽는 중 오류가 발생했습니다.');
    } finally {
      setIsProcessingFile(false);
    }
  }, [customFieldDefs]);

  const fetchMappingSuggestion = async (headers: string[], sampleRows: Record<string, string>[], retryCount = 0): Promise<void> => {
    const MAX_RETRIES = 3;
    const TIMEOUT_MS = 30000;

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
        body: JSON.stringify({ headers, sampleRows }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const result = await response.json();
      if (result.success && result.data.suggestions) {
        const newMapping: Record<string, string> = {};
        const newCustomFieldMapping: Record<string, string> = {};
        const customFieldIds = customFieldDefs.map((f) => f.id);

        for (const suggestion of result.data.suggestions) {
          if (suggestion.confidence >= 0.5) {
            if (suggestion.targetField.startsWith('custom_')) {
              const fieldId = suggestion.targetField.replace('custom_', '');
              if (customFieldIds.includes(fieldId)) {
                newCustomFieldMapping[fieldId] = suggestion.sourceColumn;
              }
            } else {
              newMapping[suggestion.targetField] = suggestion.sourceColumn;
            }
          }
        }
        setMapping(newMapping);
        setCustomFieldMapping(newCustomFieldMapping);
        saveMappingToCache(headers, customFieldIds, newMapping, newCustomFieldMapping);
        setAiError({ show: false, canRetry: false });
      } else {
        throw new Error(result.error || 'AI 매핑 추천 실패');
      }
    } catch (err) {
      console.error(`Mapping suggestion error (attempt ${retryCount + 1}/${MAX_RETRIES}):`, err);

      if (retryCount < MAX_RETRIES - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return fetchMappingSuggestion(headers, sampleRows, retryCount + 1);
      } else {
        setAiError({ show: true, canRetry: false });
      }
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const handleRetryAiMapping = () => {
    setAiError({ show: false, canRetry: false });
    fetchMappingSuggestion(uploadedHeaders, uploadedRows.slice(0, 3), 0);
  };

  const handleSave = async (overwrite = false) => {
    const missingFields = STANDARD_FIELDS.filter(
      (field) => field.required && !mapping[field.key]
    ).map((field) => field.label);

    if (missingFields.length > 0) {
      setMappingError(`필수 필드를 매핑하세요: ${missingFields.join(', ')}`);
      return;
    }

    setIsSaving(true);
    setMappingError('');
    setConfirmOverwrite({ show: false, existingCount: 0 });

    const customFieldsMapping: Record<string, string> = {};
    for (const [key, value] of Object.entries(customFieldMapping)) {
      if (value) {
        customFieldsMapping[key] = value;
      }
    }

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
          headers: uploadedHeaders,
          rows: uploadedRows,
          mapping: finalMapping,
          deliveryDate: selectedDate,
          overwrite,
        }),
      });

      const result = await response.json();
      if (result.success) {
        const customFieldIds = customFieldDefs.map((f) => f.id);
        saveMappingToCache(uploadedHeaders, customFieldIds, mapping, customFieldMapping);
        setShowMappingModal(false);
        setUploadedHeaders([]);
        setUploadedRows([]);
        setMapping({});
        setCustomFieldMapping({});
        setSuccessMessage(`${result.data.insertedCount}건의 배송 데이터를 저장했습니다.`);
        fetchDeliveries();
      } else if (result.needsConfirmation) {
        setConfirmOverwrite({ show: true, existingCount: result.existingCount });
      } else {
        setMappingError(result.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      console.error('Save error:', err);
      setMappingError('저장 중 오류가 발생했습니다.');
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

  const closeMappingModal = () => {
    setShowMappingModal(false);
    setUploadedHeaders([]);
    setUploadedRows([]);
    setMapping({});
    setCustomFieldMapping({});
    setMappingError('');
    setConfirmOverwrite({ show: false, existingCount: 0 });
  };

  // 담당자 목록 추출
  const staffList = useMemo(() => {
    const staffSet = new Set<string>();
    deliveries.forEach((d) => {
      if (d.staffName) staffSet.add(d.staffName);
    });
    return Array.from(staffSet).sort();
  }, [deliveries]);

  // 필터링된 배송 목록
  const filteredDeliveries = useMemo(() => {
    return deliveries.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (staffFilter !== 'all' && d.staffName !== staffFilter) return false;
      if (searchText) {
        const search = searchText.toLowerCase();
        const matchRecipient = d.recipientName.toLowerCase().includes(search);
        const matchAddress = d.recipientAddress.toLowerCase().includes(search);
        const matchProduct = d.productName.toLowerCase().includes(search);
        const matchPhone = d.recipientPhone.includes(search);
        if (!matchRecipient && !matchAddress && !matchProduct && !matchPhone) return false;
      }
      return true;
    });
  }, [deliveries, statusFilter, staffFilter, searchText]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (statusFilter !== 'all') count++;
    if (staffFilter !== 'all') count++;
    if (searchText) count++;
    return count;
  }, [statusFilter, staffFilter, searchText]);

  const clearFilters = () => {
    setStatusFilter('all');
    setStaffFilter('all');
    setSearchText('');
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleStatusChange = async (deliveryId: string, newStatus: 'pending' | 'in_transit' | 'completed') => {
    setUpdatingStatusId(deliveryId);
    try {
      const response = await fetch(`${API_BASE}/api/delivery/${deliveryId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const result = await response.json();
      if (result.success) {
        setDeliveries((prev) =>
          prev.map((d) => (d.id === deliveryId ? { ...d, status: newStatus } : d))
        );
      }
    } catch (error) {
      console.error('Status update error:', error);
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // 인라인 편집 시작 (사용자 정의 컬럼 + 배송담당자)
  const handleStartEditCell = (deliveryId: string, fieldId: string, currentValue: string) => {
    setEditingCell({ deliveryId, fieldId });
    setEditingValue(currentValue || '');
  };

  // 인라인 편집 취소
  const handleCancelEditCell = () => {
    setEditingCell(null);
    setEditingValue('');
  };

  // 인라인 편집 저장
  const handleSaveCell = async () => {
    if (!editingCell) return;

    const isStaffField = editingCell.fieldId === '__staffName__';
    setIsSavingCell(true);

    try {
      const url = isStaffField
        ? `${API_BASE}/api/delivery/${editingCell.deliveryId}/staff`
        : `${API_BASE}/api/delivery/${editingCell.deliveryId}/custom-fields`;

      const body = isStaffField
        ? { staffName: editingValue }
        : { customFields: { [editingCell.fieldId]: editingValue } };

      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (result.success) {
        // 로컬 상태 업데이트
        setDeliveries((prev) =>
          prev.map((d) => {
            if (d.id === editingCell.deliveryId) {
              if (isStaffField) {
                return { ...d, staffName: editingValue || null };
              }
              return {
                ...d,
                customFields: {
                  ...d.customFields,
                  [editingCell.fieldId]: editingValue,
                },
              };
            }
            return d;
          })
        );
        setEditingCell(null);
        setEditingValue('');
      } else {
        alert(result.error || '저장에 실패했습니다.');
      }
    } catch (error) {
      console.error('Cell save error:', error);
      alert('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSavingCell(false);
    }
  };

  const generateQR = async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_BASE}/api/auth/qr/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ date: selectedDate }),
      });

      const result = await response.json();
      if (!result.success) {
        alert(result.error || 'QR 코드 생성에 실패했습니다.');
        return;
      }

      const qrData = JSON.stringify({ token: result.data.token, date: selectedDate });
      const url = await QRCode.toDataURL(qrData, {
        width: 256,
        margin: 2,
        color: { dark: '#1a1a2e', light: '#ffffff' },
      });
      setQrImageUrl(url);
      setShowQRModal(true);
    } catch (err) {
      console.error('QR generation failed:', err);
      alert('QR 코드 생성에 실패했습니다.');
    }
  };

  const stats = {
    total: deliveries.length,
    pending: deliveries.filter((d) => d.status === 'pending').length,
    in_transit: deliveries.filter((d) => d.status === 'in_transit').length,
    completed: deliveries.filter((d) => d.status === 'completed').length,
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday})`;
  };

  const downloadExcel = () => {
    if (!isPro) return;

    const headers = ['No', '수령인', '연락처', '주소', '상품', '수량', '담당자', '상태'];
    const rows = filteredDeliveries.map((d, i) => [
      i + 1,
      d.recipientName,
      d.recipientPhone,
      `"${d.recipientAddress.replace(/"/g, '""')}"`,
      d.productName,
      d.quantity,
      d.staffName || '-',
      STATUS_LABELS[d.status],
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `배송목록_${selectedDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    setShowExcelModal(false);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      processFile(file);
    }
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  }, [processFile]);

  const openWebhookModal = async () => {
    setShowWebhookModal(true);
    try {
      const response = await fetch(`${API_BASE}/api/webhook`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await response.json();
      if (result.success) {
        setWebhookUrl(result.data.url || '');
        setWebhookEnabled(result.data.enabled === 1);
      }
    } catch (error) {
      console.error('Failed to fetch webhook settings:', error);
    }
  };

  const saveWebhook = async () => {
    setIsSavingWebhook(true);
    try {
      const response = await fetch(`${API_BASE}/api/webhook`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: webhookUrl, enabled: webhookEnabled }),
      });
      const result = await response.json();
      if (result.success) {
        setSuccessMessage('웹훅 설정이 저장되었습니다.');
        setShowWebhookModal(false);
      } else {
        alert('저장에 실패했습니다.');
      }
    } catch (error) {
      alert('오류가 발생했습니다.');
    } finally {
      setIsSavingWebhook(false);
    }
  };

  const testWebhook = async () => {
    setIsTestingWebhook(true);
    try {
      const response = await fetch(`${API_BASE}/api/webhook/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: webhookUrl }),
      });
      const result = await response.json();
      if (result.success) {
        alert('테스트 웹훅이 전송되었습니다.');
      } else {
        alert(`전송 실패: ${result.error}`);
      }
    } catch (error) {
      alert('오류가 발생했습니다.');
    } finally {
      setIsTestingWebhook(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <img src="/app-icon.png" alt="배매니저" className="w-10 h-10 rounded-xl" />
              <span className="font-bold text-lg text-gray-900 dark:text-white">배매니저</span>
            </div>

            <div className="flex items-center gap-3">
              {/* 사용량 표시 */}
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">등록</span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white">
                    {dailyLimit === -1 ? <>{todayUsage} / ∞</> : <>{todayUsage} / {dailyLimit}</>}
                  </span>
                </div>
                {dailyLimit !== -1 && (
                  <div className="w-16 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${todayUsage / dailyLimit >= 0.9 ? 'bg-red-500' : todayUsage / dailyLimit >= 0.7 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (todayUsage / dailyLimit) * 100)}%` }}
                    />
                  </div>
                )}
                <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase">{planType}</span>
              </div>

              <Link to="/sms-template" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white rounded-xl font-semibold shadow-lg shadow-rose-500/25 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                </svg>
                SMS 템플릿
              </Link>

              <Link to="/custom-fields" className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
                사용자 정의 컬럼
              </Link>

              <button onClick={() => setShowExcelModal(true)} className="relative flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                엑셀 저장
                {!isPro && <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded-md">유료</span>}
              </button>

              <a href="/sample.xlsx" download className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-gray-500 to-slate-600 hover:from-gray-600 hover:to-slate-700 text-white rounded-xl font-semibold shadow-lg shadow-gray-500/25 transition-all">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                엑셀 샘플
              </a>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 dark:text-gray-400">{admin?.email}</span>
                <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Success Message Toast */}
      {successMessage && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
          <div className="flex items-center gap-3 px-5 py-3 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/30">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span className="font-medium">{successMessage}</span>
            <button onClick={() => setSuccessMessage(null)} className="ml-2 p-1 hover:bg-white/20 rounded-lg transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 배송일 카드 + 드래그앤드롭 */}
        <div className="mb-6">
          <div
            className={`card p-6 bg-gradient-to-r from-primary-50 to-blue-50 border-2 transition-all ${isDragging ? 'border-primary-500 bg-primary-100/50 dark:bg-primary-900/30' : 'border-primary-200'} dark:from-primary-900/20 dark:to-blue-900/20 dark:border-primary-700`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
          >
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              {/* 날짜 선택 영역 */}
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="w-14 h-14 bg-primary-100 dark:bg-primary-900/50 rounded-xl flex items-center justify-center">
                  <svg className="w-7 h-7 text-primary-600 dark:text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <label className="block text-lg font-bold text-primary-900 dark:text-primary-100 mb-1">배송일</label>
                  <p className="text-sm text-primary-600 dark:text-primary-400">해당 날짜의 배송 현황을 조회합니다</p>
                </div>
              </div>

              {/* 드롭존 영역 */}
              <div
                className={`flex-1 flex items-center justify-center gap-4 py-4 px-6 border-2 border-dashed rounded-xl cursor-pointer transition-all ${isDragging ? 'border-primary-500 bg-primary-100/50 dark:bg-primary-800/30' : 'border-primary-300 dark:border-primary-600 hover:border-primary-400 hover:bg-primary-50/50 dark:hover:bg-primary-800/20'}`}
                onClick={() => document.getElementById('dashboard-file-input')?.click()}
              >
                <input
                  type="file"
                  id="dashboard-file-input"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                {isProcessingFile ? (
                  <div className="flex items-center gap-3">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
                    <span className="text-primary-600 dark:text-primary-400 font-medium">파일 처리 중...</span>
                  </div>
                ) : (
                  <>
                    <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <div className="text-center">
                      <p className="font-medium text-primary-700 dark:text-primary-300">
                        {isDragging ? '여기에 놓으세요!' : '엑셀 파일을 드래그하거나 클릭'}
                      </p>
                      <p className="text-xs text-primary-500 dark:text-primary-400">.xlsx, .xls, .csv</p>
                    </div>
                  </>
                )}
              </div>

              {/* 버튼들 */}
              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  onClick={generateQR}
                  className="flex items-center gap-2 px-5 py-3 bg-white dark:bg-gray-800 hover:bg-violet-50 dark:hover:bg-violet-900/30 text-violet-600 dark:text-violet-400 border-2 border-violet-300 dark:border-violet-600 rounded-xl font-semibold transition-all"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <rect x="3" y="3" width="7" height="7" rx="1" strokeWidth="2" />
                    <rect x="14" y="3" width="7" height="7" rx="1" strokeWidth="2" />
                    <rect x="3" y="14" width="7" height="7" rx="1" strokeWidth="2" />
                    <rect x="14" y="14" width="7" height="7" rx="1" strokeWidth="2" />
                  </svg>
                  QR
                </button>
                {/* 날짜 네비게이션 */}
                <div className="flex items-center">
                  <button
                    onClick={() => {
                      const date = new Date(selectedDate);
                      date.setDate(date.getDate() - 1);
                      setSelectedDate(date.toISOString().split('T')[0]);
                    }}
                    className="flex items-center justify-center w-11 h-11 bg-white dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-2 border-primary-300 dark:border-primary-600 rounded-l-xl transition-all"
                    title="이전 날짜"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="h-11 px-4 text-lg font-semibold bg-white dark:bg-gray-800 text-primary-700 dark:text-primary-300 border-y-2 border-primary-300 dark:border-primary-600 focus:outline-none focus:ring-0"
                  />
                  <button
                    onClick={() => {
                      const date = new Date(selectedDate);
                      date.setDate(date.getDate() + 1);
                      setSelectedDate(date.toISOString().split('T')[0]);
                    }}
                    className="flex items-center justify-center w-11 h-11 bg-white dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-2 border-primary-300 dark:border-primary-600 rounded-r-xl transition-all"
                    title="다음 날짜"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* 파일 에러 표시 */}
            {fileError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                {fileError}
              </div>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          {/* Status Filters & Webhook Button */}
          <div className="flex gap-3">
            <button onClick={() => setStatusFilter('all')} className={`card px-4 py-3 flex items-center gap-3 transition-all cursor-pointer hover:shadow-md ${statusFilter === 'all' ? 'ring-2 ring-primary-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}>
              <div className="w-10 h-10 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <span className="font-bold text-gray-900 dark:text-white">{stats.total}</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">전체</span>
            </button>
            <button onClick={() => setStatusFilter('pending')} className={`card px-4 py-3 flex items-center gap-3 transition-all cursor-pointer hover:shadow-md ${statusFilter === 'pending' ? 'ring-2 ring-amber-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}>
              <div className="w-10 h-10 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center">
                <span className="font-bold text-amber-700 dark:text-amber-400">{stats.pending}</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">준비</span>
            </button>
            <button onClick={() => setStatusFilter('in_transit')} className={`card px-4 py-3 flex items-center gap-3 transition-all cursor-pointer hover:shadow-md ${statusFilter === 'in_transit' ? 'ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}>
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <span className="font-bold text-blue-700 dark:text-blue-400">{stats.in_transit}</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">배송중</span>
            </button>
            <button onClick={() => setStatusFilter('completed')} className={`card px-4 py-3 flex items-center gap-3 transition-all cursor-pointer hover:shadow-md ${statusFilter === 'completed' ? 'ring-2 ring-green-500 ring-offset-2 dark:ring-offset-gray-900' : ''}`}>
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <span className="font-bold text-green-700 dark:text-green-400">{stats.completed}</span>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">완료</span>
            </button>
            {/* Make Webhook Button */}
            <button onClick={openWebhookModal} className="card px-4 py-3 flex items-center gap-3 transition-all cursor-pointer hover:shadow-md hover:ring-2 hover:ring-[#6D00CC] hover:ring-offset-2 dark:hover:ring-offset-gray-900">
              <div className="w-10 h-10 bg-[#6D00CC]/10 dark:bg-[#6D00CC]/20 rounded-lg flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#6D00CC">
                  <path d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z"/>
                </svg>
              </div>
              <span className="text-sm text-gray-500 dark:text-gray-400">Make</span>
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="검색 (수령인, 주소, 상품, 연락처)"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="input-field pl-10"
              />
            </div>
            <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} className="input-field w-full sm:w-40">
              <option value="all">전체 담당자</option>
              {staffList.map((staff) => <option key={staff} value={staff}>{staff}</option>)}
            </select>
            {activeFilterCount > 0 && (
              <button onClick={clearFilters} className="flex items-center gap-1 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                초기화
              </button>
            )}
          </div>
          {activeFilterCount > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">{filteredDeliveries.length}건 표시 중 (전체 {deliveries.length}건)</span>
            </div>
          )}
        </div>

        {/* Deliveries Table */}
        <div className="card overflow-visible">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
            </div>
          ) : filteredDeliveries.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-12 h-12 text-gray-300 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                {activeFilterCount > 0 ? '필터 조건에 맞는 배송이 없습니다.' : '배송 데이터가 없습니다. 위에서 엑셀 파일을 드래그해 주세요.'}
              </p>
              {activeFilterCount > 0 && <button onClick={clearFilters} className="btn-primary">필터 초기화</button>}
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent pt-2">
              <table className="w-full min-w-max">
                <thead className="bg-gray-100 dark:bg-gray-900/70">
                  <tr>
                    <th className="px-4 py-5 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 w-12 sticky left-0 bg-gray-100 dark:bg-gray-900/70 z-10">No</th>
                    <th className="px-4 py-5 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 sticky left-12 bg-gray-100 dark:bg-gray-900/70 z-10 min-w-[100px]">수령인</th>
                    <th className="px-4 py-5 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[120px]">
                      담당자
                      <span className="ml-1 text-xs text-emerald-500" title="클릭하여 편집">✎</span>
                    </th>
                    <th className="px-4 py-5 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[120px]">연락처</th>
                    <th className="px-3 py-5 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">주소</th>
                    <th className="px-3 py-5 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 w-12">상품</th>
                    <th className="px-4 py-5 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[120px]">메모</th>
                    {customFieldDefs.map((field) => (
                      <th key={field.id} className="px-4 py-5 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap min-w-[100px]">
                        {field.fieldName}
                        <span className="ml-1 text-xs text-cyan-500" title="클릭하여 편집">✎</span>
                      </th>
                    ))}
                    <th className="px-4 py-5 text-center text-sm font-semibold text-gray-700 dark:text-gray-300 min-w-[60px]">사진</th>
                    <th className="px-4 py-5 text-left text-sm font-semibold text-gray-700 dark:text-gray-300 sticky right-0 bg-gray-100 dark:bg-gray-900/70 z-10 min-w-[100px]">
                      상태
                      <span className="ml-1 text-xs text-green-500" title="클릭하여 편집">✎</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredDeliveries.map((delivery, index) => (
                    <tr key={delivery.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 group/row">
                      <td className="px-4 py-4 text-center text-sm font-medium text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-800 group-hover/row:bg-gray-50 dark:group-hover/row:bg-gray-800/50 z-10">{index + 1}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white sticky left-12 bg-white dark:bg-gray-800 group-hover/row:bg-gray-50 dark:group-hover/row:bg-gray-800/50 z-10">{delivery.recipientName}</td>
                      <td className="px-4 py-4 text-sm text-gray-600 dark:text-gray-300 min-w-[120px] relative">
                        {editingCell?.deliveryId === delivery.id && editingCell?.fieldId === '__staffName__' ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveCell();
                                if (e.key === 'Escape') handleCancelEditCell();
                              }}
                              autoFocus
                              disabled={isSavingCell}
                              className="min-w-[5em] px-2 py-1 text-sm border border-emerald-400 rounded focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-gray-700 dark:text-white"
                            />
                            <button
                              onClick={handleSaveCell}
                              disabled={isSavingCell}
                              className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                              title="저장"
                            >
                              {isSavingCell ? (
                                <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </button>
                            <button
                              onClick={handleCancelEditCell}
                              disabled={isSavingCell}
                              className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="취소"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <div
                            onClick={() => handleStartEditCell(delivery.id, '__staffName__', delivery.staffName || '')}
                            className="cursor-pointer hover:bg-emerald-50 dark:hover:bg-emerald-900/20 rounded px-1 py-0.5 -mx-1"
                            title="클릭하여 편집"
                          >
                            <span className="block truncate">{delivery.staffName || <span className="text-gray-400 italic">-</span>}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{delivery.recipientPhone}</td>
                      <td className="px-3 py-4 text-center group/addr relative">
                        <button className="inline-flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-800/50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </button>
                        <div className="absolute z-[100] left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/addr:block w-max max-w-sm p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-xl whitespace-pre-wrap text-left">
                          {delivery.recipientAddress}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                        </div>
                      </td>
                      <td className="px-3 py-4 text-center group/prod relative">
                        <button className="inline-flex items-center justify-center w-8 h-8 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800/50 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                          </svg>
                        </button>
                        <div className="absolute z-[100] left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/prod:block w-max max-w-sm p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-xl whitespace-pre-wrap text-left">
                          {delivery.productName} × {delivery.quantity}
                          <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-[120px] group/memo relative">
                        {delivery.memo ? (
                          <>
                            <span className="block truncate">{delivery.memo}</span>
                            <div className="absolute z-[100] left-0 bottom-full mb-2 hidden group-hover/memo:block w-max max-w-sm p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-xl whitespace-pre-wrap">
                              {delivery.memo}
                              <div className="absolute left-4 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                            </div>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      {customFieldDefs.map((field) => {
                        const value = delivery.customFields?.[field.id] || '';
                        const isEditing = editingCell?.deliveryId === delivery.id && editingCell?.fieldId === field.id;
                        return (
                          <td key={field.id} className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-[150px] relative">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="text"
                                  value={editingValue}
                                  onChange={(e) => setEditingValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveCell();
                                    if (e.key === 'Escape') handleCancelEditCell();
                                  }}
                                  autoFocus
                                  disabled={isSavingCell}
                                  className="w-full px-2 py-1 text-sm border border-cyan-400 rounded focus:outline-none focus:ring-2 focus:ring-cyan-500 dark:bg-gray-700 dark:text-white"
                                />
                                <button
                                  onClick={handleSaveCell}
                                  disabled={isSavingCell}
                                  className="p-1 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded"
                                  title="저장"
                                >
                                  {isSavingCell ? (
                                    <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
                                  ) : (
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </button>
                                <button
                                  onClick={handleCancelEditCell}
                                  disabled={isSavingCell}
                                  className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                                  title="취소"
                                >
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div
                                onClick={() => handleStartEditCell(delivery.id, field.id, value)}
                                className="cursor-pointer hover:bg-cyan-50 dark:hover:bg-cyan-900/20 rounded px-1 py-0.5 -mx-1 group/cf"
                                title="클릭하여 편집"
                              >
                                <span className="block truncate">{value || <span className="text-gray-400 italic">-</span>}</span>
                                {value && value.length > 15 && (
                                  <div className="absolute z-[100] left-0 bottom-full mb-2 hidden group-hover/cf:block w-max max-w-sm p-3 bg-gray-900 dark:bg-gray-700 text-white text-sm rounded-lg shadow-xl whitespace-pre-wrap">
                                    {value}
                                    <div className="absolute left-4 top-full w-0 h-0 border-l-8 border-r-8 border-t-8 border-transparent border-t-gray-900 dark:border-t-gray-700" />
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-4 text-center">
                        {delivery.photoUrl ? (
                          <button
                            onClick={() => setPhotoModalUrl(delivery.photoUrl)}
                            className="inline-flex items-center justify-center w-8 h-8 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-800/50 transition-colors"
                            title="사진 보기"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </button>
                        ) : (
                          <span className="text-gray-400 dark:text-gray-600">-</span>
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap sticky right-0 bg-white dark:bg-gray-800 group-hover/row:bg-gray-50 dark:group-hover/row:bg-gray-800/50 z-10">
                        <select
                          value={delivery.status}
                          onChange={(e) => handleStatusChange(delivery.id, e.target.value as 'pending' | 'in_transit' | 'completed')}
                          disabled={updatingStatusId === delivery.id}
                          className={`px-2.5 py-1 rounded-full text-xs font-medium border-0 cursor-pointer focus:ring-2 focus:ring-offset-1 ${STATUS_COLORS[delivery.status]} ${updatingStatusId === delivery.id ? 'opacity-50' : ''}`}
                        >
                          <option value="pending">배송 준비</option>
                          <option value="in_transit">배송 중</option>
                          <option value="completed">완료</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* 매핑 모달 */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* 모달 헤더 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">컬럼 매핑</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {formatDate(selectedDate)}에 {uploadedRows.length}건의 데이터를 등록합니다
                </p>
              </div>
              <button onClick={closeMappingModal} className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 모달 본문 */}
            <div className="flex-1 overflow-y-auto p-6">
              {mappingError && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  {mappingError}
                </div>
              )}

              {aiError.show && (
                <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-900/20 dark:border-amber-800">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                      <p className="text-amber-800 dark:text-amber-200 font-medium">AI 매핑 추천 실패</p>
                      <p className="text-amber-600 dark:text-amber-400 text-sm mt-1">직접 컬럼을 매핑해주세요.</p>
                      <button onClick={handleRetryAiMapping} className="mt-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-700 dark:text-amber-200 rounded-lg text-sm font-medium transition-colors">
                        다시 시도
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* 기본 필드 매핑 */}
              <div className="grid gap-3">
                {STANDARD_FIELDS.map((field) => (
                  <div key={field.key} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                    <div className="w-32 flex-shrink-0">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {field.label}
                        {field.required && <span className="text-red-500 ml-1">*</span>}
                      </span>
                    </div>
                    <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                    <select
                      value={mapping[field.key] || ''}
                      onChange={(e) => setMapping((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="flex-1 input-field py-2"
                    >
                      <option value="">선택 안 함</option>
                      {uploadedHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              {/* 사용자 정의 컬럼 매핑 */}
              {customFieldDefs.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    사용자 정의 컬럼 (선택사항)
                  </h3>
                  <div className="grid gap-3">
                    {customFieldDefs.map((field) => (
                      <div key={field.id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border-l-4 border-cyan-400">
                        <div className="w-32 flex-shrink-0">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">{field.fieldName}</span>
                          {!!field.isEditableByStaff && (
                            <span className="ml-2 text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 rounded">편집</span>
                          )}
                        </div>
                        <svg className="w-5 h-5 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                        <select
                          value={customFieldMapping[field.id] || ''}
                          onChange={(e) => setCustomFieldMapping((prev) => ({ ...prev, [field.id]: e.target.value }))}
                          className="flex-1 input-field py-2"
                        >
                          <option value="">선택 안 함</option>
                          {uploadedHeaders.map((header) => <option key={header} value={header}>{header}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 미리보기 */}
              {uploadedRows.length > 0 && (
                <div className="mt-6">
                  <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">데이터 미리보기 (처음 3행)</h3>
                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-600">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 dark:bg-gray-900/50">
                        <tr>
                          {uploadedHeaders.map((header) => (
                            <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {uploadedRows.slice(0, 3).map((row, idx) => (
                          <tr key={idx}>
                            {uploadedHeaders.map((header) => (
                              <td key={header} className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">{row[header]}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>

            {/* 모달 푸터 */}
            <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <button onClick={closeMappingModal} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium">
                취소
              </button>
              <button onClick={() => handleSave(false)} disabled={isSaving || isLoadingSuggestion} className="btn-primary">
                {isSaving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
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
        </div>
      )}

      {/* AI 분석 중 로딩 오버레이 */}
      {isLoadingSuggestion && showMappingModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-sm w-full mx-4 text-center">
            <div className="relative mx-auto w-16 h-16 mb-6">
              <div className="absolute inset-0 bg-primary-100 dark:bg-primary-900/50 rounded-xl" />
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-primary-600 dark:text-primary-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
                </svg>
              </div>
              <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary-500 rounded-full animate-ping" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">AI가 분석 중입니다</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">엑셀 헤더를 분석하여 최적의 매핑을 추천합니다...</p>
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-3 border-primary-200 border-t-primary-600" />
            </div>
          </div>
        </div>
      )}

      {/* 덮어쓰기 확인 모달 */}
      {confirmOverwrite.show && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">기존 데이터 덮어쓰기</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">{selectedDate}</p>
              </div>
            </div>

            <p className="text-gray-600 dark:text-gray-300 mb-6">
              해당 날짜에 <span className="font-bold text-amber-600 dark:text-amber-400">{confirmOverwrite.existingCount}건</span>의 기존 배송 데이터가 있습니다.
              <br /><br />
              기존 데이터를 <span className="font-bold text-red-500">삭제</span>하고 <span className="font-bold text-emerald-600">{uploadedRows.length}건</span>을 새로 등록하시겠습니까?
            </p>

            <div className="flex gap-3">
              <button onClick={handleCancelOverwrite} className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors">
                취소
              </button>
              <button onClick={handleConfirmOverwrite} disabled={isSaving} className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                {isSaving ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
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

      {/* QR Modal */}
      {showQRModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQRModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">배송담당자 QR</h3>
              <button onClick={() => setShowQRModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex justify-center mb-6">{qrImageUrl && <img src={qrImageUrl} alt="QR Code" className="w-64 h-64 rounded-lg" />}</div>
            <div className="text-center mb-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
                <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(selectedDate)}</span>
              </div>
            </div>
            <p className="text-center text-sm text-gray-500 dark:text-gray-400">배송담당자가 이 QR을 스캔하면<br />이름 입력 후 배송 목록을 확인할 수 있습니다</p>
          </div>
        </div>
      )}

      {/* Excel Download Modal */}
      {showExcelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowExcelModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">엑셀 저장</h3>
                {!isPro && <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-bold rounded-md">유료</span>}
              </div>
              <button onClick={() => setShowExcelModal(false)} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-900/30 dark:to-teal-900/30 rounded-2xl flex items-center justify-center">
                <svg className="w-10 h-10 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
            </div>
            <div className="text-center mb-6">
              <p className="text-gray-700 dark:text-gray-300 font-medium mb-2">
                {isPro ? `${filteredDeliveries.length}건의 배송 데이터를 저장합니다` : '현재 배송 데이터를 엑셀로 저장합니다'}
              </p>
              {!isPro && <p className="text-sm text-gray-500 dark:text-gray-400">이 기능은 <span className="text-amber-600 dark:text-amber-400 font-semibold">유료 구독자</span> 전용입니다</p>}
            </div>
            <div className="space-y-3">
              {isPro ? (
                <button onClick={downloadExcel} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 transition-all">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  엑셀 다운로드
                </button>
              ) : (
                <>
                  <button disabled className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-xl font-semibold cursor-not-allowed">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    엑셀 다운로드
                  </button>
                  <button onClick={() => setShowExcelModal(false)} className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/25 transition-all">
                    유료 구독하기
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 사진 확대 모달 */}
      {photoModalUrl && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
          onClick={() => setPhotoModalUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setPhotoModalUrl(null)}
              className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <img
              src={photoModalUrl}
              alt="배송 완료 사진"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* 버전 정보 */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 text-center space-y-0.5">
        <p className="text-xs text-gray-400 dark:text-gray-500">Web v{__WEB_VERSION__} ({__WEB_BUILD_DATE__})</p>
        {serverBuildDate && <p className="text-xs text-gray-400 dark:text-gray-600">Server {serverBuildDate}</p>}
      </div>
      {/* Webhook Modal */}
      {showWebhookModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-up">
            {/* Header with Make branding */}
            <div className="bg-[#6D00CC] p-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white">
                    <path d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z"/>
                  </svg>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Make 웹훅 연동</h3>
                  <p className="text-sm text-white/70">자동화 워크플로우 설정</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              {/* Info Banner */}
              <div className="mb-5 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <div className="flex gap-3">
                  <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">배송 상태 변경 시 자동 전송</p>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                      준비 → 배송중 → 완료 상태 변경 시마다 웹훅이 발송됩니다.
                    </p>
                  </div>
                </div>
              </div>

              {/* Make Template Link */}
              <div className="mb-5 p-4 bg-[#6D00CC]/5 dark:bg-[#6D00CC]/10 border border-[#6D00CC]/20 dark:border-[#6D00CC]/30 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#6D00CC]/10 dark:bg-[#6D00CC]/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="#6D00CC">
                      <path d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#6D00CC] dark:text-[#a855f7]">Make 공유 템플릿 사용</p>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-2">
                      아래 템플릿을 복사하여 Make에서 빠르게 시작하세요.
                    </p>
                    <a
                      href="https://us2.make.com/public/shared-scenario/fhq3YZY0wak/create-word-press-posts-from-new-articles"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-[#6D00CC] dark:text-[#a855f7] hover:underline"
                    >
                      공유 템플릿 열기 →
                    </a>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Webhook URL
                  </label>
                  <input
                    type="text"
                    value={webhookUrl}
                    onChange={(e) => setWebhookUrl(e.target.value)}
                    placeholder="https://hook.us1.make.com/..."
                    className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-[#6D00CC] focus:border-transparent dark:bg-gray-700 dark:text-white font-mono text-sm"
                  />
                  <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                    Make 시나리오에서 Webhook 모듈의 URL을 복사하여 붙여넣으세요.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="webhookEnabled"
                    checked={webhookEnabled}
                    onChange={(e) => setWebhookEnabled(e.target.checked)}
                    className="w-4 h-4 text-[#6D00CC] rounded border-gray-300 focus:ring-[#6D00CC]"
                  />
                  <label htmlFor="webhookEnabled" className="text-sm text-gray-700 dark:text-gray-300">
                    웹훅 활성화
                  </label>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowWebhookModal(false)}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
                >
                  취소
                </button>
                <button
                  onClick={testWebhook}
                  disabled={isTestingWebhook || !webhookUrl}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isTestingWebhook ? '전송 중...' : '테스트 전송'}
                </button>
                <button
                  onClick={saveWebhook}
                  disabled={isSavingWebhook}
                  className="px-4 py-2 bg-[#6D00CC] hover:bg-[#5a00ab] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  {isSavingWebhook ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
