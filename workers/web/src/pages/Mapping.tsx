import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useUploadStore } from '../stores/upload';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8787';

const TARGET_FIELDS = [
  { key: 'recipientName', label: '수령인 이름', required: true },
  { key: 'recipientPhone', label: '연락처', required: true },
  { key: 'recipientAddress', label: '주소', required: true },
  { key: 'productName', label: '상품명', required: true },
  { key: 'quantity', label: '수량', required: false },
  { key: 'memo', label: '메모', required: false },
  { key: 'staffName', label: '배송담당자', required: false },
  { key: 'deliveryDate', label: '배송일', required: false },
];

export default function Mapping() {
  const navigate = useNavigate();
  const { token } = useAuthStore();
  const { headers, rows, mapping, setMapping, updateMapping, reset } = useUploadStore();

  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deliveryDate, setDeliveryDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState('');

  // 데이터가 없으면 업로드 페이지로 리다이렉트
  useEffect(() => {
    if (headers.length === 0) {
      navigate('/upload');
    }
  }, [headers, navigate]);

  // AI 매핑 추천 요청
  useEffect(() => {
    if (headers.length > 0 && Object.keys(mapping).length === 0) {
      fetchMappingSuggestion();
    }
  }, [headers]);

  const fetchMappingSuggestion = async () => {
    setIsLoadingSuggestion(true);
    try {
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
      });

      const result = await response.json();
      if (result.success && result.data.suggestions) {
        const newMapping: Record<string, string> = {};
        for (const suggestion of result.data.suggestions) {
          if (suggestion.confidence >= 0.5) {
            newMapping[suggestion.targetField] = suggestion.sourceColumn;
          }
        }
        setMapping(newMapping);
      }
    } catch (err) {
      console.error('Mapping suggestion error:', err);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const handleSave = async () => {
    // 필수 필드 확인
    const missingFields = TARGET_FIELDS.filter(
      (field) => field.required && !mapping[field.key]
    ).map((field) => field.label);

    if (missingFields.length > 0) {
      setError(`필수 필드를 매핑하세요: ${missingFields.join(', ')}`);
      return;
    }

    setIsSaving(true);
    setError('');

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
          mapping,
          deliveryDate,
        }),
      });

      const result = await response.json();
      if (result.success) {
        reset();
        navigate('/', {
          state: {
            message: `${result.data.insertedCount}건의 배송 데이터를 저장했습니다.`,
          },
        });
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

            <button onClick={handleSave} disabled={isSaving} className="btn-primary">
              {isSaving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  저장하기 ({rows.length}건)
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
            {isLoadingSuggestion && ' AI가 분석 중...'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Delivery Date */}
        <div className="card p-6 mb-6">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            배송일 (엑셀에 날짜가 없는 경우)
          </label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="input-field w-auto"
          />
        </div>

        {/* Mapping Grid */}
        <div className="grid gap-4">
          {TARGET_FIELDS.map((field) => (
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
    </div>
  );
}
