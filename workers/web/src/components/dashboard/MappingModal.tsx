interface CustomFieldDef {
  id: string;
  fieldName: string;
  fieldOrder: number;
  isEditableByStaff: boolean;
}

interface StandardField {
  key: string;
  label: string;
  required: boolean;
}

interface MappingModalProps {
  selectedDate: string;
  formatDate: (date: string) => string;
  uploadedHeaders: string[];
  uploadedRows: Record<string, string>[];
  mapping: Record<string, string>;
  setMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  customFieldMapping: Record<string, string>;
  setCustomFieldMapping: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  customFieldDefs: CustomFieldDef[];
  standardFields: StandardField[];
  mappingError: string;
  aiError: { show: boolean; canRetry: boolean };
  isLoadingSuggestion: boolean;
  isSaving: boolean;
  onClose: () => void;
  onSave: (overwrite: boolean) => void;
  onRetryAiMapping: () => void;
}

export default function MappingModal({
  selectedDate,
  formatDate,
  uploadedHeaders,
  uploadedRows,
  mapping,
  setMapping,
  customFieldMapping,
  setCustomFieldMapping,
  customFieldDefs,
  standardFields,
  mappingError,
  aiError,
  isLoadingSuggestion,
  isSaving,
  onClose,
  onSave,
  onRetryAiMapping,
}: MappingModalProps) {
  return (
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
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
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
                  <button
                    onClick={onRetryAiMapping}
                    className="mt-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-800 dark:hover:bg-amber-700 text-amber-700 dark:text-amber-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    다시 시도
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 기본 필드 매핑 */}
          <div className="grid gap-3">
            {standardFields.map((field) => (
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
                  {uploadedHeaders.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
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
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400 rounded">
                          편집
                        </span>
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
                      {uploadedHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
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
                        <th key={header} className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {uploadedRows.slice(0, 3).map((row, idx) => (
                      <tr key={idx}>
                        {uploadedHeaders.map((header) => (
                          <td key={header} className="px-3 py-2 text-gray-700 dark:text-gray-300 whitespace-nowrap">
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
        </div>

        {/* 모달 푸터 */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 font-medium"
          >
            취소
          </button>
          <button onClick={() => onSave(false)} disabled={isSaving || isLoadingSuggestion} className="btn-primary">
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
  );
}

// AI 분석 중 로딩 오버레이
export function MappingLoadingOverlay() {
  return (
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
  );
}

// 덮어쓰기 확인 모달
interface ConfirmOverwriteModalProps {
  selectedDate: string;
  existingCount: number;
  newCount: number;
  isSaving: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmOverwriteModal({
  selectedDate,
  existingCount,
  newCount,
  isSaving,
  onCancel,
  onConfirm,
}: ConfirmOverwriteModalProps) {
  return (
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
          해당 날짜에 <span className="font-bold text-amber-600 dark:text-amber-400">{existingCount}건</span>의 기존 배송 데이터가 있습니다.
          <br />
          <br />
          기존 데이터를 <span className="font-bold text-red-500">삭제</span>하고{' '}
          <span className="font-bold text-emerald-600">{newCount}건</span>을 새로 등록하시겠습니까?
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isSaving}
            className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
          >
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
  );
}
