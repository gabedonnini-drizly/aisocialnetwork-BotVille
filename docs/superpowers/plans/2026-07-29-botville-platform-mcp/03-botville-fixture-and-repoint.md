# Plan 03 — BotVille: fixture/integrated seam, tolerant client repoint, activity + notes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-29-botville-world-addendum-design.md` — Part II.1/II.2 (fixture vs integrated modes, the HTTP seam), Part I.4 (`LocationsSnapshot` / `AgentPresence`), and the binding Conventions section.

**Target repo:** `/Users/home/aisocialnetwork-BotVille` (this repo). All paths below are absolute.

## Goal

Give the BotVille client the minimal integration seam to the platform: the shipped `AgentPresence` gains its optional `activity` field **in place** plus the versioned `LocationsSnapshot` type (Assets.ts, spec I.4, owner decision D-23), a build-time fixture/integrated mode switch with a tolerant platform-snapshot parser that feeds the shipped F-3 `PresenceModel` pipeline, a coarse `activity` label on agent sprites, seed-derived appearances for platform agents (D-25), a minimal venue-notes overlay in integrated mode, and D-20 fallback-URL hygiene. Fixture mode (the current `agentLife.ts` + `GET /api/agents/locations` path) stays byte-for-byte behaviourally unchanged and fully self-contained.

**Owner decisions (2026-07-30, `DECISIONS.md` in this plan directory):** D-23
(`activity?` added in place to the shipped `AgentPresence` — single definition,
no barrel breakage; existing tests/scripts integrated with, never overwritten),
D-24 (`GET /api/public/botville/locations` canonical), D-25 (platform agents
render as seed-derived premade humans via `spriteSeed` → `AppearanceResolver`),
plus D-20 hygiene (retire the Railway fallback URL). This plan was amended
2026-07-30 against the merged visual-assets set.

## Architecture

The platform api owns world truth in integrated mode; BotVille is presentation only, and the client polls the platform's `LocationsSnapshot` endpoint instead of its own server — same seam, indistinguishable to the scenes (spec II.1). The mode is picked once at client module scope from `VITE_PLATFORM_LOCATIONS_URL`; an invalid platform snapshot (missing/`< 2` `schemaVersion`) degrades to fixture mode for the session with exactly one warning. **Presence flows through the shipped F-3 pipeline unchanged:** `presenceModel.partition` over the live venue registry (+farm) is the single authority on somewhere/absent/unknown (`packages/client/src/game/presence.ts`), and `warnUnknown` logs one compact warning per unplaceable agent id. Integrated mode only swaps the roster *source* — the platform snapshot instead of the fixture store — never the authority. The parser validates row **shape** only; it never judges venue-knownness.

## Tech Stack

- TypeScript 5.7, ESM everywhere, npm workspaces + turbo.
- `packages/shared` — plain TS types (`main`/`types` point at `src/index.ts`); type assertions join the **existing** root `node --test` suite (`test/shared-types.test.ts` — the visual set shipped it along with `test/presence-model.test.ts`, `test/presence-wiring.test.ts` and the bake suites).
- `packages/client` — Vite 6 + React 18 + Zustand + Phaser 3.88; new tests via **vitest** (added by this plan — the client workspace has no test runner today, only `tsc --noEmit` typecheck).
- `packages/server` — Express + SQLite; **not modified** except a doc comment in `world/agentLife.ts`.

## Global Constraints

- **Node >= 24, ESM only** (`engines` in root `package.json`). Dev machines on Node >= 22.18 still run `node --test` on `.ts` files (type stripping is default-on from 22.18); do not add a transpile step for tests.
- **Spec Conventions (binding):** one canonical schema per boundary shape and nothing parses what it can validate; declarative naming (`derive<Thing>` for pure derivations, `SCREAMING_SNAKE` constants with the unit/meaning in the name, no abbreviations); a field carries the same name across every layer (`venueId` stays `venueId`). Any drift from spec I.4's exact field names is a defect.
- **Restated I-11:** "the client renders nothing the platform did not assert." Required `AgentPresence` fields are exactly `id`, `displayName`, `spriteSeed`, `venueId`; everything beyond them is optional-and-ignorable.
- **The visual-assets set has EXECUTED and merged.** The canonical `AgentPresence` (four required fields) and `PresenceState` ship in `packages/shared/src/types/Assets.ts:17-31`, exported through the barrel's existing `export * from './types/Assets.js'`. Addendum I.4 supersedes that file's pre-addendum "Do not extend this interface" comment, and this plan amends the interface **in place** (D-23) — a second `AgentPresence` declaration or a second colliding `export *` breaks every consumer (`PresenceModel.ts`, `presence.ts`, `useGameSync.ts`) and is forbidden. Still off limits: anything under `docs/superpowers/plans/2026-07-27-botville-visual-assets/`, art/asset work, the venue registry and archetype/instancing code, and `AGENT_LOCATIONS` in `packages/shared/src/types/Agent.ts` (the legacy fixture vocabulary — F-3 retired it as a runtime authority; it stays untouched).
- **Fixture path unchanged:** `fetchAgentLocations()`, `GET /api/agents/locations` (legacy shape, no `schemaVersion`), `applyLocations`, and `agentLife.ts` behaviour are not modified. (The retired `normalizeLocation` clamp no longer exists anywhere — do not reintroduce it.)
- **Do not commit on `main`;** work happens on the executing session's feature branch. Each task ends in its own commit.

---

## Task 1 — Shared types: `activity?` in place + `LocationsSnapshot` (spec I.4, D-23)

