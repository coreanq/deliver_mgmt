import { Platform } from 'react-native';

// API 베이스 URL (Expo Go에서 localhost 접근 불가하므로 항상 worker URL 사용)
export const API_BASE_URL = 'https://deliver-mgmt-worker.coreanq.workers.dev';

// PC 웹 접속 URL (추후 별도 라우팅 사용 시 변경)
export const PC_WEB_URL = 'https://deliver-mgmt-worker.coreanq.workers.dev';

// AdMob 테스트 광고 ID
export const AD_CONFIG = {
  // Google 제공 테스트 광고 ID
  banner: {
    ios: 'ca-app-pub-3940256099942544/2934735716',
    android: 'ca-app-pub-3940256099942544/6300978111',
  },
  rewarded: {
    ios: 'ca-app-pub-3940256099942544/1712485313',
    android: 'ca-app-pub-3940256099942544/5224354917',
  },
  isTest: true,
};

// 현재 플랫폼에 맞는 광고 ID 가져오기
export const getAdUnitId = (type: 'banner' | 'rewarded') => {
  const config = AD_CONFIG[type];
  return Platform.OS === 'ios' ? config.ios : config.android;
};

// 배송 상태 라벨
export const DELIVERY_STATUS_LABELS = {
  pending: '배송 준비중',
  in_transit: '배송 출발',
  completed: '배송 완료',
} as const;

// 배송 상태 색상
export const DELIVERY_STATUS_COLORS = {
  pending: '#f59e0b',
  in_transit: '#3b82f6',
  completed: '#10b981',
} as const;

// 구독 타입별 보관일수
export const SUBSCRIPTION_RETENTION_DAYS = {
  free: 7,
  basic: 30,
  pro: 90,
} as const;

// 테스트용 이메일 (자동 로그인)
export const TEST_EMAILS = ['dev@test.com', 'dev@example.com'];
