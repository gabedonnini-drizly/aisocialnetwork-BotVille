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
- **Comments and identifiers in `packages/client/` are Russian and load-bearing** — they record verified crop coordinates and frame layouts. Read them; never delete or "clean up" one. New comments in that package may be English.
- **`SCHEMA_VERSION = 1`**, exported from `@botville/shared`, and included in every `appearanceHash`.
- **Path segment rename: `limezu/` → `pack/`** throughout `public/assets/`. No directory, key or string in committed code may name a vendor.
- **The immutable boundary is exactly four fields:** `{ id, displayName, spriteSeed, venueId }`. Nothing may be added to `AgentPresence`.
- **Licensed art is never committed and never enters a publicly pushed image.** `assets-src/`, `public/assets/tilesets/pack/`, `public/assets/sprites/pack/`, `public/assets/ui/pack/`, `public/assets/baked/` stay gitignored.
- **Pure modules must not import Phaser.** `appearance/derive.mjs`, `venueRegistry.ts`, `PresenceModel.ts` and `AppearanceResolver`'s resolution half are unit-tested under `node --test`, which cannot load Phaser.
- **No non-erasable TypeScript: no parameter properties, no `enum`, no `namespace`.** `node --test` type-strips only — it never generates code. `constructor(private x: T)` fails with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on Node 22 *and* 24, and the error names the resolve hook's file, not yours. Declare the field and assign it in the constructor body. `packages/client/src/game/Pathfinder.ts:9` is the one pre-existing parameter property in the repo; it is Phaser-side and not node-tested — leave it, do not copy it.
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
- Modify: `scripts/world-bake.mjs` — emit `packages/client/src/game/venues.generated.ts`
- Create: `packages/client/src/game/venueRegistry.ts`
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

test('the registry enumerates all five venues, sorted', () => {
  assert.deepEqual(venueRegistry.all().map(v => v.id),
    ['cafe', 'district', 'dorm', 'library', 'office']);
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
  assert.deepEqual(venueRegistry.indoor().map(v => v.id), ['cafe', 'dorm', 'library', 'office']);
});

