import { useState, useEffect, useRef, useMemo } from 'react';
import QRCode from 'qrcode';

const APP_STORE_URL = 'https://apps.apple.com/app/id6757303714';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.trydabble.delivermgmt';
const STORAGE_KEY = 'app_download_banner_dismissed';
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24시간 (1일)

interface DeviceInfo {
  isMobile: boolean;
  isIOS: boolean;
  isAndroid: boolean;
}

// 디바이스 정보 감지 (Touch + 화면크기 + UA 조합)
function useDeviceInfo(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    isMobile: false,
    isIOS: false,
    isAndroid: false,
  });

  useEffect(() => {
    const detectDevice = () => {
      const ua = navigator.userAgent || '';

      // Touch 지원 + 작은 화면 = 모바일
      const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 768;
      const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

      // 모바일 판단: (터치 + 작은화면) 또는 (모바일 UA + 터치)
      const isMobile = (hasTouch && isSmallScreen) || (isMobileUA && hasTouch);

      // iOS 감지 (iPad 포함 - iPadOS 13+는 Mac UA 사용)
      const isIOS = /iPhone|iPad|iPod/i.test(ua) ||
        (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

      // Android 감지
      const isAndroid = /Android/i.test(ua);

      setDeviceInfo({ isMobile, isIOS, isAndroid });
    };

    detectDevice();
    window.addEventListener('resize', detectDevice);
    return () => window.removeEventListener('resize', detectDevice);
  }, []);

  return deviceInfo;
}

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  storeType: 'ios' | 'android';
}

function QRModal({ isOpen, onClose, storeType }: QRModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const url = storeType === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
  const storeName = storeType === 'ios' ? 'App Store' : 'Google Play';

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, url, {
        width: 200,
        margin: 2,
        color: {
          dark: '#1a1a2e',
          light: '#FFFFFF',
        },
      });
    }
  }, [isOpen, url]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.addEventListener('keydown', handleEsc);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEsc);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isIOS = storeType === 'ios';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-modal-title"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-gray-900/80 via-gray-900/70 to-gray-900/80 backdrop-blur-md animate-fade-in" />

      <div
        className="relative w-full max-w-[360px] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className={`absolute -inset-1 rounded-[28px] opacity-60 blur-xl ${
            isIOS
              ? 'bg-gradient-to-br from-indigo-500 via-violet-500 to-purple-500'
              : 'bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500'
          }`}
        />

        <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden">
          <div
            className={`h-2 ${
              isIOS
                ? 'bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500'
                : 'bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500'
            }`}
          />

          <div className="p-8">
            <div className="text-center mb-8">
              <div
                className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-5 ${
                  isIOS
                    ? 'bg-gradient-to-br from-indigo-50 to-violet-100'
                    : 'bg-gradient-to-br from-green-50 to-emerald-100'
                }`}
              >
                {isIOS ? (
                  <svg className="w-8 h-8 text-indigo-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-emerald-600" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.18 23.36c.47.27 1.06.22 1.48-.12l17.64-10.2c.46-.26.7-.75.7-1.26v-.02c0-.52-.25-1-.7-1.27L4.66.3c-.42-.34-1-.38-1.48-.11-.47.27-.75.77-.75 1.31v20.56c0 .54.28 1.04.75 1.3z"/>
                  </svg>
                )}
              </div>
              <h3 id="qr-modal-title" className="text-2xl font-bold text-gray-900 tracking-tight mb-2">
                {storeName}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                스마트폰 카메라로<br />QR 코드를 스캔하세요
              </p>
            </div>

            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute -top-2 -left-2 w-6 h-6 border-l-[3px] border-t-[3px] border-violet-300 rounded-tl-lg" />
                <div className="absolute -top-2 -right-2 w-6 h-6 border-r-[3px] border-t-[3px] border-violet-300 rounded-tr-lg" />
                <div className="absolute -bottom-2 -left-2 w-6 h-6 border-l-[3px] border-b-[3px] border-violet-300 rounded-bl-lg" />
                <div className="absolute -bottom-2 -right-2 w-6 h-6 border-r-[3px] border-b-[3px] border-violet-300 rounded-br-lg" />
                <div className="p-4 bg-white rounded-2xl shadow-inner border border-gray-100">
                  <canvas ref={canvasRef} className="block" />
                </div>
              </div>
            </div>

            <div className="flex justify-center mb-6">
              <div
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                  isIOS ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
                {isIOS ? 'iOS 앱 다운로드' : 'Android 앱 다운로드'}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-full py-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold rounded-2xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]"
            >
              닫기
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// 스토어 버튼 컴포넌트
interface StoreButtonProps {
  storeType: 'ios' | 'android';
  isRecommended: boolean;
  onClick: () => void;
}

