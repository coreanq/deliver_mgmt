import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8787';

interface Template {
  id: string;
  name: string;
  content: string;
  use_ai: number;
  is_default: number;
  created_at: string;
}

const VARIABLES = [
  { label: '수령인', placeholder: '${수령인}' },
  { label: '연락처', placeholder: '${연락처}' },
  { label: '주소', placeholder: '${주소}' },
  { label: '상품명', placeholder: '${상품명}' },
  { label: '수량', placeholder: '${수량}' },
  { label: '배송담당자', placeholder: '${배송담당자}' },
  { label: '배송일', placeholder: '${배송일}' },
  { label: '메모', placeholder: '${메모}' },
];

const SAMPLE_DATA: Record<string, string> = {
  '수령인': '홍길동',
  '연락처': '010-1234-5678',
  '주소': '서울시 강남구 테헤란로 123',
  '상품명': '사과 10kg',
  '수량': '1',
  '배송담당자': '김배송',
  '배송일': '2025-01-06',
  '메모': '부재시 경비실',
};

export default function SmsTemplate() {
  const { token } = useAuthStore();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [templates, setTemplates] = useState<Template[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPro, setIsPro] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [useAi, setUseAi] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTemplates();
    fetchSubscription();
  }, []);

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sms-template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTemplates(data.data.templates);
      }
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSubscription = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/subscription/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setIsPro(data.data.isPro);
      }
    } catch (err) {
      console.error('Failed to fetch subscription:', err);
    }
  };

  const insertVariable = (placeholder: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent = content.slice(0, start) + placeholder + content.slice(end);
    setContent(newContent);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
    }, 0);
  };

  const getPreview = () => {
    let preview = content;
    for (const [key, value] of Object.entries(SAMPLE_DATA)) {
      preview = preview.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), value);
    }
    return preview;
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setContent('');
    setUseAi(false);
    setIsDefault(false);
    setError('');
  };

  const handleEdit = (template: Template) => {
    setEditingId(template.id);
    setName(template.name);
    setContent(template.content);
    setUseAi(template.use_ai === 1);
    setIsDefault(template.is_default === 1);
    setError('');
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('템플릿 이름을 입력하세요.');
      return;
    }
    if (!content.trim()) {
      setError('템플릿 내용을 입력하세요.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const url = editingId
        ? `${API_BASE}/api/sms-template/${editingId}`
        : `${API_BASE}/api/sms-template`;

      const res = await fetch(url, {
        method: editingId ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          content: content.trim(),
          useAi: isPro && useAi,
          isDefault,
        }),
      });

      const data = await res.json();
      if (data.success) {
        resetForm();
        fetchTemplates();
      } else {
        setError(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch(`${API_BASE}/api/sms-template/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        if (editingId === id) resetForm();
        fetchTemplates();
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">SMS 템플릿</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-2 gap-8">
          <div>
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {editingId ? '템플릿 수정' : '새 템플릿'}
              </h2>

              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm dark:bg-red-900/20 dark:border-red-800 dark:text-red-400">
                  {error}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    템플릿 이름
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="예: 배송 완료 알림"
                    className="input-field"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    변수 삽입
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {VARIABLES.map((v) => (
                      <button
                        key={v.label}
                        type="button"
                        onClick={() => insertVariable(v.placeholder)}
                        className="px-2.5 py-1 text-xs font-medium bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-400 dark:hover:bg-primary-900/50 transition-colors"
                      >
                        {v.placeholder}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    템플릿 내용
                  </label>
                  <textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="안녕하세요 ${수령인}님, ${상품명} 배송이 완료되었습니다."
                    rows={4}
                    className="input-field resize-none"
                  />
                </div>

                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(e) => setIsDefault(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">기본 템플릿</span>
                  </label>

                  <label className={`flex items-center gap-2 ${isPro ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}>
                    <input
                      type="checkbox"
                      checked={useAi}
                      onChange={(e) => isPro && setUseAi(e.target.checked)}
                      disabled={!isPro}
                      className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300">AI 생성</span>
                    {!isPro && (
                      <span className="px-1.5 py-0.5 bg-amber-400 text-amber-900 text-[10px] font-bold rounded">
                        PRO
                      </span>
                    )}
                  </label>
                </div>

                {content && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      미리보기
                    </label>
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {getPreview()}
                    </div>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  {editingId && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
                    >
                      취소
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex-1 btn-primary"
                  >
                    {isSaving ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto" />
                    ) : editingId ? (
                      '수정'
                    ) : (
                      '저장'
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                템플릿 목록
              </h2>

              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
                </div>
              ) : templates.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-gray-500 dark:text-gray-400">템플릿이 없습니다.</p>
                  <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">새 템플릿을 만들어보세요.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templates.map((template) => (
                    <div
                      key={template.id}
                      className={`p-4 border rounded-xl transition-colors ${
                        editingId === template.id
                          ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-medium text-gray-900 dark:text-white truncate">
                              {template.name}
                            </h3>
                            {template.is_default === 1 && (
                              <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded dark:bg-green-900/30 dark:text-green-400">
                                기본
                              </span>
                            )}
                            {template.use_ai === 1 && (
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded dark:bg-purple-900/30 dark:text-purple-400">
                                AI
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">
                            {template.content}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEdit(template)}
                            className="p-2 text-gray-400 hover:text-primary-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(template.id)}
                            className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {useAi && isPro && (
              <div className="card p-4 mt-4 bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 dark:from-purple-900/20 dark:to-indigo-900/20 dark:border-purple-800">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-purple-900 dark:text-purple-200">AI 생성 모드</h4>
                    <p className="text-sm text-purple-700 dark:text-purple-300 mt-0.5">
                      배송 완료 시 템플릿을 가이드라인으로 사용하여 AI가 매번 다른 문구를 생성합니다.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
