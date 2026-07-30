# BotVille Visual Assets — Plan 3: The runtime registry

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Plan 3 of 6.** Index and sequencing: [`00-INDEX.md`](00-INDEX.md). Spec: `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md` (commit `d695881`) — approved, do not re-brainstorm.

**Goal:** Make the Phaser runtime read a registry instead of hand-written lists, so the data Plan 2 produced is what the game actually renders.

**Architecture:** `venueRegistry.ts` is the runtime authority — `get()` returning `undefined` for an unknown id is the `unknown` presence path, not an error. `InteriorScene` becomes `VenueScene`, parameterised by a descriptor, and the four subclasses are deleted. `PreloaderScene` and `GameInit` enumerate the registry. `PresenceModel` owns the three presence states. Two art-quality fixes land here because they are cheap once scenes are data-driven: a fixed camera zoom ladder and deterministic in-venue slot assignment.

**Tech Stack:** Node ≥24 (ESM), TypeScript 5.7, Phaser ^3.88.2 declared / 3.90.0 installed, Vite 6, npm workspaces + Turbo, `node:test` (no new test dependency), the existing `scripts/png-lib.mjs` PNG codec, Postgres (`aisocialnetwork-api` only), Docker Compose (local parity only — created by Plan 6 Task 35; no Docker artifact exists in the repo today).

**Depends on:** Plan 2 — `venues.json`, the generated registry module and the baked `.tmj` maps.

**Exit criterion:** All four interiors load and return to the district, the four subclass files are gone, `npm run typecheck` is clean, and `npm run build` succeeds. The city renders end to end on the fixture pack.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Node ≥ 24.** Root `package.json` `engines: { "node": ">=24.0.0" }`, `.nvmrc` = `24`. ESM: the three workspace packages (`client`, `server`, `shared`) each declare `"type": "module"`; the root `package.json` has **no** `type` key, so root-level scripts are ESM by their `.mjs` extension only.
- **No new npm dependencies.** Not in `packages/client`, not in `packages/server`, not at the root. Build tooling uses `node:` builtins plus the existing `scripts/png-lib.mjs`. Tests use `node:test` + `node:assert/strict`.
- **Build tooling is `.mjs` under `scripts/`; runtime is TypeScript under `packages/`.** Follow the existing split exactly.
- **Comments in `packages/client/` are English and load-bearing** — they record verified crop coordinates and frame layouts. Read them; preserve them and their intent; never delete or "clean up" an explanatory comment.
- **`SCHEMA_VERSION = 1`**, exported from `@botville/shared`, and included in every `appearanceHash`.
- **Path segment rename: `limezu/` → `pack/`** throughout `public/assets/`. No directory, key or string in committed code may name a vendor.
- **The `AgentPresence` boundary is four *required* fields** — `{ id, displayName, spriteSeed, venueId }`, required and unrenamed. Additions are permitted but must be optional; nothing beyond the four may ever be required (addendum §I.4).
- **Licensed art is never committed and never enters a publicly pushed image.** `assets-src/`, `public/assets/tilesets/pack/`, `public/assets/sprites/pack/`, `public/assets/ui/pack/`, `public/assets/baked/` stay gitignored.
- **Pure modules must not import Phaser.** `appearance/derive.mjs`, `venueRegistry.ts`, `PresenceModel.ts` and `AppearanceResolver`'s resolution half are unit-tested under `node --test`, which cannot load Phaser.
- **No non-erasable TypeScript: no parameter properties, no `enum`, no `namespace`.** `node --test` type-strips only — it never generates code. `constructor(private x: T)` fails with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on Node 22 *and* 24, and the error names the resolve hook's file, not yours. Declare the field and assign it in the constructor body. The pre-existing parameter properties — `packages/client/src/game/Pathfinder.ts:9` and `packages/client/src/game/scenes/InteriorScene.ts:55-58` — are all Phaser-side and never node-tested; leave them, do not copy them, and know that lifting InteriorScene code into a node-tested module will hit this error.
- **`.mjs` must never import a `.ts` file, directly or transitively.** `test/ts-resolve.mjs` only exists inside `node --test`. A `.mjs` module in `packages/shared/` or `scripts/` is loaded by bare `node` (the bake CLIs) and by Vite (the client bundle), and **neither rewrites `.js` → `.ts`**. Constants a `.mjs` module needs live in a sibling `.mjs`. See Task 2's `schemaVersion.mjs`, `hash.mjs` and the subpath seam in Step 5b.
- **Library functions never write to the source tree.** `worldBake()` takes `outDir` and `generatedDir` as *required* arguments; only the CLI wrapper supplies the repo defaults. `npm test` must leave `git status --porcelain` empty — `test:all`'s trailing shell check (Task 1) is the authoritative gate, and Task 18's in-suite guard gives the early warning.
- **No absolute path to a sibling repo, anywhere.** Cross-repo lookups go through `test/helpers/siblingRepo.mjs` (BotVille) / `tests/helpers/siblingRepo.js` (api). The two helpers implement **different** resolution chains — BotVille's: `$BOTVILLE_<NAME>_REPO` (e.g. `BOTVILLE_API_REPO`) → `$BOTVILLE_REPOS_ROOT/<name>` → sibling of the repo root; the api's: `$BOTVILLE_REPO` → `$BOTVILLE_REPOS_ROOT/<name>` → sibling. Either way the final fallback is an explicit skip with a reason. A hardcoded `/Users/home/...` is a review failure.
- **Test expectations are derived, never transcribed.** No test may hardcode a count that the contract, a descriptor or a generator parameter already determines. Assert `bakeProps(...).size === Object.keys(contract.props.district).length`, not `=== 32`. Golden *pixels* are the one exception — those are snapshots by definition.
- **Deployment is Vercel (client) + Railway (server), not Docker.** `vercel.json`, `railway.toml` and `scripts/deploy-server.mjs` are the production paths and must keep working. Docker is local-parity and self-host only. See Task 35.
- **Invariants I-1 … I-13 (spec §11) are binding.** Each is asserted by a named test in this plan.
- **Scope bar (owner, binding):** art-driven changes only. Do not repoint `packages/client/src/lib/api.ts`, do not delete or modify `packages/server/src/world/agentLife.ts`, do not replace SQLite, do not touch the key vault / model picker / heartbeat / MCP registry. This is not the integration work.

---

## Tasks in this plan

- **Task 21** — `venueRegistry.ts`
- **Task 22** — Parameterise `InteriorScene`
- **Task 23** — Registry-driven `PreloaderScene`, `GameInit` and `assetManifest`
- **Task 24** — Delete the four interior subclasses
- **Task 34** — `PresenceModel`
- **Task 36** — The camera zoom ladder
- **Task 37** — Capacity and deterministic slot assignment

---

## Task 21: `venueRegistry.ts`

The runtime authority for which venues exist. `undefined` for an unknown id is the `unknown` presence path, not an error (spec §4.2) — this is what lets the platform add, rename or retire a venue without BotVille lying about where anyone is.

The registry is generated into a TypeScript module at bake time so Vite can statically bundle it — the client cannot read `venues/` at runtime.

**Files:**
- Create: `packages/client/src/game/venueRegistry.ts`
- Verify: `scripts/world-bake.mjs` already emits `packages/client/src/game/venues.generated.ts` (Plan 2 Task 18 — no bake change in this task)
- Test: `test/venue-registry.test.ts`

**Interfaces:**
- Consumes: `VenueDescriptor`, `PublishedVenue` (Task 2); the descriptors (Tasks 13–14).
- Produces `packages/client/src/game/venueRegistry.ts`:
  - `venueRegistry.all(): VenueDescriptor[]` — sorted by id
  - `venueRegistry.get(id: string): VenueDescriptor | undefined`
  - `venueRegistry.has(id: string): boolean`
  - `venueRegistry.indoor(): VenueDescriptor[]`
  - `venueRegistry.published(): PublishedVenue[]`
  - `sceneKeyFor(id: string): string` — `'district'` → `'DistrictScene'`, any other id → `'VenueScene:<id>'`

- [ ] **Step 1: Write the failing test**