**Files:**
- Edit `/Users/home/aisocialnetwork-BotVille/packages/shared/src/types/Assets.ts` (the shipped canonical location — D-23)
- Edit `/Users/home/aisocialnetwork-BotVille/test/shared-types.test.ts` (the existing restated-I-11 test, shipped by the visual set)
- Edit `/Users/home/aisocialnetwork-BotVille/package.json` (root — append the workspace test runner to the EXISTING `test` script)
- Edit `/Users/home/aisocialnetwork-BotVille/turbo.json` (add a `test` task; only workspaces that define a `test` script run — today none, Task 2 adds the client's)

**Interfaces:**
- `AgentPresence` gains `activity?: string` **in place** (Assets.ts:17 — single definition; the barrel's existing `export * from './types/Assets.js'` carries it; no new file, no new index line).
- `const LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION = 2` and `interface LocationsSnapshot { schemaVersion: number; gameHour: number; locations: AgentPresence[] }` — added to Assets.ts beside `AgentPresence`.

Note: the legacy fixture snapshot (`AgentLocationsSnapshot` in `packages/client/src/lib/api.ts:119`, `{ gameHour, locations: [{id, location}] }`) is **not** touched — the current server keeps serving it and the client keeps parsing it. The restated-I-11 test ALREADY EXISTS (`test/shared-types.test.ts:43` — "AgentPresence requires the four boundary fields; any additions are optional") and stays byte-identical; this task only APPENDS the activity/LocationsSnapshot assertions to it (D-23: integrate, never overwrite).

**Steps:**

- [ ] In `/Users/home/aisocialnetwork-BotVille/turbo.json`, add to `"tasks"`:

  ```json
  "test": {
    "dependsOn": ["^build"]
  }
  ```

  and in root `/Users/home/aisocialnetwork-BotVille/package.json` **append** `&& turbo run test` to the existing `test` script — the shipped root suite (bake/appearance/presence/shared-types tests + `golden:names`) MUST keep running; replacing the script orphans it (D-23). The script becomes:

  ```json
  "test": "node --import ./test/ts-resolve.mjs --test --test-concurrency=4 --test-reporter=spec \"test/*.test.mjs\" \"test/*.test.ts\" && npm run golden:names && turbo run test"
  ```

  (Until Task 2 adds the client's `test` script, `turbo run test` matches zero workspaces and is a fast no-op.)

- [ ] Write the failing additions. In `/Users/home/aisocialnetwork-BotVille/test/shared-types.test.ts`, extend the type-only import at the top of the file with `LocationsSnapshot` and the value import with `LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION`:

  ```ts
  import { SCHEMA_VERSION, LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION } from '../packages/shared/src/types/Assets.ts';
  import type { AgentPresence, PresenceState, VenueDescriptor, LocationsSnapshot } from '../packages/shared/src/types/Assets.ts';
  ```

  (replacing the existing two import lines from `Assets.ts`), then APPEND these tests after the existing `'AgentPresence requires the four boundary fields; any additions are optional'` test — which stays byte-identical:

  ```ts
  test('AgentPresence: activity is the first optional addition (addendum I.4, D-23)', () => {
    const base: AgentPresence = { id: 'a', displayName: 'A', spriteSeed: 'a', venueId: 'cafe' };
    const withActivity: AgentPresence = { ...base, activity: 'working' };
    assert.equal(withActivity.activity, 'working');
    assert.equal(base.activity, undefined); // compiles with no activity — optional-and-ignorable
  });

  test('LocationsSnapshot: schemaVersion is required; platform snapshots start at 2', () => {
    const snapshot: LocationsSnapshot = {
      schemaVersion: LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION,
      gameHour: 13.5,
      locations: [{ id: 'a', displayName: 'A', spriteSeed: 'a', venueId: null }],
    };
    assert.equal(snapshot.schemaVersion, 2);
    assert.equal(snapshot.locations.length, 1);
    // @ts-expect-error schemaVersion is required on the platform snapshot
    const unversioned: LocationsSnapshot = { gameHour: 0, locations: [] };
    void unversioned;
  });
  ```

- [ ] Run: `npm test` (root) — **expected FAIL**: the value import of `LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION` errors at load (`SyntaxError: The requested module ... does not provide an export named 'LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION'`) — a real runtime red even under type stripping.

- [ ] Implement — edit `/Users/home/aisocialnetwork-BotVille/packages/shared/src/types/Assets.ts` **in place**. Replace the boundary comment + interface (currently lines 13-25):

  ```ts
  // ── The immutable platform↔city boundary (spec §3.1) ────────────────────
  // Four fields. They do not change when a venue is added, a pack is
  // swapped, or the roster grows. Do not extend this interface.

  export interface AgentPresence {
    /** platform agent uuid */
    id: string;
    displayName: string;
    /** stable, unique — the username. The only seed appearance derives from. */
    spriteSeed: string;
    /** null = absent; an id absent from the registry = unknown */
    venueId: string | null;
  }
  ```

  with:

  ```ts
  // ── The platform↔city boundary (spec §3.1; addendum §I.4, D-23) ─────────
  // The four ORIGINAL fields are required and unrenamed forever. Anything
  // beyond them is optional-and-ignorable — restated I-11: the client
  // renders nothing the platform did not assert. Additions land HERE, in
  // this one definition, never in a second declaration.

  export interface AgentPresence {
    /** platform agent uuid */
    id: string;
    displayName: string;
    /** stable, unique — the username. The only seed appearance derives from. */
    spriteSeed: string;
    /** null = absent; an id absent from the registry = unknown */
    venueId: string | null;
    /** Coarse label from the routine slot ("sleeping", "working"). Optional-and-ignorable (I.4). */
    activity?: string;
  }

  /** Platform snapshots carry schemaVersion >= 2; below that the client falls back to fixture mode (II.2). */
  export const LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION = 2;

  /**
   * The versioned locations payload the platform serves in integrated mode
   * (`GET /api/public/botville/locations` — spec II.2 as amended by D-24).
   * Canonical schema for the HTTP seam (Conventions table); the platform api
   * mirrors it with a zod validator. The legacy fixture snapshot
   * ({ gameHour, locations: [{ id, location }] }, served by this repo's own
   * server) is a separate, unversioned shape and is deliberately NOT here.
   */
  export interface LocationsSnapshot {
    /** Bumps on any breaking change to this payload. */
    schemaVersion: number;
    gameHour: number;
    locations: AgentPresence[];
  }
  ```

- [ ] Run: `npm test` (root) — **expected PASS**: the whole shipped suite plus the two new tests (the untouched `'AgentPresence requires the four boundary fields...'` test proves the four-field literal still type-checks — additions really are optional).

- [ ] Run: `npm run typecheck` (root, turbo) — **expected PASS** (the field is optional and the two new exports are additive; every consumer of `AgentPresence` compiles unchanged).

- [ ] Commit: `feat(shared): AgentPresence.activity? in place + LocationsSnapshot per addendum I.4 (D-23)`

---

## Task 2 — Tolerant client parser + fixture/integrated mode switch (preserving the F-3 authority)

**Files:**
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.ts` (additive block + D-20 fallback hygiene; `fetchAgentLocations` untouched)
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/hooks/useGameSync.ts` (**surgical edits below — NOT a rewrite**: the shipped F-3 `presenceModel.partition` / `warnUnknown` / `flattenSomewhere` pipeline stays the presence authority; integrated mode only swaps the roster source)
- Create `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.test.ts`
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/package.json` (vitest + `test` script)
- Edit `/Users/home/aisocialnetwork-BotVille/turbo.json` (declare the two new `VITE_` env vars for build caching)

**Interfaces (new exports from `api.ts`):**
- `type PresenceMode = 'fixture' | 'integrated'`
- `const PRESENCE_MODE: PresenceMode` — picked once at module scope; `'integrated'` iff `VITE_PLATFORM_LOCATIONS_URL` is non-empty
- `const PLATFORM_API_BASE: string` — from `VITE_PLATFORM_API_BASE` (used by Task 4)
- `type PlatformLocationsResult = { ok: true; gameHour: number; roster: AgentPresence[] } | { ok: false; reason: 'network' | 'invalid-schema' }` — the parser returns the raw `AgentPresence` roster; it validates row **shape** only. Venue-knownness, absent and unknown are `presenceModel`'s job (`game/presence.ts`, F-3) — NOT this parser's, and NOT `AGENT_LOCATIONS`'s (retired as a runtime authority; the live registry includes all 17 interiors + district + farm).
- `async function fetchPlatformLocations(): Promise<PlatformLocationsResult>`
- `SyncedAgent` (in `useGameSync.ts`) gains `activity?: string` and `spriteSeed?: string` — the latter so scenes can forward platform identity to `AgentSprite` (D-25, wired in Task 3).
- (No `deriveAvatarVariant` — removed per D-25: platform agents render as seed-derived premade humans via the shipped `spriteSeed` → `AppearanceResolver` path, not a hash-picked legacy variant. The shared `hashString` in `packages/shared/src/hash.mjs` already owns cross-repo seeded hashing if any is ever needed.)

**Steps:**

- [ ] Install the client test runner: `npm install --save-dev --workspace=packages/client vitest@^3.2.4`, and add to `packages/client/package.json` `"scripts"`: `"test": "vitest run"`. Vitest picks up the existing `vite.config.ts` (React plugin + the `@botville/shared` alias) automatically; default `node` environment is correct — nothing under test touches `window` at import time.

- [ ] In `/Users/home/aisocialnetwork-BotVille/turbo.json`, extend the `build` task's env list:

  ```json
  "env": ["VITE_API_URL", "VITE_PLATFORM_LOCATIONS_URL", "VITE_PLATFORM_API_BASE"]
  ```

- [ ] Write the failing test, `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.test.ts` — FULL code:

  ```ts
  // Addendum II.1/II.2: the client half of the presence seam — mode pick and
  // tolerant LocationsSnapshot parsing. Venue-knownness is deliberately NOT
  // tested here: presenceModel (game/presence.ts, F-3) is the shipped
  // authority on somewhere/absent/unknown; this parser only validates row
  // SHAPE and passes venueId through untouched. Module state (the
  // once-per-warn flag) is reset between tests via vi.resetModules().
  import { afterEach, describe, expect, it, vi } from 'vitest';

  type ApiModule = typeof import('./api.js');

  const PLATFORM_URL = 'https://platform.test/api/public/botville/locations';

  async function importApi(env: Record<string, string>): Promise<ApiModule> {
    vi.resetModules();
    for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
    return await import('./api.js');
  }

  function jsonResponse(body: unknown): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const validSnapshot = {
    schemaVersion: 2,
    gameHour: 13.5,
    locations: [
      { id: 'uuid-1', displayName: 'Ada', spriteSeed: 'ada', venueId: 'cafe', activity: 'reading' },
      { id: 'uuid-2', displayName: 'Bob', spriteSeed: 'bob', venueId: null },
      { id: 'uuid-3', displayName: 'Eve', spriteSeed: 'eve', venueId: 'observatory' },
    ],
  };

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('PRESENCE_MODE', () => {
    it('is fixture when VITE_PLATFORM_LOCATIONS_URL is unset', async () => {
      const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: '' });
      expect(api.PRESENCE_MODE).toBe('fixture');
    });

    it('is integrated when VITE_PLATFORM_LOCATIONS_URL is set', async () => {
      const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
      expect(api.PRESENCE_MODE).toBe('integrated');
    });
  });

  describe('fetchPlatformLocations', () => {
    it('passes every well-formed row through unfiltered (presenceModel decides placement)', async () => {
      const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(validSnapshot)));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await api.fetchPlatformLocations();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.gameHour).toBe(13.5);
      // All three rows survive — venueId null AND the unknown 'observatory'
      // included: absent/unknown handling belongs to presenceModel (F-3),
      // never to this parser, and the parser itself never warns about them.
      expect(result.roster).toEqual(validSnapshot.locations);
      expect(warn).not.toHaveBeenCalled();
    });

    it('rejects schemaVersion < 2 with exactly one warning (fixture-fallback signal)', async () => {
      const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ...validSnapshot, schemaVersion: 1 })));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(await api.fetchPlatformLocations()).toEqual({ ok: false, reason: 'invalid-schema' });
      expect(await api.fetchPlatformLocations()).toEqual({ ok: false, reason: 'invalid-schema' });
      expect(warn).toHaveBeenCalledTimes(1);
    });

    it('reports network failures without warning', async () => {
      const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      expect(await api.fetchPlatformLocations()).toEqual({ ok: false, reason: 'network' });
      expect(warn).not.toHaveBeenCalled();
    });

    it('skips malformed rows instead of failing the poll, and drops undeclared activity', async () => {
      const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
        schemaVersion: 2,
        gameHour: 1,
        locations: [
          { id: 42 },
          null,
          { id: 'ok', displayName: 'Ok', spriteSeed: 'ok', venueId: 'office', activity: 7 },
        ],
      })));
      const result = await api.fetchPlatformLocations();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.roster).toEqual([
        { id: 'ok', displayName: 'Ok', spriteSeed: 'ok', venueId: 'office' },
      ]);
    });
  });
  ```

- [ ] Run: `npm run test --workspace=packages/client` — **expected FAIL**: every test errors at runtime because `./api.js` does not yet export `PRESENCE_MODE` / `fetchPlatformLocations` (`.toBe('fixture')` on `undefined` / `undefined is not a function`).

- [ ] Implement the `api.ts` additions. In `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.ts`, replace the first import line (as it reads today — `AgentLocation` is no longer imported there)

  ```ts
  import type { CatalogModel, LLMProviderType, UserKeyStatus } from '@botville/shared';
  ```

  with

  ```ts
  import type { AgentPresence, CatalogModel, LLMProviderType, LocationsSnapshot, UserKeyStatus } from '@botville/shared';
  import { LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION } from '@botville/shared';
  ```

  then append this block at the end of the "Agent locations (TZ-16)" section, directly after `fetchAgentLocations` (which stays exactly as it is — it IS the fixture-mode path) — FULL code of the added block:

  ```ts
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
  ```

- [ ] D-20 hygiene (same file, separate concern): retire the dead Vercel/Railway fallback. Replace the block at the top of `api.ts` (currently lines 3-12)

  ```ts
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
  ```

  with

  ```ts
  // In dev, Vite proxy handles /api → localhost:3001 (API_BASE = '').
  // In prod, VITE_API_URL is set at build time; the default is '' — same
  // origin, which is how the self-hosted Docker deployment fronts client and
  // server (D-20; see README ## Docker). The old Vercel/Railway fallback URL
  // is retired with those platforms (D-20). `||` (not `??`) so an
  // empty-string env value cannot clobber the same-origin default.
  const envUrl = import.meta.env.VITE_API_URL;
  export const API_BASE = envUrl || '';
  ```

  If the deployment ever splits client and api across origins, `VITE_API_URL` must be set at build time — document nothing new; the README env table (Task 5) already covers build-time vars.

- [ ] Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/hooks/useGameSync.ts` — **four surgical edits on the merged F-3 file** (NOT a rewrite; `presenceModel.partition` / `warnUnknown` / `flattenSomewhere` stay the single presence authority):

  1. Replace the api import line

     ```ts
     import { fetchAgentLocations } from '../lib/api.js';
     ```

     with

     ```ts
     import { fetchAgentLocations, fetchPlatformLocations, PRESENCE_MODE, type PresenceMode } from '../lib/api.js';
     ```

  2. Extend `SyncedAgent` — after the existing `location: string;` field add:

     ```ts
     /** Addendum O-2 #1 «where + what»: coarse activity label; integrated mode only. */
     activity?: string;
     /** Platform identity for derived appearance (D-25); fixture agents omit it. */
     spriteSeed?: string;
     ```

  3. After the `isSyncable(...)` function, add the module-scope mode state:

     ```ts
     // Addendum II.1: the mode is picked ONCE at module scope from the
     // build-time env (PRESENCE_MODE). The only runtime transition is
     // integrated → fixture when the platform serves an invalid snapshot
     // (one warn, in api.ts).
     let presenceMode: PresenceMode = PRESENCE_MODE;
     /** Latest platform roster; syncToScene partitions it instead of the store in integrated mode. */
     let platformRoster: AgentPresence[] = [];
     ```

  4. Two body edits, roster source and poll:

     a. In `syncToScene`, replace the roster construction + scene call (the block from `const roster: AgentPresence[] = agentsRef.current.map(...)` through `scene.syncAgents(...)`) with a mode-aware source **feeding the same partition**:

     ```ts
     // F-3: PresenceModel is the runtime authority on "who is where" — BOTH
     // modes route through it. Unknown/absent agents never reach a scene,
     // and unknown ids get warnUnknown's single compact warning per id.
     const roster: AgentPresence[] = presenceMode === 'integrated'
       ? platformRoster
       : agentsRef.current.map(a => ({
           id: a.id, displayName: a.name, spriteSeed: a.id, venueId: a.location,
         }));
     const { somewhere, unknown } = presenceModel.partition(roster);
     warnUnknown(unknown);
     const visible = flattenSomewhere(somewhere);
     const list: SyncedAgent[] = presenceMode === 'integrated'
       ? platformRoster
           .filter(p => visible.has(p.id) && p.venueId !== null)
           .map(p => ({
             id: p.id,
             name: p.displayName,
             avatarVariant: 0, // dead field for platform agents — identity drives appearance (D-25)
             spriteSeed: p.spriteSeed,
             location: p.venueId as string,
             ...(p.activity !== undefined ? { activity: p.activity } : {}),
           }))
       : agentsRef.current
           .filter(a => visible.has(a.id))
           .map(a => ({
             id: a.id,
             name: a.name,
             avatarVariant: a.avatarVariant,
             location: a.location,
           }));
     scene.syncAgents(list);
     ```

     b. Replace the poll body (currently the four-line `fetchAgentLocations` sequence inside `const poll = async () => { ... }`) with the mode branch — the fixture path stays byte-identical as the fall-through:

     ```ts
     const poll = async () => {
       if (presenceMode === 'integrated') {
         const result = await fetchPlatformLocations();
         if (stopped) return;
         if (result.ok) {
           GameTime.syncFrom(result.gameHour);
           platformRoster = result.roster;
           syncToScene();
           return;
         }
         if (result.reason === 'network') return; // keep last roster; retry next tick
         presenceMode = 'fixture'; // invalid schema — warned once in api.ts
       }
       const snap = await fetchAgentLocations();
       if (!snap || stopped) return;
       GameTime.syncFrom(snap.gameHour);
       useAgentStore.getState().applyLocations(snap.locations);
     };
     ```

     Keep that effect's dependency array as `[]`: in the merged file the poll
     effect sits ABOVE the `const syncToScene = useCallback(...)` declaration,
     so naming `syncToScene` in the dep array would evaluate it during render
     before initialization (TDZ crash); calling it inside the callback is safe
     because effects run after the component body completes, and
     `syncToScene` is a stable `useCallback([])` anyway. Nothing else in the
     file changes.