function StoreButton({ storeType, isRecommended, onClick }: StoreButtonProps) {
  const isIOS = storeType === 'ios';

  return (
    <button
      onClick={onClick}
      className={`group flex items-center gap-2 px-3 sm:px-4 py-2 backdrop-blur-sm rounded-xl border transition-all duration-200 hover:scale-105 ${
        isRecommended
          ? 'bg-white/25 border-white/50 shadow-lg shadow-white/10'
          : 'bg-white/10 border-white/20 hover:bg-white/20 hover:border-white/30'
      }`}
    >
      {isIOS ? (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
      ) : (
        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3.18 23.36c.47.27 1.06.22 1.48-.12l17.64-10.2c.46-.26.7-.75.7-1.26v-.02c0-.52-.25-1-.7-1.27L4.66.3c-.42-.34-1-.38-1.48-.11-.47.27-.75.77-.75 1.31v20.56c0 .54.28 1.04.75 1.3z"/>
        </svg>
      )}
      <span className="text-sm font-medium text-white hidden sm:inline">
        {isIOS ? 'App Store' : 'Play Store'}
      </span>
      {isRecommended && (
        <span className="hidden sm:inline-flex items-center justify-center w-4 h-4 bg-white/30 rounded-full text-[10px] font-bold">
          ✓
        </span>
      )}
    </button>
  );
}

export default function AppDownloadBanner() {
  const [isVisible, setIsVisible] = useState(false);
  const [selectedStore, setSelectedStore] = useState<'ios' | 'android' | null>(null);
  const { isMobile, isIOS, isAndroid } = useDeviceInfo();

  useEffect(() => {
    const dismissedAt = localStorage.getItem(STORAGE_KEY);

    // 저장된 시간이 없거나 24시간이 지났으면 배너 표시
    const shouldShow = !dismissedAt ||
      (Date.now() - parseInt(dismissedAt, 10)) > DISMISS_DURATION_MS;

    if (shouldShow) {
      // 만료된 경우 기존 값 제거
      if (dismissedAt) {
        localStorage.removeItem(STORAGE_KEY);
      }
      const timer = setTimeout(() => setIsVisible(true), 500);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    // 현재 timestamp 저장 (24시간 후 다시 표시)
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  };

  // 스토어 버튼 클릭 핸들러
  const handleStoreClick = (storeType: 'ios' | 'android') => {
    if (isMobile) {
      // 모바일: 직접 스토어로 이동
      const url = storeType === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
      window.location.href = url;
    } else {
      // PC: QR 코드 모달 표시
      setSelectedStore(storeType);
    }
  };

  // 안내 메시지
  const guideMessage = useMemo(() => {
    if (isMobile) {
      if (isIOS) return '아래 버튼을 눌러 App Store에서 다운로드하세요';
      if (isAndroid) return '아래 버튼을 눌러 Play Store에서 다운로드하세요';
      return '버튼을 눌러 앱스토어에서 다운로드하세요';
    }
    return 'QR 코드를 스캔하여 앱을 다운로드하세요';
  }, [isMobile, isIOS, isAndroid]);

  if (!isVisible) return null;

  return (
    <>
      {/* Banner */}
      <div className="relative overflow-hidden animate-slide-down">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600" />

        {/* Animated mesh pattern */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Shimmer effect */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="shimmer-effect absolute inset-0 -translate-x-full" />
        </div>

        {/* Content */}
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between gap-3 sm:gap-6">
            {/* Left: Badge + Text */}
            <div className="flex items-center gap-3 min-w-0">
              <span className="hidden sm:inline-flex items-center px-2.5 py-1 bg-white/20 backdrop-blur-sm rounded-full text-[11px] font-bold tracking-widest text-white/90 border border-white/10">
                NEW
              </span>
              <div className="min-w-0 text-white">
                <p className="font-semibold text-sm sm:text-base tracking-tight">
                  <span className="sm:hidden">📱 </span>
                  모바일 앱이 출시되었습니다!
                </p>
                <p className="text-[11px] sm:text-xs text-white/70 hidden sm:block mt-0.5">
                  {guideMessage}
                </p>
              </div>
            </div>

            {/* Center: Store buttons - 항상 두 버튼 모두 표시 */}
            <div className="flex items-center gap-2">
              <StoreButton
                storeType="ios"
                isRecommended={isMobile && isIOS}
                onClick={() => handleStoreClick('ios')}
              />
              <StoreButton
                storeType="android"
                isRecommended={isMobile && isAndroid}
                onClick={() => handleStoreClick('android')}
              />
            </div>

            {/* Right: Close button */}
            <button
              onClick={handleDismiss}
              className="flex-shrink-0 p-2 hover:bg-white/10 rounded-lg transition-all duration-200 text-white/70 hover:text-white"
              aria-label="배너 닫기"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* QR Modal - PC에서만 표시 */}
      {!isMobile && (
        <QRModal
          isOpen={selectedStore !== null}
          onClose={() => setSelectedStore(null)}
          storeType={selectedStore || 'ios'}
        />
      )}
    </>
  );
}
