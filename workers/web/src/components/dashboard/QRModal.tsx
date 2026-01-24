interface QRModalProps {
  qrImageUrl: string;
  selectedDate: string;
  formatDate: (date: string) => string;
  onClose: () => void;
}

export default function QRModal({ qrImageUrl, selectedDate, formatDate, onClose }: QRModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">배송담당자 QR</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex justify-center mb-6">
          {qrImageUrl && <img src={qrImageUrl} alt="QR Code" className="w-64 h-64 rounded-lg" />}
        </div>
        <div className="text-center mb-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg">
            <svg className="w-4 h-4 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatDate(selectedDate)}</span>
          </div>
        </div>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          배송담당자가 이 QR을 스캔하면<br />이름 입력 후 배송 목록을 확인할 수 있습니다
        </p>
      </div>
    </div>
  );
}
