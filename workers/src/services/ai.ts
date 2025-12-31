/**
 * AI Provider 통합 인터페이스
 * OCP 원칙: 새로운 AI provider 추가 시 기존 코드 수정 없이 확장 가능
 */

import type { Env, AIProvider, AICallOptions, AICallResult } from '../types';
import { callClaude } from './claude';
import { callOpenAI } from './openai';
import { callGrok } from './grok';

// 기본 AI Provider
const DEFAULT_PROVIDER: AIProvider = 'grok';

/**
 * AI API 호출 (provider 선택 가능)
 * @param env 환경 변수
 * @param systemPrompt 시스템 프롬프트
 * @param userMessage 사용자 메시지
 * @param options AI 호출 옵션 (provider, maxTokens)
 * @returns AICallResult (text와 cacheHit 포함)
 */
export async function callAI(
  env: Env,
  systemPrompt: string,
  userMessage: string,
  options: AICallOptions = {}
): Promise<AICallResult> {
  const { provider = DEFAULT_PROVIDER, maxTokens = 1500 } = options;

  switch (provider) {
    case 'openai':
      return callOpenAI(env, systemPrompt, userMessage, maxTokens);
    case 'grok':
      return callGrok(env, systemPrompt, userMessage, maxTokens);
    case 'claude':
    default:
      return callClaude(env, systemPrompt, userMessage, maxTokens);
  }
}
