interface PhotoModalProps {
  photoUrl: string;
  onClose: () => void;
}

export default function PhotoModal({ photoUrl, onClose }: PhotoModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="absolute -top-12 right-0 p-2 text-white/80 hover:text-white transition-colors"
        >
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <img
          src={photoUrl}
          alt="배송 완료 사진"
          className="w-full h-full object-contain rounded-lg"
        />
      </div>
    </div>
  );
}
