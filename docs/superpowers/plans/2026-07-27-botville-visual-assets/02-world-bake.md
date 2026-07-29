# BotVille Visual Assets — Plan 2: The world bake

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Plan 2 of 6.** Index and sequencing: [`00-INDEX.md`](00-INDEX.md). Spec: `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md` (commit `d695881`) — approved, do not re-brainstorm.

**Goal:** Turn venues into data. Five descriptors plus one bake replace ~35KB of imperative crop coordinates, and adding a place stops requiring code.

**Architecture:** `AtlasBuilder` packs ordered tiles into a ground atlas (order defines GID). `PropBaker` emits one trimmed PNG per contract name and records its true size. `VenueBaker` turns a descriptor into a `.tmj`, reading object sizes from the baked bitmaps and deriving collision from furniture footprints. `districtGround.cityGrid` is the seeded outdoor generator, with its PRNG consumption order preserved exactly. `scripts/world-bake.mjs` runs all of it and publishes `venues.json`.

**Tech Stack:** Node ≥24 (ESM), TypeScript 5.7, Phaser 3.88, Vite 6, npm workspaces + Turbo, `node:test` (no new test dependency), the existing `scripts/png-lib.mjs` PNG codec, Postgres (`aisocialnetwork-api` only), Docker Compose.

**Depends on:** Plan 1 — the contract, the adapter, the reader and the fixture pack.

**Exit criterion:** `npm run bake:world` builds the entire world from data. A venue descriptor that no code mentions produces a loadable map and joins the published vocabulary (G-C, asserted). The old build scripts are frozen under `test/golden/legacy/` and nothing runs them.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Node ≥ 24.** Root `package.json` `engines: { "node": ">=24.0.0" }`, `.nvmrc` = `24`. ESM everywhere (`"type": "module"`).
- **No new npm dependencies.** Not in `packages/client`, not in `packages/server`, not at the root. Build tooling uses `node:` builtins plus the existing `scripts/png-lib.mjs`. Tests use `node:test` + `node:assert/strict`.
- **Build tooling is `.mjs` under `scripts/`; runtime is TypeScript under `packages/`.** Follow the existing split exactly.
- **Comments and identifiers in `packages/client/` are Russian and load-bearing** — they record verified crop coordinates and frame layouts. Read them; never delete or "clean up" one. New comments in that package may be English.
- **`SCHEMA_VERSION = 1`**, exported from `@botville/shared`, and included in every `appearanceHash`.
- **Path segment rename: `limezu/` → `pack/`** throughout `public/assets/`. No directory, key or string in committed code may name a vendor.
- **The immutable boundary is exactly four fields:** `{ id, displayName, spriteSeed, venueId }`. Nothing may be added to `AgentPresence`.
- **Licensed art is never committed and never enters a publicly pushed image.** `assets-src/`, `public/assets/tilesets/pack/`, `public/assets/sprites/pack/`, `public/assets/ui/pack/`, `public/assets/baked/` stay gitignored.
- **Pure modules must not import Phaser.** `appearance/derive.mjs`, `venueRegistry.ts`, `PresenceModel.ts` and `AppearanceResolver`'s resolution half are unit-tested under `node --test`, which cannot load Phaser.
- **`.mjs` must never import a `.ts` file, directly or transitively.** `test/ts-resolve.mjs` only exists inside `node --test`. A `.mjs` module in `packages/shared/` or `scripts/` is loaded by bare `node` (the bake CLIs) and by Vite (the client bundle), and **neither rewrites `.js` → `.ts`**. Constants a `.mjs` module needs live in a sibling `.mjs`. See Task 2's `schemaVersion.mjs`.
- **Library functions never write to the source tree.** `worldBake()` takes `outDir` and `generatedDir` as *required* arguments; only the CLI wrapper supplies the repo defaults. `npm test` must leave `git status --porcelain` empty — Task 18 asserts it.
- **No absolute path to a sibling repo, anywhere.** Cross-repo lookups go through `test/helpers/siblingRepo.mjs` (BotVille) / `tests/helpers/siblingRepo.js` (api): `$BOTVILLE_API_REPO` → `$BOTVILLE_REPO` → sibling of the repo root → explicit skip with a reason. A hardcoded `/Users/home/...` is a review failure.
- **Test expectations are derived, never transcribed.** No test may hardcode a count that the contract, a descriptor or a generator parameter already determines. Assert `bakeProps(...).size === Object.keys(contract.props.district).length`, not `=== 32`. Golden *pixels* are the one exception — those are snapshots by definition.
- **Deployment is Vercel (client) + Railway (server), not Docker.** `vercel.json`, `railway.toml` and `scripts/deploy-server.mjs` are the production paths and must keep working. Docker is local-parity and self-host only. See Task 35.
- **Invariants I-1 … I-13 (spec §11) are binding.** Each is asserted by a named test in this plan.
- **Scope bar (owner, binding):** art-driven changes only. Do not repoint `packages/client/src/lib/api.ts`, do not delete or modify `packages/server/src/world/agentLife.ts`, do not replace SQLite, do not touch the key vault / model picker / heartbeat / MCP registry. This is not the integration work.

---

## Tasks in this plan

- **Task 11** — `AtlasBuilder`
- **Task 12** — `PropBaker`
- **Task 13** — Venue descriptors — the four interiors
- **Task 14** — Venue descriptor — the district
- **Task 15** — `VenueBaker` — interiors
- **Task 16** — The `cityGrid` ground generator
- **Task 17** — `VenueBaker` — the district
- **Task 18** — `world-bake.mjs`, `venues.json`, and the `pack/` rename
- **Task 19** — Retire the old build scripts
- **Task 19a** — Retire `sync-assets.mjs`'s hardcoded file list
- **Task 25** — The fixture-venue test

---

## Task 11: `AtlasBuilder`

Pack an ordered tile list into a ground atlas. **Order defines GID** — this is the one place where a reordering silently corrupts every map that references it, so the builder returns the gid map it produced rather than letting callers recompute it.

**Files:**
- Create: `scripts/lib/atlasBuilder.mjs`
- Test: `test/atlas-builder.test.mjs`

**Interfaces:**
- Consumes: `readSprite()` (Task 9), `createCanvas` from `png-lib.mjs`.
- Produces `scripts/lib/atlasBuilder.mjs`:
  - `buildAtlas(contract, adapter, atlasId) → { id, canvas, columns, rows, tileCount, gid: Record<string, number> }`
  - `gid[tileName] = index + 1`, matching the `.tmj` firstgid-1 convention used by both existing build scripts.

- [ ] **Step 1: Write the failing test**

`test/atlas-builder.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { buildAtlas } from '../scripts/lib/atlasBuilder.mjs';

const c = loadContract();
const a = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('the district atlas is 8 columns x 3 rows for 23 tiles', () => {
  const at = buildAtlas(c, a(), 'district_ground');
  assert.equal(at.tileCount, 23);
  assert.equal(at.columns, 8);
  assert.equal(at.rows, 3);
  assert.equal(at.canvas.w, 128);
  assert.equal(at.canvas.h, 48);
});

test('the interiors atlas is 8 columns x 2 rows for 13 tiles', () => {
  const at = buildAtlas(c, a(), 'interiors_ground');
  assert.equal(at.canvas.w, 128);
  assert.equal(at.canvas.h, 32);
});

test('gid is index+1 in contract order', () => {
  const at = buildAtlas(c, a(), 'district_ground');
  assert.equal(at.gid.grass, 1);
  assert.equal(at.gid.grassA, 2);
  assert.equal(at.gid.dirtA, 23);
});

test('each tile lands at its row-major slot', () => {
  const at = buildAtlas(c, a(), 'district_ground');
  // tile index 8 -> column 0, row 1 -> pixel (0, 16)
  const i = (16 * at.canvas.w + 0) * 4;
  assert.equal(at.canvas.data[i + 3], 0, 'slot corner is the fixture 1px transparent margin');
  const j = ((16 + 1) * at.canvas.w + 1) * 4;
  assert.equal(at.canvas.data[j + 3], 255, 'slot interior is opaque');
});

test('the atlas is deterministic', () => {
  assert.deepEqual([...buildAtlas(c, a(), 'district_ground').canvas.data],
                   [...buildAtlas(c, a(), 'district_ground').canvas.data]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the district atlas is 8 columns"`
Expected: FAIL — `Cannot find module '.../scripts/lib/atlasBuilder.mjs'`.

- [ ] **Step 3: Write the builder**

`scripts/lib/atlasBuilder.mjs`:

```js
/**
 * Packs an ordered tile list into a ground atlas.
 * ORDER DEFINES GID. Reordering contract.groundAtlases[id].tiles silently
 * corrupts every .tmj that references the atlas — so the gid map is
 * returned here rather than recomputed by callers.
 */
import { createCanvas } from '../png-lib.mjs';
import { readSprite, asSource } from './spriteReader.mjs';

export function buildAtlas(contract, adapter, atlasId) {
  const def = contract.groundAtlases[atlasId];
  if (!def) throw new Error(`unknown ground atlas: ${atlasId}`);
  const T = contract.tileSize;
  const columns = def.columns;
  const rows = Math.ceil(def.tiles.length / columns);

  const canvas = createCanvas(columns * T, rows * T);
  const gid = {};

  def.tiles.forEach((name, i) => {
    const s = readSprite(adapter, name);
    if (s.w !== T || s.h !== T) throw new Error(`tile ${name} is ${s.w}x${s.h}, atlas needs ${T}x${T}`);
    canvas.blit(asSource(s.canvas), 0, 0, T, T, (i % columns) * T, Math.floor(i / columns) * T);
    gid[name] = i + 1;
  });

  return { id: atlasId, canvas, columns, rows, tileCount: def.tiles.length, gid };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 5 new tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/atlasBuilder.mjs test/atlas-builder.test.mjs
git commit -m "feat(bake): AtlasBuilder — ordered ground atlas with an explicit gid map"
```

---

## Task 12: `PropBaker`

Emit one trimmed PNG per contract prop name, and record its true size so `VenueBaker` can stamp honest object dimensions into the `.tmj` (spec §5.1: "true object sizes are read from baked bitmaps"). This is what removes the one hard binding the spec identified — object sizes baked into the `.tmj` by hand.

It also carries the one generator the pack forces on us: `bookSign`, from `build-district.mjs:96-126`. The pack has no book shop, so a "BOOKS" plate is stamped onto a hardware-store facade. That is pack knowledge, so it is named by the adapter (Task 6) and implemented here.

**Files:**
- Create: `scripts/lib/propBaker.mjs`
- Test: `test/prop-baker.test.mjs`

**Interfaces:**
- Consumes: `readSprite()`, `asSource()`, `loadContract()`, `loadAdapter()`.
- Produces `scripts/lib/propBaker.mjs`:
  - `bakeProps(contract, adapter, group) → Map<string, { canvas, w, h }>` — `group` is `'district'` or `'interior'`.
  - `writeProps(baked, outDir) → string[]` — writes `<outDir>/<name>.png`, returns relative paths.
  - `GENERATORS` — a named map; `bookSign(canvas)` is its only member.

- [ ] **Step 1: Write the failing test**

`test/prop-baker.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { bakeProps, writeProps, GENERATORS } from '../scripts/lib/propBaker.mjs';

const c = loadContract();
const a = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('every contract prop bakes, in both groups', () => {
  for (const group of Object.keys(c.props)) {
    assert.equal(bakeProps(c, a(), group).size, Object.keys(c.props[group]).length, group);
  }
});

test('baked size is the true trimmed bitmap, not the contract maxSize', () => {
  const baked = bakeProps(c, a(), 'interior');
  const stool = baked.get('stool');
  const [mw, mh] = c.props.interior.stool.maxSize;
  assert.equal(stool.w, mw - 2, 'fixture insets by 1px per side');
  assert.equal(stool.h, mh - 2);
  assert.equal(stool.w, stool.canvas.w);
});

test('writeProps emits one PNG per name', () => {
  const dir = mkdtempSync(join(tmpdir(), 'props-'));
  const expected = Object.keys(c.props.district).length;
  const written = writeProps(bakeProps(c, a(), 'district'), dir);
  assert.equal(written.length, expected);
  assert.equal(readdirSync(dir).filter(f => f.endsWith('.png')).length, expected);
});

test('the bookSign generator stamps a plate and leaves the base visible', () => {
  const baked = bakeProps(c, a(), 'district');
  const lib = baked.get('library_building');
  assert.ok(lib.w > 0 && lib.h > 0);
  assert.ok(typeof GENERATORS.bookSign === 'function');
});

test('baking is deterministic', () => {
  const x = bakeProps(c, a(), 'interior').get('counter_wide');
  const y = bakeProps(c, a(), 'interior').get('counter_wide');
  assert.deepEqual([...x.canvas.data], [...y.canvas.data]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="every contract prop bakes"`
