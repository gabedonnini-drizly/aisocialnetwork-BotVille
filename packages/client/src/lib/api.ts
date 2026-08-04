import type { AgentPresence, CatalogModel, LLMProviderType, LocationsSnapshot, UserKeyStatus } from '@botville/shared';
import { LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION } from '@botville/shared';

// In dev, Vite proxy handles /api → localhost:3001 (API_BASE = '').
// In prod, VITE_API_URL is set at build time; the default is '' — same
// origin, which is how the self-hosted Docker deployment fronts client and
// server (D-20; see README ## Docker). The old hardcoded cross-site fallback
// URL is retired along with the platforms that required it (D-20). `||`
// (not `??`) so an empty-string env value cannot clobber the same-origin default.
const envUrl = import.meta.env.VITE_API_URL;
export const API_BASE = envUrl || '';

export function apiUrl(path: string): string {
  return `${API_BASE}${path}`;
}

// ── Session token (TZ-12) ─────────────────────────────────────────────────────
// Originally added because client and server were deployed as different sites,
// so the cross-site av_session cookie never reached the server: Safari (ITP)
// blocks third-party cookies by default. The symptom was: POST /api/agents
// creates an agent in one session, the next GET goes out in a new one and
// returns nothing — the modal closed without an error while the HUD stayed
// empty. Under D-20's same-origin Docker deployment the cookie path works too,
// but the header-token approach still just works — no reason to remove it.
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

// ── Plot state (plan 03- Task 2) ─────────────────────────────────────────────
// The state source, as a wire call. Fixture mode answers from this repo's own
// server (GET /api/world/plots, every parcel `vacant` — which is TRUE, not a
// stub). Integrated mode has NO plot state on any client-consumed surface yet:
// `LocationsSnapshot` carries schemaVersion/gameHour/roster and nothing else,
// and the api's /locations serves exactly that. Measured, not assumed — see
// game/plotState.ts. When it lands, it lands here and nowhere else.

export interface PlotStateWireRow {
  id?: unknown;
  state?: unknown;
  archetype?: unknown;
}

/** null = "no source answered"; the caller keeps whatever it already had. */
export async function fetchPlotStates(): Promise<PlotStateWireRow[] | null> {
  if (PRESENCE_MODE === 'integrated') return null; // not on the wire yet
  try {
    const res = await apiFetch('/api/world/plots', {}, { timeoutMs: 10_000 });
    const json = await res.json();
    const rows = json?.data?.plots;
    return Array.isArray(rows) ? (rows as PlotStateWireRow[]) : null;
  } catch {
    return null;
  }
}

// ── Integrated mode (world addendum II.1/II.2): the platform presence seam ──
// The platform api owns presence; this client renders nothing the platform
// did not assert (restated I-11). fetchAgentLocations() above stays the
// fixture-mode path, untouched. This parser validates row SHAPE only —
// somewhere/absent/unknown is presenceModel's job (game/presence.ts, F-3),
// so venueId passes through untouched, null and unknown ids included.

export type PresenceMode = 'fixture' | 'integrated';

const PLATFORM_LOCATIONS_URL: string =
  (import.meta.env.VITE_PLATFORM_LOCATIONS_URL as string | undefined) ?? '';

/** Base URL of the platform api for public venue reads (venue-notes overlay). */
export const PLATFORM_API_BASE: string =
  (import.meta.env.VITE_PLATFORM_API_BASE as string | undefined) ?? '';

/** Picked once at module scope: integrated iff the platform URL is configured at build time. */
export const PRESENCE_MODE: PresenceMode = PLATFORM_LOCATIONS_URL ? 'integrated' : 'fixture';

export type PlatformLocationsResult =
  | { ok: true; gameHour: number; roster: AgentPresence[] }
  | { ok: false; reason: 'network' | 'invalid-schema' };

// Once-per-session warn state (module scope; tests reset via vi.resetModules).
let warnedInvalidSchema = false;

/**
 * Poll the platform LocationsSnapshot endpoint (addendum II.2, path per
 * D-24). Tolerant by construction: a malformed row is skipped, and a
 * snapshot without schemaVersion >= 2 signals fixture fallback (one warn).
 * The well-formed roster is returned as-is — presenceModel decides
 * placement (F-3), never this parser.
 */
export async function fetchPlatformLocations(): Promise<PlatformLocationsResult> {
  let body: unknown;
  try {
    const res = await fetch(PLATFORM_LOCATIONS_URL, { signal: AbortSignal.timeout(10_000) });
    body = await res.json();
  } catch {
    return { ok: false, reason: 'network' };
  }

  const snap = body as Partial<LocationsSnapshot> | null;
  if (
    typeof snap?.schemaVersion !== 'number' ||
    snap.schemaVersion < LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION ||
    typeof snap.gameHour !== 'number' ||
    !Array.isArray(snap.locations)
  ) {
    if (!warnedInvalidSchema) {
      warnedInvalidSchema = true;
      console.warn(
        '[presence] platform snapshot failed validation (schemaVersion must be a number >= 2) — falling back to fixture mode',
      );
    }
    return { ok: false, reason: 'invalid-schema' };
  }

  const roster: AgentPresence[] = [];
  for (const entry of snap.locations as Array<Partial<AgentPresence> | null>) {
    if (
      typeof entry?.id !== 'string' ||
      typeof entry.displayName !== 'string' ||
      typeof entry.spriteSeed !== 'string' ||
      (entry.venueId !== null && typeof entry.venueId !== 'string')
    ) {
      continue; // tolerant: one malformed row never breaks the poll
    }
    const presence: AgentPresence = {
      id: entry.id,
      displayName: entry.displayName,
      spriteSeed: entry.spriteSeed,
      venueId: entry.venueId,
    };
    if (typeof entry.activity === 'string') presence.activity = entry.activity;
    roster.push(presence);
  }
  return { ok: true, gameHour: snap.gameHour, roster };
}

// ── Venue notes (addendum II.4 botville_venue_notes; render per II.6) ──
// Public reads from the platform; the client's six venueIds map to the interiors.
// Tolerant parser: any network/shape failure just yields an empty list.

export interface VenueNote {
  id: string;
  body: string;
  createdAt: string; // ISO-8601, per the platform's VenueNoteSchema
}

/** Show at most this many notes, newest first. */
export const VENUE_NOTES_MAX_SHOWN = 10;

export async function fetchVenueNotes(venueId: string): Promise<VenueNote[]> {
  if (!PLATFORM_API_BASE) return [];
  let body: unknown;
  try {
    const res = await fetch(
      `${PLATFORM_API_BASE}/api/public/botville/venues/${encodeURIComponent(venueId)}/notes`,
      { signal: AbortSignal.timeout(10_000) },
    );
    body = await res.json();
  } catch {
    return [];
  }
  const raw = (body as { notes?: unknown } | null)?.notes;
  if (!Array.isArray(raw)) return [];
  const notes: VenueNote[] = [];
  for (const entry of raw as Array<Partial<VenueNote> | null>) {
    if (typeof entry?.id !== 'string' || typeof entry.body !== 'string') continue;
    notes.push({
      id: entry.id,
      body: entry.body,
      createdAt: typeof entry.createdAt === 'string' ? entry.createdAt : '',
    });
  }
  // ISO-8601 sorts lexicographically — newest first without Date.parse.
  return notes
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, VENUE_NOTES_MAX_SHOWN);
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