- [ ] Run: `npm run test --workspace=packages/client` — **expected PASS**: 6 tests pass in `api.test.ts`.

- [ ] Run: `npm run typecheck --workspace=packages/client` — **expected PASS** (no scene touches yet; `SyncedAgent.activity`/`spriteSeed` are optional, so `syncAgents` consumers compile unchanged).

- [ ] Commit: `feat(client): fixture/integrated presence mode switch + tolerant platform parser feeding PresenceModel (addendum II.1/II.2, D-20 fallback hygiene)`

---

## Task 3 — Activity label on the agent sprite + platform identity forwarding (D-25)

**Files:**
- Create `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/agents/activityLabel.ts`
- Create `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/agents/activityLabel.test.ts`
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/agents/AgentSprite.ts`
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/scenes/DistrictScene.ts` (`syncAgents` only)
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/scenes/InteriorScene.ts` (`syncAgents` only)

**Interfaces:**
- `const ACTIVITY_LABEL_MAX_CHARS = 24`
- `function formatActivityLabel(activity: string | undefined): string | null` — pure; `null` when there is nothing to render
- `AgentSprite.setActivity(activity?: string): void` — creates/updates/removes a small text under the sprite, styled like the existing `nameLabel`
- D-25 wiring: both scenes' `syncAgents` forward `SyncedAgent.spriteSeed` (present only for platform agents, Task 2) as `AgentSprite`'s existing optional `identity` constructor arg — platform agents render as seed-derived premade humans via the shipped `AppearanceResolver` path; fixture agents pass `undefined` and keep the legacy variant path, byte-identically.

The label follows the `nameLabel` pattern (a `Phaser.GameObjects.Text` outside the container's own transform, repositioned in `update()`, `NAME_LABEL_DEPTH`, monospace + `UI.ink900` stroke — `UI` comes from `../palette.js`, AgentSprite.ts:6). It sits just below the feet, is absent when `activity` is `undefined` (the client renders nothing the platform did not assert), and is capped at 24 characters. Note (re-anchored 2026-07-30): the merged sprite NEVER hides the name label — there is no `hideInside()`; the sleep path is `sleepOutside()`/`wakeUp()` (AgentSprite.ts:247-263) and neither touches label visibility — so the activity plate needs no visibility mirroring, only position tracking. Phaser itself is not unit-tested (it needs a browser canvas); the pure formatter is, and the sprite/scene wiring is verified by typecheck.

**Steps:**

- [ ] Write the failing test, `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/agents/activityLabel.test.ts` — FULL code:

  ```ts
  // Addendum O-2 #1: the coarse "what" label. Absent when the platform asserted
  // nothing; capped so it never dwarfs the name plate.
  import { describe, expect, it } from 'vitest';
  import { ACTIVITY_LABEL_MAX_CHARS, formatActivityLabel } from './activityLabel.js';

  describe('formatActivityLabel', () => {
    it('returns null when the platform asserted no activity', () => {
      expect(formatActivityLabel(undefined)).toBeNull();
      expect(formatActivityLabel('')).toBeNull();
      expect(formatActivityLabel('   ')).toBeNull();
    });

    it('passes short labels through trimmed', () => {
      expect(formatActivityLabel(' sleeping ')).toBe('sleeping');
    });

    it('caps at 24 characters with an ellipsis', () => {
      const long = 'contemplating the nature of city goals';
      const label = formatActivityLabel(long);
      expect(label).toHaveLength(ACTIVITY_LABEL_MAX_CHARS);
      expect(label).toBe(`${long.slice(0, ACTIVITY_LABEL_MAX_CHARS - 1)}…`);
    });

    it('keeps a label of exactly 24 characters intact', () => {
      const exact = 'x'.repeat(ACTIVITY_LABEL_MAX_CHARS);
      expect(formatActivityLabel(exact)).toBe(exact);
    });
  });
  ```

- [ ] Run: `npm run test --workspace=packages/client` — **expected FAIL**: `activityLabel.test.ts` cannot resolve `./activityLabel.js`.

- [ ] Implement `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/agents/activityLabel.ts` — FULL code:

  ```ts
  /**
   * Addendum O-2 #1 "where + what": the agent's activity caption ("sleeping",
   * "working") — a coarse label from the routine slot, arriving in AgentPresence
   * only in integrated mode. Pure function: the sprite is left with just drawing.
   */

  /** Cap for the on-sprite activity label, characters (incl. the ellipsis). */
  export const ACTIVITY_LABEL_MAX_CHARS = 24;

  /** null — draw no plate at all (the client renders nothing the platform did not assert). */
  export function formatActivityLabel(activity: string | undefined): string | null {
    const trimmed = activity?.trim();
    if (!trimmed) return null;
    if (trimmed.length <= ACTIVITY_LABEL_MAX_CHARS) return trimmed;
    return `${trimmed.slice(0, ACTIVITY_LABEL_MAX_CHARS - 1)}…`;
  }
  ```

- [ ] Run: `npm run test --workspace=packages/client` — **expected PASS** (10 tests total).

- [ ] Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/agents/AgentSprite.ts` — five surgical changes, exact code:

  1. Add the import (after the `assetManifest.js` import block):

     ```ts
     import { formatActivityLabel } from './activityLabel.js';
     ```

  2. Add the field, directly under `private nameLabel: Phaser.GameObjects.Text;`:

     ```ts
     /** Addendum O-2 #1: activity plate under the feet; null — the platform asserted nothing. */
     private activityLabel: Phaser.GameObjects.Text | null = null;
     ```

  3. Add the method, directly after `standUp()`:

     ```ts
     /** Addendum O-2 #1 "where + what": show/update/remove the activity caption. */
     setActivity(activity?: string) {
       const text = formatActivityLabel(activity);
       if (text === null) {
         this.activityLabel?.destroy();
         this.activityLabel = null;
         return;
       }
       if (!this.activityLabel) {
         // Same recipe as nameLabel: outside the container, above props-above.
         // No visibility mirroring: the merged sprite never hides nameLabel.
         this.activityLabel = this.scene.add.text(this.x, this.y + 3, text, {
           fontSize: '6px',
           color: UI.textOnDark,
           fontFamily: 'monospace',
           stroke: UI.ink900,
           strokeThickness: 2,
         }).setOrigin(0.5, 0).setDepth(NAME_LABEL_DEPTH).setAlpha(0.85);
       } else {
         this.activityLabel.setText(text);
       }
     }
     ```

  4. Track position with the name plate (re-anchored 2026-07-30: there is no
     `hideInside()` and nothing ever calls `nameLabel.setVisible`, so there
     is NO visibility edit) — in `update()`, directly after the existing
     multi-line call

     ```ts
     this.nameLabel.setPosition(
       this.x,
       this.y - this.variantDef.frameHeight * this.variantDef.scale - 6,
     );
     ```

     add:

     ```ts
     this.activityLabel?.setPosition(this.x, this.y + 3);
     ```

  5. In `destroy()`, add before `this.nameLabel.destroy();`:

     ```ts
     this.activityLabel?.destroy();
     ```

