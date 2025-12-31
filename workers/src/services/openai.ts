/**
 * OpenAI API 호출 유틸리티
 * Cloudflare AI Gateway를 통해 호출
 */

import type { Env, AICallResult } from '../types';

const OPENAI_MODEL = 'gpt-4o-mini';

/**
 * Cloudflare AI Gateway URL 생성
 * @param env 환경 변수
 * @returns AI Gateway를 통한 OpenAI API URL
 */
function getOpenAIApiUrl(env: Env): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/openai/chat/completions`;
}

interface OpenAIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface OpenAIResponse {
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
 * OpenAI API 호출
 * @returns AICallResult (text와 cacheHit 포함)
 */
export async function callOpenAI(
  env: Env,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 500
): Promise<AICallResult> {
  const messages: OpenAIMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(getOpenAIApiUrl(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`, // BYOK 인증
      'cf-aig-cache-ttl': '86400', // 24시간 캐시 TTL
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      max_tokens: maxTokens,
    }),
  });

  // 캐시 히트 여부 확인
  const cacheHit = response.headers.get('cf-aig-cache-status') === 'HIT';

  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI API error:', error);
    throw new Error('AI 응답 생성 실패');
  }

  const data = (await response.json()) as OpenAIResponse;
  return { text: data.choices[0].message.content, cacheHit };
}