test('published() emits exactly the vocabulary fields', () => {
  const pub = venueRegistry.published();
  assert.equal(pub.length, 5);
  for (const v of pub) assert.deepEqual(Object.keys(v).sort(), ['capacity', 'id', 'indoor', 'label']);
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

Run: `npm test -- --test-name-pattern="the registry enumerates all five venues"`
Expected: FAIL — `Cannot find module '.../packages/client/src/game/venueRegistry.ts'`.

- [ ] **Step 3: Emit the generated module from the bake**

In `scripts/world-bake.mjs`, immediately after the `venues.json` write, add:

```js
  // The client cannot read venues/ at runtime, so the registry is generated
  // into a module Vite bundles statically.
  const generated = `// GENERATED by scripts/world-bake.mjs — do not edit.
import type { VenueDescriptor } from '@botville/shared';

export const VENUES: VenueDescriptor[] = ${JSON.stringify(venues, null, 2)};
`;
  write(join(generatedDir, 'venues.generated.ts'), generated);
```

`generatedDir`, never a repo path. Task 18 made it a required argument for exactly this: `test/bake/world-bake.test.mjs` calls `worldBake` eight times, and every one of those calls would otherwise rewrite a committed source file as a side effect of running the tests.

- [ ] **Step 4: Write the registry**

`packages/client/src/game/venueRegistry.ts`:

```ts
/**
 * Единственный рантайм-авторитет: какие места существуют.
 *
 * get() для неизвестного id возвращает undefined — это путь `unknown`
 * (спец §8.1), а не ошибка. Именно он позволяет платформе добавлять,
 * переименовывать и убирать места, не заставляя BotVille врать о том,
 * где находится агент.
 *
 * Не импортировать Phaser: модуль тестируется под node --test.
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
    return VENUES.map(({ id, label, indoor, capacity }) => ({ id, label, indoor, capacity }));
  },
};

/**
 * Место -> ключ сцены Phaser. Район рисуется своей сценой (машины, глоу,
 * день/ночь); все интерьеры — одной параметризованной VenueScene.
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
git add scripts/world-bake.mjs packages/client/src/game/venueRegistry.ts packages/client/src/game/venues.generated.ts test/venue-registry.test.ts
git commit -m "feat(runtime): venueRegistry with an unknown-id path and a bake-generated descriptor module"
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
   * Явное поле, не parameter property: `node --test` стирает типы, но не
   * умеет генерировать присваивание (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX).
   * Здесь Phaser и тестов под node нет — но отсюда конструктор копируют.
   */
  private readonly venue: VenueDescriptor;

  constructor(venue: VenueDescriptor) {
    super({ key: sceneKeyFor(venue.id) });
    this.venue = venue;
  }

  /** Ключ карты = id места; .tmj печёт scripts/world-bake.mjs. */
  private get mapKey() { return this.venue.id; }
  /** Локация этого места в терминах сервера: кто здесь — тех и рисуем. */
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

`VenueBaker` (Task 15) writes `targetVenue`, not `targetScene`. Replace `InteriorScene.ts:102-112` (the range starts at the `// выход:` comment on 102 — the snippet below includes it, so leaving 102 in place would duplicate it):

```ts
    // выход: зона над ковриком, hover подсвечивает коврик
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
/** @deprecated имя оставлено на время миграции; удаляется в задаче 24. */
export const InteriorScene = VenueScene;
```

- [ ] **Step 4: Compare the location filter against the venue id**

`InteriorScene.ts:222` reads `a.location === this.locationId`. `locationId` is now `venue.id`, and both `AGENT_LOCATIONS` (`Agent.ts:17`) and the venue ids use the same five strings plus `farm`. Leave the comparison as-is; only its source changed. Add above it:

```ts
    // ТЗ-16 + spec §8.1: id места == серверная локация. Неизвестный id
    // сюда просто не доходит — его отсеивает PresenceModel (задача 34).
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
- Modify: `packages/client/src/game/assetManifest.ts:71,100,195,211-218,243-247`
- Modify: `scripts/world-bake.mjs` — emit the generated asset index
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
/** Пары кадров иконок статусов. Специфичны для пака — живут в адаптере (I-1). */
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
    // Карты и атласы всех мест (генерирует scripts/world-bake.mjs)
    for (const v of venueRegistry.all()) {
      this.load.tilemapTiledJSON(v.id, `assets/tilemaps/${v.id}.tmj`);
    }
    for (const atlasId of new Set(venueRegistry.all().map(v => v.groundAtlas))) {
      this.load.image(atlasId, `assets/tilesets/pack/${atlasId}.png`);
    }

    // Пропсы: имя = ключ текстуры = имя файла
    for (const key of DISTRICT_PROPS) this.load.image(key, `assets/sprites/pack/district/${key}.png`);
    for (const key of INTERIOR_PROPS) this.load.image(key, `assets/sprites/pack/interior/${key}.png`);

    // Спрайтшиты агентов (люди + животные) — размеры кадров из манифеста
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
    // Иконки статусов — двухкадровая пульсация. Индексы кадров приходят
    // из адаптера пака через assets.generated.ts, не из кода (I-1).
    for (const [statusName, pair] of Object.entries(EMOTE_FRAMES)) {
      mk(`emote-icon-${statusName}`, EMOTES.icons.textureKey, [...pair], EMOTES.icons.frameRate);
    }
```

- [ ] **Step 5: Strip the frame indices out of `assetManifest.ts`**

Replace `assetManifest.ts:211-218` (the `byStatus` object) with:

```ts
    /**
     * Пары кадров по статусам агента специфичны для ПАКА и живут в
     * sources/<pack>.json (I-1). Читаются из assets.generated.ts.
     */
```

so `EMOTES.icons` keeps only `textureKey`, `frameWidth`, `frameHeight` and `frameRate`. Then fix every consumer: `AgentSprite.ts:278` currently reads `pair[0]` from `EMOTES.icons.byStatus`. Change it to import `EMOTE_FRAMES` from `../assets.generated.js` and read `EMOTE_FRAMES[status]`.

Also update the `limezu/` paths in `assetManifest.ts` — line 71 (`assets/sprites/limezu/Premade_Character_${nn}.png`), line 100 (`assets/sprites/limezu/${file}`), line 195 (`EMOTES.file`), line 225 (`UI_SHEET.file`) and lines 243-247 (`ANIMATED_OBJECTS`) — replacing the `limezu/` segment with `pack/`.

- [ ] **Step 6: Make `GameInit` build its scene list from the registry**

Replace `GameInit.ts:5-10` and line 29:

```ts
import { PreloaderScene } from './scenes/PreloaderScene.js';
import { DistrictScene } from './scenes/DistrictScene.js';
import { VenueScene } from './scenes/InteriorScene.js';
import { venueRegistry } from './venueRegistry.js';
```

```ts
    // Сцены перечисляются по реестру мест — добавление места кода не требует
    scene: [
      PreloaderScene,
      DistrictScene,
      ...venueRegistry.indoor().map(v => new VenueScene(v)),
    ],
```

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

In `config.ts`, delete `LOCATION_SCENES` (lines 11-23 — the doc comment opens with `/**` at 11; starting at 12 leaves an orphaned, unbalanced block comment), `INTERIORS` (142-148), `INTERIOR_IMAGES` (155-166) and `DISTRICT_IMAGES` (168-179). Keep `INTERIOR_TILESET` and `INTERIOR_CAMERA_ZOOM` — they are camera and tileset settings, not asset enumerations.

Replace the `LOCATION_SCENES` block with a pointer, so the next reader knows where it went:

```ts
/**
 * ТЗ-16: локация (правда сервера) -> сцена, которая её рисует.
 * Теперь это реестр мест: см. sceneKeyFor() в venueRegistry.ts.
 * 'farm' — загон/двор фермы, живёт на карте района.
 */
```

- [ ] **Step 4: Repoint every consumer**

Anywhere that read `LOCATION_SCENES[loc]`, call `sceneKeyFor(loc)` instead, importing from `./venueRegistry.js`. `'farm'` has no descriptor, so guard it explicitly where it appears:

```ts
// ферма рисуется на карте района, отдельного места у неё нет
const sceneFor = (loc: AgentLocation) => (loc === 'farm' ? 'DistrictScene' : sceneKeyFor(loc));
```

In `DistrictScene.ts`, door and building objects now carry `targetVenue` instead of `targetScene`; change the property lookup and wrap it in `sceneKeyFor(...)`, exactly as Task 22 Step 2 did for interiors.

- [ ] **Step 5: Simplify `SceneRegistry.ts`**

The stray `import Phaser from 'phaser';` at line 25 sits *below* its use. Move it to the top and drop the comment:

```ts
import Phaser from 'phaser';
import type { DistrictScene } from './scenes/DistrictScene.js';

/** Ссылки на активные сцены, чтобы React/store могли вызывать их методы. */
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
 * Присутствие: РОВНО три состояния (I-3).
 *
 *   venueId есть и известен  -> somewhere: рисуем в этом месте
 *   venueId === null         -> absent:    не рисуем, в HUD «нет на месте»
 *   venueId есть, но НЕ известен -> unknown: не рисуем нигде, в HUD «неизвестно»
 *
 * Третья строка — то, что позволяет платформе добавлять, переименовывать и
 * убирать места в любой момент, а BotVille при этом не врёт о том, где
 * находится агент. Никакого четвёртого состояния клиент не придумывает.
 *
 * Не импортирует Phaser: тестируется под node --test.
 */
import type { AgentPresence, PresenceState } from '@botville/shared';

interface VenueLookup { has(id: string): boolean }

export function resolvePresence(p: AgentPresence, registry: VenueLookup): PresenceState {
  if (p.venueId === null) return { kind: 'absent' };
  if (!registry.has(p.venueId)) return { kind: 'unknown' };
  return { kind: 'somewhere', venueId: p.venueId };
}

export interface PresencePartition {
  /** место -> кто в нём */
  somewhere: Map<string, AgentPresence[]>;
  absent: AgentPresence[];
  unknown: AgentPresence[];
}

export class PresenceModel {
  /** Явное поле: parameter property не переживает strip-only type stripping. */
  private readonly registry: VenueLookup;

  constructor(registry: VenueLookup) {
    this.registry = registry;
  }

  resolve(p: AgentPresence): PresenceState {
    return resolvePresence(p, this.registry);
  }

  /** Разложить ростер по состояниям. Никто не теряется. */
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
- Modify: `packages/client/src/game/config.ts:40-45`
- Modify: `packages/client/src/game/cameraControls.ts` — step by rung
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
 * Лестница зума: только чистые кратности. Нецелый зум на 16px-арте даёт
 * мерцание и неровный размер пикселя (спец §10.1) — старый шаг 1.3 от
 * initialZoom 1.8 попадал ровно в это. Управление ходит по ступеням.
 */
export const ZOOM_LADDER: readonly number[] = [0.5, 1, 2, 3, 4] as const;

export const CAMERA = {
  initialZoom: 2,
  minZoom: ZOOM_LADDER[0],
  maxZoom: ZOOM_LADDER[ZOOM_LADDER.length - 1],
} as const;

/** Ближайшая ступень лестницы — для пинча и любого произвольного зума. */
export function snapZoom(z: number): number {
  return ZOOM_LADDER.reduce((best, r) => (Math.abs(r - z) < Math.abs(best - z) ? r : best), ZOOM_LADDER[0]);
}

/** Ровно одна ступень вверх (+1) или вниз (-1), с зажимом на концах. */
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

and delete `INTERIOR_CAMERA_ZOOM`.

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

**Files:**
- Create: `packages/client/src/game/venueSlots.ts`
- Modify: `packages/client/src/game/scenes/InteriorScene.ts:232-251`
- Test: `test/venue-slots.test.ts`

**Interfaces:**
- Consumes: `hashString` (**Plan 1 Task 2**, `packages/shared/src/hash.mjs`), `VenueDescriptor` (Plan 1 Task 2). Nothing in this task depends on Plan 4.
- Produces `packages/client/src/game/venueSlots.ts`:
  - `assignSlots(venue: VenueDescriptor, agentIds: string[]): Map<string, { x: number; y: number; seatIndex: number | null }>`
  - `standingSlot(venue, agentId, rank): { x: number; y: number }`
  - `isOverCapacity(venue, count): boolean`

- [ ] **Step 1: Write the failing test**

`test/venue-slots.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignSlots, standingSlot, isOverCapacity } from '../packages/client/src/game/venueSlots.ts';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';

const cafe = venueRegistry.get('cafe')!;
const ids = (n: number) => Array.from({ length: n }, (_, i) => `agent_${i}`);

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
 * Детерминированное распределение агентов по местам внутри места.
 *
 * Шесть мест и город на 150 агентов — это ~25 агентов на комнату 20x15 с
 * 4-9 стульями (спец §10.3). Раньше syncAgents раскладывал новичков по трём
 * колонкам от точки спавна и назначал первый свободный стул — то есть
 * зависел от порядка прихода: один и тот же агент при перезагрузке
 * оказывался в разных местах.
 *
 * Здесь порядок не участвует: место выводится из agentId и id места.
 * Одинаковый ростер -> одинаковая расстановка, всегда.
 *
 * В scope: capacity и раскладка. НЕ в scope: UX переполнения — его надо
 * оценивать на населённом мире, придумывать сейчас было бы гаданием (R-3).
 *
 * Не импортирует Phaser: тестируется под node --test.
 */
import { hashString } from '@botville/shared/hash.mjs';
import type { VenueDescriptor } from '@botville/shared';

const T = 16;

export interface Slot { x: number; y: number; seatIndex: number | null }

export function isOverCapacity(venue: VenueDescriptor, count: number): boolean {
  return count > venue.capacity;
}

/**
 * Наибольший шаг, взаимно простой с числом клеток. Гарантирует, что
 * rank -> cell — БИЕКЦИЯ на первых N рангах: двое стоящих агентов не могут
 * попасть в одну клетку. Прежний вариант подмешивал в cell хеш агента, и
 * коллизии становились возможны — тест мог падать через раз.
 */
function strideFor(cells: number): number {
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  for (let s = Math.floor(cells / 2) | 1; s > 1; s -= 2) if (gcd(s, cells) === 1) return s;
  return 1;
}

/**
 * Позиция стоящего агента: клетка свободного пола, выведенная из ранга.
 *
 * Индивидуальность даёт не хеш ЗДЕСЬ, а порядок в assignSlots: ранг агента
 * выводится из его seed. Поэтому раскладка одновременно детерминированная,
 * зависящая от агента и БЕЗ коллизий, пока стоящих меньше, чем клеток.
 */
export function standingSlot(venue: VenueDescriptor, agentId: string, rank: number): { x: number; y: number } {
  const [W, H] = venue.sizeTiles;
  // пол: от 2-го ряда (под стенами) до предпоследнего, без крайних колонок
  const cols = W - 4;
  const rows = H - 5;
  const cells = cols * rows;

  // Сдвиг — свойство МЕСТА, не агента: разные комнаты заполняются по-разному,
  // но внутри комнаты отображение остаётся биекцией.
  const offset = hashString(venue.id, 'slot:offset') % cells;
  const cell = (rank * strideFor(cells) + offset) % cells;

  const cx = 2 + (cell % cols);
  const cy = 3 + Math.floor(cell / cols);
  return { x: cx * T + T / 2, y: cy * T + T / 2 };
}

/**
 * Раздать места всему ростеру за один проход.
 * Стулья заполняются раньше, чем кто-то встаёт; порядок ростера не влияет.
 */
export function assignSlots(venue: VenueDescriptor, agentIds: string[]): Map<string, Slot> {
  // стабильный порядок независимо от того, в каком порядке пришёл ростер
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
      const { x, y } = standingSlot(venue, id, rank - venue.seats.length);
      out.set(id, { x, y, seatIndex: null });
    }
  });
  return out;
}
```

- [ ] **Step 4: Use it in the scene**

Replace `InteriorScene.ts:232-251`:

```ts
    // Детерминированная раскладка: стулья заполняются раньше стоящих, и
    // один и тот же агент при перезагрузке садится на то же место.
    const slots = assignSlots(this.venue, agentList.map(a => a.id));
    if (isOverCapacity(this.venue, agentList.length)) {
      // R-3: UX переполнения отложен; факт фиксируем, чтобы он был виден
      console.debug(`[${this.venue.id}] over capacity: ${agentList.length}/${this.venue.capacity}`);
    }

    agentList.forEach(a => {
      if (this.agentSprites.has(a.id)) return;
      const slot = slots.get(a.id)!;
      const sprite = new AgentSprite(this, a.id, a.name, a.avatarVariant, this.spawnPoint.x, this.spawnPoint.y);
      this.agentSprites.set(a.id, sprite);

      // животные на кровати не забираются
      const isAnimal = getVariant(a.avatarVariant).kind === 'animal';
      const seat = slot.seatIndex !== null ? this.seats[slot.seatIndex] : undefined;
      const seatAllowed = seat && !(isAnimal && seat.kind === 'bed');

      if (seatAllowed) {
        seat.occupiedBy = a.id;
        this.pendingSeat.set(a.id, seat);
        sprite.walkTo(seat.x, seat.y);
        return;
      }

      // Место есть, но оно запрещено (животное + кровать) — slot.x/y указывают
      // на ТО ЖЕ сиденье, поэтому идти туда нельзя: получится ровно то, что
      // мы только что запретили. Отправляем на свободный пол по тому же рангу.
      const rank = [...slots.keys()].indexOf(a.id);
      const floor = seat ? standingSlot(this.venue, a.id, rank) : slot;
      sprite.walkTo(floor.x, floor.y);
    });
```

Add the import: `import { assignSlots, isOverCapacity, standingSlot } from '../venueSlots.js';`

- [ ] **Step 5: Test, typecheck, look at it**

Run: `npm test && npm run typecheck && npm run dev`
Expected: 10 new tests PASS; typecheck clean. In the cafe, agents fan out across the room rather than stacking on the spawn point.

- [ ] **Step 6: Commit**

```bash
git add packages/client/src/game/venueSlots.ts packages/client/src/game/scenes/InteriorScene.ts test/venue-slots.test.ts
git commit -m "feat(runtime): deterministic in-venue slot assignment with capacity awareness (R-3)"
```