- [ ] Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/scenes/DistrictScene.ts` `syncAgents` — three exact changes:

  1. After the existing `const locOf = new Map(fullList.map(a => [a.id, a.location]));` add:

     ```ts
     const activityOf = new Map(present.map(a => [a.id, a.activity]));
     ```

  2. Inside the `this.agentSprites.forEach((sprite, id) => { if (incoming.has(id)) { ... } ... })` branch, after `if (this.leaving.delete(id)) sprite.cancelGoal();` add:

     ```ts
     sprite.setActivity(activityOf.get(id));
     ```

  3. In the `present.forEach((a) => { ... })` creation block, replace the constructor call

     ```ts
     const sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, x, y);
     ```

     with (D-25: platform agents carry `spriteSeed` → derived appearance; fixture agents pass `undefined` and keep the legacy variant path):

     ```ts
     const sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, x, y,
       a.spriteSeed !== undefined ? { spriteSeed: a.spriteSeed, gender: '' } : undefined);
     sprite.setActivity(a.activity);
     ```

     (`gender: ''` is honest: the platform payload carries no gender — spec I.4 — and the appearance normaliser maps unrecognised input to the neutral build, never branching on raw values.)

- [ ] Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/scenes/InteriorScene.ts` `syncAgents` (re-anchored 2026-07-30 — the merged loop is slot-based, `agentList.forEach(a => { ... })` with a `let sprite = this.agentSprites.get(a.id); if (!sprite) { ... }` create-if-missing block, InteriorScene.ts:286-292; there is no early-return for existing sprites). Replace

  ```ts
      let sprite = this.agentSprites.get(a.id);
      if (!sprite) {
        sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, this.spawnPoint.x, this.spawnPoint.y);
        this.agentSprites.set(a.id, sprite);
      }
  ```

  with

  ```ts
      let sprite = this.agentSprites.get(a.id);
      if (!sprite) {
        sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, this.spawnPoint.x, this.spawnPoint.y,
          a.spriteSeed !== undefined ? { spriteSeed: a.spriteSeed, gender: '' } : undefined);
        this.agentSprites.set(a.id, sprite);
      }
      sprite.setActivity(a.activity);
  ```

  — one edit covers both branches: newly created and already-present sprites get the current label.