`test/venue-registry.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { venueRegistry, sceneKeyFor } from '../packages/client/src/game/venueRegistry.ts';

test('the registry enumerates every baked venue, sorted by id', () => {
  // Derived, not transcribed: the five authored venues plus however many
  // residence instances the town snapshot provisioned (Plan 2 Task 14a).
  const ids = venueRegistry.all().map(v => v.id);
  assert.deepEqual(ids, [...ids].sort());
  for (const id of ['cafe', 'district', 'dorm', 'library', 'office'])
    assert.ok(ids.includes(id), id);
  assert.ok(venueRegistry.all().some(v => v.roles.includes('home')),
    'residence instances are venues like any other and must be enumerable');
});

test('get() returns the descriptor', () => {
  assert.equal(venueRegistry.get('cafe')?.label, 'Café');
  assert.equal(venueRegistry.get('cafe')?.capacity, 9);
});

test('an unknown id is undefined, not a throw — that is the unknown path', () => {
  assert.equal(venueRegistry.get('speakeasy'), undefined);
  assert.equal(venueRegistry.has('speakeasy'), false);
});

test('indoor() excludes the district', () => {
  const ids = venueRegistry.indoor().map(v => v.id);
  assert.equal(ids.includes('district'), false);
  for (const id of ['cafe', 'dorm', 'library', 'office']) assert.ok(ids.includes(id), id);
});

test('published() emits exactly the vocabulary fields', () => {
  const pub = venueRegistry.published();
  assert.equal(pub.length, venueRegistry.all().length);
  for (const v of pub) {
    assert.deepEqual(Object.keys(v).sort(),
      ['affords', 'archetype', 'capacity', 'hours', 'id', 'indoor', 'label', 'roles']);
  }
});

test('published() matches the committed venues.json byte for byte', async () => {
  const { readFileSync } = await import('node:fs');
  const onDisk = JSON.parse(readFileSync('packages/client/public/assets/venues.json', 'utf8'));
  assert.deepEqual(venueRegistry.published(), onDisk);
});

test('scene keys: the district keeps its class, venues get one shared scene', () => {
  assert.equal(sceneKeyFor('district'), 'DistrictScene');
  assert.equal(sceneKeyFor('cafe'), 'VenueScene:cafe');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the registry enumerates every baked venue"`
Expected: FAIL — `Cannot find module '.../packages/client/src/game/venueRegistry.ts'`.

- [ ] **Step 3: Verify the generated module the bake already emits**

Plan 2 Task 18's `worldBake` writes `venues.generated.ts` immediately after the `venues.json` write — the client cannot read `venues/` at runtime, so the registry data is generated into a module Vite bundles statically. **Nothing to add to the bake here**; confirm the emission and its shape instead:

Run: `npm run bake:world && head -4 packages/client/src/game/venues.generated.ts`
Expected: the `// GENERATED by scripts/world-bake.mjs — do not edit.` header, the `import type { VenueDescriptor } from '@botville/shared';` line, and `export const VENUES: VenueDescriptor[] = [` opening the full descriptor array — authored venues plus residence instances, sorted by id.

`generatedDir`, never a repo path. Task 18 made it a required argument for exactly this: `test/bake/world-bake.test.mjs` calls `worldBake` eight times, and every one of those calls would otherwise rewrite a committed source file as a side effect of running the tests.

- [ ] **Step 4: Write the registry**

`packages/client/src/game/venueRegistry.ts`:

```ts
/**
 * The single runtime authority on which venues exist.
 *
 * get() returns undefined for an unknown id — that is the `unknown` path
 * (spec §8.1), not an error. It is exactly what lets the platform add,
 * rename and retire venues without forcing BotVille to lie about where
 * an agent is.
 *
 * Do not import Phaser: the module is tested under node --test.
 */
import type { PublishedVenue, VenueDescriptor } from '@botville/shared';
import { VENUES } from './venues.generated.js';

const byId = new Map<string, VenueDescriptor>(VENUES.map(v => [v.id, v]));

export const venueRegistry = {
  all(): VenueDescriptor[] {
    return VENUES;
  },
  get(id: string): VenueDescriptor | undefined {
    return byId.get(id);
  },
  has(id: string): boolean {
    return byId.has(id);
  },
  indoor(): VenueDescriptor[] {
    return VENUES.filter(v => v.indoor);
  },
  published(): PublishedVenue[] {
    // Mirrors the bake's published projection EXACTLY (Plan 2 Task 18),
    // including the `archetype ?? id` default for authored venues — the
    // byte-for-byte test against the committed venues.json depends on it.
    return VENUES.map(v => ({
      id: v.id,
      label: v.label,
      indoor: v.indoor,
      capacity: v.capacity,
      archetype: v.archetype ?? v.id,
      roles: v.roles,
      affords: v.affords,
      hours: v.hours,
    }));
  },
};

/**
 * Venue -> Phaser scene key. The district is drawn by its own scene (cars,
 * glow, day/night); all the interiors share one parameterised VenueScene.
 */
export function sceneKeyFor(venueId: string): string {
  return venueId === 'district' ? 'DistrictScene' : `VenueScene:${venueId}`;
}
```

- [ ] **Step 5: Bake, test, typecheck**

Run: `npm run bake:world && npm test && npm run typecheck`
Expected: 7 new tests PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/game/venueRegistry.ts test/venue-registry.test.ts
git commit -m "feat(runtime): venueRegistry over the bake-generated descriptor module, with an unknown-id path"
```

---

## Task 22: Parameterise `InteriorScene`

`InteriorScene` already takes `(sceneKey, mapKey, locationId)`. Make it take a `VenueDescriptor` instead, so any venue renders with no code change — the design's central claim.

**Files:**
- Modify: `packages/client/src/game/scenes/InteriorScene.ts:6,54-61,68-69,222,240-245`
- Test: covered by Task 25's fixture-venue test

**Interfaces:**
- Consumes: `venueRegistry` (Task 21), `VenueDescriptor` (Task 2).
- Produces: `class VenueScene extends Phaser.Scene { constructor(venue: VenueDescriptor) }` with `super({ key: sceneKeyFor(venue.id) })`, reading `venue.id` where it used to read `locationId`, and `venue.capacity` in Task 37.

- [ ] **Step 1: Change the constructor**

Replace `InteriorScene.ts:54-61`:

```ts
  /**
   * An explicit field, not a parameter property: `node --test` strips types
   * but cannot generate the assignment (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX).
   * There is no Phaser and no node testing here — but this constructor is
   * what gets copied from.
   */
  private readonly venue: VenueDescriptor;

  constructor(venue: VenueDescriptor) {
    super({ key: sceneKeyFor(venue.id) });
    this.venue = venue;
  }

  /** Map key = venue id; the .tmj is baked by scripts/world-bake.mjs. */
  private get mapKey() { return this.venue.id; }
  /** This venue's location in server terms: whoever is here is whom we draw. */
  private get locationId() { return this.venue.id; }
  private get sceneKey() { return sceneKeyFor(this.venue.id); }
```

Update the imports at line 6 and add the registry import:

```ts
import { CAMERA_FOCUS, INTERIOR_CAMERA_ZOOM, INTERIOR_TILESET, NIGHT_SCHEDULE, SCENE_FADE_MS } from '../config.js';
import { sceneKeyFor } from '../venueRegistry.js';
import type { VenueDescriptor } from '@botville/shared';
```

- [ ] **Step 2: Follow the door property rename**

`VenueBaker` (Task 15) writes `targetVenue`, not `targetScene`. Replace `InteriorScene.ts:102-112` (the range starts at the `// exit:` comment on 102 — the snippet below includes it, so leaving 102 in place would duplicate it):

```ts
    // exit: a zone over the doormat, hover highlights the doormat
    for (const o of map.getObjectLayer('doors')?.objects ?? []) {
      const p = propsOf(o);
      if (typeof p.targetVenue !== 'string') continue;
      const target = sceneKeyFor(p.targetVenue);
      const zone = this.add.zone(o.x! + o.width! / 2, o.y! + o.height! / 2, o.width!, o.height!)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => doormat?.setTint(0xaaffaa));
      zone.on('pointerout', () => doormat?.clearTint());
      onTap(zone, () => this.transitionTo(target));
    }
```

- [ ] **Step 3: Rename the class and re-export**

Rename `export class InteriorScene` to `export class VenueScene`, and keep the file name for now. At the bottom of the file add, so nothing breaks mid-refactor:

