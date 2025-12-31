/**
 * Claude API 호출 유틸리티
 * Cloudflare AI Gateway를 통해 호출
 */

import type { Env, AICallResult } from '../types';

const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

/**
 * Cloudflare AI Gateway URL 생성
 * @param env 환경 변수
 * @returns AI Gateway를 통한 Anthropic API URL
 */
function getClaudeApiUrl(env: Env): string {
  return `https://gateway.ai.cloudflare.com/v1/${env.AI_GATEWAY_ACCOUNT_ID}/${env.AI_GATEWAY_NAME}/anthropic/v1/messages`;
}

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ClaudeResponse {
  content: Array<{
    type: 'text';
    text: string;
  }>;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

/**
 * Claude API 호출
 * @returns AICallResult (text와 cacheHit 포함)
 */
export async function callClaude(
  env: Env,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number = 500
): Promise<AICallResult> {
  const response = await fetch(getClaudeApiUrl(env), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'cf-aig-authorization': `Bearer ${env.CF_AIG_TOKEN}`, // BYOK 인증
      'anthropic-version': '2023-06-01',
      'cf-aig-cache-ttl': '86400', // 24시간 캐시 TTL
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ] as ClaudeMessage[],
    }),
  });

  // 캐시 히트 여부 확인
  const cacheHit = response.headers.get('cf-aig-cache-status') === 'HIT';

  if (!response.ok) {
    const error = await response.text();
    console.error('Claude API error:', response.status, error);
    console.error('Request URL:', getClaudeApiUrl(env));
    throw new Error(`AI 응답 생성 실패: ${response.status}`);
  }

  const data = (await response.json()) as ClaudeResponse;
  return { text: data.content[0].text, cacheHit };
}
