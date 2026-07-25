import type { LLMProviderType } from '@botville/shared';
import { OPENROUTER_BASE_URL } from '@botville/shared';
import { ClaudeAdapter } from './adapters/ClaudeAdapter.js';
import { OpenAIAdapter } from './adapters/OpenAIAdapter.js';
import { OllamaAdapter } from './adapters/OllamaAdapter.js';
import { openRouterConfig } from '../config.js';
import type { LLMAdapter } from './LLMAdapter.js';

/** Заголовки атрибуции OpenRouter (ТЗ-14) — ключа в них нет. */
export function openRouterHeaders(): Record<string, string> {
  return {
    'HTTP-Referer': openRouterConfig.appUrl,
    'X-Title': openRouterConfig.appTitle,
  };
}

/**
 * Адаптер для demo-режима: провайдер из DEMO_PROVIDER, базовый URL можно
 * переопределить через DEMO_BASE_URL (OpenAI-совместимые провайдеры).
 */
export function getDemoAdapter(provider: LLMProviderType, baseUrl?: string): LLMAdapter {
  if (baseUrl && (provider === 'openai' || provider === 'deepseek')) {
    return new OpenAIAdapter(baseUrl);
  }
  return getAdapter(provider, baseUrl);
}

/**
 * @param baseUrl пользовательский базовый URL — обязателен для 'custom'
 *   (уже провалидированный validateBaseUrl), для остальных игнорируется.
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
      // OpenAI-совместимый агрегатор — свой адаптер не нужен (ТЗ-14)
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