```ts
/** @deprecated name kept for the duration of the migration; removed in Task 24. */
export const InteriorScene = VenueScene;
```

- [ ] **Step 4: Compare the location filter against the venue id**

`InteriorScene.ts:222` reads `a.location === this.locationId`. `locationId` is now `venue.id`, and both `AGENT_LOCATIONS` (`Agent.ts:17`) and the venue ids use the same five strings plus `farm`. Leave the comparison as-is; only its source changed. Add above it:

```ts
    // TZ-16 + spec §8.1: venue id == server location. An unknown id simply
    // never reaches this point — PresenceModel filters it out (Task 34).
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: errors only in `CafeScene.ts`, `DormScene.ts`, `LibraryScene.ts`, `OfficeScene.ts` — they still call the three-argument constructor. Task 24 deletes them. That is the expected intermediate state.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/game/scenes/InteriorScene.ts
git commit -m "refactor(runtime): parameterise InteriorScene by VenueDescriptor as VenueScene"
```

---

## Task 23: Registry-driven `PreloaderScene`, `GameInit` and `assetManifest`

`PreloaderScene` currently iterates `DISTRICT_IMAGES`, `INTERIOR_IMAGES` and `INTERIORS` from `config.ts`. Those three lists become one registry lookup plus one contract lookup. This is also where the emote frame indices leave the code (I-1).

**Files:**
- Modify: `packages/client/src/game/scenes/PreloaderScene.ts:2,39-69,122-124`
- Modify: `packages/client/src/game/GameInit.ts:5-10,29`
- Modify: `packages/client/src/game/assetManifest.ts:71,100,195,211-218,225,243-247`
- Modify: `packages/client/src/game/agents/AgentSprite.ts:278` — read `EMOTE_FRAMES` from the generated index (Step 5)
- Modify: `scripts/world-bake.mjs` — emit the generated asset index
- Create (bake output, committed in Step 8): `packages/client/src/game/assets.generated.ts`
- Test: `test/asset-index.test.ts`

**Interfaces:**
- Consumes: `venueRegistry`, `sceneKeyFor` (Task 21).
- Produces `packages/client/src/game/assets.generated.ts`:
  - `export const DISTRICT_PROPS: string[]`
  - `export const INTERIOR_PROPS: string[]`
  - `export const EMOTE_FRAMES: Record<string, [number, number]>`
  - `export const ANIMATED_OBJECT_KEYS: string[]`

- [ ] **Step 1: Write the failing test**

`test/asset-index.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DISTRICT_PROPS, INTERIOR_PROPS, EMOTE_FRAMES } from '../packages/client/src/game/assets.generated.ts';
// A .ts test importing an .mjs library is the allowed direction (Task 1).
import { loadContract } from '../scripts/lib/assetContract.mjs';

test('the generated index carries every prop the contract declares', () => {
  // Set equality against the contract, not a transcribed count (Global
  // Constraints): the claim is "these two artifacts agree", by name.
  const c = loadContract();
  assert.deepEqual([...DISTRICT_PROPS].sort(), Object.keys(c.props.district).sort());
  assert.deepEqual([...INTERIOR_PROPS].sort(), Object.keys(c.props.interior).sort());
});

test('emote frame indices come from the adapter, not from code (I-1)', () => {
  assert.deepEqual(Object.keys(EMOTE_FRAMES).sort(),
    ['chat_npc', 'error', 'rest', 'task_done', 'task_running', 'work']);
  for (const pair of Object.values(EMOTE_FRAMES)) assert.equal(pair.length, 2);
});

test('no source file under packages/client hardcodes an emote frame index', async () => {
  const { readFileSync } = await import('node:fs');
  const manifest = readFileSync('packages/client/src/game/assetManifest.ts', 'utf8');
  assert.equal(/byStatus\s*:\s*\{[^}]*\d+\s*,\s*\d+/.test(manifest), false,
    'assetManifest still hardcodes byStatus frame pairs');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the generated index carries every prop"`
Expected: FAIL — `Cannot find module '.../assets.generated.ts'`.

- [ ] **Step 3: Emit the index from the bake**

In `scripts/world-bake.mjs`, after the `venues.generated.ts` write:

```js
  const assetIndex = `// GENERATED by scripts/world-bake.mjs — do not edit.
export const DISTRICT_PROPS: string[] = ${JSON.stringify(Object.keys(contract.props.district))};
export const INTERIOR_PROPS: string[] = ${JSON.stringify(Object.keys(contract.props.interior))};
export const ANIMATED_OBJECT_KEYS: string[] = ${JSON.stringify(Object.keys(contract.animatedObjects))};
/** Frame pairs for the status icons. Pack-specific — they live in the adapter (I-1). */
export const EMOTE_FRAMES: Record<string, [number, number]> = ${JSON.stringify(
    Object.fromEntries(contract.emotes.icons.statuses.map(s => [s, adapter.emoteFrames[s]])), null, 2)};
`;
  write(join(generatedDir, 'assets.generated.ts'), assetIndex);
```

**This file's contents depend on which pack you last baked.** `EMOTE_FRAMES` comes from `adapter.emoteFrames`, so a `bake:world` with the default fixture pack overwrites the committed real values with the fixture's synthetic ones, and status icons then render the wrong frames in production. Two guards, both cheap:

Emit the pack name into the file so a reviewer can see it in a diff:

```js
  const assetIndex = `// GENERATED by scripts/world-bake.mjs from pack "${adapter.pack}" — do not edit.
```

and add to `test/asset-index.test.ts`:

```ts
test('the committed asset index was generated from a real pack, not the fixture', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('packages/client/src/game/assets.generated.ts', 'utf8');
  const pack = src.match(/from pack "([^"]+)"/)?.[1];
  assert.ok(pack, 'the generated header lost its pack marker');
  // The fixture pack is correct for a clean checkout and for CI. It is NOT
  // correct for anything that ships pixels — Task 39 re-bakes with limezu and
  // this assertion is what makes forgetting that a test failure.
  assert.equal(pack, process.env.BOTVILLE_PACK ?? 'fixture',
    `assets.generated.ts was baked from "${pack}" — re-run npm run bake:world with the pack you intend to ship`);
});
```

- [ ] **Step 4: Rewrite `PreloaderScene`'s preload**

Replace `PreloaderScene.ts:39-69` with:

```ts
    // Maps and atlases for every venue (generated by scripts/world-bake.mjs)
    for (const v of venueRegistry.all()) {
      this.load.tilemapTiledJSON(v.id, `assets/tilemaps/${v.id}.tmj`);
    }
    for (const atlasId of new Set(venueRegistry.all().map(v => v.groundAtlas))) {
      this.load.image(atlasId, `assets/tilesets/pack/${atlasId}.png`);
    }

    // Props: name = texture key = file name
    for (const key of DISTRICT_PROPS) this.load.image(key, `assets/sprites/pack/district/${key}.png`);
    for (const key of INTERIOR_PROPS) this.load.image(key, `assets/sprites/pack/interior/${key}.png`);

    // Agent spritesheets (humans + animals) — frame sizes come from the manifest
    for (const v of AVATAR_VARIANTS) {
      this.load.spritesheet(v.textureKey, v.file, {
        frameWidth: v.frameWidth,
        frameHeight: v.frameHeight,
      });
    }

    for (const [key, def] of Object.entries(ANIMATED_OBJECTS)) {
      this.load.spritesheet(`anim-${key}`, def.file, {
        frameWidth: def.frameWidth,
        frameHeight: def.frameHeight,
      });
    }
```

Update the imports at line 2:

```ts
import { DISTRICT } from '../config.js';
import { venueRegistry } from '../venueRegistry.js';
import { DISTRICT_PROPS, INTERIOR_PROPS, EMOTE_FRAMES } from '../assets.generated.js';
```

And replace the `byStatus` loop at lines 122-124:

```ts
    // Status icons — a two-frame pulse. The frame indices come from the pack
    // adapter via assets.generated.ts, not from code (I-1).
    for (const [statusName, pair] of Object.entries(EMOTE_FRAMES)) {
      mk(`emote-icon-${statusName}`, EMOTES.icons.textureKey, [...pair], EMOTES.icons.frameRate);
    }
