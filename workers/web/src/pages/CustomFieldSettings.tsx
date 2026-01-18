import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8787';
const MAX_CUSTOM_FIELDS = 5;

interface CustomField {
  id: string;
  fieldName: string;
  fieldOrder: number;
  isEditableByStaff: boolean;
  createdAt: string;
}

export default function CustomFieldSettings() {
  const { token } = useAuthStore();

  const [fields, setFields] = useState<CustomField[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 새 컬럼 입력 (컬럼명만)
  const [newFieldName, setNewFieldName] = useState('');
  const [newIsEditable, setNewIsEditable] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  // 수정 중인 필드
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFieldName, setEditFieldName] = useState('');
  const [editIsEditable, setEditIsEditable] = useState(false);

  useEffect(() => {
    fetchFields();
  }, []);

  const fetchFields = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/custom-field`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setFields(data.data.fields || []);
      }
    } catch (err) {
      console.error('Failed to fetch fields:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newFieldName.trim()) {
      setError('컬럼명을 입력하세요.');
      return;
    }

    setIsAdding(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/custom-field`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fieldName: newFieldName.trim(),
          isEditableByStaff: newIsEditable,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('컬럼이 추가되었습니다.');
        setNewFieldName('');
        setNewIsEditable(false);
        fetchFields();
      } else {
        setError(data.error || '추가에 실패했습니다.');
      }
    } catch (err) {
      setError('추가 중 오류가 발생했습니다.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdate = async (id: string) => {
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/custom-field/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          fieldName: editFieldName.trim(),
          isEditableByStaff: editIsEditable,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('컬럼이 수정되었습니다.');
        setEditingId(null);
        fetchFields();
      } else {
        setError(data.error || '수정에 실패했습니다.');
      }
    } catch (err) {
      setError('수정 중 오류가 발생했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 컬럼을 삭제하시겠습니까?\n기존 배송 데이터의 해당 값은 유지됩니다.')) return;

    setError('');
    setSuccess('');

    try {
      const res = await fetch(`${API_BASE}/api/custom-field/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('컬럼이 삭제되었습니다.');
        fetchFields();
      } else {
        setError(data.error || '삭제에 실패했습니다.');
      }
    } catch (err) {
      setError('삭제 중 오류가 발생했습니다.');
    }
  };

  const startEdit = (field: CustomField) => {
    setEditingId(field.id);
    setEditFieldName(field.fieldName);
    setEditIsEditable(field.isEditableByStaff);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditFieldName('');
    setEditIsEditable(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              돌아가기
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">사용자 정의 컬럼</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              사용자 정의 컬럼 설정
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              엑셀에서 추가로 가져올 컬럼명을 입력하세요. AI가 자동으로 매핑합니다. (최대 {MAX_CUSTOM_FIELDS}개)
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-600 text-sm dark:bg-green-900/20 dark:border-green-800 dark:text-green-400">
              {success}
            </div>
          )}

          {/* 기존 컬럼 목록 */}
          <div className="space-y-3 mb-6">
            {fields.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                등록된 컬럼이 없습니다.
              </div>
            ) : (
              fields.map((field, index) => (
                <div
                  key={field.id}
                  className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600"
                >
                  {editingId === field.id ? (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                          컬럼명
                        </label>
                        <input
                          type="text"
                          value={editFieldName}
                          onChange={(e) => setEditFieldName(e.target.value)}
                          className="input-field"
                        />
                      </div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editIsEditable}
                          onChange={(e) => setEditIsEditable(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                        />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          배송담당자 편집 가능
                        </span>
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleUpdate(field.id)}
                          className="flex-1 btn-primary py-2 text-sm"
                        >
                          저장
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="flex-1 btn-secondary py-2 text-sm"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="w-6 h-6 bg-primary-100 dark:bg-primary-900/50 rounded-full flex items-center justify-center text-xs font-medium text-primary-600 dark:text-primary-400">
                          {index + 1}
                        </span>
                        <div>
                          <span className="font-medium text-gray-900 dark:text-white">
                            {field.fieldName}
                          </span>
                          {field.isEditableByStaff && (
                            <span className="ml-2 text-xs text-emerald-600 dark:text-emerald-400">
                              편집 가능
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(field)}
                          className="p-2 text-gray-400 hover:text-primary-500 transition-colors"
                          title="수정"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(field.id)}
                          className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          title="삭제"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 새 컬럼 추가 */}
          {fields.length < MAX_CUSTOM_FIELDS && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                새 컬럼 추가
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                    컬럼명
                  </label>
                  <input
                    type="text"
                    value={newFieldName}
                    onChange={(e) => setNewFieldName(e.target.value)}
                    placeholder="예: 배송시간, 주문번호, Order ID..."
                    className="input-field"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    엑셀 헤더와 유사한 이름을 입력하면 AI가 자동 매핑합니다 (한글/영어 모두 가능)
                  </p>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newIsEditable}
                    onChange={(e) => setNewIsEditable(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    배송담당자 편집 가능
                  </span>
                </label>

                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={isAdding}
                  className="w-full btn-primary py-3"
                >
                  {isAdding ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto" />
                  ) : (
                    '컬럼 추가'
                  )}
                </button>
              </div>
            </div>
          )}

          {fields.length >= MAX_CUSTOM_FIELDS && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl dark:bg-amber-900/20 dark:border-amber-800">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span className="text-sm font-medium">
                  최대 {MAX_CUSTOM_FIELDS}개까지만 추가할 수 있습니다.
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl dark:bg-blue-900/20 dark:border-blue-800">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h4 className="font-medium text-blue-900 dark:text-blue-200 text-sm">사용 방법</h4>
              <ul className="text-xs text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                <li>1. 엑셀에서 가져올 컬럼명을 등록합니다.</li>
                <li>2. 엑셀 업로드 시 AI가 해당 컬럼을 자동 매핑합니다.</li>
                <li>3. 편집 가능한 컬럼은 배송담당자가 앱에서 수정할 수 있습니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
