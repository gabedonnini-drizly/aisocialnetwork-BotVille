import type { LLMProviderType } from '@botville/shared';
import { OPENROUTER_BASE_URL } from '@botville/shared';
import { openRouterHeaders } from './LLMRouter.js';

// TZ-02, part 3: a minimal key check on save (list models). true/false is the
// provider's verdict; null means the check couldn't be performed (network,
// timeout, 5xx) — saving is not blocked.

const CHECK_TIMEOUT_MS = Number(process.env.KEY_CHECK_TIMEOUT_MS ?? 5000);

/**
 * @param baseUrl base URL for the 'custom' provider (already validated)
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
        // IMPORTANT: OpenRouter's /models is public and answers 200 to any
        // garbage — only the authorized /key works for checking a key (TZ-14).
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
        // ollama and the rest — no key is used
        return null;
    }
    if (res.ok) return true;
    if (res.status === 401 || res.status === 403) return false;
    return null;
  } catch {
    return null;
  }
}