```

- [ ] **Step 5: Strip the frame indices out of `assetManifest.ts`**

Replace `assetManifest.ts:211-218` (the `byStatus` object) with:

```ts
    /**
     * The frame pairs per agent status are PACK-specific and live in
     * sources/<pack>.json (I-1). They are read from assets.generated.ts.
     */
```

so `EMOTES.icons` keeps only `textureKey`, `frameWidth`, `frameHeight` and `frameRate`. Then fix every consumer: `AgentSprite.ts:278` currently reads `pair[0]` from `EMOTES.icons.byStatus`. Change it to import `EMOTE_FRAMES` from `../assets.generated.js` and read `EMOTE_FRAMES[status]`.

Also update the `limezu/` paths in `assetManifest.ts` — line 71 (`assets/sprites/limezu/Premade_Character_${nn}.png`), line 100 (`assets/sprites/limezu/${file}`), line 195 (`EMOTES.file`), line 225 (`UI_SHEET.file`) — replacing the `limezu/` segment with `pack/`. For lines 243-247 (`ANIMATED_OBJECTS`) the filename changes too, not just the segment: post-Task-19a `sync-assets.mjs` copies the contract's `animatedObjects` under their **contract names** (`assets/sprites/pack/coffee_steam.png`, `cake_fridge.png`, `tv_news.png`, `office_screen.png`, `cuckoo_clock.png`), so each entry's `file` becomes `assets/sprites/pack/<contract-name>.png` — the legacy `animated_*.png` filenames no longer exist in the synced output. (Amended 2026-07-29 during Plan 2 execution: the Task 19a sync rewrite dropped the legacy animated copies; delivery was restored via derived contract-name copies, closing the hole this line would otherwise 404 on.)

- [ ] **Step 6: Make `GameInit` build its scene list from the registry**

Replace `GameInit.ts:5-10` and line 29:

```ts
import { PreloaderScene } from './scenes/PreloaderScene.js';
import { DistrictScene } from './scenes/DistrictScene.js';
import { VenueScene } from './scenes/InteriorScene.js';
import { venueRegistry } from './venueRegistry.js';
```

```ts
    // Scenes are enumerated from the venue registry — adding a venue needs no code
    scene: [
      PreloaderScene,
      DistrictScene,
      ...venueRegistry.indoor().map(v => new VenueScene(v)),
    ],
```

Note what this buys for free: Plan 2 Task 14a's residence instances are ordinary registry entries, so every house gets its `VenueScene` here with no further work, and `navigation.ts`'s agent-click path (`agent:goto` → `sceneKeyFor(venueId)` after Task 24) can already reach them — click a sleeping agent in the HUD, arrive in their house. Their district door tiles remain the FOLLOW-UP recorded in Plan 2 Task 14a.

- [ ] **Step 7: Bake, test, typecheck**

Run: `npm run bake:world && npm test && npm run typecheck`
Expected: 4 new tests PASS (Step 1 declares three; Step 3 adds a fourth). Typecheck still errors only in the four subclass files.

- [ ] **Step 8: Commit**

```bash
git add scripts/world-bake.mjs packages/client/src/game/assets.generated.ts packages/client/src/game/scenes/PreloaderScene.ts packages/client/src/game/assetManifest.ts packages/client/src/game/GameInit.ts packages/client/src/game/agents/AgentSprite.ts test/asset-index.test.ts
git commit -m "refactor(runtime): registry-driven preload; emote frame indices move to the adapter (I-1)"
```

---

## Task 24: Delete the four interior subclasses

24 lines of pure duplication that exist only because venues were not data. Deleting them is the visible payoff of Tasks 21–23.

**Files:**
- Delete: `packages/client/src/game/scenes/{Cafe,Dorm,Library,Office}Scene.ts`
- Modify: `packages/client/src/game/config.ts:11-23,142-179`
- Modify: `packages/client/src/game/SceneRegistry.ts`
- Modify: `packages/client/src/game/scenes/InteriorScene.ts` — drop the deprecated alias

**Interfaces:**
- Consumes: Tasks 21–23.
- Produces: `LOCATION_SCENES` is gone; callers use `sceneKeyFor(venueId)`.

- [ ] **Step 1: Find every reference**

Run: `grep -rn "CafeScene\|DormScene\|LibraryScene\|OfficeScene\|LOCATION_SCENES\|INTERIOR_IMAGES\|DISTRICT_IMAGES\|INTERIORS\b" packages/client/src --include='*.ts' --include='*.tsx'`
Expected: 34 hits in 9 files — `config.ts` (12), `navigation.ts:4,29`, `GameInit.ts:7,8,9,10,29`, `DistrictScene.ts:8,425,440,441`, `PreloaderScene.ts:2,44,57,61`, and the four files being deleted (3 each). `GameInit.ts` and `PreloaderScene.ts` are already rewritten by Task 23 — if they still appear here, Task 23 was applied incompletely.

- [ ] **Step 2: Delete the subclasses and the deprecated alias**

```bash
git rm packages/client/src/game/scenes/CafeScene.ts \
       packages/client/src/game/scenes/DormScene.ts \
       packages/client/src/game/scenes/LibraryScene.ts \
       packages/client/src/game/scenes/OfficeScene.ts
```

Remove the `export const InteriorScene = VenueScene;` alias added in Task 22 Step 3.

- [ ] **Step 3: Remove the superseded config lists**

In `config.ts`, delete `LOCATION_SCENES` (lines 11-23 — the doc comment opens with `/**` at 11; starting at 12 leaves an orphaned, unbalanced block comment), `INTERIORS` (142-148), `INTERIOR_IMAGES` (155-166) and `DISTRICT_IMAGES` (168-179). Keep `INTERIOR_TILESET` and `INTERIOR_CAMERA_ZOOM` — they are camera and tileset settings, not asset enumerations. (`INTERIOR_CAMERA_ZOOM` is deleted later, in Task 36, when the zoom ladder replaces it; at this point it is still read by `InteriorScene`.)

Replace the `LOCATION_SCENES` block with a pointer, so the next reader knows where it went:

```ts
/**
 * TZ-16: location (the server's truth) -> the scene that draws it.
 * This is now the venue registry: see sceneKeyFor() in venueRegistry.ts.
 * 'farm' — the farm pen/yard, which lives on the district map.
 */
```

- [ ] **Step 4: Repoint every consumer**

Anywhere that read `LOCATION_SCENES[loc]`, call `sceneKeyFor(loc)` instead, importing from `./venueRegistry.js`. `'farm'` has no descriptor, so guard it explicitly where it appears:

```ts
// the farm is drawn on the district map; it has no venue of its own
const sceneFor = (loc: AgentLocation) => (loc === 'farm' ? 'DistrictScene' : sceneKeyFor(loc));
```

In `DistrictScene.ts`, door and building objects now carry `targetVenue` instead of `targetScene`; change the property lookup and wrap it in `sceneKeyFor(...)`, exactly as Task 22 Step 2 did for interiors.

- [ ] **Step 5: Simplify `SceneRegistry.ts`**

The stray `import Phaser from 'phaser';` at line 25 sits *below* its use. Move it to the top and drop the comment:

```ts
import Phaser from 'phaser';
import type { DistrictScene } from './scenes/DistrictScene.js';

/** References to the live scenes, so React/the store can call their methods. */
class SceneRegistry {
  private scenes: Map<string, Phaser.Scene> = new Map();

  register(key: string, scene: Phaser.Scene) { this.scenes.set(key, scene); }
  unregister(key: string) { this.scenes.delete(key); }
  get<T extends Phaser.Scene>(key: string): T | undefined { return this.scenes.get(key) as T | undefined; }
  getDistrict(): DistrictScene | undefined { return this.get<DistrictScene>('DistrictScene'); }
}

export const sceneRegistry = new SceneRegistry();
```

- [ ] **Step 6: Typecheck, test and run**

Run: `npm run typecheck && npm test && npm run build`
Expected: **typecheck clean for the first time since Task 22**; tests pass; client build succeeds.

- [ ] **Step 7: Verify in the browser**

Run: `npm run dev`, open http://localhost:5173, click each of the four building doors and the exit doormat in each room.
Expected: all four interiors load and return to the district. With the fixture pack the art is coloured blocks — that is correct and proves the pipeline, not the pixels.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor(runtime): delete the four interior subclasses — venues are data now"
```