- [ ] Run: `npm run typecheck --workspace=packages/client` — **expected PASS**. Run: `npm run test --workspace=packages/client` — **expected PASS** (still 10).

- [ ] Manual smoke (fixture mode, no env vars): `npm run dev` from the repo root, open http://localhost:5173 — agents render exactly as before (legacy variants, no derived appearances: fixture `SyncedAgent`s carry no `spriteSeed`), and **no** activity labels appear (fixture presence has no `activity`). This is the "renders nothing not asserted" check.

- [ ] Commit: `feat(client): activity label under agent sprites (addendum O-2 #1) + platform identity forwarding (D-25)`

---

## Task 4 — Minimal venue-notes overlay (integrated mode only)

**Files:**
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.ts` (add `VenueNote` + `fetchVenueNotes`)
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.test.ts` (add the `fetchVenueNotes` describe block)
- Create `/Users/home/aisocialnetwork-BotVille/packages/client/src/ui/VenueNotes/VenueNotesPanel.tsx`
- Create `/Users/home/aisocialnetwork-BotVille/packages/client/src/ui/VenueNotes/VenueNotesPanel.module.css`
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/i18n/en.ts` (two keys)
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/App.tsx` (mount, integrated mode only)

**Interfaces:**
- `interface VenueNote { id: string; body: string; createdAt: string }` — `createdAt` is an ISO-8601 string, exactly what the platform's `VenueNoteSchema` serialises (Plan 01 Task 1)
- `const VENUE_NOTES_MAX_SHOWN = 10`
- `async function fetchVenueNotes(venueId: string): Promise<VenueNote[]>` — GET `${PLATFORM_API_BASE}/api/public/botville/venues/:venueId/notes`, tolerant parse of the platform controller's `{ success, venueId, notes: [...] }` shape (Plan 01 Task 6 — no `data` envelope), newest first, max 10, `[]` on any failure
- `function VenueNotesPanel(): JSX.Element | null` — DOM overlay, follows the existing `ui/` panel pattern (CSS module + `theme.css` tokens + `useT()` i18n); scene → venueId is parsed from the scene key (re-anchored 2026-07-30: `INTERIORS` no longer exists — `game/config.ts:13` points to the venue registry; interiors register under `sceneKeyFor(venue.id)` = `` `VenueScene:${venueId}` ``, `game/venueRegistry.ts:50-52`), which covers ALL interiors — café, library, office, dorm and the 13 houses — with zero hardcoded venue ids