Expected: FAIL — `Cannot find module '.../scripts/lib/propBaker.mjs'`.

- [ ] **Step 3: Write the baker**

`scripts/lib/propBaker.mjs`:

```js
/**
 * Emits one trimmed PNG per contract prop name and records its TRUE size.
 * VenueBaker stamps those sizes into the .tmj, which is what removes the
 * hand-authored object dimensions the old maps carried.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createCanvas, encodePng } from '../png-lib.mjs';
import { readSprite, asSource } from './spriteReader.mjs';

/**
 * Named pixel generators for props no pack supplies. Referenced by name
 * from sources/<pack>.json, never called from runtime code.
 */
export const GENERATORS = {
  /**
   * The packs ship no book shop, so a MARKET-style plate reading BOOKS is
   * stamped onto a generic building facade (was build-district.mjs:96-126).
   */
  bookSign(src) {
    const FONT = {
      B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
      O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
      K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
      S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    };
    const TEXT = 'BOOKS';
    const cv = createCanvas(src.w, src.h);
    cv.blit(asSource(src), 0, 0, src.w, src.h, 0, 0);

    const textW = TEXT.length * 6 - 1;
    const plateW = textW + 8, plateH = 13;
    const px0 = Math.floor((src.w - plateW) / 2), py0 = 85;
    const BORDER = [42, 42, 62, 255], PLATE = [233, 230, 238, 255], INK = [52, 52, 84, 255];

    for (let y = 0; y < plateH; y++) {
      for (let x = 0; x < plateW; x++) {
        const edge = x === 0 || y === 0 || x === plateW - 1 || y === plateH - 1;
        cv.set(px0 + x, py0 + y, edge ? BORDER : PLATE);
      }
    }
    TEXT.split('').forEach((ch, i) => {
      const glyph = FONT[ch];
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 5; x++)
          if (glyph[y][x] === '#') cv.set(px0 + 4 + i * 6 + x, py0 + 3 + y, INK);
    });
    return cv;
  },
};

/** @returns {Map<string, {canvas: object, w: number, h: number}>} */
export function bakeProps(contract, adapter, group) {
  const defs = contract.props[group];
  if (!defs) throw new Error(`unknown prop group: ${group}`);
  const out = new Map();

  for (const name of Object.keys(defs)) {
    const s = readSprite(adapter, name);
    const gen = adapter.resolve(name).generated;
    if (gen) {
      const fn = GENERATORS[gen];
      if (!fn) throw new Error(`prop ${name} names unknown generator: ${gen}`);
      const canvas = fn(s.canvas);
      out.set(name, { canvas, w: canvas.w, h: canvas.h });
    } else {
      out.set(name, { canvas: s.canvas, w: s.w, h: s.h });
    }
  }
  return out;
}

/** @returns {string[]} written file names */
export function writeProps(baked, outDir) {
  const written = [];
  for (const [name, { canvas }] of baked) {
    const p = join(outDir, `${name}.png`);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, encodePng(canvas));
    written.push(`${name}.png`);
  }
  return written.sort();
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 6 new tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/propBaker.mjs test/prop-baker.test.mjs
git commit -m "feat(bake): PropBaker with true-bitmap sizes and named pixel generators"
```

---

## Task 13: Venue descriptors — the four interiors

Transcribe the four `buildRoom({...})` calls from `build-interiors.mjs:230-360` into `venues/<id>/venue.json`. The existing call signature already *is* a venue descriptor — this task only moves it from an argument object to a file.

`capacity` is new and comes from spec §5.3 / §10.3. Set it to the seat count of each room, which is what the art actually supports.

**Files:**
- Create: `venues/office/venue.json`, `venues/cafe/venue.json`, `venues/dorm/venue.json`, `venues/library/venue.json`
- Test: `test/venue-descriptors.test.mjs`

**Interfaces:**
- Consumes: `VenueDescriptor` (Task 2), `loadContract()` (Task 4).
- Produces: four descriptor files conforming to `VenueDescriptor`. Task 15 bakes them; Task 21 loads them at runtime; Task 18 publishes their `{id,label,indoor,capacity}` into `venues.json`.

- [ ] **Step 1: Write the failing test**

`test/venue-descriptors.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const load = id => JSON.parse(readFileSync(`venues/${id}/venue.json`, 'utf8'));
const INTERIORS = ['office', 'cafe', 'dorm', 'library'];
const c = loadContract();

test('all four interior descriptors exist', () => {
  for (const id of INTERIORS) assert.ok(existsSync(`venues/${id}/venue.json`), id);
});

test('interiors are 20x15 on the interiors_ground atlas', () => {
  for (const id of INTERIORS) {
    const v = load(id);
    assert.deepEqual(v.sizeTiles, [20, 15], id);
    assert.equal(v.groundAtlas, 'interiors_ground', id);
    assert.equal(v.indoor, true, id);
  }
});

test('every ground key names a tile in the atlas', () => {
  const tiles = new Set(c.groundAtlases.interiors_ground.tiles);
  for (const id of INTERIORS) {
    const g = load(id).ground;
    for (const key of ['wallA', 'wallB', 'floor']) assert.ok(tiles.has(g[key]), `${id}.${key}=${g[key]}`);
  }
});

test('every furniture and animated name is in the contract', () => {
  const props = new Set(Object.keys(c.props.interior));
  const anims = new Set(Object.keys(c.animatedObjects));
  for (const id of INTERIORS) {
    const v = load(id);
    for (const f of v.furniture) assert.ok(props.has(f.name), `${id}: ${f.name}`);
    for (const a of v.animated) assert.ok(anims.has(a.name), `${id}: ${a.name}`);
  }
});

test('capacity equals the seat count the art supports', () => {
  assert.equal(load('office').seats.length, 4);
  assert.equal(load('cafe').seats.length, 9);
  assert.equal(load('dorm').seats.length, 6);
  assert.equal(load('library').seats.length, 4);
  for (const id of INTERIORS) assert.equal(load(id).capacity, load(id).seats.length, id);
});

test('every interior exits to the district', () => {
  for (const id of INTERIORS) {
    const v = load(id);
    assert.equal(v.doors.length, 1, id);
    assert.equal(v.doors[0].targetVenue, 'district', id);
  }
});

test('descriptor ids match their directory', () => {
  for (const dir of readdirSync('venues')) assert.equal(load(dir).id, dir);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="all four interior descriptors exist"`
Expected: FAIL — `ENOENT ... venues/office/venue.json`.

- [ ] **Step 3: Write `venues/office/venue.json`**

Transcribed from `build-interiors.mjs:230-259`. `collide: false` reproduces the `false` fourth element in the original furniture tuples.

```json
{
  "id": "office",
  "label": "Office",
  "indoor": true,
  "sizeTiles": [20, 15],
  "groundAtlas": "interiors_ground",
  "capacity": 4,
  "ground": { "wallA": "wallOfficeA", "wallB": "wallOfficeB", "floor": "floorOffice" },
  "furniture": [
    { "name": "workstation_single", "at": [2, 1.2] },
    { "name": "workstation_double", "at": [6.5, 1.2] },
    { "name": "workstation_single", "at": [12, 1.2] },
    { "name": "whiteboard", "at": [15.5, 0.2], "collide": false },
    { "name": "printer", "at": [17.5, 1.6] },
    { "name": "coffee_machine", "at": [1.2, 5.5] },
    { "name": "plant_pot", "at": [18, 5] },
    { "name": "plant_small", "at": [1.2, 12] },
    { "name": "table_plain", "at": [7, 6.5] },
    { "name": "table_plain", "at": [10, 6.5] },
    { "name": "chair_blue_r", "at": [5.4, 6.8], "collide": false },
    { "name": "chair_blue_r", "at": [5.4, 8.3], "collide": false },
    { "name": "chair_blue_l", "at": [13.2, 6.8], "collide": false },
    { "name": "chair_blue_l", "at": [13.2, 8.3], "collide": false },
    { "name": "plant_palm", "at": [17.5, 10.5] }
  ],
  "seats": [
    { "at": [6.2, 8.6],  "side": "right", "kind": "chair" },
    { "at": [6.2, 10.1], "side": "right", "kind": "chair" },
    { "at": [14, 8.6],   "side": "left",  "kind": "chair" },
    { "at": [14, 10.1],  "side": "left",  "kind": "chair" }
  ],
  "animated": [
    { "name": "office_screen", "at": [4.5, 0.3] },
    { "name": "coffee_steam", "at": [1.5, 4.6] }
  ],
  "spawns": [[9.8, 12.5]],
  "doors": [{ "name": "exit", "at": [9.5, 14], "targetVenue": "district" }],
  "glows": []
}
```

- [ ] **Step 4: Write `venues/cafe/venue.json`**

From `build-interiors.mjs:261-297`. The comment at 277-279 explains the 3.5-tile offset of the lower table — keep the coordinates exactly.

```json
{
  "id": "cafe",
  "label": "Café",
  "indoor": true,
  "sizeTiles": [20, 15],
  "groundAtlas": "interiors_ground",
  "capacity": 9,
  "ground": { "wallA": "wallCafeA", "wallB": "wallCafeB", "floor": "floorCafe" },
  "furniture": [
    { "name": "counter_wide", "at": [2, 3.6] },
    { "name": "counter_wide", "at": [5.25, 3.6] },
    { "name": "coffee_machine", "at": [2.4, 2] },
    { "name": "stool", "at": [3, 5.6], "collide": false },
    { "name": "stool", "at": [5, 5.6], "collide": false },
    { "name": "stool", "at": [7, 5.6], "collide": false },
    { "name": "table_plain", "at": [3, 8.5] },
    { "name": "chair_red_r", "at": [1.4, 8.8], "collide": false },
    { "name": "chair_red_l", "at": [6.2, 8.8], "collide": false },
    { "name": "table_plain", "at": [13, 8.5] },
    { "name": "chair_red_r", "at": [11.4, 8.8], "collide": false },
    { "name": "chair_red_l", "at": [16.2, 8.8], "collide": false },
    { "name": "table_plain", "at": [4.5, 11],
      "note": "lower table sits left of the doorway: the mat (x145-175) and the entry stay clear. Offset is exactly 3.5 tiles — any less and the left chair (+3.2 tiles) lands on the mat (owner note after ТЗ-09)" },
    { "name": "chair_yellow_r", "at": [2.9, 11.3], "collide": false },
    { "name": "chair_yellow_l", "at": [7.7, 11.3], "collide": false },
    { "name": "plant_palm", "at": [17.5, 1.4] },
    { "name": "plant_pot", "at": [1.2, 12] }
  ],
  "seats": [
    { "at": [3.5, 6.6],  "side": "right", "kind": "stool" },
    { "at": [5.5, 6.6],  "side": "left",  "kind": "stool" },
    { "at": [7.5, 6.6],  "side": "right", "kind": "stool" },
    { "at": [2.2, 10.6], "side": "right", "kind": "chair" },
    { "at": [7, 10.6],   "side": "left",  "kind": "chair" },
    { "at": [12.2, 10.6],"side": "right", "kind": "chair" },
    { "at": [17, 10.6],  "side": "left",  "kind": "chair" },
    { "at": [3.7, 13.1], "side": "right", "kind": "chair" },
    { "at": [8.5, 13.1], "side": "left",  "kind": "chair" }
  ],
  "animated": [
    { "name": "cake_fridge", "at": [10.5, 1.6] },
    { "name": "coffee_steam", "at": [4.8, 2.6] }
  ],
  "spawns": [[9.8, 12.8]],
  "doors": [{ "name": "exit", "at": [9.5, 14], "targetVenue": "district" }],
  "glows": []
}
```

- [ ] **Step 5: Write `venues/dorm/venue.json`**

From `build-interiors.mjs:299-327`.

```json
{
  "id": "dorm",
  "label": "Dorm",
  "indoor": true,
  "sizeTiles": [20, 15],
  "groundAtlas": "interiors_ground",
  "capacity": 6,
  "ground": { "wallA": "wallDormA", "wallB": "wallDormB", "floor": "floorDorm" },
  "furniture": [
    { "name": "bed_green", "at": [2, 1.6] },
    { "name": "bed_blue", "at": [6, 1.6] },
    { "name": "bed_teal", "at": [12, 1.6] },
    { "name": "bed_green", "at": [16, 1.6] },
    { "name": "nightstand", "at": [4.3, 2.4] },
    { "name": "nightstand", "at": [14.3, 2.4] },
    { "name": "rug_pink", "at": [8, 8.4], "collide": false },
    { "name": "armchair_grey_r", "at": [6, 7.25],
      "note": "armchair bottom (42px from ty) sits on the seat line — a seated agent draws over the seat, the back rises above their head" },
    { "name": "armchair_grey_l", "at": [12.2, 7.25] },
    { "name": "plant_palm", "at": [1.2, 8] },
    { "name": "lamp_red", "at": [18, 7.6] },
    { "name": "plant_pot", "at": [18, 12] }
  ],
  "seats": [
    { "at": [2.8, 3.4],  "side": "right", "kind": "bed" },
    { "at": [6.8, 3.4],  "side": "right", "kind": "bed" },
    { "at": [12.8, 3.4], "side": "left",  "kind": "bed" },
    { "at": [16.8, 3.4], "side": "left",  "kind": "bed" },
    { "at": [6.9, 9.9],  "side": "right", "kind": "chair" },
    { "at": [13, 9.9],   "side": "left",  "kind": "chair" }
  ],
  "animated": [{ "name": "tv_news", "at": [9, 0.4] }],
  "spawns": [[9.8, 12.8]],
  "doors": [{ "name": "exit", "at": [9.5, 14], "targetVenue": "district" }],
  "glows": []
}
```