---

## Task 34: `PresenceModel`

Exactly three states. The client never invents a fourth (I-3). The `unknown` row is what lets the platform add, rename or retire a venue at any time without BotVille lying about where anyone is.

**Files:**
- Create: `packages/client/src/game/PresenceModel.ts`
- Test: `test/presence-model.test.ts`

**Interfaces:**
- Consumes: `AgentPresence`, `PresenceState` (Task 2), `venueRegistry` (Task 21).
- Produces `packages/client/src/game/PresenceModel.ts`:
  - `resolvePresence(p: AgentPresence, registry): PresenceState`
  - `class PresenceModel { constructor(registry); resolve(p); partition(list): { somewhere: Map<string, AgentPresence[]>; absent: AgentPresence[]; unknown: AgentPresence[] } }`

- [ ] **Step 1: Write the failing test**

`test/presence-model.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PresenceModel, resolvePresence } from '../packages/client/src/game/PresenceModel.ts';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';
import type { AgentPresence } from '../packages/shared/src/types/Assets.ts';

const p = (venueId: string | null, id = 'a'): AgentPresence =>
  ({ id, displayName: id, spriteSeed: id, venueId });

test('the §8.1 matrix, row by row', () => {
  assert.deepEqual(resolvePresence(p('cafe'), venueRegistry), { kind: 'somewhere', venueId: 'cafe' });
  assert.deepEqual(resolvePresence(p(null), venueRegistry), { kind: 'absent' });
  assert.deepEqual(resolvePresence(p('speakeasy'), venueRegistry), { kind: 'unknown' });
});

test('every published venue resolves to somewhere', () => {
  for (const v of venueRegistry.published())
    assert.deepEqual(resolvePresence(p(v.id), venueRegistry), { kind: 'somewhere', venueId: v.id });
});

test('there is no fourth state, whatever the input (I-3)', () => {
  const inputs = [null, '', '  ', 'cafe', 'CAFE', 'speakeasy', 'district', '../etc/passwd', '🙂'];
  for (const v of inputs) {
    const k = resolvePresence(p(v as string | null), venueRegistry).kind;
    assert.ok(['somewhere', 'absent', 'unknown'].includes(k), `${v} -> ${k}`);
  }
});

test('venue ids are matched exactly — case is not normalised away', () => {
  assert.equal(resolvePresence(p('CAFE'), venueRegistry).kind, 'unknown');
});

test('an empty-string venue is unknown, not absent', () => {
  assert.equal(resolvePresence(p(''), venueRegistry).kind, 'unknown');
});

test('partition groups a roster by state', () => {
  const m = new PresenceModel(venueRegistry);
  const r = m.partition([p('cafe', '1'), p('cafe', '2'), p('office', '3'), p(null, '4'), p('speakeasy', '5')]);
  assert.equal(r.somewhere.get('cafe')?.length, 2);
  assert.equal(r.somewhere.get('office')?.length, 1);
  assert.equal(r.absent.length, 1);
  assert.equal(r.unknown.length, 1);
});

test('partition loses nobody', () => {
  const m = new PresenceModel(venueRegistry);
  const roster = Array.from({ length: 85 }, (_, i) =>
    p(i % 7 === 0 ? null : i % 11 === 0 ? 'ghost' : 'cafe', `a${i}`));
  const r = m.partition(roster);
  const counted = [...r.somewhere.values()].reduce((n, xs) => n + xs.length, 0)
    + r.absent.length + r.unknown.length;
  assert.equal(counted, roster.length);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the §8.1 matrix"`
Expected: FAIL — `Cannot find module '.../PresenceModel.ts'`.

- [ ] **Step 3: Write the model**

`packages/client/src/game/PresenceModel.ts`:

```ts
/**
 * Presence: EXACTLY three states (I-3).
 *
 *   venueId present and known    -> somewhere: draw in that venue
 *   venueId === null             -> absent:    don't draw, HUD shows "not here"
 *   venueId present but NOT known -> unknown:  draw nowhere, HUD shows "unknown"
 *
 * That third line is what lets the platform add, rename and remove venues at any
 * time while BotVille never lies about where an agent is. The client does not
 * invent any fourth state.
 *
 * Does not import Phaser: tested under node --test.
 */
import type { AgentPresence, PresenceState } from '@botville/shared';

interface VenueLookup { has(id: string): boolean }

export function resolvePresence(p: AgentPresence, registry: VenueLookup): PresenceState {
  if (p.venueId === null) return { kind: 'absent' };
  if (!registry.has(p.venueId)) return { kind: 'unknown' };
  return { kind: 'somewhere', venueId: p.venueId };
}

export interface PresencePartition {
  /** venue -> who is in it */
  somewhere: Map<string, AgentPresence[]>;
  absent: AgentPresence[];
  unknown: AgentPresence[];
}

export class PresenceModel {
  /** An explicit field: a parameter property does not survive strip-only type stripping. */
  private readonly registry: VenueLookup;

  constructor(registry: VenueLookup) {
    this.registry = registry;
  }

  resolve(p: AgentPresence): PresenceState {
    return resolvePresence(p, this.registry);
  }

  /** Sort the roster into states. Nobody gets lost. */
  partition(roster: AgentPresence[]): PresencePartition {
    const out: PresencePartition = { somewhere: new Map(), absent: [], unknown: [] };
    for (const p of roster) {
      const state = this.resolve(p);
      if (state.kind === 'absent') { out.absent.push(p); continue; }
      if (state.kind === 'unknown') { out.unknown.push(p); continue; }
      const bucket = out.somewhere.get(state.venueId);
      if (bucket) bucket.push(p); else out.somewhere.set(state.venueId, [p]);
    }
    return out;
  }
}
```

- [ ] **Step 4: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: 7 new tests PASS; typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/game/PresenceModel.ts test/presence-model.test.ts
git commit -m "feat(runtime): PresenceModel with exactly three states (I-3)"
```

---

## Task 36: The camera zoom ladder

`CAMERA` runs `initialZoom: 1.8`, range 0.6–4, step 1.3. Non-integer zoom on 16px art produces shimmer and uneven pixel sizes. This is an art-quality defect and therefore in scope (spec §10.1).

**Files:**
- Modify: `packages/client/src/game/config.ts:40-45` — and delete `INTERIOR_CAMERA_ZOOM` (line 153)
- Modify: `packages/client/src/game/cameraControls.ts` — step by rung
- Modify: `packages/client/src/game/scenes/InteriorScene.ts:6,125` — snapped fit; drop the `INTERIOR_CAMERA_ZOOM` import
- Test: `test/zoom-ladder.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces, from `config.ts`:
  - `ZOOM_LADDER: readonly number[] = [0.5, 1, 2, 3, 4]`
  - `CAMERA = { initialZoom: 2, minZoom: 0.5, maxZoom: 4 }`
  - `nextZoom(current: number, direction: 1 | -1): number` — moves exactly one rung

- [ ] **Step 1: Write the failing test**

`test/zoom-ladder.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZOOM_LADDER, CAMERA, nextZoom, snapZoom } from '../packages/client/src/game/config.ts';

test('the ladder is the spec-pinned design constant', () => {
  assert.deepEqual([...ZOOM_LADDER], [0.5, 1, 2, 3, 4]);
});

test('the initial zoom is on the ladder and integral', () => {
  assert.equal(CAMERA.initialZoom, 2);
  assert.ok(ZOOM_LADDER.includes(CAMERA.initialZoom));
});

test('the range is the ladder ends', () => {
  assert.equal(CAMERA.minZoom, ZOOM_LADDER[0]);
  assert.equal(CAMERA.maxZoom, ZOOM_LADDER[ZOOM_LADDER.length - 1]);
});

test('zooming moves exactly one rung', () => {
  assert.equal(nextZoom(1, 1), 2);
  assert.equal(nextZoom(2, 1), 3);
  assert.equal(nextZoom(2, -1), 1);
  assert.equal(nextZoom(0.5, -1), 0.5, 'clamped at the bottom');
  assert.equal(nextZoom(4, 1), 4, 'clamped at the top');
});

test('an off-ladder zoom snaps to the nearest rung before stepping', () => {
  assert.equal(snapZoom(1.8), 2);
  assert.equal(snapZoom(0.7), 0.5);
  assert.equal(snapZoom(3.4), 3);
  assert.equal(nextZoom(1.8, 1), 3, 'snap to 2, then one rung up');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the ladder is the spec-pinned design constant"`