**Steps:**

- [ ] Add the failing tests — append this describe block to `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.test.ts` — FULL code of the addition:

  ```ts
  describe('fetchVenueNotes', () => {
    const NOTES_ENV = {
      VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL,
      VITE_PLATFORM_API_BASE: 'https://platform.test',
    };

    it('returns [] without fetching when VITE_PLATFORM_API_BASE is unset', async () => {
      const api = await importApi({ VITE_PLATFORM_API_BASE: '' });
      const fetchSpy = vi.fn();
      vi.stubGlobal('fetch', fetchSpy);
      expect(await api.fetchVenueNotes('cafe')).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('returns at most 10 notes, newest first, skipping malformed rows', async () => {
      const api = await importApi(NOTES_ENV);
      // createdAt is ISO-8601, per the platform's VenueNoteSchema.
      const iso = (i: number) => new Date(Date.UTC(2026, 6, 29, 12, 0, i)).toISOString();
      const raw = [
        ...Array.from({ length: 12 }, (_, i) => ({ id: `n${i}`, body: `note ${i}`, createdAt: iso(i) })),
        { id: 'bad-no-body' },
      ];
      const fetchSpy = vi.fn(async () => jsonResponse({ success: true, venueId: 'cafe', notes: raw }));
      vi.stubGlobal('fetch', fetchSpy);
      const notes = await api.fetchVenueNotes('cafe');
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://platform.test/api/public/botville/venues/cafe/notes',
        expect.anything(),
      );
      expect(notes).toHaveLength(10);
      expect(notes[0]).toEqual({ id: 'n11', body: 'note 11', createdAt: iso(11) });
      expect(notes[9]).toEqual({ id: 'n2', body: 'note 2', createdAt: iso(2) });
    });

    it('returns [] on network error or non-array payloads', async () => {
      const api = await importApi(NOTES_ENV);
      vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down'); }));
      expect(await api.fetchVenueNotes('cafe')).toEqual([]);
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ success: true, venueId: 'cafe', notes: 'nope' })));
      expect(await api.fetchVenueNotes('cafe')).toEqual([]);
    });
  });
  ```

