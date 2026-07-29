# Plan 03 — BotVille: fixture/integrated seam, tolerant client repoint, activity + notes

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-29-botville-world-addendum-design.md` — Part II.1/II.2 (fixture vs integrated modes, the HTTP seam), Part I.4 (`LocationsSnapshot` / `AgentPresence`), and the binding Conventions section.

**Target repo:** `/Users/home/aisocialnetwork-BotVille` (this repo). All paths below are absolute.

## Goal

Give the BotVille client the minimal integration seam to the platform: a schema-versioned `LocationsSnapshot`/`AgentPresence` type pair in `@botville/shared` (spec I.4, exact field names), a build-time fixture/integrated mode switch with a tolerant platform-snapshot parser in the client, a coarse `activity` label on agent sprites, and a minimal venue-notes overlay in integrated mode. Fixture mode (the current `agentLife.ts` + `GET /api/agents/locations` path) stays byte-for-byte behaviourally unchanged and fully self-contained.

## Architecture

The platform api owns world truth in integrated mode; BotVille is presentation only, and the client polls the platform's `LocationsSnapshot` endpoint instead of its own server — same seam, indistinguishable to the scenes (spec II.1). The mode is picked once at client module scope from `VITE_PLATFORM_LOCATIONS_URL`; an invalid platform snapshot (missing/`< 2` `schemaVersion`) degrades to fixture mode for the session with exactly one warning. Presence maps to the client's existing `SyncedAgent` pipeline: known `venueId` → the existing six-location render path, `venueId: null` → absent, unrecognised `venueId` → `unknown` → rendered absent with one `console.warn` per venue id (the spec's three presence states).

## Tech Stack

- TypeScript 5.7, ESM everywhere, npm workspaces + turbo.
- `packages/shared` — plain TS types (`main`/`types` point at `src/index.ts`); new tests via `node --test` with native type stripping + `tsc --noEmit` for compile-time assertions.
- `packages/client` — Vite 6 + React 18 + Zustand + Phaser 3.88; new tests via **vitest** (added by this plan — the client has no test runner today, only `tsc --noEmit` typecheck).
- `packages/server` — Express + SQLite; **not modified** except a doc comment in `world/agentLife.ts`.

## Global Constraints

- **Node >= 24, ESM only** (`engines` in root `package.json`). Dev machines on Node >= 22.18 still run `node --test` on `.ts` files (type stripping is default-on from 22.18); do not add a transpile step for tests.
- **Spec Conventions (binding):** one canonical schema per boundary shape and nothing parses what it can validate; declarative naming (`derive<Thing>` for pure derivations, `SCREAMING_SNAKE` constants with the unit/meaning in the name, no abbreviations); a field carries the same name across every layer (`venueId` stays `venueId`). Any drift from spec I.4's exact field names is a defect.
- **Restated I-11:** "the client renders nothing the platform did not assert." Required `AgentPresence` fields are exactly `id`, `displayName`, `spriteSeed`, `venueId`; everything beyond them is optional-and-ignorable.
- **Visual-assets territory is off limits:** do not touch anything under `docs/superpowers/plans/2026-07-27-botville-visual-assets/`, no art/asset work, no venue registry or archetype/instancing code, no changes to the `AGENT_LOCATIONS` six-venue vocabulary in `packages/shared/src/types/Agent.ts`. Those plans reference a future `packages/shared/src/types/Assets.ts` with an "exactly four fields" `AgentPresence` invariant; the addendum I.4 supersedes that invariant (four **required** fields, additions optional). This plan claims the canonical location `packages/shared/src/types/LocationsSnapshot.ts`; whichever plan executes second must import/re-export from it rather than redefine — recorded here, not by editing their files.
- **Fixture path unchanged:** `fetchAgentLocations()`, `GET /api/agents/locations` (legacy shape, no `schemaVersion`), `applyLocations`, and `agentLife.ts` behaviour are not modified.
- **Do not commit on `main`;** work happens on the executing session's feature branch. Each task ends in its own commit.

---

## Task 1 — Shared types: `LocationsSnapshot` v2 (spec I.4, exact names)

**Files:**
- Create `/Users/home/aisocialnetwork-BotVille/packages/shared/src/types/LocationsSnapshot.ts`
- Edit `/Users/home/aisocialnetwork-BotVille/packages/shared/src/index.ts`
- Create `/Users/home/aisocialnetwork-BotVille/packages/shared/test/locations-snapshot.test.ts`
- Create `/Users/home/aisocialnetwork-BotVille/packages/shared/tsconfig.test.json`
- Edit `/Users/home/aisocialnetwork-BotVille/packages/shared/package.json` (add `test` script)
- Edit `/Users/home/aisocialnetwork-BotVille/turbo.json` + `/Users/home/aisocialnetwork-BotVille/package.json` (root) — wire a `test` task

**Interfaces:**
- `interface AgentPresence { id: string; displayName: string; spriteSeed: string; venueId: string | null; activity?: string }`
- `interface LocationsSnapshot { schemaVersion: number; gameHour: number; locations: AgentPresence[] }`
- `const LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION = 2`

Note: the legacy fixture snapshot (`AgentLocationsSnapshot` in `packages/client/src/lib/api.ts`, `{ gameHour, locations: [{id, location}] }`) is **not** touched — the current server keeps serving it and the client keeps parsing it. No shared-types test exists in the repo today (verified 2026-07-29: zero `*.test.*` files anywhere), so this task creates the restated-I-11 test fresh; there is nothing to reconcile against yet.

**Steps:**

- [ ] Create `/Users/home/aisocialnetwork-BotVille/packages/shared/tsconfig.test.json`:

  ```json
  {
    "extends": "../../tsconfig.base.json",
    "compilerOptions": {
      "noEmit": true,
      "allowImportingTsExtensions": true,
      "types": ["node"]
    },
    "include": ["src/**/*", "test/**/*"]
  }
  ```

- [ ] In `/Users/home/aisocialnetwork-BotVille/packages/shared/package.json`, add to `"scripts"`:

  ```json
  "test": "tsc -p tsconfig.test.json && node --test \"test/*.test.ts\""
  ```

- [ ] In `/Users/home/aisocialnetwork-BotVille/turbo.json`, add to `"tasks"`:

  ```json
  "test": {
    "dependsOn": ["^build"]
  }
  ```

  and in root `/Users/home/aisocialnetwork-BotVille/package.json` add to `"scripts"`: `"test": "turbo test"`. (If a `test` task already exists by execution time — another plan landed first — reuse it as-is; do not duplicate.)

- [ ] Write the failing test, `/Users/home/aisocialnetwork-BotVille/packages/shared/test/locations-snapshot.test.ts` — FULL code:

  ```ts
  // Addendum I.4: LocationsSnapshot / AgentPresence — the versioned seam payload.
  // Runtime half runs under `node --test` (native type stripping); the
  // @ts-expect-error half is enforced by `tsc -p tsconfig.test.json`.
  // Restated I-11: the four original fields are required and unrenamed;
  // every addition beyond them is optional-and-ignorable.
  import { test } from 'node:test';
  import assert from 'node:assert/strict';
  import type { AgentPresence, LocationsSnapshot } from '../src/index.ts';
  import { LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION } from '../src/index.ts';

  const presence: AgentPresence = {
    id: '3f2b6c1e-0000-4000-8000-000000000001',
    displayName: 'Ada',
    spriteSeed: 'ada_lovelace',
    venueId: 'cafe',
  };

  test('AgentPresence: the four original fields are required and exactly named', () => {
    assert.deepEqual(
      Object.keys(presence).sort(),
      ['displayName', 'id', 'spriteSeed', 'venueId'],
    );
    // @ts-expect-error venueId is required (null means absent; missing is illegal)
    const missingVenue: AgentPresence = { id: 'x', displayName: 'X', spriteSeed: 'x' };
    void missingVenue;
  });

  test('AgentPresence: additions beyond the four are optional-and-ignorable', () => {
    const withActivity: AgentPresence = { ...presence, activity: 'working' };
    assert.equal(withActivity.activity, 'working');
    const withoutActivity: AgentPresence = presence; // compiles with no activity
    assert.equal(withoutActivity.activity, undefined);
  });

  test('AgentPresence: venueId null (absent) is legal', () => {
    const absent: AgentPresence = { ...presence, venueId: null };
    assert.equal(absent.venueId, null);
  });

  test('LocationsSnapshot: schemaVersion is required; platform snapshots start at 2', () => {
    const snapshot: LocationsSnapshot = {
      schemaVersion: LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION,
      gameHour: 13.5,
      locations: [presence],
    };
    assert.equal(snapshot.schemaVersion, 2);
    assert.equal(snapshot.locations.length, 1);
    // @ts-expect-error schemaVersion is required on the v2 snapshot
    const unversioned: LocationsSnapshot = { gameHour: 0, locations: [] };
    void unversioned;
  });
  ```

- [ ] Run: `npm run test --workspace=packages/shared` — **expected FAIL**: `tsc` errors with `TS2305: Module '"../src/index.ts"' has no exported member 'AgentPresence'` (and `LocationsSnapshot`, `LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION`).

- [ ] Implement `/Users/home/aisocialnetwork-BotVille/packages/shared/src/types/LocationsSnapshot.ts` — FULL code:

  ```ts
  /**
   * World addendum I.4 (2026-07-29): the versioned locations payload the
   * platform serves in integrated mode (`GET /api/botville/locations`, spec
   * II.2). This interface is the CANONICAL schema for the HTTP seam
   * (Conventions table); the platform api mirrors it with a zod validator.
   *
   * Restated I-11: the four original AgentPresence fields are required and
   * unrenamed forever; anything beyond them is optional-and-ignorable — the
   * client renders nothing the platform did not assert.
   *
   * The legacy fixture snapshot ({ gameHour, locations: [{ id, location }] },
   * served by this repo's own server) is a separate, unversioned shape and is
   * deliberately NOT defined here.
   */

  /** Platform snapshots carry schemaVersion >= 2; below that the client falls back to fixture mode. */
  export const LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION = 2;

  export interface AgentPresence {
    /** Platform agent uuid. */
    id: string;
    displayName: string;
    /** Stable and unique — the platform username; seeds the client-side avatar pick. */
    spriteSeed: string;
    /** null = absent; a value the client does not recognise = unknown (rendered absent). */
    venueId: string | null;
    /** Coarse label from the routine slot ("sleeping", "working"). Optional-and-ignorable. */
    activity?: string;
  }

  export interface LocationsSnapshot {
    /** Bumps on any breaking change to this payload. */
    schemaVersion: number;
    gameHour: number;
    locations: AgentPresence[];
  }
  ```

- [ ] In `/Users/home/aisocialnetwork-BotVille/packages/shared/src/index.ts`, add the export line (after the existing five):

  ```ts
  export * from './types/LocationsSnapshot.js';
  ```

- [ ] Run: `npm run test --workspace=packages/shared` — **expected PASS**: `tsc` clean, then `node --test` reports `# pass 4`, `# fail 0` (an `ExperimentalWarning: Type Stripping` line on Node 22 is fine).

