import type { LLMProviderType } from '@botville/shared';
import { getDecryptedKey } from '../api/agents.js';
import { getUserKey } from '../api/keys.js';

// TZ-14: the single key-resolution order for an agent's request.
//
//   1) the agent's personal key (the old flow — works without migration)
//   2) the saved user key for the agent's provider
//   3) demo (decided by the caller — it also counts the limits)
//   4) a human-readable error
//
// Steps 1–2 live here; demo and the error stay on the route side, so that
// limits and SSE aren't dragged in here.

export type KeySource = 'agent' | 'user' | 'none';

export interface ResolvedKey {
  source: KeySource;
  apiKey?: string;
  /** Base URL: for ollama/custom it comes from the agent, otherwise from the saved user key. */
  baseUrl?: string;
}

export function resolveAgentKey(agent: Record<string, unknown>, userId: string): ResolvedKey {
  const provider = agent.provider_type as LLMProviderType;

  if (provider === 'ollama') {
    // No key is needed at all — the address comes from the agent.
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
    // For custom, the agent's address wins: the user may have set it for this
    // specific agent while reusing a shared key.
    return { source: 'user', apiKey: saved.apiKey, baseUrl: agentBaseUrl ?? saved.baseUrl };
  }

  return { source: 'none', baseUrl: agentBaseUrl };
}