- [ ] **Step 6: Write `venues/library/venue.json`**

From `build-interiors.mjs:329-360`.

```json
{
  "id": "library",
  "label": "Library",
  "indoor": true,
  "sizeTiles": [20, 15],
  "groundAtlas": "interiors_ground",
  "capacity": 4,
  "ground": { "wallA": "wallLibA", "wallB": "wallLibB", "floor": "floorLib" },
  "furniture": [
    { "name": "bookshelf_a", "at": [1, 0.7] },
    { "name": "bookshelf_b", "at": [4, 0.7] },
    { "name": "bookshelf_a", "at": [7, 0.7] },
    { "name": "bookshelf_narrow", "at": [10, 0.4] },
    { "name": "bookshelf_b", "at": [11.5, 0.7] },
    { "name": "bookshelf_a", "at": [14.5, 0.7] },
    { "name": "chalkboard", "at": [17.6, 0.4], "collide": false },
    { "name": "lectern", "at": [9.4, 4] },
    { "name": "globe", "at": [1.4, 5] },
    { "name": "lamp_red", "at": [18, 4.6] },
    { "name": "table_plain", "at": [4, 7.5] },
    { "name": "chair_yellow_r", "at": [2.4, 7.8], "collide": false },
    { "name": "chair_yellow_l", "at": [7.2, 7.8], "collide": false },
    { "name": "table_plain", "at": [13, 7.5] },
    { "name": "chair_blue_r", "at": [11.4, 7.8], "collide": false },
    { "name": "chair_blue_l", "at": [16.2, 7.8], "collide": false },
    { "name": "plant_palm", "at": [1.2, 10.5] },
    { "name": "plant_pot", "at": [18, 12] }
  ],
  "seats": [
    { "at": [3.2, 9.6],  "side": "right", "kind": "chair" },
    { "at": [8, 9.6],    "side": "left",  "kind": "chair" },
    { "at": [12.2, 9.6], "side": "right", "kind": "chair" },
    { "at": [17, 9.6],   "side": "left",  "kind": "chair" }
  ],
  "animated": [{ "name": "cuckoo_clock", "at": [13, 0.3] }],
  "spawns": [[9.8, 12.8]],
  "doors": [{ "name": "exit", "at": [9.5, 14], "targetVenue": "district" }],
  "glows": []
}
```

- [ ] **Step 7: Run tests and the validator**

Run: `npm test && npm run validate:contract`
Expected: 7 new tests PASS; `contract validation OK: pack "fixture", 4 venue(s), pixels checked`.

- [ ] **Step 8: Commit**

```bash
git add venues/ test/venue-descriptors.test.mjs
git commit -m "feat(venues): four interior descriptors transcribed from build-interiors.mjs"
```

---

## Task 14: Venue descriptor — the district

The district is 48×46 with two procedural tile layers, a seeded PRNG and 250-odd objects. **Expressing 2,208 tiles as data would be dishonest** — the ground is generated, not authored. So the descriptor names a generator plus its parameters, and lists the hand-placed objects. That keeps the design's claim ("venues are data") true without inventing a tile-painting format nobody will hand-edit.

**Files:**
- Create: `venues/district/venue.json`
- Test: `test/venue-district-descriptor.test.mjs`

**Interfaces:**
- Consumes: `VenueDescriptor` + `VenueGenerator` (Task 2).
- Produces: `venues/district/venue.json` with `generator: { name: 'cityGrid', seed: 20260703, params: {...} }`. Task 16 implements `cityGrid` against exactly these params.

- [ ] **Step 1: Write the failing test**

`test/venue-district-descriptor.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const v = JSON.parse(readFileSync('venues/district/venue.json', 'utf8'));
const c = loadContract();

test('the district is a 48x46 outdoor venue', () => {
  assert.equal(v.id, 'district');
  assert.equal(v.indoor, false);
  assert.deepEqual(v.sizeTiles, [48, 46]);
  assert.equal(v.groundAtlas, 'district_ground');
});

test('the ground is generated, not authored, and pins the PRNG seed', () => {
  assert.equal(v.generator.name, 'cityGrid');
  assert.equal(v.generator.seed, 20260703);
  assert.equal(v.ground, undefined, 'outdoor venues use generator, not ground');
});

test('the generator params match build-district.mjs road and pen geometry', () => {
  const p = v.generator.params;
  assert.deepEqual(p.vRoad, [22, 24]);
  assert.deepEqual(p.hRoad, [21, 23]);
  assert.deepEqual(p.vSidewalks, [[20, 21], [25, 26]]);
  assert.deepEqual(p.hSidewalks, [[19, 20], [24, 25]]);
  assert.deepEqual(p.pen, [36, 2, 47, 18]);
  assert.deepEqual(p.gate, [40, 42]);
});

test('every furniture name is a district prop in the contract', () => {
  const props = new Set(Object.keys(c.props.district));
  for (const f of v.furniture) assert.ok(props.has(f.name), f.name);
});

test('the four building doors target the four interior venues', () => {
  assert.deepEqual(v.doors.map(d => d.targetVenue).sort(), ['cafe', 'dorm', 'library', 'office']);
});

test('glows declare a kind the client knows (GLOW_KINDS)', () => {
  const kinds = new Set(['lamp', 'window', 'sign', 'headlight']);
  for (const g of v.glows) assert.ok(kinds.has(g.kind), g.kind);
  assert.ok(v.glows.length >= 12, 'at least the twelve street lamps');
});

test('capacity is generous — the district is the outdoor overflow', () => {
  assert.ok(v.capacity >= 64);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the district is a 48x46"`
Expected: FAIL — `ENOENT ... venues/district/venue.json`.

- [ ] **Step 3: Write the descriptor**

`venues/district/venue.json`. `generator.params` is transcribed from `build-district.mjs:130-141`; `furniture` from lines 248-356; `glows` from 310-333. `layer` names the object layer each prop belongs on — the district has three (`props-below`, `buildings`, `props-above`) where interiors have one.

```json
{
  "id": "district",
  "label": "District",
  "indoor": false,
  "sizeTiles": [48, 46],
  "groundAtlas": "district_ground",
  "capacity": 96,
  "generator": {
    "name": "cityGrid",
    "seed": 20260703,
    "params": {
      "vRoad": [22, 24],
      "hRoad": [21, 23],
      "vSidewalks": [[20, 21], [25, 26]],
      "hSidewalks": [[19, 20], [24, 25]],
      "pen": [36, 2, 47, 18],
      "gate": [40, 42],
      "paths": [[8, 41, 9, 42], [10, 41, 19, 42], [32, 36, 33, 37], [27, 36, 31, 37]]
    }
  },
  "furniture": [
    { "name": "office_building",  "at": [4, 0],    "layer": "buildings", "label": "Office",  "targetVenue": "office" },
    { "name": "cafe_building",    "at": [29, 7],   "layer": "buildings", "label": "Café",    "targetVenue": "cafe" },
    { "name": "villa_building",   "at": [5, 27],   "layer": "buildings", "label": "Dorm",    "targetVenue": "dorm" },
    { "name": "library_building", "at": [30, 27],  "layer": "buildings", "label": "Library", "targetVenue": "library" },
    { "name": "barn",             "at": [37, 2],   "layer": "buildings", "label": "Farm" },

    { "name": "tree_oak_big", "at": [0, 1],   "layer": "props-above" },
    { "name": "tree_oak_big", "at": [17, 12], "layer": "props-above" },
    { "name": "tree_oak_med", "at": [1, 13],  "layer": "props-above" },
    { "name": "tree_oak_big", "at": [28, 0],  "layer": "props-above" },
    { "name": "tree_birch",   "at": [33, 3],  "layer": "props-above" },
    { "name": "tree_oak_med", "at": [0, 26],  "layer": "props-above" },
    { "name": "tree_birch",   "at": [16, 27], "layer": "props-above" },
    { "name": "tree_oak_big", "at": [15, 33], "layer": "props-above" },
    { "name": "tree_oak_big", "at": [40, 27], "layer": "props-above" },
    { "name": "tree_oak_med", "at": [44, 31], "layer": "props-above" },
    { "name": "tree_oak_big", "at": [39, 36], "layer": "props-above" },
    { "name": "tree_birch",   "at": [44, 40], "layer": "props-above" },
    { "name": "tree_oak_med", "at": [28, 40], "layer": "props-above" },
    { "name": "tree_oak_big", "at": [2, 40],  "layer": "props-above" },

    { "name": "street_lamp", "at": [6, 18],  "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [15, 18], "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [30, 18], "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [40, 18], "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [6, 26],  "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [15, 26], "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [33, 26], "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [44, 26], "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [19, 5],  "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [19, 32], "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [27, 12], "layer": "props-above", "type": "lamp" },
    { "name": "street_lamp", "at": [27, 38], "layer": "props-above", "type": "lamp" },

    { "name": "bench",      "at": [33, 19], "layer": "props-above" },
    { "name": "bench",      "at": [12, 24], "layer": "props-above" },
    { "name": "bench",      "at": [42, 33], "layer": "props-above" },
    { "name": "trash_can",  "at": [36, 19], "layer": "props-above" },
    { "name": "trash_can",  "at": [17, 24], "layer": "props-above" },
    { "name": "hydrant",    "at": [17, 18], "layer": "props-above" },

    { "name": "car_right_1", "at": [8, 22.6],  "layer": "props-above" },
    { "name": "car_left_1",  "at": [33, 19.1], "layer": "props-above",
      "note": "red car parks against the north kerb, half the body on the pavement" },
    { "name": "car_right_1", "at": [42, 22.6], "layer": "props-above" }
  ],
  "scatter": {
    "bushes": {
      "at": [[3, 19], [10, 19], [28, 19], [38, 19], [3, 25], [16, 26], [29, 26], [35, 26], [46, 20]],
      "pick": ["bush_1", "bush_2"],
      "layer": "props-above"
    },
    "fence": { "prefix": "fence_", "layer": "props-above" },
    "crops": { "rows": 3, "startTile": [37, 13], "step": 2, "alternate": ["crop_cabbage", "crop_berry"], "layer": "props-below" }
  },
  "seats": [],
  "spawns": [[21, 19.75], [26.875, 19.75], [21, 25.625], [26.875, 25.625], [11.25, 19.875], [35, 25.625], [21, 12.5], [26.25, 32.5]],
  "animated": [],
  "doors": [
    { "name": "office_door",  "at": [9, 18],   "targetVenue": "office",  "sizePx": [48, 16] },
    { "name": "cafe_door",    "at": [31, 18],  "targetVenue": "cafe",    "sizePx": [48, 16] },
    { "name": "villa_door",   "at": [7.5, 40], "targetVenue": "dorm",    "sizePx": [48, 16] },
    { "name": "library_door", "at": [32, 35],  "targetVenue": "library", "sizePx": [48, 16] }
  ],
  "glows": [
    { "kind": "lamp", "at": [117, 302] }, { "kind": "lamp", "at": [261, 302] },
    { "kind": "lamp", "at": [501, 302] }, { "kind": "lamp", "at": [661, 302] },
    { "kind": "lamp", "at": [117, 430] }, { "kind": "lamp", "at": [261, 430] },
    { "kind": "lamp", "at": [549, 430] }, { "kind": "lamp", "at": [725, 430] },
    { "kind": "lamp", "at": [325, 94] },  { "kind": "lamp", "at": [325, 526] },
    { "kind": "lamp", "at": [453, 206] }, { "kind": "lamp", "at": [453, 622] },

    { "kind": "sign",   "at": [189, 146] },
    { "kind": "window", "at": [94, 170] },  { "kind": "window", "at": [154, 170] },
    { "kind": "window", "at": [94, 202] },  { "kind": "window", "at": [154, 202] },
    { "kind": "window", "at": [94, 234] },  { "kind": "window", "at": [154, 234] },
    { "kind": "window", "at": [94, 266] },  { "kind": "window", "at": [154, 266] },
    { "kind": "window", "at": [214, 180] }, { "kind": "window", "at": [214, 240] },

    { "kind": "sign",   "at": [520, 242] },
    { "kind": "window", "at": [489, 270] }, { "kind": "window", "at": [551, 270] },

    { "kind": "window", "at": [116, 540] }, { "kind": "window", "at": [180, 540] },
    { "kind": "window", "at": [126, 598] }, { "kind": "window", "at": [192, 598] },

    { "kind": "sign",   "at": [544, 523] },
    { "kind": "window", "at": [500, 560] }, { "kind": "window", "at": [544, 560] },
    { "kind": "window", "at": [588, 560] }
  ],
  "night": [
    { "name": "animal_sleep", "atPx": [656, 220] },
    { "name": "animal_sleep", "atPx": [700, 232] },
    { "name": "animal_sleep", "atPx": [672, 258] },
    { "name": "animal_sleep", "atPx": [726, 262] }
  ]
}
```

