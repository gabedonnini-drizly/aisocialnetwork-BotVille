// ТЗ-02, часть 3: все ошибки LLM-провайдеров нормализуются в один формат
// { code, message }, где message — готовый текст для пользователя (RU).

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
// ТЗ-14: у агрегаторов (OpenRouter) и своих endpoint'ов частый случай — ключ
// рабочий, но именно эта модель недоступна. Раньше это уезжало в stream_error.
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
    return { code: 'invalid_key', message: 'Ключ не подошёл. Проверь его в настройках агента' };
  }
  // Модель недоступна — проверяем до денег и лимитов: тексты пересекаются
  if (NO_MODEL_MARKERS.some(m => haystack.includes(m))) {
    return { code: 'no_model_access', message: 'Эта модель недоступна для твоего ключа. Выбери другую' };
  }
  // insufficient quota часто приходит со статусом 429 — проверяем до rate_limited
  if (NO_CREDITS_MARKERS.some(m => haystack.includes(m))) {
    return { code: 'no_credits', message: 'На ключе закончились средства' };
  }
  if (status === 429) {
    return { code: 'rate_limited', message: 'Провайдер просит подождать. Попробуй через минуту' };
  }
  if (NETWORK_MARKERS.some(m => haystack.includes(m)) || (status !== undefined && status >= 500)) {
    return { code: 'server_down', message: 'Сервер спит. Уже будим' };
  }
  if (TIMEOUT_MARKERS.some(m => haystack.includes(m))) {
    return { code: 'stream_error', message: 'Связь прервалась. Отправь сообщение ещё раз' };
  }
  // Обрыв стрима и всё прочее — «попробуй ещё раз»
  return { code: 'stream_error', message: 'Связь прервалась. Отправь сообщение ещё раз' };
}