- [ ] Run: `npm run typecheck` (root, turbo) — **expected PASS** (no consumer breaks; the new file is additive).

- [ ] Commit: `feat(shared): LocationsSnapshot v2 + AgentPresence per addendum I.4, with restated-I-11 type test`

---

## Task 2 — Tolerant client parser + fixture/integrated mode switch

**Files:**
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.ts` (additive block; `fetchAgentLocations` untouched)
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/hooks/useGameSync.ts` (full rewrite below)
- Create `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.test.ts`
- Edit `/Users/home/aisocialnetwork-BotVille/packages/client/package.json` (vitest + `test` script)
- Edit `/Users/home/aisocialnetwork-BotVille/turbo.json` (declare the two new `VITE_` env vars for build caching)

**Interfaces (new exports from `api.ts`):**
- `type PresenceMode = 'fixture' | 'integrated'`
- `const PRESENCE_MODE: PresenceMode` — picked once at module scope; `'integrated'` iff `VITE_PLATFORM_LOCATIONS_URL` is non-empty
- `const PLATFORM_API_BASE: string` — from `VITE_PLATFORM_API_BASE` (used by Task 4)
- `interface PresenceAgent { id: string; name: string; avatarVariant: number; location: AgentLocation; activity?: string }` — structurally the scenes' `SyncedAgent`
- `interface PlatformSnapshot { gameHour: number; agents: PresenceAgent[] }`
- `type PlatformLocationsResult = { ok: true; snapshot: PlatformSnapshot } | { ok: false; reason: 'network' | 'invalid-schema' }`
- `function deriveAvatarVariant(spriteSeed: string): number` — pure, deterministic (FNV-1a), range `[0, ANIMAL_VARIANT_MIN)` so platform agents always render as humans
- `async function fetchPlatformLocations(): Promise<PlatformLocationsResult>`