The `glows` coordinates are the `build-district.mjs:310-333` values with the per-building offsets already applied (lamp head `+21,+14` from the lamp tile; building glows `at + local`). `spawns` are the pixel points from line 261 divided by 16 into tile units.

- [ ] **Step 4: Run tests and the validator**

Run: `npm test && npm run validate:contract`
Expected: 7 new tests PASS; `contract validation OK: pack "fixture", 5 venue(s), pixels checked`.

- [ ] **Step 5: Commit**

```bash
git add venues/district/venue.json test/venue-district-descriptor.test.mjs
git commit -m "feat(venues): district descriptor with a named ground generator"
```

---

## Task 15: `VenueBaker` — interiors

Descriptor → `.tmj`. Object sizes come from the baked bitmaps (Task 12), and collision is *derived* from furniture footprints rather than hand-authored — which removes the class of bug where a moved prop leaves a stale collision box (spec §5.3).

**Files:**
- Create: `scripts/lib/venueBaker.mjs`
- Test: `test/venue-baker-interior.test.mjs`

**Interfaces:**
- Consumes: `buildAtlas()` (Task 11), `bakeProps()` (Task 12), venue descriptors (Task 13).
- Produces `scripts/lib/venueBaker.mjs`:
  - `bakeInterior(contract, descriptor, { atlas, propSizes }) → tmjObject`
  - `propSizes` is `Map<string, {w,h}>` from `bakeProps`.
  - The emitted `.tmj` carries layers `ground, furniture, seats, animated, doors, spawns, collision` — the exact set `InteriorScene.ts:76-119` reads.

- [ ] **Step 1: Write the failing test**

`test/venue-baker-interior.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { buildAtlas } from '../scripts/lib/atlasBuilder.mjs';
import { bakeProps } from '../scripts/lib/propBaker.mjs';
import { bakeInterior } from '../scripts/lib/venueBaker.mjs';

const c = loadContract();
const a = loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');
const atlas = buildAtlas(c, a, 'interiors_ground');
const propSizes = bakeProps(c, a, 'interior');
const cafe = JSON.parse(readFileSync('venues/cafe/venue.json', 'utf8'));
const tmj = () => bakeInterior(c, cafe, { atlas, propSizes });

test('the map is 20x15 with 16px tiles', () => {
  const m = tmj();
  assert.equal(m.width, 20);
  assert.equal(m.height, 15);
  assert.equal(m.tilewidth, 16);
});

test('layer names are exactly what InteriorScene reads', () => {
  assert.deepEqual(tmj().layers.map(l => l.name),
    ['ground', 'furniture', 'seats', 'animated', 'doors', 'spawns', 'collision']);
});

test('the ground layer paints walls, floor and a border', () => {
  const g = tmj().layers[0].data;
  assert.equal(g.length, 300);
  assert.equal(g[0], atlas.gid.wallCafeA, 'row 0 is wallA');
  assert.equal(g[20], atlas.gid.wallCafeB, 'row 1 is wallB');
  assert.equal(g[2 * 20 + 0], atlas.gid.border, 'left column is border');
  assert.equal(g[5 * 20 + 10], atlas.gid.floorCafe, 'interior is floor');
});

test('the doorway is floor, not border', () => {
  const g = tmj().layers[0].data;
  assert.equal(g[14 * 20 + 9], atlas.gid.floorCafe);
  assert.equal(g[14 * 20 + 10], atlas.gid.floorCafe);
});

test('furniture objects carry sizes read from the baked bitmaps', () => {
  const f = tmj().layers[1].objects.find(o => o.name === 'counter_wide');
  const real = propSizes.get('counter_wide');
  assert.equal(f.width, real.w);
  assert.equal(f.height, real.h);
});

test('a doormat is added at the doorway even though the descriptor omits it', () => {
  const mats = tmj().layers[1].objects.filter(o => o.name === 'doormat');
  assert.equal(mats.length, 1);
  assert.ok(mats[0].properties.some(p => p.name === 'doormat' && p.value === true));
});

test('seats become point objects with side and kind', () => {
  const seats = tmj().layers[2].objects;
  assert.equal(seats.length, 9);
  assert.equal(seats[0].point, true);
  assert.deepEqual(seats[0].properties.map(p => p.name).sort(), ['kind', 'side']);
});

test('collision is derived: walls, borders, doorway gap and colliding furniture', () => {
  const col = tmj().layers[6].objects;
  // five structural rects + one per colliding furniture item
  const colliding = cafe.furniture.filter(f => f.collide !== false).length;
  assert.equal(col.length, 5 + colliding);
});

test('non-colliding furniture contributes no collision box', () => {
  const m = tmj();
  const stoolCount = cafe.furniture.filter(f => f.name === 'stool').length;
  assert.equal(stoolCount, 3);
  assert.equal(m.layers[6].objects.length, 5 + cafe.furniture.filter(f => f.collide !== false).length);
});

test('the exit door targets the district venue', () => {
  const door = tmj().layers[4].objects[0];
  assert.equal(door.name, 'exit');
  assert.ok(door.properties.some(p => p.name === 'targetVenue' && p.value === 'district'));
});

test('baking is deterministic', () => {
  assert.equal(JSON.stringify(tmj()), JSON.stringify(tmj()));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the map is 20x15"`
Expected: FAIL — `Cannot find module '.../scripts/lib/venueBaker.mjs'`.

- [ ] **Step 3: Write the interior baker**

`scripts/lib/venueBaker.mjs`:

```js
/**
 * Venue descriptor -> Tiled .tmj.
 * Object sizes are read from the BAKED bitmaps, never hand-authored, and
 * collision is derived from furniture footprints — so a moved prop can no
 * longer leave a stale collision box behind (spec §5.3).
 */

const T = 16;

/** Tiled object factory with a monotonic id, matching the old scripts' shape. */
function objectFactory() {
  let nextId = 1;
  return {
    get nextId() { return nextId; },
    make(name, x, y, w, h, props = {}, extra = {}) {
      return {
        id: nextId++,
        name,
        type: extra.type ?? '',
        x, y, width: w, height: h,
        rotation: 0,
        visible: true,
        point: !!extra.point,
        properties: Object.entries(props).map(([k, v]) => ({
          name: k,
          type: typeof v === 'number' ? 'float' : typeof v === 'boolean' ? 'bool' : 'string',
          value: v,
        })),
      };
    },
  };
}

function tileLayer(id, name, w, h, data) {
  return { id, name, type: 'tilelayer', width: w, height: h, x: 0, y: 0, opacity: 1, visible: true, data };
}
function objLayer(id, name, objects) {
  return { id, name, type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects };
}

/** The doorway gap in the bottom wall, shared by every interior. */
const DOOR = { x0: 9, x1: 10 };

export function bakeInterior(contract, v, { atlas, propSizes }) {
  const [W, H] = v.sizeTiles;
  const f = objectFactory();
  const size = name => propSizes.get(name) ?? { w: T, h: T };

  // ── ground ────────────────────────────────────────────────────────────
  const ground = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let g;
      if (y === 0) g = atlas.gid[v.ground.wallA];
      else if (y === 1) g = atlas.gid[v.ground.wallB];
      else if (x === 0 || x === W - 1 || y === H - 1) g = atlas.gid.border;
      else g = atlas.gid[v.ground.floor];
      ground[y * W + x] = g;
    }
  }
  for (let x = DOOR.x0; x <= DOOR.x1; x++) ground[(H - 1) * W + x] = atlas.gid[v.ground.floor];

  // ── furniture + derived collision ─────────────────────────────────────
  const furniture = [];
  const collision = [];
  for (const item of v.furniture) {
    const s = size(item.name);
    const [tx, ty] = item.at;
    furniture.push(f.make(item.name, tx * T, ty * T, s.w, s.h));
    if (item.collide !== false) {
      // footprint = the bottom band of the sprite, inset 1px each side
      collision.push(f.make('c', tx * T + 1, ty * T + Math.max(0, s.h - 18), s.w - 2, Math.min(s.h, 18)));
    }
  }

  // ── seats ─────────────────────────────────────────────────────────────
  const seats = v.seats.map((s, i) =>
    f.make(`seat_${i}`, s.at[0] * T, s.at[1] * T, 0, 0, { side: s.side, kind: s.kind }, { point: true }));

  // ── animated ──────────────────────────────────────────────────────────
  const animated = v.animated.map(a => f.make(a.name, a.at[0] * T, a.at[1] * T, 0, 0, {}, { point: true }));

  // ── doormat + exit zone, both centred on the wall gap ─────────────────
  const mat = size('doormat');
  const doorCenterX = ((DOOR.x0 + DOOR.x1 + 1) / 2) * T;
  const matY = (H - 1) * T - mat.h - 2;
  furniture.push(f.make('doormat', Math.round(doorCenterX - mat.w / 2), matY, mat.w, mat.h, { doormat: true }));

  const doors = v.doors.map(d =>
    f.make(d.name, doorCenterX - 1.5 * T, matY - 4, 3 * T, mat.h + 8, { targetVenue: d.targetVenue }));

  // ── structural collision: walls, side borders, doorway gap ────────────
  collision.push(f.make('c', 0, 0, W * T, 2 * T));
  collision.push(f.make('c', 0, (H - 1) * T, DOOR.x0 * T, T));
  collision.push(f.make('c', (DOOR.x1 + 1) * T, (H - 1) * T, (W - DOOR.x1 - 1) * T, T));
  collision.push(f.make('c', 0, 0, T, H * T));
  collision.push(f.make('c', (W - 1) * T, 0, T, H * T));

  const spawns = v.spawns.map((s, i) => f.make(`spawn_${i}`, s[0] * T, s[1] * T, 0, 0, {}, { point: true }));

  return {
    type: 'map', version: '1.10', tiledversion: '1.10.2',
    orientation: 'orthogonal', renderorder: 'right-down',
    width: W, height: H, tilewidth: T, tileheight: T,
    infinite: false, compressionlevel: -1,
    nextlayerid: 9, nextobjectid: f.nextId, properties: [],
    tilesets: [{
      firstgid: 1,
      name: atlas.id,
      image: `../tilesets/pack/${atlas.id}.png`,
      imagewidth: atlas.canvas.w,
      imageheight: atlas.canvas.h,
      tilewidth: T, tileheight: T,
      tilecount: atlas.tileCount,
      columns: atlas.columns,
      margin: 0, spacing: 0,
    }],
    layers: [
      tileLayer(1, 'ground', W, H, ground),
      objLayer(2, 'furniture', furniture),
      objLayer(3, 'seats', seats),
      objLayer(4, 'animated', animated),
      objLayer(5, 'doors', doors),
      objLayer(6, 'spawns', spawns),
      objLayer(7, 'collision', collision),
    ],
  };
}
```

Two intentional differences from `build-interiors.mjs`: the tileset image path is `../tilesets/pack/` (the vendor-name rename), and the door property is `targetVenue` rather than `targetScene` (venues, not scene classes — Task 22 consumes it). Both are behaviour-preserving after Tasks 18 and 22.

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 11 new tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/venueBaker.mjs test/venue-baker-interior.test.mjs
git commit -m "feat(bake): VenueBaker for interiors with derived collision and bitmap-read sizes"
```

---

## Task 16: The `cityGrid` ground generator

The district's `ground` and `roads` tile layers, extracted from `build-district.mjs:142-207`. **The PRNG consumption order is part of the contract** — the generator draws from a seeded LCG in a specific sequence, and any reordering changes every grass, pavement and asphalt tile. Task 20 is what catches a mistake here.

**Files:**
- Create: `scripts/lib/districtGround.mjs`
- Test: `test/district-ground.test.mjs`

**Interfaces:**
- Consumes: an atlas `gid` map (Task 11), `venues/district/venue.json` `generator.params` (Task 14).
- Produces `scripts/lib/districtGround.mjs`:
  - `cityGrid(params, seed, gid, [W, H]) → { ground: number[], roads: number[], rnd: () => number }`
  - `rnd` is returned so the *caller* can keep drawing from the same stream — the bush picks at `build-district.mjs:344` share this PRNG and must consume it after the ground, before anything else.

- [ ] **Step 1: Write the failing test**

`test/district-ground.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { buildAtlas } from '../scripts/lib/atlasBuilder.mjs';
import { cityGrid } from '../scripts/lib/districtGround.mjs';

