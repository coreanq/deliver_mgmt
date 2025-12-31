// UUID 생성
export function generateId(): string {
  return crypto.randomUUID();
}

// 날짜 문자열 생성 (YYYY-MM-DD)
export function getDateString(date: Date = new Date()): string {
  return date.toISOString().split('T')[0];
}

// ISO 날짜 문자열 생성
export function getISOString(date: Date = new Date()): string {
  return date.toISOString();
}

// 오늘 날짜 가져오기 (한국 시간 기준)
export function getTodayKST(): string {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000; // UTC+9
  const kstDate = new Date(now.getTime() + kstOffset);
  return kstDate.toISOString().split('T')[0];
}

// N일 전 날짜 가져오기
export function getDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return getDateString(date);
}

// 랜덤 토큰 생성
export function generateRandomToken(length: number = 32): string {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

// 이메일 유효성 검사
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// 전화번호 정규화 (한국)
export function normalizePhoneNumber(phone: string): string {
  // 숫자만 추출
  const digits = phone.replace(/\D/g, '');

  // 010-XXXX-XXXX 형식으로 변환
  if (digits.length === 11 && digits.startsWith('010')) {
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  }

  // 그 외는 그대로 반환
  return phone;
}

// 테스트 이메일 확인 (환경변수 기반)
export function isTestEmail(email: string, testEmailsEnv: string): boolean {
  if (!testEmailsEnv || testEmailsEnv.trim() === '') {
    return false;
  }
  const testEmails = testEmailsEnv.split(',').map((e) => e.trim().toLowerCase());
  return testEmails.includes(email.toLowerCase());
}

// snake_case를 camelCase로 변환
export function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

// 객체의 키를 snake_case에서 camelCase로 변환
export function transformKeys<T extends object>(obj: T): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[snakeToCamel(key)] = obj[key as keyof T];
    }
  }
  return result;
}

// 배열의 객체들을 camelCase로 변환
export function transformArray<T extends object>(arr: T[]): Record<string, unknown>[] {
  return arr.map((item) => transformKeys(item));
}
