import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:8787';

interface Template {
  id: string;
  name: string;
  content: string;
  is_default: number;
  created_at: string;
}

const VARIABLES = [
  { label: '수령인', placeholder: '${수령인}' },
  { label: '연락처', placeholder: '${연락처}' },
  { label: '주소', placeholder: '${주소}' },
  { label: '상품명', placeholder: '${상품명}' },
  { label: '배송담당자', placeholder: '${배송담당자}' },
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

  const [template, setTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchTemplate();
  }, []);

  useEffect(() => {
    if (template) {
      setName(template.name);
      setContent(template.content);
    }
  }, [template]);

  const fetchTemplate = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sms-template`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data.templates.length > 0) {
        setTemplate(data.data.templates[0]);
      }
    } catch (err) {
      console.error('Failed to fetch template:', err);
    } finally {
      setIsLoading(false);
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
    setSuccess('');

    try {
      const url = template
        ? `${API_BASE}/api/sms-template/${template.id}`
        : `${API_BASE}/api/sms-template`;

      const res = await fetch(url, {
        method: template ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: name.trim(),
          content: content.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccess('템플릿이 저장되었습니다.');
        fetchTemplate();
      } else {
        setError(data.error || '저장에 실패했습니다.');
      }
    } catch (err) {
      setError('저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!template) return;
    if (!confirm('템플릿을 삭제하시겠습니까?\n삭제 후 기본 메시지가 사용됩니다.')) return;

    try {
      const res = await fetch(`${API_BASE}/api/sms-template/${template.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setTemplate(null);
        setName('');
        setContent('');
        setSuccess('템플릿이 삭제되었습니다.');
      }
    } catch (err) {
      console.error('Delete error:', err);
    }
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
            <h1 className="text-lg font-semibold text-gray-900 dark:text-white">SMS 템플릿</h1>
            <div className="w-20" />
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="card p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {template ? '템플릿 수정' : '새 템플릿 만들기'}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                배송 완료 시 발송되는 SMS 메시지를 설정합니다.
              </p>
            </div>
            {template && (
              <button
                type="button"
                onClick={handleDelete}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="템플릿 삭제"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
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

          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                변수 삽입
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                클릭하면 커서 위치에 변수가 삽입됩니다.
              </p>
              <div className="flex flex-wrap gap-2">
                {VARIABLES.map((v) => (
                  <button
                    key={v.label}
                    type="button"
                    onClick={() => insertVariable(v.placeholder)}
                    className="px-2.5 py-1.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-lg hover:bg-primary-200 dark:bg-primary-900/30 dark:text-primary-400 dark:hover:bg-primary-900/50 transition-colors"
                  >
                    {v.placeholder}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
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

            {content && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
                  미리보기
                </label>
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-xl text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {getPreview()}
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  * 실제 발송 시 변수가 배송 정보로 대체됩니다.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="w-full btn-primary py-3"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mx-auto" />
              ) : (
                '저장'
              )}
            </button>
          </div>
        </div>

        {!template && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-xl dark:bg-blue-900/20 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h4 className="font-medium text-blue-900 dark:text-blue-200 text-sm">템플릿이 없으면?</h4>
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  기본 메시지가 사용됩니다:<br />
                  <span className="font-mono">[배송완료] 홍길동님, 사과 10kg 배송이 완료되었습니다. 좋은 하루 되세요!</span>
                </p>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