Expected: FAIL — `ZOOM_LADDER` is not exported from `config.ts`.

- [ ] **Step 3: Replace the camera config**

`config.ts:40-45`:

```ts
/**
 * Zoom ladder: clean multiples only. Non-integer zoom on 16px art produces
 * shimmer and uneven pixel size (spec §10.1) — the old step of 1.3 from
 * initialZoom 1.8 landed exactly there. The controls move rung by rung.
 */
export const ZOOM_LADDER: readonly number[] = [0.5, 1, 2, 3, 4] as const;

export const CAMERA = {
  initialZoom: 2,
  minZoom: ZOOM_LADDER[0],
  maxZoom: ZOOM_LADDER[ZOOM_LADDER.length - 1],
} as const;

/** The nearest rung of the ladder — for pinch and any arbitrary zoom. */
export function snapZoom(z: number): number {
  return ZOOM_LADDER.reduce((best, r) => (Math.abs(r - z) < Math.abs(best - z) ? r : best), ZOOM_LADDER[0]);
}

/** Exactly one rung up (+1) or down (-1), clamped at the ends. */
export function nextZoom(current: number, direction: 1 | -1): number {
  const i = ZOOM_LADDER.indexOf(snapZoom(current));
  return ZOOM_LADDER[Math.min(ZOOM_LADDER.length - 1, Math.max(0, i + direction))];
}
```

- [ ] **Step 4: Use the ladder in the camera controls**

Run: `grep -n "zoomStep\|setZoom\|zoomTo" packages/client/src/game/cameraControls.ts`

There is no `cam.setZoom(cam.zoom * CAMERA.zoomStep)` in this file — do not search-and-replace. The keyboard buttons already go through a **300 ms `zoomTo` tween**, and the wheel and the pinch go through a local `setZoom` helper. Three separate edits:

**1. Extend the import (`cameraControls.ts:2`):**

```ts
import { CAMERA, CAMERA_DRAG, nextZoom, snapZoom } from './config.js';
```

**2. Step by rung on the keyboard, keeping the glide (`:88-91`):**

```ts
  scene.input.keyboard?.on('keydown-EQUAL', () =>
    cam.zoomTo(nextZoom(cam.zoom, 1), 300));
  scene.input.keyboard?.on('keydown-MINUS', () =>
    cam.zoomTo(nextZoom(cam.zoom, -1), 300));
```

`nextZoom` snaps to the nearest rung and clamps at both ends, so the `Phaser.Math.Clamp(..., minZoom, maxZoom)` wrapper is now dead weight — drop it. **Keep the `, 300`.** `cam.zoomTo(z)` with no duration is `setZoom`-with-extra-steps: the button would snap instead of glide, which is a visible regression, not a cleanup.

**3. Snap the wheel and the pinch, which share the `setZoom` helper (`:62-65`):**

Wheel (`:93`) — one rung per notch, so the ladder is actually reachable:

```ts
  scene.input.on('wheel', (_p: unknown, _go: unknown, _dx: number, dy: number) => {
    if (dy !== 0) setZoom(nextZoom(cam.zoom, dy < 0 ? 1 : -1));
  });
```

Pinch (`:112`) — track continuously so the gesture stays live, then settle on a rung when the fingers lift. Leave `:112` as it is and add the snap to `endPinch` (`:82-86`):

```ts
  const endPinch = () => {
    setZoom(snapZoom(cam.zoom));
    pinch = null;
    pinchActive = false;
    pinchEndedAt = Date.now();
  };
```

**Dead-zone hazard:** snapping the wheel or the pinch per-event (e.g. `setZoom(snapZoom(cam.zoom - dy * 0.001))`, or `snapZoom` at the existing `:112` call site) produces a **dead control** — the raw delta per event is far smaller than the gap between rungs, so `snapZoom` returns the rung you are already on and zoom never changes. The wheel must step by rung, and the pinch must snap on release, not per-frame.

Note also: `cam.zoomTo` only writes `cam.zoom` when the tween completes, so two button presses inside 300 ms both read the pre-tween value and land on the same rung. That is today's behaviour and is out of scope — do not mistake it for a ladder bug during review.

`CAMERA_FOCUS.zoom` (`config.ts:128`) is `2.4` — snap it to `2`:

```ts
export const CAMERA_FOCUS = { panMs: 600, zoom: 2 } as const;
```

`INTERIOR_CAMERA_ZOOM` (line 153) is `2.4` and feeds a `Phaser.Math.Clamp(fitZoom, 1.5, ...)` in `InteriorScene.ts:125`. Replace that line with a snapped fit:

```ts
    cam.setZoom(snapZoom(Phaser.Math.Clamp(fitZoom, CAMERA.minZoom, CAMERA.maxZoom)));
```

and delete `INTERIOR_CAMERA_ZOOM` from `config.ts` — **including its import in `InteriorScene.ts`** (the Task 22 Step 1 import line brought it in alongside `INTERIOR_TILESET`; remove only `INTERIOR_CAMERA_ZOOM` from that list, and add the `snapZoom`/`CAMERA` imports the snapped fit needs). Task 24 deliberately kept the constant because the scene still read it then; this is where it dies. Grep `INTERIOR_CAMERA_ZOOM` afterwards — zero hits, or typecheck fails on the dangling import.

**Deliberately no `GameInit.ts` change.** Spec §10.1's third bullet ("canvas sizing respects device pixel ratio without fractional scaling") is *not* implemented by touching the `scale` block. Phaser's `ScaleConfig` has no `resolution` key (verified against the installed 3.90 typings) — the once-proposed `resolution: Math.floor(devicePixelRatio)` would be a silently ignored property — and `zoom: 1 / Math.floor(dpr)` halves the CSS size on every 2× display while doing nothing on a 1.5× one. `pixelArt: true` / `roundPixels` are already set, and the ladder from Steps 1–4 is the whole control surface. A unit test cannot see a backing store, so the check that the art stays sharp is the manual one in Step 5.

- [ ] **Step 5: Test, typecheck, look at it**

Run: `npm test && npm run typecheck && npm run dev`
Expected: 5 new tests PASS; typecheck clean. In the browser, scroll-zoom steps 0.5 → 1 → 2 → 3 → 4 with no intermediate values, and pixel edges stay sharp at every rung.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/game/config.ts packages/client/src/game/cameraControls.ts packages/client/src/game/scenes/InteriorScene.ts test/zoom-ladder.test.ts
git commit -m "fix(camera): fixed zoom ladder to stop shimmer on 16px art"
```

---

## Task 37: Capacity and deterministic slot assignment

Six venues and a 150-agent town is ~25 agents per venue, in 20×15 rooms with 4–9 seats. Sprites overlap into an unreadable pile. `capacity` exists for this. **In scope:** the descriptor field (already there from Task 13) and deterministic in-venue slot assignment so agents distribute rather than stack. **Out of scope:** overflow UX for a genuinely over-capacity venue — that needs a populated world to evaluate against, and inventing it now would be guesswork (spec §10.3, R-3).

Today `InteriorScene.syncAgents` spreads newcomers over three columns (`(i % 3) * 14 - 14`), which stacks hard past ~6 agents, and seat assignment is `find(s => !s.occupiedBy)` — order-dependent, so the same agent lands somewhere different on every reload.

**Standing slots respect furniture (F-14).** The naive floor grid — every cell between the walls — puts standing agents inside tables and on top of beds: the bake derives collision from exactly those furniture footprints (Plan 2 Task 15), and the slot assigner must not ignore what the system already knows. So the free-floor cell list is computed by **excluding every cell a footprint touches**, and the stride bijection runs over the *free* cells. The bijection argument survives intact — it only ever needed `cells` to be the count of cells actually in play. The scene supplies the footprints from the baked map's `collision` object layer, which exists precisely because the bake derived it; the structural wall rects in that layer touch no floor cell, so passing the whole layer is safe and simple.

**Files:**
- Create: `packages/client/src/game/venueSlots.ts`
- Modify: `packages/client/src/game/scenes/InteriorScene.ts:100` (after the seats read — capture footprints) and `:232-251` (the sync rewrite)
- Test: `test/venue-slots.test.ts`

**Interfaces:**
- Consumes: `hashString` (**Plan 1 Task 2**, `packages/shared/src/hash.mjs`), `VenueDescriptor` (Plan 1 Task 2). Nothing in this task depends on Plan 4.
- Produces `packages/client/src/game/venueSlots.ts`:
  - `interface FootprintRect { x: number; y: number; w: number; h: number }` — pixel-space, as the `.tmj` collision layer stores them
  - `assignSlots(venue: VenueDescriptor, agentIds: string[], footprints?: FootprintRect[]): Map<string, { x: number; y: number; seatIndex: number | null }>`
  - `standingSlot(venue, agentId, rank, footprints?): { x: number; y: number }`
  - `isOverCapacity(venue, count): boolean`

- [ ] **Step 1: Write the failing test**

`test/venue-slots.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignSlots, standingSlot, isOverCapacity } from '../packages/client/src/game/venueSlots.ts';
import type { FootprintRect } from '../packages/client/src/game/venueSlots.ts';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';

