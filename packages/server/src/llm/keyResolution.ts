import type { LLMProviderType } from '@botville/shared';
import { getDecryptedKey } from '../api/agents.js';
import { getUserKey } from '../api/keys.js';

// ТЗ-14: единый порядок разрешения ключа для запроса агента.
//
//   1) личный ключ агента (старый сценарий — работает без миграции)
//   2) сохранённый ключ юзера для провайдера агента
//   3) demo (решает вызывающий — он же считает лимиты)
//   4) человеческая ошибка
//
// Здесь — шаги 1–2; demo и ошибка остаются на стороне роутов, чтобы не тянуть
// сюда лимиты и SSE.

export type KeySource = 'agent' | 'user' | 'none';

export interface ResolvedKey {
  source: KeySource;
  apiKey?: string;
  /** Базовый URL: ollama/custom — от агента, иначе от сохранённого ключа юзера. */
  baseUrl?: string;
}

export function resolveAgentKey(agent: Record<string, unknown>, userId: string): ResolvedKey {
  const provider = agent.provider_type as LLMProviderType;

  if (provider === 'ollama') {
    // Ключ не нужен вовсе — адрес берём у агента.
    return {
      source: 'agent',
      baseUrl: (agent.ollama_base_url as string) ?? 'http://localhost:11434',
    };
  }

  const agentBaseUrl = provider === 'custom' ? ((agent.custom_base_url as string) ?? undefined) : undefined;

  const own = getDecryptedKey(agent.id as string);
  if (own) return { source: 'agent', apiKey: own, baseUrl: agentBaseUrl };

  const saved = getUserKey(userId, provider);
  if (saved) {
    // Для custom адрес агента приоритетнее: юзер мог задать его конкретно
    // этому агенту, а ключ переиспользовать общий.
    return { source: 'user', apiKey: saved.apiKey, baseUrl: agentBaseUrl ?? saved.baseUrl };
  }

  return { source: 'none', baseUrl: agentBaseUrl };
}
