/**
 * 쿠팡 파트너스 API 서비스
 * - HMAC SHA256 서명 생성
 * - 상품 검색 API
 * - 딥링크 생성 API
 */
import type { Env } from '../types';

const API_GATEWAY = 'https://api-gateway.coupang.com';

export interface CoupangProduct {
  productId: number;
  productName: string;
  productPrice: number;
  productImage: string;
  productUrl: string;
  isRocket: boolean;
  isFreeShipping: boolean;
  categoryName: string;
  rank: number;
}

interface SearchResponse {
  rCode: string;
  rMessage: string;
  data: {
    productData: Array<{
      productId: number;
      productName: string;
      productPrice: number;
      productImage: string;
      productUrl: string;
      isRocket: boolean;
      isFreeShipping: boolean;
      categoryName: string;
      rank: number;
    }>;
  };
}

interface DeeplinkResponse {
  rCode: string;
  rMessage: string;
  data: Array<{
    originalUrl: string;
    shortenUrl: string;
  }>;
}

/**
 * HMAC SHA256 서명 생성 (Web Crypto API 사용)
 */
async function generateHmacSignature(
  secretKey: string,
  message: string
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const messageData = encoder.encode(message);

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 현재 시간을 yyMMddTHHmmssZ 형식으로 반환
 * 예: 251229T204220Z
 */
function getFormattedDateTime(): string {
  return new Date()
    .toISOString()
    .substring(2, 19)
    .replace(/:/g, '')
    .replace(/-/g, '') + 'Z';
}

/**
 * Authorization 헤더 생성
 */
async function generateAuthorizationHeader(
  method: string,
  path: string,
  query: string,
  accessKey: string,
  secretKey: string
): Promise<{ authorization: string; datetime: string }> {
  const datetime = getFormattedDateTime();
  const message = datetime + method + path + query;
  const signature = await generateHmacSignature(secretKey, message);

  const authorization = `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${datetime}, signature=${signature}`;

  return { authorization, datetime };
}

/**
 * 쿠팡 파트너스 상품 검색 API
 * - 1시간에 최대 10번 호출 제한
 * - 최대 10개 상품 반환
 */
export async function searchProducts(
  keyword: string,
  env: Env,
  limit: number = 5
): Promise<CoupangProduct[]> {
  const accessKey = env.COUPANG_ACCESS_KEY;
  const secretKey = env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    console.warn('Coupang API keys not configured');
    return [];
  }

  const method = 'GET';
  const path = '/v2/providers/affiliate_open_api/apis/openapi/products/search';
  const query = `keyword=${encodeURIComponent(keyword)}&limit=${limit}`;

  const { authorization } = await generateAuthorizationHeader(
    method,
    path,
    query,
    accessKey,
    secretKey
  );

  const url = `${API_GATEWAY}${path}?${query}`;

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: authorization,
      },
    });

    if (!response.ok) {
      console.error('Coupang search API error:', response.status, await response.text());
      return [];
    }

    const result = (await response.json()) as SearchResponse;

    if (result.rCode !== '0') {
      console.error('Coupang search API failed:', result.rCode, result.rMessage);
      return [];
    }

    return result.data.productData.map((item) => ({
      productId: item.productId,
      productName: item.productName,
      productPrice: item.productPrice,
      productImage: item.productImage,
      productUrl: item.productUrl,
      isRocket: item.isRocket,
      isFreeShipping: item.isFreeShipping,
      categoryName: item.categoryName,
      rank: item.rank,
    }));
  } catch (error) {
    console.error('Coupang search API exception:', error);
    return [];
  }
}

/**
 * 딥링크 생성 API
 * - 일반 쿠팡 URL을 파트너스 수익 추적 링크로 변환
 */
export async function createDeeplink(
  urls: string[],
  env: Env
): Promise<Map<string, string>> {
  const accessKey = env.COUPANG_ACCESS_KEY;
  const secretKey = env.COUPANG_SECRET_KEY;

  if (!accessKey || !secretKey) {
    console.warn('Coupang API keys not configured');
    return new Map();
  }

  const method = 'POST';
  const path = '/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink';
  const query = '';

  const { authorization } = await generateAuthorizationHeader(
    method,
    path,
    query,
    accessKey,
    secretKey
  );

  const url = `${API_GATEWAY}${path}`;
  const body = JSON.stringify({
    coupangUrls: urls,
  });

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        Authorization: authorization,
      },
      body,
    });

    if (!response.ok) {
      console.error('Coupang deeplink API error:', response.status, await response.text());
      return new Map();
    }

    const result = (await response.json()) as DeeplinkResponse;

    if (result.rCode !== '0') {
      console.error('Coupang deeplink API failed:', result.rCode, result.rMessage, 'URLs:', JSON.stringify(urls));
      return new Map();
    }

    const deeplinkMap = new Map<string, string>();
    for (const item of result.data) {
      deeplinkMap.set(item.originalUrl, item.shortenUrl);
    }

    return deeplinkMap;
  } catch (error) {
    console.error('Coupang deeplink API exception:', error);
    return new Map();
  }
}

/**
 * 상품 검색 + 딥링크 생성 통합 함수
 *
 * 참고: 쿠팡 검색 API(/products/search)가 반환하는 productUrl은
 * 이미 어필리에이트 트래킹이 포함된 URL이므로 딥링크 변환이 불필요합니다.
 */
export async function searchProductsWithDeeplink(
  keyword: string,
  env: Env,
  limit: number = 5
): Promise<CoupangProduct[]> {
  // 검색 API 결과의 productUrl은 이미 어필리에이트 URL이므로
  // 별도의 딥링크 변환 없이 바로 반환
  return searchProducts(keyword, env, limit);
}
