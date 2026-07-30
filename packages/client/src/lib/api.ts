import type { CatalogModel, LLMProviderType, UserKeyStatus } from '@botville/shared';

// In dev, Vite proxy handles /api → localhost:3001 (API_BASE = '').
// In prod, VITE_API_URL wins if set at build time; otherwise fall back to the
// known Railway server URL (public, not a secret). Fallback added 2026-07-16:
// env-injection through vercel build proved unreliable on this setup.
// NB: `||` (not `??`) — vercel pull returns Sensitive variables as an empty
// string, and it must not clobber the fallback.
const PROD_API_FALLBACK = 'https://botvilleserver-production.up.railway.app';
const envUrl = import.meta.env.VITE_API_URL;
export const API_BASE =
  envUrl || (import.meta.env.PROD ? PROD_API_FALLBACK : '');

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

// ── Session token (TZ-12) ─────────────────────────────────────────────────────
// The client and server are different sites (vercel.app / railway.app), so the
// cross-site av_session cookie never reaches the server: Safari (ITP) blocks
// third-party cookies by default. The symptom was: POST /api/agents creates an
// agent in one session, the next GET goes out in a new one and returns nothing —
// the modal closed without an error while the HUD stayed empty.
//
// The fix: the same signed `<uuid>.<hmac>` as in the cookie, but in a header.
// The cookie is untouched: where the browser allows it, both paths work.
const TOKEN_KEY = 'av_session_token';
const SESSION_HEADER = 'X-Session-Token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // private mode / storage disabled — just proceed without a token
  }
}

function writeToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage unavailable — the cookie path remains */
  }
}

/** WebSocket URL with the token in the query: browser WS cannot send headers. */
export function wsUrl(path = '/ws'): string {
  const base = API_BASE || window.location.origin;
  const url = new URL(path, base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = readToken();
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

// A single bootstrap shared by all parallel calls: on first render apiFetch is
// hit by several places at once (agent list + demo status). Without a shared
// promise each would start its own session and one of them would be lost.
let bootstrap: Promise<void> | null = null;

function ensureSession(): Promise<void> {
  if (readToken()) return Promise.resolve();
  bootstrap ??= fetch(apiUrl('/api/session'), { credentials: 'include' })
    .then(res => res.json())
    .then(json => {
      const token = json?.data?.token;
      if (typeof token === 'string' && token) writeToken(token);
    })
    .catch(() => {
      // Server unreachable — don't block the call: it will fail on its own and
      // show a human-readable error (TZ-11 timeout). Bootstrap retries later.
      bootstrap = null;
    });
  return bootstrap;
}

/**
 * fetch to the API: the session travels both as a cookie (credentials:'include')
 * and as a token in a header — whichever of the two gets through, the server uses.
 *
 * opts.timeoutMs (optional): if the server is unreachable/blocked by the ISP, a
 * bare fetch hangs until the OS socket timeout (minutes). A timeout via
 * AbortController turns the "black hole" into a deterministic failure that the
 * caller can show to the user. Default behavior is unchanged — the timeout is
 * enabled only by calls where fast feedback matters (agent creation).
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
  opts: { timeoutMs?: number } = {},
): Promise<Response> {
  await ensureSession();

  const token = readToken();
  const headers = new Headers(init.headers);
  if (token) headers.set(SESSION_HEADER, token);

  const ctrl = opts.timeoutMs ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), opts.timeoutMs) : null;
  try {
    const res = await fetch(apiUrl(path), {
      credentials: 'include',
      ...init,
      headers,
      ...(ctrl ? { signal: ctrl.signal } : {}),
    });
    // The server returns the current token on every /api response — pick it up
    // if we don't have one yet or the session has changed.
    const fresh = res.headers.get(SESSION_HEADER);
    if (fresh && fresh !== token) writeToken(fresh);
    return res;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── Agent locations (TZ-16) ──────────────────────────────────────────────────

export interface AgentLocationsSnapshot {
  gameHour: number;
  // F-3: a venue id, not the retired six-string AGENT_LOCATIONS vocabulary —
  // see game/presence.ts (PresenceModel over the venue registry) for what "known" means.
  locations: Array<{ id: string; location: string }>;
}

/** Lightweight "who is where" polling + server game hour; null — network/server unavailable. */
export async function fetchAgentLocations(): Promise<AgentLocationsSnapshot | null> {
  try {
    const res = await apiFetch('/api/agents/locations', {}, { timeoutMs: 10_000 });
    const json = await res.json();
    if (json?.error || typeof json?.data?.gameHour !== 'number') return null;
    return json.data as AgentLocationsSnapshot;
  } catch {
    return null;
  }
}

// ── Live OpenRouter model catalog (TZ-14) ────────────────────────────────────
// The catalog is public and the same for everyone — the server caches it, the
// client keeps it in tab memory to avoid hitting the API every time the modal opens.
let catalogCache: Promise<CatalogModel[]> | null = null;

export function fetchOpenRouterModels(): Promise<CatalogModel[]> {
  catalogCache ??= apiFetch('/api/models/openrouter', {}, { timeoutMs: 12_000 })
    .then(res => res.json())
    .then(json => (json?.data?.models ?? []) as CatalogModel[])
    .catch(() => {
      catalogCache = null; // give the next open a chance
      return [] as CatalogModel[];
    });
  return catalogCache;
}

// ── User keys (TZ-14) ─────────────────────────────────────────────────────────
// The server returns only the "configured" flag + a masked tail; the key itself
// is never returned.

export async function fetchUserKeys(): Promise<UserKeyStatus[]> {
  try {
    const res = await apiFetch('/api/keys');
    const json = await res.json();
    return (json.data ?? []) as UserKeyStatus[];
  } catch {
    return [];
  }
}

/** @returns health-check verdict: true/false, null — the check could not be performed */
export async function saveUserKey(
  provider: LLMProviderType,
  apiKey: string,
  baseUrl?: string,
): Promise<{ ok: boolean; valid: boolean | null; errorCode?: string }> {
  try {
    const res = await apiFetch(`/api/keys/${provider}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey, baseUrl }),
    }, { timeoutMs: 15_000 });
    const json = await res.json();
    if (json.error) return { ok: false, valid: null, errorCode: json.error.code };
    return { ok: true, valid: json.data?.valid ?? null };
  } catch {
    return { ok: false, valid: null, errorCode: 'NETWORK' };
  }
}

export async function deleteUserKey(provider: LLMProviderType): Promise<void> {
  await apiFetch(`/api/keys/${provider}`, { method: 'DELETE' });
}

/** Demo-mode state for the current session (badge, the "Later — start with demo" button). */
export async function fetchDemoStatus(): Promise<{ demoEnabled: boolean; demoRemaining?: number }> {
  try {
    const res = await apiFetch('/api/chat/demo-status');
    const json = await res.json();
    return json.data ?? { demoEnabled: false };
  } catch {
    return { demoEnabled: false };
  }
}
