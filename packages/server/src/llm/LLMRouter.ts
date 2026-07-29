import type { LLMProviderType } from '@botville/shared';
import { OPENROUTER_BASE_URL } from '@botville/shared';
import { ClaudeAdapter } from './adapters/ClaudeAdapter.js';
import { OpenAIAdapter } from './adapters/OpenAIAdapter.js';
import { OllamaAdapter } from './adapters/OllamaAdapter.js';
import { openRouterConfig } from '../config.js';
import type { LLMAdapter } from './LLMAdapter.js';

/** OpenRouter attribution headers (TZ-14) — they contain no key. */
export function openRouterHeaders(): Record<string, string> {
  return {
    'HTTP-Referer': openRouterConfig.appUrl,
    'X-Title': openRouterConfig.appTitle,
  };
}

/**
 * Adapter for demo mode: the provider comes from DEMO_PROVIDER, and the base
 * URL can be overridden via DEMO_BASE_URL (OpenAI-compatible providers).
 */
export function getDemoAdapter(provider: LLMProviderType, baseUrl?: string): LLMAdapter {
  if (baseUrl && (provider === 'openai' || provider === 'deepseek')) {
    return new OpenAIAdapter(baseUrl);
  }
  return getAdapter(provider, baseUrl);
}

/**
 * @param baseUrl user-supplied base URL — required for 'custom' (already
 *   validated by validateBaseUrl), ignored for the rest.
 */
export function getAdapter(provider: LLMProviderType, baseUrl?: string): LLMAdapter {
  switch (provider) {
    case 'claude':
      return new ClaudeAdapter();
    case 'openai':
      return new OpenAIAdapter();
    case 'deepseek':
      return new OpenAIAdapter(process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1');
    case 'openrouter':
      // An OpenAI-compatible aggregator — no dedicated adapter needed (TZ-14)
      return new OpenAIAdapter(OPENROUTER_BASE_URL, openRouterHeaders());
    case 'custom':
      if (!baseUrl) throw new Error('custom provider requires baseUrl');
      return new OpenAIAdapter(baseUrl);
    case 'ollama':
      return new OllamaAdapter();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}
