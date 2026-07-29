// TZ-14: a user-supplied baseUrl (the 'custom' provider) is the only place
// where a URL comes from outside. Validate it strictly, so the endpoint doesn't
// turn into an SSRF lever and so no path injections sneak into the URL.

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export interface BaseUrlCheck {
  ok: boolean;
  /** The normalized URL without a trailing slash (only when ok). */
  url?: string;
  /** Machine-readable rejection reason — the client supplies the text from i18n. */
  code?: 'invalid_url' | 'insecure_scheme' | 'bad_url_parts';
}

/**
 * Only https:// (any host) and http:// for localhost/127.0.0.1 are allowed —
 * otherwise local proxies couldn't be connected. Query, hash, and credentials
 * in the URL are forbidden: the adapter concatenates
 * `${baseUrl}/chat/completions`, and a query-string tail would break the path.
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
