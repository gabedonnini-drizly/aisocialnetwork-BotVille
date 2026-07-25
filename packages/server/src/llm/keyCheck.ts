import type { LLMProviderType } from '@botville/shared';
import { OPENROUTER_BASE_URL } from '@botville/shared';
import { openRouterHeaders } from './LLMRouter.js';

// ТЗ-02, часть 3: минимальная проверка ключа при сохранении (list models).
// true/false — вердикт провайдера; null — проверить не удалось (сеть, таймаут,
// 5xx) — сохранение не блокируем.

const CHECK_TIMEOUT_MS = Number(process.env.KEY_CHECK_TIMEOUT_MS ?? 5000);

/**
 * @param baseUrl базовый URL для провайдера 'custom' (уже провалидированный)
 */
export async function checkApiKey(
  provider: LLMProviderType,
  apiKey: string,
  baseUrl?: string,
): Promise<boolean | null> {
  try {
    const signal = AbortSignal.timeout(CHECK_TIMEOUT_MS);
    let res: Response;
    switch (provider) {
      case 'claude':
        res = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          signal,
        });
        break;
      case 'openai':
        res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal,
        });
        break;
      case 'deepseek':
        res = await fetch((process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com/v1') + '/models', {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal,
        });
        break;
      case 'openrouter':
        // ВАЖНО: /models у OpenRouter публичный и ответит 200 на любой мусор —
        // для проверки ключа годится только авторизованный /key (ТЗ-14).
        res = await fetch(`${OPENROUTER_BASE_URL}/key`, {
          headers: { ...openRouterHeaders(), Authorization: `Bearer ${apiKey}` },
          signal,
        });
        break;
      case 'custom':
        if (!baseUrl) return null;
        res = await fetch(`${baseUrl}/models`, {
          headers: { Authorization: `Bearer ${apiKey}` },
          signal,
        });
        break;
      default:
        // ollama и прочие — ключ не используется
        return null;
    }
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403) return false;
    return null;
  } catch {
    return null;
  }
}
