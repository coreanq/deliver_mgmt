import { API_BASE_URL } from '@/constants';

export const debugLog = async (tag: string, data: any) => {
  try {
    await fetch(`${API_BASE_URL}/api/log`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tag, data, timestamp: new Date().toISOString() }),
    });
  } catch (e) {
    // 로그 실패해도 무시
  }
};
