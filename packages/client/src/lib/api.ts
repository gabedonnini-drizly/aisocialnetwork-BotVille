import type { AgentLocation, CatalogModel, LLMProviderType, UserKeyStatus } from '@botville/shared';

// In dev, Vite proxy handles /api → localhost:3001 (API_BASE = '').
// In prod, VITE_API_URL wins if set at build time; otherwise fall back to the
// known Railway server URL (public, not a secret). Fallback added 2026-07-16:
// env-injection through vercel build proved unreliable on this setup.
// NB: `||` (не `??`) — vercel pull отдаёт Sensitive-переменные как пустую
// строку, и она не должна затирать fallback.
const PROD_API_FALLBACK = 'https://botvilleserver-production.up.railway.app';
const envUrl = import.meta.env.VITE_API_URL;
export const API_BASE =
  envUrl || (import.meta.env.PROD ? PROD_API_FALLBACK : '');

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

// ── Токен-сессия (ТЗ-12) ──────────────────────────────────────────────────────
// Клиент и сервер — разные сайты (vercel.app / railway.app), поэтому cookie
// av_session cross-site до сервера не доезжает: Safari (ITP) режет сторонние
// куки по умолчанию. Симптом был — POST /api/agents создаёт агента в одной
// сессии, следующий GET уходит уже в новой и возвращает пусто: модалка
// закрывалась без ошибки, а HUD оставался пустым.
//
// Лечение — тот же подписанный `<uuid>.<hmac>`, что и в куке, но в заголовке.
// Кука не тронута: где браузер её пускает, работают оба пути.
const TOKEN_KEY = 'av_session_token';
const SESSION_HEADER = 'X-Session-Token';

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // приватный режим / отключённое хранилище — просто без токена
  }
}

function writeToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* хранилище недоступно — остаётся cookie-путь */
  }
}

/** URL для WebSocket с токеном в query: браузерный WS не шлёт заголовки. */
export function wsUrl(path = '/ws'): string {
  const base = API_BASE || window.location.origin;
  const url = new URL(path, base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  const token = readToken();
  if (token) url.searchParams.set('token', token);
  return url.toString();
}

// Единый бутстрап на все параллельные вызовы: на первом рендере apiFetch
// дёргают сразу несколько мест (список агентов + demo-статус). Без общего
// промиса каждый завёл бы свою сессию, и одна из них потерялась бы.
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
      // Сервер недостижим — не блокируем вызов: он упадёт сам и покажет
      // человеческую ошибку (таймаут ТЗ-11). Бутстрап повторится позже.
      bootstrap = null;
    });
  return bootstrap;
}

/**
 * fetch к API: сессия едет и cookie (credentials:'include'), и токеном в
 * заголовке — что из двух долетит, тем сервер и воспользуется.
 *
 * opts.timeoutMs (опц.): если сервер недостижим/заблокирован провайдером,
 * голый fetch висит до OS-таймаута сокета (минуты). Таймаут через
 * AbortController превращает «чёрную дыру» в детерминированный отказ,
 * который вызывающий покажет человеку. По умолчанию поведение не меняется —
 * таймаут включают только те вызовы, где важен быстрый фидбек (создание агента).
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
    // Сервер отдаёт актуальный токен на каждом /api-ответе — подхватываем,
    // если своего ещё нет или сессия сменилась.
    const fresh = res.headers.get(SESSION_HEADER);
    if (fresh && fresh !== token) writeToken(fresh);
    return res;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

// ── Местоположения агентов (ТЗ-16) ───────────────────────────────────────────

export interface AgentLocationsSnapshot {
  gameHour: number;
  locations: Array<{ id: string; location: AgentLocation }>;
}

/** Лёгкий поллинг «кто где» + серверный игровой час; null — сеть/сервер недоступны. */
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

// ── Живой каталог моделей OpenRouter (ТЗ-14) ─────────────────────────────────
// Каталог публичный и одинаковый для всех — сервер его кэширует, клиент держит
// в памяти вкладки, чтобы не дёргать API на каждое открытие модалки.
let catalogCache: Promise<CatalogModel[]> | null = null;

export function fetchOpenRouterModels(): Promise<CatalogModel[]> {
  catalogCache ??= apiFetch('/api/models/openrouter', {}, { timeoutMs: 12_000 })
    .then(res => res.json())
    .then(json => (json?.data?.models ?? []) as CatalogModel[])
    .catch(() => {
      catalogCache = null; // дать следующему открытию шанс
      return [] as CatalogModel[];
    });
  return catalogCache;
}

// ── Ключи юзера (ТЗ-14) ───────────────────────────────────────────────────────
// Сервер отдаёт только факт «настроен» + маску-хвост, сам ключ не возвращается.

export async function fetchUserKeys(): Promise<UserKeyStatus[]> {
  try {
    const res = await apiFetch('/api/keys');
    const json = await res.json();
    return (json.data ?? []) as UserKeyStatus[];
  } catch {
    return [];
  }
}

/** @returns вердикт health-check: true/false, null — проверить не удалось */
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

/** Состояние demo-режима для текущей сессии (бейдж, кнопка «Позже — начать с демо»). */
export async function fetchDemoStatus(): Promise<{ demoEnabled: boolean; demoRemaining?: number }> {
  try {
    const res = await apiFetch('/api/chat/demo-status');
    const json = await res.json();
    return json.data ?? { demoEnabled: false };
  } catch {
    return { demoEnabled: false };
  }
}
