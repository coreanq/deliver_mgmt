interface WebhookModalProps {
  webhookUrl: string;
  setWebhookUrl: (url: string) => void;
  webhookEnabled: boolean;
  setWebhookEnabled: (enabled: boolean) => void;
  isTestingWebhook: boolean;
  isSavingWebhook: boolean;
  onClose: () => void;
  onTest: () => void;
  onSave: () => void;
}

export default function WebhookModal({
  webhookUrl,
  setWebhookUrl,
  webhookEnabled,
  setWebhookEnabled,
  isTestingWebhook,
  isSavingWebhook,
  onClose,
  onTest,
  onSave,
}: WebhookModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-scale-up">
        {/* Header with Make branding */}
        <div className="bg-[#6D00CC] p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="white">
                <path d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z" />
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
                  <path d="M13.38 3.498c-.27 0-.511.19-.566.465L9.85 18.986a.578.578 0 0 0 .453.678l4.095.826a.58.58 0 0 0 .682-.455l2.963-15.021a.578.578 0 0 0-.453-.678l-4.096-.826a.589.589 0 0 0-.113-.012zm-5.876.098a.576.576 0 0 0-.516.318L.062 17.697a.575.575 0 0 0 .256.774l3.733 1.877a.578.578 0 0 0 .775-.258l6.926-13.781a.577.577 0 0 0-.256-.776L7.762 3.658a.571.571 0 0 0-.258-.062zm11.74.115a.576.576 0 0 0-.576.576v15.426c0 .318.258.578.576.578h4.178a.58.58 0 0 0 .578-.578V4.287a.578.578 0 0 0-.578-.576Z" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-[#6D00CC] dark:text-[#a855f7]">Make 공유 템플릿 사용</p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 mb-2">아래 템플릿을 복사하여 Make에서 빠르게 시작하세요.</p>
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Webhook URL</label>
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
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg font-medium transition-colors"
            >
              취소
            </button>
            <button
              onClick={onTest}
              disabled={isTestingWebhook || !webhookUrl}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isTestingWebhook ? '전송 중...' : '테스트 전송'}
            </button>
            <button
              onClick={onSave}
              disabled={isSavingWebhook}
              className="px-4 py-2 bg-[#6D00CC] hover:bg-[#5a00ab] text-white rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              {isSavingWebhook ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
