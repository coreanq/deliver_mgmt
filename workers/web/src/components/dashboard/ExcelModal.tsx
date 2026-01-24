interface ExcelModalProps {
  isPro: boolean;
  filteredCount: number;
  onDownload: () => void;
  onClose: () => void;
}

export default function ExcelModal({ isPro, filteredCount, onDownload, onClose }: ExcelModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">엑셀 저장</h3>
            {!isPro && <span className="px-2 py-0.5 bg-amber-400 text-amber-900 text-xs font-bold rounded-md">유료</span>}
          </div>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
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
            {isPro ? `${filteredCount}건의 배송 데이터를 저장합니다` : '현재 배송 데이터를 엑셀로 저장합니다'}
          </p>
          {!isPro && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              이 기능은 <span className="text-amber-600 dark:text-amber-400 font-semibold">유료 구독자</span> 전용입니다
            </p>
          )}
        </div>
        <div className="space-y-3">
          {isPro ? (
            <button
              onClick={onDownload}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white rounded-xl font-semibold shadow-lg shadow-emerald-500/25 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              엑셀 다운로드
            </button>
          ) : (
            <>
              <button
                disabled
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-xl font-semibold cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                엑셀 다운로드
              </button>
              <button
                onClick={onClose}
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-semibold shadow-lg shadow-amber-500/25 transition-all"
              >
                유료 구독하기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
