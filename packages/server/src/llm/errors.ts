// TZ-02, part 3: all LLM provider errors are normalized into a single format
// { code, message }, where message is ready-to-show text for the user.

export class LLMError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly providerBody?: string,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

export interface NormalizedLLMError {
  code: 'invalid_key' | 'rate_limited' | 'no_credits' | 'stream_error' | 'server_down' | 'no_model_access';
  message: string;
}

const NO_CREDITS_MARKERS = ['insufficient', 'quota', 'credit', 'balance', 'billing'];
// TZ-14: with aggregators (OpenRouter) and custom endpoints a common case is a
// working key but this particular model being unavailable. This used to end up
// as stream_error.
const NO_MODEL_MARKERS = [
  'no endpoints found',
  'not a valid model',
  'model_not_found',
  'unknown model',
  'does not exist',
  'no allowed providers',
];
const NETWORK_MARKERS = ['fetch failed', 'econnrefused', 'enotfound', 'econnreset', 'socket hang up', 'network'];
const TIMEOUT_MARKERS = ['timeout', 'timed out', 'aborted'];

export function normalizeLLMError(err: Error): NormalizedLLMError {
  const status = err instanceof LLMError ? err.status : undefined;
  const haystack = `${err.message} ${err instanceof LLMError ? (err.providerBody ?? '') : ''} ${String((err as NodeJS.ErrnoException).cause ?? '')}`.toLowerCase();

  if (status === 401 || status === 403) {
    return { code: 'invalid_key', message: 'The key was rejected. Check it in the agent settings' };
  }
  // Model unavailable — checked before credits and limits: the texts overlap
  if (NO_MODEL_MARKERS.some(m => haystack.includes(m))) {
    return { code: 'no_model_access', message: 'This model is not available for your key. Pick another one' };
  }
  // insufficient quota often arrives with status 429 — checked before rate_limited
  if (NO_CREDITS_MARKERS.some(m => haystack.includes(m))) {
    return { code: 'no_credits', message: 'The key has run out of funds' };
  }
  if (status === 429) {
    return { code: 'rate_limited', message: 'The provider asks you to wait. Try again in a minute' };
  }
  if (NETWORK_MARKERS.some(m => haystack.includes(m)) || (status !== undefined && status >= 500)) {
    return { code: 'server_down', message: 'The server is asleep. Waking it up' };
  }
  if (TIMEOUT_MARKERS.some(m => haystack.includes(m))) {
    return { code: 'stream_error', message: 'The connection dropped. Send the message again' };
  }
  // A dropped stream and everything else — "try again"
  return { code: 'stream_error', message: 'The connection dropped. Send the message again' };
}