const cafe = venueRegistry.get('cafe')!;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `agent_${i}`);

// Pixel-space furniture footprints, the shape the .tmj collision layer holds.
// One aligned to the grid, one deliberately off-grid: exclusion is by
// intersection, not by tile-coordinate equality.
const FOOTPRINTS: FootprintRect[] = [
  { x: 4 * 16, y: 8 * 16, w: 48, h: 18 },
  { x: 12 * 16 + 5, y: 9 * 16 + 3, w: 30, h: 18 },
];

test('assignment is deterministic — the same roster lands identically', () => {
  assert.deepEqual([...assignSlots(cafe, ids(20))], [...assignSlots(cafe, ids(20))]);
});

test('assignment does not depend on roster order', () => {
  const a = assignSlots(cafe, ids(9));
  const b = assignSlots(cafe, [...ids(9)].reverse());
  for (const id of ids(9)) assert.deepEqual(a.get(id), b.get(id), id);
});

test('no two agents share a seat', () => {
  const m = assignSlots(cafe, ids(9));
  const taken = [...m.values()].map(v => v.seatIndex).filter(i => i !== null);
  assert.equal(new Set(taken).size, taken.length);
});

test('seats fill before anyone stands', () => {
  const m = assignSlots(cafe, ids(cafe.seats.length));
  assert.equal([...m.values()].filter(v => v.seatIndex === null).length, 0);
});

test('overflow agents never share a standing position', () => {
  // Exact, not "mostly distinct": rank -> cell is a bijection, so a
  // collision is a bug in strideFor, not an acceptable coincidence. A
  // threshold here would have hidden exactly that.
  for (const n of [10, 25, 40]) {
    const standing = [...assignSlots(cafe, ids(n)).values()].filter(v => v.seatIndex === null);
    assert.equal(standing.length, Math.max(0, n - cafe.seats.length), `roster of ${n}`);
    const keys = new Set(standing.map(v => `${v.x},${v.y}`));
    assert.equal(keys.size, standing.length, `roster of ${n}: two agents on the same tile`);
  }
});

test('standing capacity is the free floor, and we know what it is', () => {
  const [W, H] = cafe.sizeTiles;
  const cells = (W - 4) * (H - 5);
  const standing = [...assignSlots(cafe, ids(cells + cafe.seats.length)).values()]
    .filter(v => v.seatIndex === null);
  assert.equal(new Set(standing.map(v => `${v.x},${v.y}`)).size, cells,
    'the floor grid should be exactly filled before anything repeats');
});

test('standing positions stay inside the room', () => {
  const [W, H] = cafe.sizeTiles;
  for (const v of assignSlots(cafe, ids(40)).values()) {
    assert.ok(v.x > 16 && v.x < (W - 1) * 16, `x ${v.x}`);
    assert.ok(v.y > 32 && v.y < (H - 1) * 16, `y ${v.y}`);
  }
});

// ── F-14: furniture footprints exclude standing cells ────────────────────

test('no standing slot intersects a furniture footprint (F-14)', () => {
  const standing = [...assignSlots(cafe, ids(40), FOOTPRINTS).values()]
    .filter(v => v.seatIndex === null);
  assert.ok(standing.length > 0, 'the roster must overflow the seats for this test to bite');
  for (const s of standing) {
    // The slot is a cell centre; the whole 16px cell must be clear.
    const cx = s.x - 8, cy = s.y - 8;
    for (const f of FOOTPRINTS) {
      const overlaps = f.x < cx + 16 && f.x + f.w > cx && f.y < cy + 16 && f.y + f.h > cy;
      assert.equal(overlaps, false, `slot at ${s.x},${s.y} stands in the footprint at ${f.x},${f.y}`);
    }
  }
});

test('footprints shrink the bijection without breaking it', () => {
  // Same guarantee as the free-floor test, over the REDUCED cell set: fill
  // every free cell exactly once before anything repeats.
  const [W, H] = cafe.sizeTiles;
  const T = 16;
  let free = 0;
  for (let cy = 3; cy < H - 2; cy++) {
    for (let cx = 2; cx < W - 2; cx++) {
      const blocked = FOOTPRINTS.some(f =>
        f.x < (cx + 1) * T && f.x + f.w > cx * T && f.y < (cy + 1) * T && f.y + f.h > cy * T);
      if (!blocked) free++;
    }
  }
  const all = (W - 4) * (H - 5);
  assert.ok(free < all, 'the fixture footprints must actually block cells');
  const standing = [...assignSlots(cafe, ids(free + cafe.seats.length), FOOTPRINTS).values()]
    .filter(v => v.seatIndex === null);
  assert.equal(new Set(standing.map(v => `${v.x},${v.y}`)).size, free,
    'the free cells should be exactly filled before anything repeats');
});

test('footprints do not disturb determinism or order-independence', () => {
  assert.deepEqual([...assignSlots(cafe, ids(20), FOOTPRINTS)],
                   [...assignSlots(cafe, ids(20), FOOTPRINTS)]);
  const a = assignSlots(cafe, ids(20), FOOTPRINTS);
  const b = assignSlots(cafe, [...ids(20)].reverse(), FOOTPRINTS);
  for (const id of ids(20)) assert.deepEqual(a.get(id), b.get(id), id);
});

test('a pathologically furnished room degrades to the raw grid, never crashes', () => {
  const everything: FootprintRect[] = [{ x: 0, y: 0, w: cafe.sizeTiles[0] * 16, h: cafe.sizeTiles[1] * 16 }];
  const s = standingSlot(cafe, 'a', 0, everything);
  assert.ok(Number.isFinite(s.x) && Number.isFinite(s.y));
});

test('standingSlot is a pure function of venue, agent and rank', () => {
  assert.deepEqual(standingSlot(cafe, 'a', 3), standingSlot(cafe, 'a', 3));
  assert.notDeepEqual(standingSlot(cafe, 'a', 3), standingSlot(cafe, 'a', 4));
});

test('isOverCapacity reports against the descriptor', () => {
  assert.equal(isOverCapacity(cafe, cafe.capacity), false);
  assert.equal(isOverCapacity(cafe, cafe.capacity + 1), true);
});