**Steps:**

- [ ] Install the client test runner: `npm install --save-dev --workspace=packages/client vitest@^3.2.4`, and add to `packages/client/package.json` `"scripts"`: `"test": "vitest run"`. Vitest picks up the existing `vite.config.ts` (React plugin + the `@botville/shared` alias) automatically; default `node` environment is correct — nothing under test touches `window` at import time.

- [ ] In `/Users/home/aisocialnetwork-BotVille/turbo.json`, extend the `build` task's env list:

  ```json
  "env": ["VITE_API_URL", "VITE_PLATFORM_LOCATIONS_URL", "VITE_PLATFORM_API_BASE"]
  ```

- [ ] Write the failing test, `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.test.ts` — FULL code:

  ```ts
  // Addendum II.1/II.2: the client half of the presence seam — mode pick,
  // tolerant LocationsSnapshot parsing, and the three presence states
  // (somewhere / absent / unknown). Module state (once-per-warn sets) is reset
  // between tests via vi.resetModules() + dynamic import.
  import { afterEach, describe, expect, it, vi } from 'vitest';
  import { ANIMAL_VARIANT_MIN } from '@botville/shared';

  type ApiModule = typeof import('./api.js');

  const PLATFORM_URL = 'https://platform.test/api/botville/locations';

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

  describe('deriveAvatarVariant', () => {
    it('is deterministic and stays inside the human variant range', async () => {
      const api = await importApi({});
      for (const seed of ['ada', 'bob', 'a-very-long-username-seed', '']) {
        const variant = api.deriveAvatarVariant(seed);
        expect(variant).toBe(api.deriveAvatarVariant(seed));
        expect(variant).toBeGreaterThanOrEqual(0);
        expect(variant).toBeLessThan(ANIMAL_VARIANT_MIN);
      }
    });
  });

  describe('fetchPlatformLocations', () => {
    it('maps AgentPresence to the SyncedAgent inputs', async () => {
      const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(validSnapshot)));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = await api.fetchPlatformLocations();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.gameHour).toBe(13.5);
      expect(result.snapshot.agents).toEqual([
        {
          id: 'uuid-1',
          name: 'Ada',
          avatarVariant: api.deriveAvatarVariant('ada'),
          location: 'cafe',
          activity: 'reading',
        },
      ]);
      // uuid-2: venueId null -> absent, no warn. uuid-3: unknown venue -> absent + one warn.
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0][0])).toContain('observatory');
    });

    it('warns once per unknown venueId across polls', async () => {
      const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse(validSnapshot)));
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      await api.fetchPlatformLocations();
      await api.fetchPlatformLocations();
      expect(warn).toHaveBeenCalledTimes(1);
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

    it('skips malformed rows instead of failing the poll', async () => {
      const api = await importApi({ VITE_PLATFORM_LOCATIONS_URL: PLATFORM_URL });
      vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({
        schemaVersion: 2,
        gameHour: 1,
        locations: [
          { id: 42 },
          null,
          { id: 'ok', displayName: 'Ok', spriteSeed: 'ok', venueId: 'office' },
        ],
      })));
      const result = await api.fetchPlatformLocations();
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.snapshot.agents.map(a => a.id)).toEqual(['ok']);
    });
  });
  ```