const c = loadContract();
const { gid } = buildAtlas(c, loadAdapter('sources/fixture.json', 'test/fixtures/pack-src'), 'district_ground');
const v = JSON.parse(readFileSync('venues/district/venue.json', 'utf8'));
const run = () => cityGrid(v.generator.params, v.generator.seed, gid, v.sizeTiles);

test('both layers are 48x46', () => {
  const { ground, roads } = run();
  assert.equal(ground.length, 48 * 46);
  assert.equal(roads.length, 48 * 46);
});

test('road tiles are empty in ground and asphalt in roads', () => {
  const { ground, roads } = run();
  const i = 22 * 48 + 23;         // on both the vertical and horizontal road
  assert.equal(ground[i], 0);
  assert.ok([gid.asphA, gid.asphB, gid.asphC, gid.asphD].includes(roads[i]));
});

test('the farm pen is dirt', () => {
  const { ground } = run();
  const i = 10 * 48 + 40;
  assert.ok([gid.dirt, gid.dirtA].includes(ground[i]));
});

test('open land is the base grass tile, never a variant', () => {
  const { ground } = run();
  assert.equal(ground[5 * 48 + 5], gid.grass);
});

test('the centre line skips the junction and the crossings', () => {
  const { roads } = run();
  assert.equal(roads[22 * 48 + 2], gid.dashH);
  assert.notEqual(roads[22 * 48 + 22], gid.dashH, 'no dash inside the junction');
});

test('zebra crossings sit on the sidewalk lines', () => {
  const { roads } = run();
  assert.ok([gid.zebHa1, gid.zebHb1].includes(roads[19 * 48 + 22]));
  assert.ok([gid.zebVa1, gid.zebVb1, gid.zebVa2, gid.zebVb2].includes(roads[21 * 48 + 20]));
});

test('the same seed reproduces the same layers byte for byte', () => {
  const x = run(), y = run();
  assert.deepEqual(x.ground, y.ground);
  assert.deepEqual(x.roads, y.roads);
});

test('a different seed produces different pavement', () => {
  const other = cityGrid(v.generator.params, 1, gid, v.sizeTiles);
  assert.notDeepEqual(other.ground, run().ground);
});

