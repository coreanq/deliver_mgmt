/**
 * Grok API 호출 유틸리티
 * xAI의 Grok 4.1 Fast 모델 사용
 * Cloudflare AI Gateway를 통해 호출
 */

import type { Env, AICallResult } from '../types';

const GROK_MODEL = 'grok-4-1-fast-reasoning';

/**
 * Cloudflare AI Gateway URL 생성 (xAI/Grok용)
 * @param env 환경 변수
 * @returns AI Gateway를 통한 xAI API URL
 */
function getGrokApiUrl(env: Env): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/grok/v1/chat/completions`;
}

interface GrokMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface GrokResponse {
  choices: Array<{
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Grok API 호출
 * @param env 환경 변수
 * @param systemPrompt 시스템 프롬프트
 * @param userMessage 사용자 메시지
 * @param maxTokens 최대 토큰 수
 * @returns AICallResult (text와 cacheHit 포함)
 */
export async function callGrok(
  env: Env,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 500
): Promise<AICallResult> {
  const messages: GrokMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(getGrokApiUrl(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`, // BYOK 인증
      'cf-aig-cache-ttl': '86400', // 24시간 캐시 TTL
    },
    body: JSON.stringify({
      model: GROK_MODEL,
      messages,
      max_tokens: maxTokens,
    }),
  });

  // 캐시 히트 여부 확인
  const cacheHit = response.headers.get('cf-aig-cache-status') === 'HIT';

  if (!response.ok) {
    const error = await response.text();
    console.error('Grok API error:', response.status, error);
    console.error('Request URL:', getGrokApiUrl(env));
    throw new Error(`AI 응답 생성 실패: ${response.status}`);
  }

  const data = (await response.json()) as GrokResponse;
  return { text: data.choices[0].message.content, cacheHit };
}
