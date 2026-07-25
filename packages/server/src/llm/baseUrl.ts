// ТЗ-14: пользовательский baseUrl (провайдер 'custom') — единственное место,
// где URL приходит снаружи. Валидируем строго, чтобы эндпоинт не превратился
// в SSRF-педаль и чтобы в URL не уехали пути-инъекции.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface BaseUrlCheck {
  ok: boolean;
  /** Нормализованный URL без хвостового слэша (только при ok). */
  url?: string;
  /** Машинный код причины отказа — текст подставляет клиент из i18n. */
  code?: 'invalid_url' | 'insecure_scheme' | 'bad_url_parts';
}

/**
 * Разрешаем только https:// (любой хост) и http:// для localhost/127.0.0.1
 * — локальные прокси иначе не подключить. Query, hash, credentials в URL
 * запрещены: адаптер клеит `${baseUrl}/chat/completions`, и хвост из строки
 * запроса сломал бы путь.
 */
export function validateBaseUrl(raw: string): BaseUrlCheck {
  const trimmed = raw.trim();
  if (!trimmed) return { ok: false, code: 'invalid_url' };

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, code: 'invalid_url' };
  }

  const isLocal = LOCAL_HOSTS.has(parsed.hostname);
  if (parsed.protocol === 'http:') {
    if (!isLocal) return { ok: false, code: 'insecure_scheme' };
  } else if (parsed.protocol !== 'https:') {
    return { ok: false, code: 'insecure_scheme' };
  }

  if (parsed.search || parsed.hash || parsed.username || parsed.password) {
    return { ok: false, code: 'bad_url_parts' };
  }

  const path = parsed.pathname.replace(/\/+$/, '');
  return { ok: true, url: `${parsed.origin}${path}` };
}