- [ ] Run: `npm run test --workspace=packages/client` — **expected FAIL**: the three new tests error (`fetchVenueNotes` is not exported).

- [ ] Implement — append to `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.ts` (after the integrated-mode block from Task 2) — FULL code of the addition:

  ```ts
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
  ```

- [ ] Run: `npm run test --workspace=packages/client` — **expected PASS** (13 tests).

- [ ] Create `/Users/home/aisocialnetwork-BotVille/packages/client/src/ui/VenueNotes/VenueNotesPanel.tsx` — FULL code:

  ```tsx
  import { useEffect, useState } from 'react';
  import { useUIStore } from '../../store/agentStore.js';
  import { fetchVenueNotes, type VenueNote } from '../../lib/api.js';
  import { useT } from '../../i18n/index.js';
  import styles from './VenueNotesPanel.module.css';

  // Addendum II.6 "render notes": a minimal venue-notes overlay.
  // Mounted from App.tsx ONLY in integrated mode; in fixture mode it does not exist at all.
  // Scene → venueId: interiors register under sceneKeyFor(venue.id) =
  // `VenueScene:<venueId>` (game/venueRegistry.ts), so the id is parsed from
  // the scene key — every interior, houses included, no hardcoded list.

  const VENUE_SCENE_PREFIX = 'VenueScene:';

  function venueIdOf(scene: string): string | null {
    return scene.startsWith(VENUE_SCENE_PREFIX) ? scene.slice(VENUE_SCENE_PREFIX.length) : null;
  }

  export function VenueNotesPanel() {
    const t = useT();
    const currentScene = useUIStore(s => s.currentScene);
    const [notes, setNotes] = useState<VenueNote[]>([]);
    const venueId = venueIdOf(currentScene);

    useEffect(() => {
      if (!venueId) { setNotes([]); return; }
      let cancelled = false;
      void fetchVenueNotes(venueId).then(list => {
        if (!cancelled) setNotes(list);
      });
      return () => { cancelled = true; };
    }, [venueId]);

    if (!venueId) return null;

    return (
      <div className={styles.panel}>
        <div className={styles.title}>{t('venueNotes.title')}</div>
        {notes.length === 0
          ? <div className={styles.empty}>{t('venueNotes.empty')}</div>
          : (
            <ul className={styles.list}>
              {notes.map(n => <li key={n.id} className={styles.note}>{n.body}</li>)}
            </ul>
          )}
      </div>
    );
  }
  ```