- [ ] Run: `npm run test --workspace=packages/client` — **expected FAIL**: every test errors at runtime because `./api.js` does not yet export `PRESENCE_MODE`, `deriveAvatarVariant`, `fetchPlatformLocations` (`undefined is not a function` / `.toBe('fixture')` on `undefined`).

- [ ] Implement the `api.ts` additions. In `/Users/home/aisocialnetwork-BotVille/packages/client/src/lib/api.ts`, replace the first import line

  ```ts
  import type { AgentLocation, CatalogModel, LLMProviderType, UserKeyStatus } from '@botville/shared';
  ```

  with

  ```ts
  import type { AgentLocation, AgentPresence, CatalogModel, LLMProviderType, LocationsSnapshot, UserKeyStatus } from '@botville/shared';
  import {
    AGENT_LOCATIONS,
    ANIMAL_VARIANT_MIN,
    LOCATIONS_SNAPSHOT_MIN_PLATFORM_SCHEMA_VERSION,
  } from '@botville/shared';
  ```

  then append this block at the end of the "Agent locations (TZ-16)" section, directly after `fetchAgentLocations` (which stays exactly as it is — it IS the fixture-mode path) — FULL code of the added block:

  ```ts
  // ── Integrated mode (world addendum II.1/II.2): the platform presence seam ──
  // The platform api owns presence; this client renders nothing the platform
  // did not assert (restated I-11). fetchAgentLocations() above stays the
  // fixture-mode path, untouched.

  export type PresenceMode = 'fixture' | 'integrated';

  const PLATFORM_LOCATIONS_URL: string =
    (import.meta.env.VITE_PLATFORM_LOCATIONS_URL as string | undefined) ?? '';

  /** Base URL of the platform api for public venue reads (venue-notes overlay). */
  export const PLATFORM_API_BASE: string =
    (import.meta.env.VITE_PLATFORM_API_BASE as string | undefined) ?? '';

  /** Picked once at module scope: integrated iff the platform URL is configured at build time. */
  export const PRESENCE_MODE: PresenceMode = PLATFORM_LOCATIONS_URL ? 'integrated' : 'fixture';

  /** What a scene needs to render one platform agent — structurally the scenes' SyncedAgent. */
  export interface PresenceAgent {
    id: string;
    name: string;
    avatarVariant: number;
    location: AgentLocation;
    activity?: string;
  }

  export interface PlatformSnapshot {
    gameHour: number;
    agents: PresenceAgent[];
  }

  export type PlatformLocationsResult =
    | { ok: true; snapshot: PlatformSnapshot }
    | { ok: false; reason: 'network' | 'invalid-schema' };

  /**
   * FNV-1a over spriteSeed → stable avatar pick in [0, ANIMAL_VARIANT_MIN):
   * platform agents always render as humans; the seed is the platform username,
   * so the pick survives reloads and is identical for every viewer.
   */
  export function deriveAvatarVariant(spriteSeed: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < spriteSeed.length; i++) {
      hash ^= spriteSeed.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0) % ANIMAL_VARIANT_MIN;
  }

  // Once-per-session warn state (module scope; tests reset via vi.resetModules).
  let warnedInvalidSchema = false;
  const warnedUnknownVenueIds = new Set<string>();

  function isKnownLocation(venueId: string): venueId is AgentLocation {
    return (AGENT_LOCATIONS as readonly string[]).includes(venueId);
  }

  /**
   * Poll the platform LocationsSnapshot endpoint (addendum II.2) and map it to
   * SyncedAgent inputs. Tolerant by construction: a malformed row is skipped,
   * an unknown venueId renders the agent absent (one warn per venue id), and a
   * snapshot without schemaVersion >= 2 signals fixture fallback (one warn).
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

    const agents: PresenceAgent[] = [];
    for (const entry of snap.locations as Array<Partial<AgentPresence> | null>) {
      if (
        typeof entry?.id !== 'string' ||
        typeof entry.displayName !== 'string' ||
        typeof entry.spriteSeed !== 'string' ||
        (entry.venueId !== null && typeof entry.venueId !== 'string')
      ) {
        continue; // tolerant: one malformed row never breaks the poll
      }
      if (entry.venueId === null) continue; // absent — render nothing
      if (!isKnownLocation(entry.venueId)) {
        if (!warnedUnknownVenueIds.has(entry.venueId)) {
          warnedUnknownVenueIds.add(entry.venueId);
          console.warn(
            `[presence] unknown venueId "${entry.venueId}" — rendering its agents as absent`,
          );
        }
        continue; // unknown — the third presence state, rendered absent
      }
      agents.push({
        id: entry.id,
        name: entry.displayName,
        avatarVariant: deriveAvatarVariant(entry.spriteSeed),
        location: entry.venueId,
        ...(typeof entry.activity === 'string' ? { activity: entry.activity } : {}),
      });
    }
    return { ok: true, snapshot: { gameHour: snap.gameHour, agents } };
  }
  ```