test('the PRNG is handed back mid-stream for the caller to continue', () => {
  const { rnd } = run();
  const a = rnd(), b = rnd();
  assert.ok(a >= 0 && a < 1 && b >= 0 && b < 1);
  assert.notEqual(a, b);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="both layers are 48x46"`
Expected: FAIL — `Cannot find module '.../scripts/lib/districtGround.mjs'`.

- [ ] **Step 3: Write the generator**

`scripts/lib/districtGround.mjs`:

```js
/**
 * The district's procedural ground and roads layers
 * (was build-district.mjs:142-207).
 *
 * THE PRNG CONSUMPTION ORDER IS PART OF THE CONTRACT. The stream is drawn
 * in exactly this sequence: ground rows (row-major), then the four paved
 * paths, then the road asphalt (row-major). The caller continues the same
 * stream for scatter picks. Reordering any of it repaints the whole map.
 */

/**
 * @returns {{ground: number[], roads: number[], rnd: () => number}}
 */
export function cityGrid(params, seed, gid, [W, H]) {
  const { vRoad, hRoad, vSidewalks, hSidewalks, pen, gate: _gate, paths } = params;
  const [PX0, PY0, PX1, PY1] = pen;

  // LCG, verbatim from build-district.mjs:143-145
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  const inVRoad = x => x >= vRoad[0] && x <= vRoad[1];
  const inHRoad = y => y >= hRoad[0] && y <= hRoad[1];
  const inVSw = x => vSidewalks.some(([a, b]) => x >= a && x <= b);
  const inHSw = y => hSidewalks.some(([a, b]) => y >= a && y <= b);

  // ── ground ────────────────────────────────────────────────────────────
  const ground = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let g;
      if (inVRoad(x) || inHRoad(y)) {
        g = 0;                                   // the roads layer covers it
      } else if (inVSw(x) || inHSw(y)) {
        g = pick([gid.sideA, gid.sideA, gid.sideB, gid.sideC, gid.sideD]);
      } else if (x >= PX0 && x <= PX1 && y >= PY0 && y <= PY1) {
        g = pick([gid.dirt, gid.dirt, gid.dirtA]);
      } else {
        // the pack's grass variants are darker than the base — keep one tile
        g = gid.grass;
      }
      ground[y * W + x] = g;
    }
  }

  // paved paths to the villa and library doors
  for (const [x0, y0, x1, y1] of paths) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        ground[y * W + x] = pick([gid.sideA, gid.sideA, gid.sideB, gid.sideC]);
  }

  // ── roads ─────────────────────────────────────────────────────────────
  const roads = new Array(W * H).fill(0);
  const asphalt = () => pick([gid.asphA, gid.asphA, gid.asphB, gid.asphC, gid.asphD]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (inVRoad(x) || inHRoad(y)) roads[y * W + x] = asphalt();

  // centre lines, skipping the junction and the crossings
  for (let x = 0; x < W; x += 2)
    if (!(x >= vRoad[0] - 3 && x <= vRoad[1] + 3)) roads[22 * W + x] = gid.dashH;
  for (let y = 0; y < H; y += 2)
    if (!(y >= hRoad[0] - 3 && y <= hRoad[1] + 3)) roads[y * W + 23] = gid.dashV;

  // crossings over the vertical road (horizontal stripes), on the sidewalk lines
  for (const [ya, yb] of hSidewalks) {
    for (let i = 0; i < 3; i++) {
      const x = vRoad[0] + i;
      roads[ya * W + x] = i % 2 === 0 ? gid.zebHa1 : gid.zebHb1;
      roads[yb * W + x] = i % 2 === 0 ? gid.zebHa2 : gid.zebHb2;
    }
  }
  // crossings over the horizontal road (vertical stripes)
  for (const [xa, xb] of vSidewalks) {
    for (let y = hRoad[0]; y <= hRoad[1]; y++) {
      const odd = (y - hRoad[0]) % 2 === 1;
      roads[y * W + xa] = odd ? gid.zebVa2 : gid.zebVa1;
      roads[y * W + xb] = odd ? gid.zebVb2 : gid.zebVb1;
    }
  }

  return { ground, roads, rnd };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 9 new tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/districtGround.mjs test/district-ground.test.mjs
git commit -m "feat(bake): cityGrid ground generator with the PRNG order preserved"
```

---

## Task 17: `VenueBaker` — the district

The outdoor half: three object layers, a fence loop, crop rows, seeded bush picks, glows and the `night` layer. The PRNG handed back by `cityGrid` continues here, in the same order the old script used.

**Files:**
- Modify: `scripts/lib/venueBaker.mjs` — add `bakeDistrict`
- Test: `test/venue-baker-district.test.mjs`

**Interfaces:**
- Consumes: `cityGrid()` (Task 16), `buildAtlas()`, `bakeProps(contract, adapter, 'district')`.
- Produces: `bakeDistrict(contract, descriptor, { atlas, propSizes }) → tmjObject` with layers `ground, roads, props-below, buildings, props-above, doors, spawns, collision, glows, night` — the exact set `DistrictScene.ts` reads.

- [ ] **Step 1: Write the failing test**

`test/venue-baker-district.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { buildAtlas } from '../scripts/lib/atlasBuilder.mjs';
import { bakeProps } from '../scripts/lib/propBaker.mjs';
import { bakeDistrict } from '../scripts/lib/venueBaker.mjs';

const c = loadContract();
const a = loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');
const atlas = buildAtlas(c, a, 'district_ground');
const propSizes = bakeProps(c, a, 'district');
const v = JSON.parse(readFileSync('venues/district/venue.json', 'utf8'));
const tmj = () => bakeDistrict(c, v, { atlas, propSizes });

test('layer names are exactly what DistrictScene reads', () => {
  assert.deepEqual(tmj().layers.map(l => l.name),
    ['ground', 'roads', 'props-below', 'buildings', 'props-above', 'doors', 'spawns', 'collision', 'glows', 'night']);
});

test('the five buildings land on the buildings layer with a label', () => {
  const b = tmj().layers.find(l => l.name === 'buildings').objects;
  assert.equal(b.length, 5);
  assert.ok(b.every(o => o.properties.some(p => p.name === 'label')));
});

test('the four enterable buildings carry targetVenue', () => {
  const b = tmj().layers.find(l => l.name === 'buildings').objects;
  const targets = b.flatMap(o => o.properties.filter(p => p.name === 'targetVenue').map(p => p.value));
  assert.deepEqual(targets.sort(), ['cafe', 'dorm', 'library', 'office']);
});

test('building sizes come from the baked bitmaps', () => {
  const office = tmj().layers.find(l => l.name === 'buildings').objects.find(o => o.name === 'office_building');
  assert.equal(office.width, propSizes.get('office_building').w);
});

test('the fence rings the pen with a gate gap in the bottom run', () => {
  const above = tmj().layers.find(l => l.name === 'props-above').objects;
  const fences = above.filter(o => o.name.startsWith('fence_'));

  // Derived from the descriptor, not counted by hand: the expectation has to
  // stay true when the pen or the gate moves.
  const [PX0, PY0, PX1, PY1] = v.generator.params.pen;
  const [G0, G1] = v.generator.params.gate;
  const spanX = PX1 - PX0 - 1;                 // interior columns, corners excluded
  const spanY = PY1 - PY0 - 1;                 // interior rows
  const gateCols = Math.min(G1, PX1 - 1) - Math.max(G0, PX0 + 1) + 1;
  const expected = spanX                        // top run
                 + (spanX - gateCols)           // bottom run, gate removed
                 + spanY * 2                    // left and right runs
                 + 4;                           // corners
  assert.equal(fences.length, expected);

  for (const corner of ['top_left', 'top_right', 'bottom_left', 'bottom_right'])
    assert.equal(fences.filter(o => o.name === `fence_${corner}`).length, 1, corner);
});

test('the gate gap is where the descriptor says it is', () => {
  const above = tmj().layers.find(l => l.name === 'props-above').objects;
  const [, , , PY1] = v.generator.params.pen;
  const [G0, G1] = v.generator.params.gate;
  const bottomXs = new Set(above
    .filter(o => o.name === 'fence_bottom_middle' && o.y === PY1 * 16)
    .map(o => o.x / 16));
  for (let x = G0; x <= G1; x++) assert.equal(bottomXs.has(x), false, `gate column ${x} is fenced`);
  assert.equal(bottomXs.has(G0 - 1), true, 'the run does not resume left of the gate');
});

test('crop rows alternate on props-below, one soil strip per row', () => {
  const below = tmj().layers.find(l => l.name === 'props-below').objects;
  const { rows, alternate } = v.scatter.crops;
  const PER_ROW = 3;                                  // left / mid / right

  assert.equal(below.filter(o => o.name.startsWith('soil_')).length, rows * PER_ROW);
  alternate.forEach((crop, i) => {
    const rowsOfThisCrop = Math.floor((rows - i + alternate.length - 1) / alternate.length);
    assert.equal(below.filter(o => o.name === crop).length, rowsOfThisCrop * PER_ROW, crop);
  });
});

test('street lamps are typed so the client can hang a night glow', () => {
  const lamps = tmj().layers.find(l => l.name === 'props-above').objects.filter(o => o.name === 'street_lamp');
  assert.equal(lamps.length, v.furniture.filter(f => f.name === 'street_lamp').length);
  assert.ok(lamps.length > 0, 'the district descriptor places no street lamps');
  assert.ok(lamps.every(o => o.type === 'lamp'));
});

test('glow points carry their kind as the object type', () => {
  const glows = tmj().layers.find(l => l.name === 'glows').objects;
  assert.equal(glows.length, v.glows.length);
  assert.ok(glows.every(o => o.point === true && o.type === o.name));
});

test('the night layer keeps every animal sleep point the descriptor declares', () => {
  assert.equal(tmj().layers.find(l => l.name === 'night').objects.length, v.night.length);
});

test('baking is deterministic', () => {
  assert.equal(JSON.stringify(tmj()), JSON.stringify(tmj()));
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="layer names are exactly what DistrictScene reads"`
Expected: FAIL — `bakeDistrict is not a function`.

- [ ] **Step 3: Add `bakeDistrict`**

Append to `scripts/lib/venueBaker.mjs` (and add `import { cityGrid } from './districtGround.mjs';` at the top):

```js
/** Named ground generators. Outdoor venues reference one by name. */
const GROUND_GENERATORS = { cityGrid };

export function bakeDistrict(contract, v, { atlas, propSizes }) {
  const [W, H] = v.sizeTiles;
  const f = objectFactory();
  const size = name => propSizes.get(name) ?? { w: T, h: T };

  const gen = GROUND_GENERATORS[v.generator.name];
  if (!gen) throw new Error(`venue ${v.id}: unknown ground generator ${v.generator.name}`);
  // rnd continues here — scatter picks draw from the same stream, in order
  const { ground, roads, rnd } = gen(v.generator.params, v.generator.seed, atlas.gid, v.sizeTiles);

  const layers = { 'props-below': [], buildings: [], 'props-above': [], doors: [], spawns: [], collision: [], glows: [], night: [] };
  const collide = (x, y, w, h) => layers.collision.push(f.make('c', x, y, w, h));

  // ── hand-placed props ─────────────────────────────────────────────────
  for (const item of v.furniture) {
    const s = size(item.name);
    const [tx, ty] = item.at;
    const props = {};
    if (item.label) props.label = item.label;
    if (item.targetVenue) props.targetVenue = item.targetVenue;
    layers[item.layer].push(f.make(item.name, tx * T, ty * T, s.w, s.h, props, { type: item.type }));

    if (item.layer === 'buildings') {
      collide(tx * T, ty * T, s.w, s.h);
    } else if (item.name.startsWith('tree_')) {
      collide(tx * T + s.w / 2 - 12, ty * T + s.h - 20, 24, 16);   // trunk only
    } else if (item.name === 'street_lamp') {
      collide(tx * T + 8, ty * T + 48, 16, 14);
    } else if (item.name === 'bench') {
      collide(tx * T, ty * T + 8, 32, 20);
    } else if (item.name === 'trash_can') {
      collide(tx * T + 8, ty * T + 12, 16, 16);
    } else if (item.name === 'hydrant') {
      collide(tx * T + 2, ty * T + 20, 12, 10);
    } else if (item.name.startsWith('car_')) {
      collide(tx * T, Math.round(ty + 0.4) * T, 64, item.name === 'car_left_1' ? 28 : 24);
    }
  }

  // ── fence ring with the gate gap ──────────────────────────────────────
  const [PX0, PY0, PX1, PY1] = v.generator.params.pen;
  const [G0, G1] = v.generator.params.gate;
  const fence = (part, tx, ty) => {
    const s = size(`fence_${part}`);
    layers['props-above'].push(f.make(`fence_${part}`, tx * T, ty * T, s.w, s.h));
    collide(tx * T, ty * T + 6, 16, 10);
  };
  for (let x = PX0 + 1; x < PX1; x++) {
    fence('top_middle', x, PY0);
    if (x < G0 || x > G1) fence('bottom_middle', x, PY1);
  }
  for (let y = PY0 + 1; y < PY1; y++) {
    fence('middle_left', PX0, y);
    fence('middle_right', PX1, y);
  }
  fence('top_left', PX0, PY0);
  fence('top_right', PX1, PY0);
  fence('bottom_left', PX0, PY1);
  fence('bottom_right', PX1, PY1);

  // ── crop rows ─────────────────────────────────────────────────────────
  const crops = v.scatter.crops;
  for (let i = 0; i < crops.rows; i++) {
    const ty = crops.startTile[1] + i * crops.step;
    const tx0 = crops.startTile[0];
    for (const [dx, part] of [[0, 'soil_left'], [1, 'soil_mid'], [2, 'soil_right']]) {
      const s = size(part);
      layers[crops.layer].push(f.make(part, (tx0 + dx) * T, ty * T, s.w, s.h));
    }
    const crop = crops.alternate[i % 2];
    for (let cx = 0; cx < 3; cx++) {
      const s = size(crop);
      layers[crops.layer].push(f.make(crop, (tx0 + cx) * T, ty * T, s.w, s.h));
    }
  }

  // ── bushes: seeded picks, continuing the ground stream ────────────────
  const bushes = v.scatter.bushes;
  for (const [tx, ty] of bushes.at) {
    const name = rnd() < 0.5 ? bushes.pick[0] : bushes.pick[1];
    const s = size(name);
    layers[bushes.layer].push(f.make(name, tx * T, ty * T, s.w, s.h));
    collide(tx * T + 2, ty * T + 6, 12, 10);
  }

  // ── doors, spawns, glows, night ───────────────────────────────────────
  for (const d of v.doors) {
    const [w, h] = d.sizePx;
    layers.doors.push(f.make(d.name, d.at[0] * T, d.at[1] * T, w, h, { targetVenue: d.targetVenue }));
  }
  v.spawns.forEach((s, i) =>
    layers.spawns.push(f.make(`spawn_${i}`, s[0] * T, s[1] * T, 0, 0, {}, { point: true })));
  for (const g of v.glows) {
    layers.glows.push(f.make(g.kind, g.at[0], g.at[1], 0, 0, {}, { point: true, type: g.kind }));
  }
  for (const n of v.night) {
    layers.night.push(f.make(n.name, n.atPx[0], n.atPx[1], 0, 0, {}, { point: true }));
  }

  // ── map bounds ────────────────────────────────────────────────────────
  collide(-16, 0, 16, H * T);
  collide(W * T, 0, 16, H * T);
  collide(0, -16, W * T, 16);
  collide(0, H * T, W * T, 16);

  return {
    type: 'map', version: '1.10', tiledversion: '1.10.2',
    orientation: 'orthogonal', renderorder: 'right-down',
    width: W, height: H, tilewidth: T, tileheight: T,
    infinite: false, compressionlevel: -1,
    nextlayerid: 12, nextobjectid: f.nextId, properties: [],
    tilesets: [{
      firstgid: 1, name: atlas.id,
      image: `../tilesets/pack/${atlas.id}.png`,
      imagewidth: atlas.canvas.w, imageheight: atlas.canvas.h,
      tilewidth: T, tileheight: T,
      tilecount: atlas.tileCount, columns: atlas.columns,
      margin: 0, spacing: 0,
    }],
    layers: [
      tileLayer(1, 'ground', W, H, ground),
      tileLayer(2, 'roads', W, H, roads),
      objLayer(3, 'props-below', layers['props-below']),
      objLayer(4, 'buildings', layers.buildings),
      objLayer(5, 'props-above', layers['props-above']),
      objLayer(6, 'doors', layers.doors),
      objLayer(7, 'spawns', layers.spawns),
      objLayer(8, 'collision', layers.collision),
      objLayer(9, 'glows', layers.glows),
      objLayer(10, 'night', layers.night),
    ],
  };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 10 new tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/venueBaker.mjs test/venue-baker-district.test.mjs
git commit -m "feat(bake): VenueBaker for the district — fence, crops, glows and seeded scatter"
```

---

## Task 18: `world-bake.mjs`, `venues.json`, and the `pack/` rename

One entry point that runs the whole world bake, and the vendor-name rename that the design exists to make possible. The bake also publishes `venues.json` — **BotVille is the only authority for the venue vocabulary** (I-8), and this is where it speaks.

**`worldBake()` takes its output directories as required arguments.** Not defaults — arguments. A library function whose default is "write into the repo" turns every test that calls it into a source-tree mutation, and this one is called eight times by its own test file. The CLI wrapper at the bottom of the module supplies the repo paths; the function itself has no opinion. Step 6 asserts that `npm test` leaves the tree clean, which is the check that keeps it honest.

**Files:**
- Create: `scripts/world-bake.mjs`
- Modify: `package.json` — `bake:world` script
- Modify: `.gitignore:22-24` — `limezu/` → `pack/`, add `baked/`
- Test: `test/bake/world-bake.test.mjs` (slow suite — it encodes ~70 PNGs per run)
- Test: `test/clean-tree.test.mjs`

**Interfaces:**
- Consumes: everything from Tasks 4–17.
- Produces `scripts/world-bake.mjs`:
  - `worldBake({ pack, srcRoot, outDir, generatedDir, venuesDirs }) → { atlases, props, venues, outDir, generatedDir }`
  - `outDir` and `generatedDir` are **required**; the function throws if either is missing.
  - `venuesDirs` defaults to `[<repo>/venues]`; Task 25 passes a second directory.
  - CLI `npm run bake:world [pack] [srcRoot]` (default `fixture`) supplies `outDir = packages/client/public/assets` and `generatedDir = packages/client/src/game`.
- Emits:
  - `<outDir>/tilesets/pack/{district_ground,interiors_ground}.png`
  - `<outDir>/sprites/pack/{district,interior}/<name>.png`
  - `<outDir>/tilemaps/<venue>.tmj`
  - `<outDir>/venues.json` — `PublishedVenue[]`, sorted by `id`

- [ ] **Step 1: Write the failing test**

`test/bake/world-bake.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldBake } from '../../scripts/world-bake.mjs';
import { loadContract } from '../../scripts/lib/assetContract.mjs';

const c = loadContract();

/** Every bake in this file writes to a temp dir. Nothing touches the repo. */
function bake() {
  const out = mkdtempSync(join(tmpdir(), 'world-out-'));
  const gen = mkdtempSync(join(tmpdir(), 'world-gen-'));
  const result = worldBake({
    pack: 'fixture', srcRoot: 'test/fixtures/pack-src', outDir: out, generatedDir: gen,
  });
  return { out, gen, result };
}

test('worldBake refuses to guess where to write', () => {
  assert.throws(() => worldBake({ pack: 'fixture', srcRoot: 'test/fixtures/pack-src' }),
    /outDir is required/);
  assert.throws(() => worldBake({ pack: 'fixture', srcRoot: 'test/fixtures/pack-src', outDir: '/tmp/x' }),
    /generatedDir is required/);
});

test('both ground atlases are written under tilesets/pack', () => {
  const { out } = bake();
  assert.ok(existsSync(join(out, 'tilesets/pack/district_ground.png')));
  assert.ok(existsSync(join(out, 'tilesets/pack/interiors_ground.png')));
});

test('no output path names a vendor (I-1)', () => {
  const { out } = bake();
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  assert.deepEqual(walk(out).filter(p => /limezu/i.test(p)), []);
});

test('one prop PNG per contract name, in every group', () => {
  const { out } = bake();
  for (const group of Object.keys(c.props)) {
    assert.equal(readdirSync(join(out, 'sprites/pack', group)).length,
      Object.keys(c.props[group]).length, group);
  }
});

test('five tilemaps are written', () => {
  const { out } = bake();
  assert.deepEqual(readdirSync(join(out, 'tilemaps')).sort(),
    ['cafe.tmj', 'district.tmj', 'dorm.tmj', 'library.tmj', 'office.tmj']);
});

test('tilemaps reference ../tilesets/pack/, never a vendor name', () => {
  const { out } = bake();
  const m = JSON.parse(readFileSync(join(out, 'tilemaps/cafe.tmj'), 'utf8'));
  assert.equal(m.tilesets[0].image, '../tilesets/pack/interiors_ground.png');
});

test('venues.json publishes the vocabulary sorted by id (I-8)', () => {
  const { out } = bake();
  const pub = JSON.parse(readFileSync(join(out, 'venues.json'), 'utf8'));
  assert.deepEqual(pub.map(v => v.id), ['cafe', 'district', 'dorm', 'library', 'office']);
  for (const v of pub) assert.deepEqual(Object.keys(v).sort(), ['capacity', 'id', 'indoor', 'label']);
  assert.equal(pub.find(v => v.id === 'cafe').capacity, 9);
});

test('the bake is deterministic across runs', () => {
  const a = bake(), b = bake();
  const read = (o, p) => readFileSync(join(o, p));
  for (const p of ['tilesets/pack/district_ground.png', 'tilemaps/district.tmj', 'venues.json']) {
    assert.deepEqual(read(a.out, p), read(b.out, p), p);
  }
});

test('the bake reports what it wrote, and the report matches the contract', () => {
  const { out, result } = bake();
  assert.equal(result.atlases, Object.keys(c.groundAtlases).length);
  assert.equal(result.props,
    Object.values(c.props).reduce((n, g) => n + Object.keys(g).length, 0));
  assert.equal(result.venues, readdirSync(join(out, 'tilemaps')).length);
});
```

`test/clean-tree.test.mjs` — the guard that keeps the whole suite honest:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

/**
 * Running the tests must not modify the working tree. A test that bakes into
 * packages/client/src/ produces a green run and a dirty diff, and the diff is
 * what the next person commits by accident.
 *
 * This runs LAST by filename convention (z-prefixed suites sort late); it is
 * cheap and catches every future task that forgets to pass a temp directory.
 */
test('the test suite leaves the working tree clean', () => {
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    // Untracked plan/scratch files the author is mid-edit on are not our business;
    // anything TRACKED that changed is.
    .filter(l => !l.startsWith('??'));
  assert.deepEqual(dirty, [], `tests modified tracked files:\n${dirty.join('\n')}`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="both ground atlases are written"`
Expected: FAIL — `Cannot find module '.../scripts/world-bake.mjs'`.

- [ ] **Step 3: Write the entry point**

`scripts/world-bake.mjs`:

```js
#!/usr/bin/env node
/**
 * World bake: contract + adapter + venue descriptors -> ground atlases,
 * prop PNGs, .tmj maps and the published venue vocabulary.
 *
 * Deterministic: same source + same registry = byte-identical output, so
 * CI can assert it by checksum (spec §7.1).
 *
 *   node scripts/world-bake.mjs [pack] [srcRoot]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png-lib.mjs';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';
import { buildAtlas } from './lib/atlasBuilder.mjs';
import { bakeProps, writeProps } from './lib/propBaker.mjs';
import { bakeInterior, bakeDistrict } from './lib/venueBaker.mjs';
import { validate } from './lib/contractValidator.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

function write(p, buf) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
}

/**
 * @param {{pack?: string, srcRoot: string, outDir: string, generatedDir: string,
 *          venuesDirs?: string[]}} opts
 *
 * outDir and generatedDir are REQUIRED. This function has no idea where the
 * repo is and must not: a default of "write into packages/client" turns every
 * caller — including this module's own tests — into a source-tree mutation.
 * The CLI at the bottom of this file is the only place those paths live.
 */
export function worldBake({ pack = 'fixture', srcRoot, outDir, generatedDir, venuesDirs } = {}) {
  if (!outDir) throw new Error('worldBake: outDir is required');
  if (!generatedDir) throw new Error('worldBake: generatedDir is required');

  const contract = loadContract();
  const adapter = loadAdapter(`sources/${pack}.json`, srcRoot);

  const dirs = venuesDirs ?? [join(ROOT, 'venues')];
  const venues = dirs
    .flatMap(dir => readdirSync(dir).map(id => JSON.parse(readFileSync(join(dir, id, 'venue.json'), 'utf8'))))
    .sort((a, b) => a.id.localeCompare(b.id));

  const dupes = venues.map(v => v.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (dupes.length) throw new Error(`duplicate venue id across venue directories: ${[...new Set(dupes)].join(', ')}`);

  // I-2: an unresolved name fails the BUILD, never renders as a missing texture.
  const { errors } = validate(contract, adapter, { checkPixels: true, venues });
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    throw new Error(`world bake refused: ${errors.length} contract error(s)`);
  }

  // ── atlases ───────────────────────────────────────────────────────────
  const atlases = {};
  for (const id of Object.keys(contract.groundAtlases)) {
    const at = buildAtlas(contract, adapter, id);
    atlases[id] = at;
    write(join(outDir, 'tilesets', 'pack', `${id}.png`), encodePng(at.canvas));
  }

  // ── props ─────────────────────────────────────────────────────────────
  const propSizes = new Map();
  let propCount = 0;
  for (const group of Object.keys(contract.props)) {
    const baked = bakeProps(contract, adapter, group);
    propCount += writeProps(baked, join(outDir, 'sprites', 'pack', group)).length;
    for (const [name, s] of baked) propSizes.set(name, s);
  }

  // ── venues ────────────────────────────────────────────────────────────
  for (const v of venues) {
    const atlas = atlases[v.groundAtlas];
    const tmj = v.indoor
      ? bakeInterior(contract, v, { atlas, propSizes })
      : bakeDistrict(contract, v, { atlas, propSizes });
    write(join(outDir, 'tilemaps', `${v.id}.tmj`), JSON.stringify(tmj));
  }

  // ── published vocabulary (I-8): BotVille is the only authority ─────────
  const published = venues.map(v => ({ id: v.id, label: v.label, indoor: v.indoor, capacity: v.capacity }));
  const publishedJson = JSON.stringify(published, null, 2) + '\n';
  write(join(outDir, 'venues.json'), publishedJson);

  // A lock beside the artifact, so the platform can prove its copy is intact
  // WITHOUT needing this repo on disk. The sibling-repo comparison in Task 33
  // is the stronger check; this one is the check that still works in CI.
  write(join(outDir, 'venues.lock.json'), JSON.stringify({
    sha256: createHash('sha256').update(publishedJson).digest('hex'),
    count: published.length,
    schemaVersion: contract.schemaVersion,
  }, null, 2) + '\n');

  return { atlases: Object.keys(atlases).length, props: propCount, venues: venues.length, outDir, generatedDir };
}

// ── CLI: the ONE place that knows where this repo keeps things ────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const pack = process.argv[2] ?? 'fixture';
  const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');
  const r = worldBake({
    pack,
    srcRoot,
    outDir: join(ROOT, 'packages', 'client', 'public', 'assets'),
    generatedDir: join(ROOT, 'packages', 'client', 'src', 'game'),
  });
  console.log(`world bake OK: ${r.atlases} atlases, ${r.props} props, ${r.venues} venues -> ${r.outDir}`);
}
```

- [ ] **Step 4: Wire the script and fix `.gitignore`**

Root `package.json`, in `"scripts"`:

```json
    "bake:world": "node scripts/world-bake.mjs",
```

Replace `.gitignore` lines 20-24 with:

```
# Paid art — licence permits use, forbids redistribution (see docs/ASSETS.md)
assets-src/
packages/client/public/assets/tilesets/pack/
packages/client/public/assets/sprites/pack/
packages/client/public/assets/ui/pack/
packages/client/public/assets/baked/
```

`venues.json` is a bake output but **is committed** — the platform's CI check (Task 33) compares against it.

- [ ] **Step 5: Run the bake and the tests**

Run: `npm run bake:world && npm run test:all && git status --porcelain`
Expected: `world bake OK: 2 atlases, 68 props, 5 venues -> .../public/assets` (the numbers come from the contract and `venues/`; the test asserts they agree rather than pinning them). Then the fast suite passes, then `test/bake/world-bake.test.mjs` passes, and `git status --porcelain` shows only the intended new files — the bake outputs are gitignored and `venues.json` is the one deliberate addition.

The `clean tree` test is the one to watch. It fails if any suite writes into the repo, which is exactly what would happen if `outDir`/`generatedDir` had defaults.

- [ ] **Step 6: Commit**

```bash
git add scripts/world-bake.mjs package.json .gitignore test/bake/world-bake.test.mjs test/clean-tree.test.mjs packages/client/public/assets/venues.json
git commit -m "feat(bake): world-bake entry point, published venue vocabulary, limezu->pack rename"
```

---

## Task 19: Retire the old build scripts

`build-district.mjs` and `build-interiors.mjs` are now fully superseded — ~35KB of imperative crop coordinates that have become `sources/limezu.json` plus five descriptors. They must leave `scripts/`, because leaving them there means two ways to build the world and no answer to which one is right.

**But they are not deleted — they are frozen.** They are the *only* description of what the world looked like before this plan touched it, and Task 20's golden gate exists to prove the new pipeline reproduces it. Deleting them outright is what made the original sequencing impossible: with the art absent, Task 3 runs last, and it needs scripts that vanished sixteen tasks earlier.

So they move to `test/golden/legacy/`, with a header saying what they are. Nothing imports them. The bake never runs them. `scripts/capture-golden-baseline.mjs` (Task 3) and `test/bake/golden.test.mjs` (Task 20) are their only callers, and both are explicitly about comparing against the past.

The rule this keeps: **one source of truth for building the world, one frozen record of what it used to be.** Those are different jobs, and conflating them is what forced the archaeology.

**Files:**
- Move: `scripts/build-district.mjs` → `test/golden/legacy/build-district.mjs`
- Move: `scripts/build-interiors.mjs` → `test/golden/legacy/build-interiors.mjs`
- Create: `test/golden/legacy/README.md`
- Modify: `README.md`, `packages/client/src/game/assetManifest.ts:7-9`, `packages/client/src/game/config.ts:28`

**Interfaces:**
- Consumes: Task 18's `worldBake`.
- Produces: `test/golden/legacy/build-{district,interiors}.mjs` — frozen, runnable, never imported. Task 3 and Task 20 both locate them via the `legacy()` lookup in `scripts/capture-golden-baseline.mjs`.

- [ ] **Step 1: Confirm nothing still references them**

Run: `grep -rn "build-district\|build-interiors" --include='*.ts' --include='*.mjs' --include='*.json' --include='*.md' . | grep -v node_modules | grep -v docs/superpowers`
Expected: references only in `README.md`, `assetManifest.ts:7`, `config.ts:28`, `InteriorScene.ts:35`, `PreloaderScene.ts:39` and the two files themselves.

- [ ] **Step 2: Freeze them, then update every reference**

```bash
mkdir -p test/golden/legacy
git mv scripts/build-district.mjs  test/golden/legacy/build-district.mjs
git mv scripts/build-interiors.mjs test/golden/legacy/build-interiors.mjs
```

Add `test/golden/legacy/README.md`:

```markdown
# Frozen legacy pipeline — do not modify, do not import

These are the imperative build scripts this repo used before the world bake
existed. They are kept for exactly one purpose: proving that
`scripts/world-bake.mjs` reproduces what they produced, byte for byte
(Task 20's golden gate).

- Nothing in `scripts/`, `packages/` or `test/` imports them.
- The build never runs them.
- Their only callers are `scripts/capture-golden-baseline.mjs` and
  `test/bake/golden.test.mjs`, both of which are about comparing to the past.
- They need `assets-src/` to run, so they are inert without the licensed packs.

If you are tempted to fix a bug in here: don't. Fix it in the contract, the
adapter or the venue descriptor, and let the golden gate tell you the output
changed. A change here would make the gate compare the new pipeline against a
moving target, which is the one thing it must never do.
```

Prepend the same warning as a comment block at the top of each moved script.

Then update the comments that cite them. In `packages/client/src/game/assetManifest.ts:7-9`, replace the pipeline comment:

```ts
 * Пайплайн: scripts/world-bake.mjs собирает атласы, пропсы и карты из
 * contract/assets.contract.json + sources/<pack>.json + venues/<id>/venue.json
 * в public/assets/{sprites,tilesets}/pack/ — пути ниже указаны
 * относительно public/.
```

In `config.ts:28`, replace `/** Карта района (должно совпадать с scripts/build-district.mjs). */` with:

```ts
/** Карта района (генерируется scripts/world-bake.mjs из venues/district/venue.json). */
```

In `InteriorScene.ts:35` replace `(scripts/build-interiors.mjs)` with `(scripts/world-bake.mjs)`. In `PreloaderScene.ts:39` replace `(генерируются scripts/build-district.mjs)` with `(генерируются scripts/world-bake.mjs)`.

In `README.md`, replace the `node scripts/sync-assets.mjs` block in "About the art" with:

```bash
node scripts/sync-assets.mjs        # copy the licensed source files into place
npm run bake:world -- limezu assets-src
```

- [ ] **Step 3: Verify the bake still works and nothing dangles**

Run:

```bash
npm run bake:world && npm run test:all && npm run typecheck
grep -rn "build-district\|build-interiors" --include='*.ts' --include='*.mjs' --include='*.md' . \
  | grep -v node_modules | grep -v docs/superpowers | grep -v '^\./test/golden/legacy/'
```

Expected: bake OK, tests pass, typecheck clean, and the grep returns **only** `scripts/capture-golden-baseline.mjs` (which locates them by design). Every other reference is gone.

Then prove the freeze is inert:

```bash
grep -rn "golden/legacy" --include='*.ts' packages/ | grep -v node_modules
```

Expected: nothing. No runtime code may reach the frozen scripts.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(bake): freeze build-district/interiors as test/golden/legacy — superseded by world-bake"
```

## Task 19a: Retire `sync-assets.mjs`'s hardcoded file list

Task 19 removed the last pack-specific *coordinates* from `scripts/`. One list survives, and it is the same kind of thing: `scripts/sync-assets.mjs` holds **59 hardcoded `[source, destination]` pairs** naming LimeZu files by path.

That list is a curation decision — *these* sheets, of the thousands in four packs, are the ones that matter — expressed as code. It overlaps the adapter's `files` block by about fifty entries, so the same knowledge now lives in two places and can disagree. Under I-1 it should not exist at all.

**Why the script itself survives.** The world bake reads `assets-src/` directly through the adapter, so it needs no copying. But a handful of sheets are loaded *whole* by the runtime rather than baked: the premade character sheets `AppearanceResolver` falls back to, the emote sheet, the UI sheet. Those still have to reach `public/assets/`. The script has a job; its list does not.

**So the list becomes derived.** The contract already names every runtime-loaded sheet (`char_*`, `emote_sheet`, `ui_sheet`), and the adapter already knows which file each resolves to. Copying exactly those files is a two-line query, and adding a new runtime sheet becomes a contract entry rather than an edit here.

**Files:**
- Rewrite: `scripts/sync-assets.mjs`
- Modify: `contract/assets.contract.json` — a `runtimeSheets` list
- Test: `test/sync-assets.test.mjs`

**Interfaces:**
- Consumes: `loadContract()`, `loadAdapter()`.
- Produces `scripts/sync-assets.mjs`: `syncAssets({ pack, srcRoot, outDir }) → { copied: string[], missing: string[] }` — required `outDir`, per the Global Constraint. Exits non-zero on any missing source.

- [ ] **Step 1: Write the failing test**

`test/sync-assets.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { syncAssets } from '../scripts/sync-assets.mjs';

const c = loadContract();
const run = () => syncAssets({
  pack: 'fixture', srcRoot: 'test/fixtures/pack-src',
  outDir: mkdtempSync(join(tmpdir(), 'sync-')),
});

test('no LimeZu path appears in the script any more (I-1)', () => {
  const src = readFileSync('scripts/sync-assets.mjs', 'utf8');
  for (const marker of ['ME_Singles', 'Room_Builder', '_16x16.png', 'exteriors/themes'])
    assert.equal(src.includes(marker), false, `sync-assets.mjs still names ${marker}`);
});

test('the contract declares which sheets the runtime loads whole', () => {
  assert.ok(Array.isArray(c.runtimeSheets));
  assert.ok(c.runtimeSheets.length > 0);
  // Every one must be a contract name, or the adapter cannot resolve it.
  const known = new Set(c.allNames());
  for (const n of c.runtimeSheets) assert.ok(known.has(n), `${n} is not a contract name`);
});

test('exactly the declared sheets are copied — nothing more', () => {
  const { copied, missing } = run();
  assert.deepEqual(missing, []);
  assert.equal(copied.length, c.runtimeSheets.length);
});

test('copying is idempotent and byte-preserving', () => {
  const out = mkdtempSync(join(tmpdir(), 'sync-idem-'));
  const opts = { pack: 'fixture', srcRoot: 'test/fixtures/pack-src', outDir: out };
  syncAssets(opts);
  const first = readdirSync(join(out, 'sprites', 'pack')).sort();
  syncAssets(opts);
  assert.deepEqual(readdirSync(join(out, 'sprites', 'pack')).sort(), first);
});

test('a missing source file is reported, not silently skipped', () => {
  const { missing } = syncAssets({
    pack: 'fixture', srcRoot: 'test/fixtures/does-not-exist',
    outDir: mkdtempSync(join(tmpdir(), 'sync-missing-')), throwOnMissing: false,
  });
  assert.ok(missing.length > 0);
});

test('syncAssets refuses to guess where to write', () => {
  assert.throws(() => syncAssets({ pack: 'fixture', srcRoot: 'test/fixtures/pack-src' }),
    /outDir is required/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="no LimeZu path appears"`
Expected: FAIL — the script is full of them.

- [ ] **Step 3: Declare the runtime sheets in the contract**

Add to `contract/assets.contract.json`, at the top level:

```json
  "runtimeSheets": [
    "char_body", "char_hair", "char_top", "char_bottom", "char_accessory",
    "emote_sheet", "ui_sheet"
  ],
```

These are the names the client loads as whole images rather than as baked
props — `PreloaderScene` reads them straight out of `public/assets/`. Everything
else the runtime touches is a bake output. Adding a new one is an entry here,
not an edit to a copy script.

- [ ] **Step 4: Rewrite the script**

`scripts/sync-assets.mjs`:

```js
#!/usr/bin/env node
/**
 * Copies the sheets the RUNTIME loads whole into public/assets/.
 *
 * Everything else the client shows is a bake output (scripts/world-bake.mjs),
 * read straight from assets-src/ through the adapter. What survives here is
 * the short list of sheets Phaser loads as images: the premade character
 * sheets AppearanceResolver falls back to, the emote sheet, the UI sheet.
 *
 * This script used to carry 59 hardcoded LimeZu paths — a curation decision
 * ("these sheets matter") expressed as code, duplicating the adapter's files
 * block and free to disagree with it. The list is now derived: the contract
 * names the sheets, the adapter resolves each to a file (I-1).
 *
 *   node scripts/sync-assets.mjs [pack] [srcRoot]
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

export function syncAssets({ pack = 'fixture', srcRoot, outDir, throwOnMissing = true } = {}) {
  if (!outDir) throw new Error('syncAssets: outDir is required');

  const contract = loadContract();
  const adapter = loadAdapter(`sources/${pack}.json`, srcRoot);

  const copied = [];
  const missing = [];

  for (const name of contract.runtimeSheets) {
    const { absPath } = adapter.resolve(name);
    // Destination keeps the source filename: assetManifest.ts references these
    // by file, not by contract name, and the vendor segment is already gone.
    const dest = join(outDir, 'sprites', 'pack', basename(absPath));
    if (!existsSync(absPath)) { missing.push(`${name} -> ${absPath}`); continue; }
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(absPath, dest);
    copied.push(name);
  }

  if (missing.length && throwOnMissing) {
    for (const m of missing) console.error(`error: missing runtime sheet ${m}`);
    throw new Error(`sync-assets: ${missing.length} runtime sheet(s) missing from ${srcRoot}`);
  }
  return { copied, missing };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pack = process.argv[2] ?? 'fixture';
  const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');
  const { copied } = syncAssets({
    pack, srcRoot, outDir: join(ROOT, 'packages', 'client', 'public', 'assets'),
  });
  console.log(`sync-assets: ${copied.length} runtime sheet(s) copied from pack "${pack}"`);
}
```

- [ ] **Step 5: Follow the two callers**

`package.json`'s `deploy:client` calls `node scripts/sync-assets.mjs` with no
arguments; it now needs the pack, matching the bake beside it:

```json
    "deploy:client": "node scripts/sync-assets.mjs limezu assets-src && npm run bake:world -- limezu assets-src && ...",
```

`scripts/capture-golden-baseline.mjs` (Plan 6 Task 3) runs it as part of
reproducing the legacy pipeline. That call is against `limezu`/`assets-src`
already — confirm it passes both arguments.

- [ ] **Step 6: Verify the copy set did not change**

The point is fewer hardcoded paths, not different output. With the licensed
pack present the old and new scripts must place the same runtime sheets:

```bash
node test/golden/legacy/../../../scripts/sync-assets.mjs limezu assets-src
ls packages/client/public/assets/sprites/pack/
```

Expected: the premade character sheets, the emote sheet and the UI sheet — the
files `assetManifest.ts` references. The other ~50 entries the old list copied
were tilesheets the bake now reads directly from `assets-src/`, so they should
be **absent**, and `npm run bake:world` should still succeed without them. If
the client 404s on something, that name belongs in `runtimeSheets`.

Without the pack, run the fixture equivalent: `node scripts/sync-assets.mjs`.

- [ ] **Step 7: Test and commit**

Run: `npm run test:all && npm run bake:world`
Expected: 6 new tests PASS; the bake is unaffected.

```bash
git add scripts/sync-assets.mjs contract/assets.contract.json package.json test/sync-assets.test.mjs
git commit -m "refactor(assets): derive the runtime sheet copy list from the contract (I-1)"
```

---


---

## Task 25: The fixture-venue test

**The most important test in this plan.** Spec §14: "Adding a fixture descriptor produces a loadable scene with **no code change** (G-C, as an executable claim)." If this fails, the design's central claim is false.

**Files:**
- Create: `test/fixtures/venues/speakeasy/venue.json`
- Create: `test/bake/fixture-venue.test.mjs`
- Modify: **nothing outside `test/`** — that is the assertion

**Interfaces:**
- Consumes: `worldBake()` (Task 18) — specifically its `venuesDirs` argument.
- Produces: a test that bakes a venue nobody wrote code for and asserts every downstream artifact appears.

- [ ] **Step 1: Write the failing test**

`test/bake/fixture-venue.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldBake } from '../../scripts/world-bake.mjs';
import { REPO_ROOT } from '../helpers/siblingRepo.mjs';

/**
 * G-C as an executable claim: a venue that no code mentions must bake into
 * a loadable scene. Nothing under packages/client knows the word "speakeasy".
 */
function bakeWithFixture() {
  const out = mkdtempSync(join(tmpdir(), 'fixture-venue-'));
  const r = worldBake({
    pack: 'fixture',
    srcRoot: 'test/fixtures/pack-src',
    outDir: out,
    generatedDir: mkdtempSync(join(tmpdir(), 'fixture-venue-gen-')),
    venuesDirs: [join(REPO_ROOT, 'venues'), join(REPO_ROOT, 'test/fixtures/venues')],
  });
  return { out, r };
}

test('a venue nobody wrote code for bakes into a tilemap', () => {
  const { out } = bakeWithFixture();
  assert.ok(existsSync(join(out, 'tilemaps/speakeasy.tmj')));
});

test('its tilemap has the layers the venue scene reads', () => {
  const { out } = bakeWithFixture();
  const m = JSON.parse(readFileSync(join(out, 'tilemaps/speakeasy.tmj'), 'utf8'));
  assert.deepEqual(m.layers.map(l => l.name),
    ['ground', 'furniture', 'seats', 'animated', 'doors', 'spawns', 'collision']);
  assert.equal(m.layers[2].objects.length, 3, 'three seats');
});

test('it joins the published vocabulary with no code change (G-C)', () => {
  const { out } = bakeWithFixture();
  const pub = JSON.parse(readFileSync(join(out, 'venues.json'), 'utf8'));
  const sp = pub.find(v => v.id === 'speakeasy');
  assert.deepEqual(sp, { id: 'speakeasy', label: 'Speakeasy', indoor: true, capacity: 3 });
});

test('it lands in the generated registry module', () => {
  const { r } = bakeWithFixture();
  const gen = readFileSync(join(r.generatedDir, 'venues.generated.ts'), 'utf8');
  assert.ok(gen.includes('"id": "speakeasy"'));
});

test('no source file mentions the fixture venue (G-C)', async () => {
  const { readdirSync } = await import('node:fs');
  const walk = d => readdirSync(d, { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]);
  // Runtime AND tooling: if scripts/ had to learn the word, venues are not data.
  const hits = [...walk(join(REPO_ROOT, 'packages/client/src')), ...walk(join(REPO_ROOT, 'scripts'))]
    .filter(p => /\.(tsx?|mjs)$/.test(p) && !p.endsWith('.generated.ts'))
    .filter(p => readFileSync(p, 'utf8').includes('speakeasy'));
  assert.deepEqual(hits, [], 'G-C violated: code mentions the fixture venue');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="a venue nobody wrote code for"`
Expected: FAIL — `ENOENT ... test/fixtures/venues/speakeasy/venue.json`.

- [ ] **Step 3: Write the fixture descriptor**

`test/fixtures/venues/speakeasy/venue.json`:

```json
{
  "id": "speakeasy",
  "label": "Speakeasy",
  "indoor": true,
  "sizeTiles": [20, 15],
  "groundAtlas": "interiors_ground",
  "capacity": 3,
  "ground": { "wallA": "wallLibA", "wallB": "wallLibB", "floor": "floorDorm" },
  "furniture": [
    { "name": "counter_wide", "at": [4, 4] },
    { "name": "stool", "at": [4, 6], "collide": false },
    { "name": "stool", "at": [6, 6], "collide": false },
    { "name": "stool", "at": [8, 6], "collide": false },
    { "name": "plant_palm", "at": [17, 3] }
  ],
  "seats": [
    { "at": [4.5, 7], "side": "right", "kind": "stool" },
    { "at": [6.5, 7], "side": "left",  "kind": "stool" },
    { "at": [8.5, 7], "side": "right", "kind": "stool" }
  ],
  "animated": [{ "name": "cuckoo_clock", "at": [12, 0.3] }],
  "spawns": [[9.8, 12.8]],
  "doors": [{ "name": "exit", "at": [9.5, 14], "targetVenue": "district" }],
  "glows": []
}
```

- [ ] **Step 4: Nothing to change in the bake**

`worldBake` already takes `venuesDirs` and `generatedDir` — Task 18 made both first-class rather than bolting them on here, precisely so this test could be written without touching the bake. That is the point being demonstrated: **a new venue needs no code change anywhere**, including in the tooling.

Confirm it, rather than assuming it:

```bash
git diff --stat scripts/ packages/
```

Expected: **empty.** If this task had to modify a file outside `test/`, G-C is not true yet and the reason needs finding before moving on.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS — 5 new tests. **This is the design's central claim, now executable.**

- [ ] **Step 6: Commit**

```bash
git add test/fixtures/venues/ test/bake/fixture-venue.test.mjs
git commit -m "test(venues): a fixture venue produces a loadable scene with no code change (G-C)"
```

The commit touching only `test/` is itself the evidence.