- [ ] Create `/Users/home/aisocialnetwork-BotVille/packages/client/src/ui/VenueNotes/VenueNotesPanel.module.css` — FULL code (tokens from `ui/theme.css`, same family as the existing `HUD` module CSS):

  ```css
  /* Addendum II.6: floating venue-notes card (integrated mode). */

  .panel {
    position: fixed; left: 12px; bottom: 12px; z-index: 250; pointer-events: all;
    width: 240px; max-height: 40vh; overflow-y: auto;
    background: var(--panel-bg); border: 1px solid var(--ink-line);
    border-radius: var(--radius-lg); padding: 12px;
    font-family: 'Courier New', monospace; color: var(--text-on-dark);
    box-shadow: var(--shadow-lg);
  }
  .title { font-size: 12px; font-weight: bold; margin-bottom: 8px; }
  .empty { font-size: 11px; color: var(--text-on-dark-muted); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
  .note { font-size: 11px; line-height: 1.4; border-top: 1px solid var(--ink-line); padding-top: 6px; overflow-wrap: break-word; }
  .note:first-child { border-top: none; padding-top: 0; }
  ```

- [ ] Add the i18n keys. In `/Users/home/aisocialnetwork-BotVille/packages/client/src/i18n/en.ts`, before the closing `};` of the dictionary add:

  ```ts
  // Addendum II.6: venue notes overlay (integrated mode only)
  'venueNotes.title': '📝 Notes here',
  'venueNotes.empty': 'No notes yet.',
  ```

  `en.ts` is the only dictionary — `TKey` is derived from it, so both keys must land there for `useT()` to resolve them under `typecheck`.

- [ ] Mount it in `/Users/home/aisocialnetwork-BotVille/packages/client/src/App.tsx`. Add the imports:

  ```ts
  import { VenueNotesPanel } from './ui/VenueNotes/VenueNotesPanel.js';
  import { PRESENCE_MODE } from './lib/api.js';
  ```

  and inside the `<div id="ui-overlay">` block, after `<HUD />`:

  ```tsx
  {PRESENCE_MODE === 'integrated' && <VenueNotesPanel />}
  ```

  Fixture mode skips the component entirely — it is never mounted, no fetches, no DOM.

- [ ] Run: `npm run typecheck --workspace=packages/client` — **expected PASS**. Run: `npm run test --workspace=packages/client` — **expected PASS** (13).

- [ ] Manual smoke (fixture mode): `npm run dev`, enter the café — no notes panel exists in the DOM.

- [ ] Commit: `feat(client): venue-notes overlay on interior enter, integrated mode only (addendum II.4/II.6)`

---

## Task 5 — Fixture-generator note + two-mode docs

**Files:**
- Edit `/Users/home/aisocialnetwork-BotVille/packages/server/src/world/agentLife.ts` (doc comment only — zero behaviour change)
- Edit `/Users/home/aisocialnetwork-BotVille/README.md` (new section)

**Steps:**

- [ ] In `/Users/home/aisocialnetwork-BotVille/packages/server/src/world/agentLife.ts`, extend the module doc comment: after the line `* agent looks and walks within a location is client-side cosmetics.` (end of the first paragraph), insert:

  ```ts
   *
   * World addendum II.2 (2026-07-29): this module is the FIXTURE-MODE world
   * generator. In integrated mode (client built with VITE_PLATFORM_LOCATIONS_URL)
   * the platform api computes presence and the client never reads this server's
   * locations — but nothing here changes for that: fixture mode must stay fully
   * self-contained and is the default whenever the env var is absent.
  ```

- [ ] In `/Users/home/aisocialnetwork-BotVille/README.md`, insert the following section verbatim, directly after the `## Stack` section's closing code fence and the `Design notes: [ARCHITECTURE.md](ARCHITECTURE.md).` line:

  ```md
  ## Presence modes

  BotVille runs in one of two modes, chosen at client build time (world
  addendum, spec §II.1–II.2):

  - **Fixture mode** (the default — no env vars set). This repo's server is the
    world: `packages/server/src/world/agentLife.ts` moves agents between the six
    venues on a schedule and the client polls `GET /api/agents/locations`.
    Fully self-contained; nothing outside this repo is required.
  - **Integrated mode.** The platform api owns presence. The client polls the
    platform's versioned `LocationsSnapshot` endpoint instead and renders
    exactly what the platform asserts — nothing more. An agent at a venue this
    client does not recognise is rendered absent (one console warning per venue
    id), and an agent with `venueId: null` is simply not drawn.

  | Env var (client build time) | Meaning |
  |---|---|
  | `VITE_PLATFORM_LOCATIONS_URL` | Full URL of the platform locations endpoint (e.g. `https://<platform-host>/api/public/botville/locations` — canonical path per D-24). Setting it switches the client to integrated mode. |
  | `VITE_PLATFORM_API_BASE` | Base URL of the platform api, used for public venue reads (the venue-notes overlay). Integrated mode only. |

  If the platform responds with a snapshot whose `schemaVersion` is missing or
  below 2, the client logs one warning and falls back to fixture mode for the
  session.
  ```

- [ ] Verify: `npm run typecheck` (root) — **expected PASS** (comment/docs only). Re-read both diffs (`git diff packages/server/src/world/agentLife.ts README.md`) and confirm no code lines changed in `agentLife.ts`.

- [ ] Commit: `docs: fixture vs integrated presence modes, env vars, fixture-generator note (addendum II.2/II.6)`

---

## Done means

- `npm test` (root) runs the whole shipped suite green PLUS this plan's additions: the two new shared-type tests in `test/shared-types.test.ts` and — via the appended `turbo run test` — 13 vitest tests in the client.
- `npm run typecheck` green across the workspace.
- Fixture mode is visually indistinguishable from before this plan (no labels, no notes panel, legacy avatar variants, same polling), and the F-3 `presenceModel` pipeline is still the single presence authority in both modes.
- Nothing under `docs/superpowers/plans/2026-07-27-botville-visual-assets/` was modified; `AGENT_LOCATIONS` in `packages/shared/src/types/Agent.ts` still lists exactly the original six venues; the pre-existing test at `test/shared-types.test.ts:43` is byte-identical.
- `packages/client/src/lib/api.ts` no longer mentions Railway or Vercel (D-20).