- [ ] Rewrite `/Users/home/aisocialnetwork-BotVille/packages/client/src/hooks/useGameSync.ts` — FULL file:

  ```ts
  import { useEffect, useRef, useCallback } from 'react';
  import { useAgentStore, useUIStore } from '../store/agentStore.js';
  import { sceneRegistry } from '../game/SceneRegistry.js';
  import { GameBridge } from '../game/GameBridge.js';
  import { GameTime } from '../game/time.js';
  import {
    fetchAgentLocations,
    fetchPlatformLocations,
    PRESENCE_MODE,
    type PresenceAgent,
    type PresenceMode,
  } from '../lib/api.js';
  import { LOCATION_POLL_MS } from '../game/config.js';
  import type { Agent, AgentLocation } from '@botville/shared';

  /** What a scene knows about an agent; location decides whether to draw it here (TZ-16). */
  export interface SyncedAgent {
    id: string;
    name: string;
    avatarVariant: number;
    location: AgentLocation;
    /** Addendum O-2 #1 «where + what»: coarse activity label; integrated mode only. */
    activity?: string;
  }

  /** Scenes the agent list is synced into (the district and all interiors). */
  interface AgentSyncScene extends Phaser.Scene {
    syncAgents(list: SyncedAgent[]): void;
  }

  function isSyncable(scene: Phaser.Scene | undefined): scene is AgentSyncScene {
    return !!scene && typeof (scene as Partial<AgentSyncScene>).syncAgents === 'function';
  }

  // Addendum II.1: the mode is picked ONCE at module scope from the build-time
  // env (PRESENCE_MODE). The only runtime transition is integrated → fixture
  // when the platform serves an invalid snapshot (one warn, in api.ts).
  let presenceMode: PresenceMode = PRESENCE_MODE;
  /** Latest platform roster; scene sync reads it instead of the store in integrated mode. */
  let platformAgents: PresenceAgent[] = [];

  export function useGameSync() {
    const { agents, fetchAgents } = useAgentStore();
    const { setScene } = useUIStore();
    const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const agentsRef = useRef<Agent[]>(agents);
    const sceneKeyRef = useRef('DistrictScene');

    // Keep ref current
    useEffect(() => { agentsRef.current = agents; }, [agents]);

    // Fetch on mount (HUD roster — the user's own agents, both modes)
    useEffect(() => {
      fetchAgents();
    }, [fetchAgents]);

    // Sync into the active scene; retries until it registers
    const syncToScene = useCallback((retries = 30) => {
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      const scene = sceneRegistry.get(sceneKeyRef.current);
      if (isSyncable(scene)) {
        const list: SyncedAgent[] = presenceMode === 'integrated'
          ? platformAgents
          : agentsRef.current.map(a => ({
              id: a.id,
              name: a.name,
              avatarVariant: a.avatarVariant,
              location: a.location,
            }));
        scene.syncAgents(list);
      } else if (retries > 0) {
        syncTimeoutRef.current = setTimeout(() => syncToScene(retries - 1), 400);
      }
    }, []);

    // TZ-16 + addendum II.2: "who is where" polling + game hour. Integrated —
    // the platform; fixture — this repo's own server. Whichever server it is,
    // it is the source of truth for location; the client only renders.
    useEffect(() => {
      let stopped = false;
      const poll = async () => {
        if (presenceMode === 'integrated') {
          const result = await fetchPlatformLocations();
          if (stopped) return;
          if (result.ok) {
            GameTime.syncFrom(result.snapshot.gameHour);
            platformAgents = result.snapshot.agents;
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
      void poll();
      const interval = setInterval(() => { void poll(); }, LOCATION_POLL_MS);
      return () => { stopped = true; clearInterval(interval); };
    }, [syncToScene]);

    // Sync whenever agents list changes (fixture pipeline; harmless when integrated)
    useEffect(() => {
      agentsRef.current = agents;
      syncToScene();
      return () => {
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
      };
    }, [agents, syncToScene]);

    // Scene change — sync agents into the new scene
    useEffect(() => {
      const handler = ({ scene }: { scene: string }) => {
        setScene(scene);
        sceneKeyRef.current = scene;
        // a short pause so Phaser finishes registering the new scene
        setTimeout(() => syncToScene(), 100);
      };
      GameBridge.on('scene:changed', handler);
      return () => { GameBridge.off('scene:changed', handler); };
    }, [setScene, syncToScene]);
  }
  ```