test('every venue can seat at least one agent', () => {
  for (const v of venueRegistry.indoor()) {
    assert.ok(v.seats.length > 0, v.id);
    assert.equal(assignSlots(v, ['solo']).get('solo')!.seatIndex, 0);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="assignment is deterministic"`
Expected: FAIL — `Cannot find module '.../venueSlots.ts'`.

- [ ] **Step 3: Write the slot assigner**

`packages/client/src/game/venueSlots.ts`:

```ts
/**
 * Deterministic distribution of agents across the slots inside a venue.
 *
 * Six venues and a town of 150 agents means ~25 agents per 20x15 room with
 * 4-9 chairs (spec §10.3). Previously syncAgents laid newcomers out in three
 * columns from the spawn point and assigned the first free chair — i.e. it
 * depended on arrival order: the same agent ended up in different places
 * after a reload.
 *
 * Here order plays no part: the slot is derived from the agentId and the venue id.
 * The same roster -> the same arrangement, always.
 *
 * In scope: capacity and layout. NOT in scope: the over-capacity UX — that has to
 * be judged on a populated world; inventing it now would be guesswork (R-3).
 *
 * Does not import Phaser: tested under node --test.
 */
import { hashString } from '@botville/shared/hash.mjs';
import type { VenueDescriptor } from '@botville/shared';

const T = 16;

export interface Slot { x: number; y: number; seatIndex: number | null }

/** A footprint rectangle in pixels — as the collision layer stores it in the .tmj. */
export interface FootprintRect { x: number; y: number; w: number; h: number }

export function isOverCapacity(venue: VenueDescriptor, count: number): boolean {
  return count > venue.capacity;
}

/**
 * The largest stride coprime with the number of cells. This guarantees that
 * rank -> cell is a BIJECTION over the first N ranks: two standing agents cannot
 * land in the same cell. The previous version mixed the agent's hash into cell,
 * which made collisions possible — the test could fail intermittently.
 */
function strideFor(cells: number): number {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  for (let s = Math.floor(cells / 2) | 1; s > 1; s -= 2) if (gcd(s, cells) === 1) return s;
  return 1;
}

/**
 * FREE floor cells (F-14): the grid between the walls MINUS the cells touched by
 * a furniture footprint. The bake derives the collision layer from exactly these
 * footprints (Plan 2 Task 15) — the system knows which cells are occupied, and
 * the layout is obliged to use that knowledge, otherwise agents stand inside tables.
 *
 * Structural wall rectangles from the same layer do not intersect the grid
 * (it is inset from the walls), so the scene can pass the whole layer through.
 */
function freeFloorCells(venue: VenueDescriptor, footprints: FootprintRect[]): { cx: number; cy: number }[] {
  const [W, H] = venue.sizeTiles;
  // floor: from the 2nd row (below the walls) to the second-to-last, excluding the edge columns
  const cells: { cx: number; cy: number }[] = [];
  for (let cy = 3; cy < H - 2; cy++) {
    for (let cx = 2; cx < W - 2; cx++) {
      const blocked = footprints.some(f =>
        f.x < (cx + 1) * T && f.x + f.w > cx * T &&
        f.y < (cy + 1) * T && f.y + f.h > cy * T);
      if (!blocked) cells.push({ cx, cy });
    }
  }
  return cells;
}

/**
 * A standing agent's position: a free-floor cell derived from the rank.
 *
 * Individuality comes not from a hash HERE but from the ordering in assignSlots:
 * an agent's rank is derived from its seed. That makes the layout simultaneously
 * deterministic, agent-dependent and collision-FREE as long as there are fewer
 * standing agents than cells. The rank -> cell bijection operates on the FREE
 * cells: cells is their count, and the argument from strideFor carries over
 * unchanged (F-14).
 */
export function standingSlot(
  venue: VenueDescriptor,
  agentId: string,
  rank: number,
  footprints: FootprintRect[] = [],
): { x: number; y: number } {
  let free = freeFloorCells(venue, footprints);
  // The pathological "furniture covered the whole floor" case: degrade to the raw
  // grid — standing inside a table is worse than standing nowhere, but crashing is not an option.
  if (free.length === 0) free = freeFloorCells(venue, []);
  const cells = free.length;

  // The offset is a property of the VENUE, not the agent: different rooms fill
  // differently, but within a room the mapping stays a bijection.
  const offset = hashString(venue.id, 'slot:offset') % cells;
  const { cx, cy } = free[(rank * strideFor(cells) + offset) % cells];
  return { x: cx * T + T / 2, y: cy * T + T / 2 };
}

/**
 * Hand out slots to the whole roster in a single pass.
 * Chairs fill up before anyone stands; the roster's order has no effect.
 * footprints is the collision layer from the baked map: standing agents route
 * around furniture (F-14).
 */
export function assignSlots(
  venue: VenueDescriptor,
  agentIds: string[],
  footprints: FootprintRect[] = [],
): Map<string, Slot> {
  // a stable order regardless of the order the roster arrived in
  const ordered = [...agentIds].sort((a, b) => {
    const ha = hashString(a, `order:${venue.id}`);
    const hb = hashString(b, `order:${venue.id}`);
    return ha - hb || (a < b ? -1 : a > b ? 1 : 0);
  });

  const out = new Map<string, Slot>();
  ordered.forEach((id, rank) => {
    if (rank < venue.seats.length) {
      const seat = venue.seats[rank];
      out.set(id, { x: seat.at[0] * T, y: seat.at[1] * T, seatIndex: rank });
    } else {
      const { x, y } = standingSlot(venue, id, rank - venue.seats.length, footprints);
      out.set(id, { x, y, seatIndex: null });
    }
  });
  return out;
}
```

- [ ] **Step 4: Use it in the scene**

First, capture the derived footprints. In `create()`, immediately after the seats read (the block ending at `InteriorScene.ts:100` with `});`), add a field read from the baked map:

```ts
    // F-14: standing agents route around furniture. The collision layer was
    // derived at bake time from exactly those footprints (Plan 2 Task 15) — read it from the map.
    this.furnitureFootprints = (map.getObjectLayer('collision')?.objects ?? [])
      .map(o => ({ x: o.x ?? 0, y: o.y ?? 0, w: o.width ?? 0, h: o.height ?? 0 }));
```

with the field declared beside the other scene fields:

```ts
  /** The collision layer's rectangles — the F-14 input for venueSlots. */
  private furnitureFootprints: FootprintRect[] = [];
```

Then replace `InteriorScene.ts:232-251`:

```ts
    // Deterministic layout: chairs fill before anyone stands, and the same agent
    // sits in the same place after a reload.
    // Furniture footprints exclude the occupied cells (F-14).
    const slots = assignSlots(this.venue, agentList.map(a => a.id), this.furnitureFootprints);
    if (isOverCapacity(this.venue, agentList.length)) {
      // R-3: the over-capacity UX is deferred; we record the fact so it stays visible
      console.debug(`[${this.venue.id}] over capacity: ${agentList.length}/${this.venue.capacity}`);
    }

    agentList.forEach(a => {
      if (this.agentSprites.has(a.id)) return;
      const slot = slots.get(a.id)!;
      const sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, this.spawnPoint.x, this.spawnPoint.y);
      this.agentSprites.set(a.id, sprite);

      // animals do not climb onto beds
      const isAnimal = getVariant(a.avatarVariant).kind === 'animal';
      const seat = slot.seatIndex !== null ? this.seats[slot.seatIndex] : undefined;
      const seatAllowed = seat && !(isAnimal && seat.kind === 'bed');

      if (seatAllowed) {
        seat.occupiedBy = a.id;
        this.pendingSeat.set(a.id, seat);
        sprite.walkTo(seat.x, seat.y);
        return;
      }

      // There is a slot, but it is forbidden (animal + bed) — slot.x/y point at
      // the SAME seat, so walking there is not allowed: it would produce exactly
      // what we just forbade. Send them to free floor — at a rank that CANNOT
      // collide with a real standing rank: standing agents occupy floor ranks
      // 0..(standingCount-1), so the displaced animal takes standingCount plus
      // its own seatIndex (unique per seat, so two displaced animals cannot
      // collide either). The bijection wraps modulo the free cells, so an
      // out-of-range rank is safe by construction.
      const standingCount = Math.max(0, agentList.length - this.seats.length);
      const floor = seat
        ? standingSlot(this.venue, a.id, standingCount + slot.seatIndex!, this.furnitureFootprints)
        : slot;
      sprite.walkTo(floor.x, floor.y);
    });
```

Add the import: `import { assignSlots, isOverCapacity, standingSlot } from '../venueSlots.js';` and the type import `import type { FootprintRect } from '../venueSlots.js';`

- [ ] **Step 5: Test, typecheck, look at it**

Run: `npm test && npm run typecheck && npm run dev`
Expected: 14 new tests PASS; typecheck clean. In the cafe, agents fan out across the room rather than stacking on the spawn point — and nobody stands inside a table or on a bed (F-14).

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/game/venueSlots.ts packages/client/src/game/scenes/InteriorScene.ts test/venue-slots.test.ts
git commit -m "feat(runtime): deterministic slot assignment; standing slots exclude furniture footprints (R-3, F-14)"
```