- [ ] Run: `npm run test --workspace=packages/client` — **expected PASS**: 8 tests pass in `api.test.ts`.

- [ ] Run: `npm run typecheck --workspace=packages/client` — **expected PASS** (no scene touches yet; `SyncedAgent.activity` is optional, so `syncAgents` consumers compile unchanged).

- [ ] Commit: `feat(client): fixture/integrated presence mode switch + tolerant platform LocationsSnapshot parser (addendum II.1/II.2)`

---

## Task 3 — Activity label on the agent sprite

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

The label follows the `nameLabel` pattern exactly (a `Phaser.GameObjects.Text` outside the container's own transform, repositioned in `update()`, `NAME_LABEL_DEPTH`, monospace + `UI.ink900` stroke). It sits just below the feet, is absent when `activity` is `undefined` (the client renders nothing the platform did not assert), and is capped at 24 characters. Phaser itself is not unit-tested (it needs a browser canvas); the pure formatter is, and the sprite/scene wiring is verified by typecheck.

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

- [ ] Run: `npm run test --workspace=packages/client` — **expected PASS** (12 tests total).

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
         this.activityLabel = this.scene.add.text(this.x, this.y + 3, text, {
           fontSize: '6px',
           color: UI.textOnDark,
           fontFamily: 'monospace',
           stroke: UI.ink900,
           strokeThickness: 2,
         }).setOrigin(0.5, 0).setDepth(NAME_LABEL_DEPTH).setAlpha(0.85);
         this.activityLabel.setVisible(this.nameLabel.visible);
       } else {
         this.activityLabel.setText(text);
       }
     }
     ```

  4. Track visibility and position with the name plate — in `hideInside()` add after `this.nameLabel.setVisible(false);`:

     ```ts
     this.activityLabel?.setVisible(false);
     ```

     in `wakeUp()` add after `this.nameLabel.setVisible(true);`:

     ```ts
     this.activityLabel?.setVisible(true);
     ```

     and in `update()` add directly after the existing `this.nameLabel.setPosition(...)` call:

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

  3. In the `present.forEach((a) => { ... })` creation block, directly after `const sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, x, y);` add:

     ```ts
     sprite.setActivity(a.activity);
     ```

- [ ] Edit `/Users/home/aisocialnetwork-BotVille/packages/client/src/game/scenes/InteriorScene.ts` `syncAgents` — replace the start of the creation loop

  ```ts
  agentList.forEach((a, i) => {
    if (this.agentSprites.has(a.id)) return;
  ```

  with

  ```ts
  agentList.forEach((a, i) => {
    const existing = this.agentSprites.get(a.id);
    if (existing) { existing.setActivity(a.activity); return; }
  ```

  and directly after `const sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, x, y);` add:

  ```ts
  sprite.setActivity(a.activity);
  ```

- [ ] Run: `npm run typecheck --workspace=packages/client` — **expected PASS**. Run: `npm run test --workspace=packages/client` — **expected PASS** (still 12).

- [ ] Manual smoke (fixture mode, no env vars): `npm run dev` from the repo root, open http://localhost:5173 — agents render exactly as before, **no** activity labels appear (fixture presence has no `activity`). This is the "renders nothing not asserted" check.

- [ ] Commit: `feat(client): activity label under agent sprites (addendum O-2 #1), absent unless asserted`

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
- `function VenueNotesPanel(): JSX.Element | null` — DOM overlay, follows the existing `ui/` panel pattern (CSS module + `theme.css` tokens + `useT()` i18n); scene → venueId comes from the existing `INTERIORS` map in `game/config.ts` (its map keys `office`/`cafe`/`dorm`/`library` are exactly the venue ids)

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

- [ ] Run: `npm run test --workspace=packages/client` — **expected PASS** (15 tests).

- [ ] Create `/Users/home/aisocialnetwork-BotVille/packages/client/src/ui/VenueNotes/VenueNotesPanel.tsx` — FULL code:

  ```tsx
  import { useEffect, useState } from 'react';
  import { useUIStore } from '../../store/agentStore.js';
  import { fetchVenueNotes, type VenueNote } from '../../lib/api.js';
  import { INTERIORS } from '../../game/config.js';
  import { useT } from '../../i18n/index.js';
  import styles from './VenueNotesPanel.module.css';

  // Addendum II.6 "render notes": a minimal venue-notes overlay.
  // Mounted from App.tsx ONLY in integrated mode; in fixture mode it does not exist at all.
  // Scene → venueId: the map keys in INTERIORS are exactly the interiors' venueIds.

  function venueIdOf(scene: string): string | null {
    return (INTERIORS as Record<string, string>)[scene] ?? null;
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

- [ ] Create `/Users/home/aisocialnetwork-BotVille/packages/client/src/ui/VenueNotes/VenueNotesPanel.module.css` — FULL code (tokens from `ui/theme.css`, same family as `KeysPanel.module.css`):

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

- [ ] Run: `npm run typecheck --workspace=packages/client` — **expected PASS**. Run: `npm run test --workspace=packages/client` — **expected PASS** (15).

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
  | `VITE_PLATFORM_LOCATIONS_URL` | Full URL of the platform locations endpoint (e.g. `https://<platform-host>/api/botville/locations`). Setting it switches the client to integrated mode. |
  | `VITE_PLATFORM_API_BASE` | Base URL of the platform api, used for public venue reads (the venue-notes overlay). Integrated mode only. |

  If the platform responds with a snapshot whose `schemaVersion` is missing or
  below 2, the client logs one warning and falls back to fixture mode for the
  session.
  ```

- [ ] Verify: `npm run typecheck` (root) — **expected PASS** (comment/docs only). Re-read both diffs (`git diff packages/server/src/world/agentLife.ts README.md`) and confirm no code lines changed in `agentLife.ts`.

- [ ] Commit: `docs: fixture vs integrated presence modes, env vars, fixture-generator note (addendum II.2/II.6)`

---

## Done means

- `npm run test` (root, turbo) runs shared + client suites green: 4 `node --test` assertions in shared, 15 vitest tests in client.
- `npm run typecheck` green across the workspace.
- Fixture mode is visually indistinguishable from before this plan (no labels, no notes panel, same polling).
- Nothing under `docs/superpowers/plans/2026-07-27-botville-visual-assets/` was modified, and `AGENT_LOCATIONS` still lists exactly the original six venues.
