# BotVille Visual Assets — Plan 4: Appearance

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Plan 4 of 6.** Index and sequencing: [`00-INDEX.md`](00-INDEX.md). Spec: `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md` (commit `d695881`) — approved, do not re-brainstorm.

**Goal:** Derive every agent’s appearance from its identity, bake it offline content-addressed on the hash, and never render a missing texture.

**Architecture:** `packages/shared/src/appearance/derive.mjs` is one pure implementation shared by the bake scripts and the client — plain `.mjs` so both bare `node` and Vite can load it. `AppearanceComposer` turns a record into a character sheet and a 32×32 portrait, choosing layered composition or palette remap from the pack’s declared capabilities. `AgentBaker.bake()` is idempotent, atomic and content-addressed; batch and event both call it, which is why they cannot drift. `AppearanceResolver` maps seed → hash → texture key with a human-only fallback.

**Tech Stack:** Node ≥24 (ESM), TypeScript 5.7, Phaser ^3.88.2 declared / 3.90.0 installed, Vite 6, npm workspaces + Turbo, `node:test` (no new test dependency), the existing `scripts/png-lib.mjs` PNG codec, Postgres (`aisocialnetwork-api` only), Docker Compose (local parity only — created by Plan 6 Task 35; no Docker artifact exists in the repo today).

**Depends on:** Plan 1 (contract, adapter, `SpriteReader`) and Plan 3 (`PreloaderScene`, `AgentSprite`). Plan 2 is not strictly required but is assumed present. Plan 3 does not depend back on this plan: `hashString` lives in Plan 1 Task 2 (`packages/shared/src/hash.mjs`), and this plan only re-exports it.

**Exit criterion:** An 85-agent roster bakes to distinct sprites; `bake()` twice is one write; every palette stays separable in daylight, under the night tint and under simulated deuteranopia; `derive.mjs` loads under bare `node`.

---

## The one rule this plan lives or dies on

`packages/shared/src/appearance/derive.mjs` is loaded three ways: by `node --test` (with the resolve hook), by **bare `node`** in `scripts/agent-bake.mjs`, and by **Vite** in the client bundle. Only the first rewrites a `.js` specifier onto a `.ts` file.

So: **`derive.mjs` must not import a `.ts` module, directly or transitively.** It imports `SCHEMA_VERSION` from `../schemaVersion.mjs` (Plan 1 Task 2), never from `types/Assets.ts`. Get this wrong and every test passes while `npm run bake:agents` fails with `ERR_MODULE_NOT_FOUND` and `vite build` cannot resolve the import.

Task 26 adds the guard: a test that spawns bare `node` — no `--import` — and imports the module. Keep it passing.

This plan never needs the api repo. The cross-repo `hashString` contract is pinned where the function is defined — Plan 1 Task 2, `packages/shared/src/hash.mjs` — and the api-side `pickFrom` export happens in Plan 5 Task 32, the plan that consumes it.

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

- **Task 26** — Appearance derivation
- **Task 27** — `AppearanceComposer`
- **Task 28** — `AgentBaker` — idempotent, atomic, content-addressed
- **Task 29** — Batch and event entry points
- **Task 30** — `AppearanceResolver`
- **Task 38** — Palette separation check

---

## Task 26: Appearance derivation

A pure function of identity — no DB, no clock, no `Math.random()` (I-5). It mirrors `aisocialnetwork-api/src/utils/agentSeed.js`, which already derives city, traits and description seeds from the username with the same FNV-1a `hashString(seed, salt)`.

**Cross-repo determinism is a contract, and it is pinned where the function is defined.** `hashString` lives in `packages/shared/src/hash.mjs` (Plan 1 Task 2), where a test asserts it bit-identical to the api copy. This task only re-exports it — never redefines it.

The record's axes follow the real Character Generator layers (body, eyes, hair, outfit, accessory — art-pack QA 2026-07-29): `eyes` is a sheet-selection axis (each `Eyes_NN.png` sheet is its own colour), and the old separate top/bottom garment axes collapse into one `outfit` axis. That drops the appearance space from ~690k to **604,800 (≈605k)** — still far above the 10⁴ floor (G-D). No manual cache migration is needed for the record-shape change: the appearance hash embeds `SCHEMA_VERSION` (I-7), so bumping it invalidates every cached bake automatically.

**Files:**
- Create: `packages/shared/src/appearance/derive.mjs`
- Consumes: `packages/shared/src/hash.mjs` (Plan 1 Task 2)
- Modify: `test/harness-no-hook.test.mjs` — add `derive.mjs` to `NO_HOOK_MODULES`
- Test: `test/appearance-derive.test.mjs`

**Interfaces:**
- Consumes: `AppearanceRecord`, `Build`, `SCHEMA_VERSION`, `hashString` (Plan 1 Task 2).
- Produces `packages/shared/src/appearance/derive.mjs`:
  - `hashString` — re-exported from `../hash.mjs` (Plan 1 Task 2), not redefined
  - `pickFrom(list, seed, salt) → T`
  - `normalizeGender(raw) → Build`
  - `SKIN_TONES, EYE_VARIANTS, HAIR_STYLES, HAIR_COLORS, OUTFIT_COLORS, ACCESSORIES` — the colour palettes plus the eyes sheet-variant list
  - `appearanceRecord(spriteSeed, gender) → AppearanceRecord`
  - `appearanceHash(record) → string` (8 lowercase hex chars)
  - `appearanceSpaceSize() → number`

- [ ] **Step 1: Write the failing test**

`test/appearance-derive.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  normalizeGender, appearanceRecord, appearanceHash,
  appearanceSpaceSize, SKIN_TONES, EYE_VARIANTS, HAIR_STYLES, HAIR_COLORS,
  OUTFIT_COLORS, ACCESSORIES,
} from '../packages/shared/src/appearance/derive.mjs';

// The hashString unit and cross-repo contract tests live in
// test/shared-types.test.ts (Plan 1 Task 2), beside hash.mjs itself.

test('derive.mjs loads under bare node — the bake CLIs depend on it', () => {
  // No --import ./test/ts-resolve.mjs. If this module ever reaches a .ts file
  // it throws here instead of at `npm run bake:agents` two tasks from now.
  const out = execFileSync(process.execPath,
    ['-e', "import('./packages/shared/src/appearance/derive.mjs').then(m => console.log(typeof m.appearanceHash))"],
    { encoding: 'utf8' });
  assert.match(out, /function/);
});

test('normalizeGender maps the live DB values', () => {
  assert.equal(normalizeGender('male'), 'masc');
  assert.equal(normalizeGender('female'), 'fem');
  assert.equal(normalizeGender('  MALE  '), 'masc');
  assert.equal(normalizeGender('Woman'), 'fem');
});

test('normalizeGender never throws and falls to neutral', () => {
  for (const v of [null, undefined, '', '   ', 'nonbinary', 'agender', 'yes', '🙂', 42, {}])
    assert.equal(normalizeGender(v), 'neutral', String(v));
});

test('derivation is pure and deterministic', () => {
  const a = appearanceRecord('aisha_khan', 'female');
  const b = appearanceRecord('aisha_khan', 'female');
  assert.deepEqual(a, b);
});

test('every axis is seed-derived — no dimension is gated on gender', () => {
  const m = appearanceRecord('aisha_khan', 'male');
  const f = appearanceRecord('aisha_khan', 'female');
  assert.notEqual(m.build, f.build);
  for (const k of ['skinTone', 'eyes', 'hairStyle', 'hairColor', 'outfit', 'accessory'])
    assert.equal(m[k], f[k], `${k} must not depend on build`);
});

test('every derived value comes from its declared palette', () => {
  const r = appearanceRecord('the_skeptic', 'male');
  assert.ok(SKIN_TONES.includes(r.skinTone));
  assert.ok(EYE_VARIANTS.includes(r.eyes));
  assert.ok(HAIR_STYLES.includes(r.hairStyle));
  assert.ok(HAIR_COLORS.includes(r.hairColor));
  assert.ok(OUTFIT_COLORS.includes(r.outfit));
  assert.ok(ACCESSORIES.includes(r.accessory));
});

test('the space is at least 10^4 as G-D requires', () => {
  assert.equal(appearanceSpaceSize(), 3 * 6 * 7 * 12 * 10 * 8 * 5);
  assert.ok(appearanceSpaceSize() >= 1e4);
});

test('10k seeds spread across the space without collapsing', () => {
  const seen = new Set();
  for (let i = 0; i < 10_000; i++) seen.add(appearanceHash(appearanceRecord(`agent_${i}`, 'neutral')));
  assert.ok(seen.size > 5000, `only ${seen.size} distinct appearances in 10k seeds`);
});

test('no palette value is used by more than 30% of a 10k roster', () => {
  const counts = {};
  for (let i = 0; i < 10_000; i++) {
    const r = appearanceRecord(`agent_${i}`, 'neutral');
    counts[r.hairStyle] = (counts[r.hairStyle] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(counts)) assert.ok(n < 3000, `${k} appears ${n} times`);
});

test('the hash embeds SCHEMA_VERSION so a bump invalidates the cache (I-7)', async () => {
  const mod = await import('../packages/shared/src/appearance/derive.mjs');
  const r = appearanceRecord('aisha_khan', 'female');
  assert.equal(appearanceHash(r), appearanceHash(r));
  assert.notEqual(appearanceHash(r), mod.appearanceHashAt(r, 2));
});

test('the hash is 8 lowercase hex characters — safe as a filename', () => {
  assert.match(appearanceHash(appearanceRecord('x', 'male')), /^[0-9a-f]{8}$/);
});

test('no record can name an animal (I-13)', () => {
  const banned = /cow|pig|dog|chicken|animal/i;
  for (let i = 0; i < 2000; i++) {
    const r = appearanceRecord(`agent_${i}`, 'neutral');
    for (const v of Object.values(r)) assert.equal(banned.test(String(v)), false, `${v}`);
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="derivation is pure and deterministic"`
Expected: FAIL — `Cannot find module '.../packages/shared/src/appearance/derive.mjs'`.

- [ ] **Step 3: Write the derivation**

`packages/shared/src/appearance/derive.mjs` — plain ESM JavaScript so both the Node bake scripts and the Vite-bundled client import the *same* module. One implementation, no drift (I-5, I-6).

```js
/**
 * Appearance derivation. A PURE function of identity: no DB, no clock, no
 * Math.random() (I-5). This mirrors aisocialnetwork-api/src/utils/agentSeed.js,
 * which already derives city, traits and description seeds from the username
 * with the same FNV-1a hashString(seed, salt).
 *
 * CROSS-REPO CONTRACT: hashString is DEFINED in ../hash.mjs (Plan 1 Task 2)
 * and only re-exported here. That file must stay bit-identical to the api
 * copy — if they diverge, an agent's sprite and profile stop agreeing.
 * test/shared-types.test.ts pins it.
 *
 * Plain .mjs on purpose — imported unchanged by scripts/*.mjs under Node and
 * by the client through Vite. Two copies would be two sources of truth.
 *
 * NOTE THE IMPORT BELOW. It reaches schemaVersion.mjs, NOT types/Assets.ts.
 * Neither bare `node` (scripts/agent-bake.mjs) nor Vite (the client bundle)
 * rewrites a `.js` specifier onto a `.ts` file — only test/ts-resolve.mjs
 * does, and that exists solely inside `node --test`. Importing the constant
 * from the .ts file would make this module load in tests and nowhere else.
 * test/harness-no-hook.test.mjs is the guard.
 */
import { SCHEMA_VERSION } from '../schemaVersion.mjs';

// hashString lives in ../hash.mjs (Plan 1 Task 2): venueSlots.ts (Plan 3
// Task 37) needs it a whole plan before this file exists, and the api's
// scheduleCoverage.js needs the api's identical copy. Re-exported here so
// every consumer of the appearance seam still finds it on one module.
import { hashString } from '../hash.mjs';
export { hashString };

export function pickFrom(list, seed, salt) {
  return list[hashString(seed, salt) % list.length];
}

// ── palettes ────────────────────────────────────────────────────────────
// Perceptually separated rather than evenly spaced in hue (spec §10.2):
// colour must stay distinguishable under the night tint (DAY_TINT_KEYS
// reaches alpha 0.45) and for colour-vision deficiency. Name labels remain
// the authoritative identifier; colour is an aid, never the only channel.

export const SKIN_TONES = ['#5c3317', '#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac'];

/** Silhouette carries more at 16px than hue does — styles differ in volume. */
export const HAIR_STYLES = [
  'buzz', 'short_crop', 'side_part', 'bob', 'long_straight', 'ponytail',
  'bun', 'curly_short', 'curly_long', 'afro', 'mohawk', 'braids',
];

export const HAIR_COLORS = [
  '#1a1a1a', '#4a2c19', '#8b5a2b', '#c98a3b', '#e8c547',
  '#f2f2f2', '#8c8c8c', '#a33b2a', '#d2691e', '#3f5fa8',
];

export const OUTFIT_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f1c40f',
  '#8e44ad', '#e67e22', '#ecf0f1', '#34495e',
];

/**
 * Eyes are a SHEET-SELECTION axis, not a colour: the pack ships one full
 * sheet per eye colour (Eyes_01.png .. Eyes_07.png) and each sheet IS the
 * colour. No hex palette exists for eyes, and the palette-separation test
 * (Task 38) deliberately excludes them.
 */
export const EYE_VARIANTS = ['01', '02', '03', '04', '05', '06', '07'];

/** Accessories must alter SILHOUETTE, not only hue (spec §10.2). */
export const ACCESSORIES = ['none', 'cap', 'beanie', 'backpack', 'satchel'];

export const BUILDS = ['masc', 'fem', 'neutral'];

/**
 * users.gender is VARCHAR(50) with NO check constraint (008_add_gender.js),
 * made non-null by 009 — the column holds arbitrary strings. Map a
 * case-folded, trimmed value onto a Build; anything unrecognised or empty
 * falls to 'neutral'. Never throws, never branches on an unbounded set.
 */
export function normalizeGender(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (['male', 'm', 'man', 'masc', 'masculine', 'boy'].includes(v)) return 'masc';
  if (['female', 'f', 'woman', 'fem', 'feminine', 'girl'].includes(v)) return 'fem';
  return 'neutral';
}

/**
 * @param {string} spriteSeed stable, unique — the username
 * @param {unknown} gender free text from users.gender
 * @returns {{build:string, skinTone:string, eyes:string, hairStyle:string, hairColor:string, outfit:string, accessory:string}}
 */
export function appearanceRecord(spriteSeed, gender) {
  return {
    build:     normalizeGender(gender),                          // not hashed
    skinTone:  pickFrom(SKIN_TONES,     spriteSeed, 'sprite:skin'),
    eyes:      pickFrom(EYE_VARIANTS,   spriteSeed, 'sprite:eyes'),
    hairStyle: pickFrom(HAIR_STYLES,    spriteSeed, 'sprite:hairStyle'),
    hairColor: pickFrom(HAIR_COLORS,    spriteSeed, 'sprite:hairColor'),
    outfit:    pickFrom(OUTFIT_COLORS,  spriteSeed, 'sprite:outfit'),
    accessory: pickFrom(ACCESSORIES,    spriteSeed, 'sprite:accessory'),
  };
}

/** Key order is fixed so JSON.stringify is stable across engines. */
const KEYS = ['build', 'skinTone', 'eyes', 'hairStyle', 'hairColor', 'outfit', 'accessory'];
const canonical = record => JSON.stringify(KEYS.map(k => record[k]));

/**
 * Content address. SCHEMA_VERSION is inside the hash, so bumping it changes
 * every hash and invalidates the cache with no manual purge step (I-7).
 */
export function appearanceHashAt(record, version) {
  return hashString(canonical(record) + version, 'appearance').toString(16).padStart(8, '0');
}

export function appearanceHash(record) {
  return appearanceHashAt(record, SCHEMA_VERSION);
}

export function appearanceSpaceSize() {
  return BUILDS.length * SKIN_TONES.length * EYE_VARIANTS.length * HAIR_STYLES.length
    * HAIR_COLORS.length * OUTFIT_COLORS.length * ACCESSORIES.length;
}
```

- [ ] **Step 4: Confirm the subpath resolves in all three loaders**

Plan 1 Task 2 Step 5b already opened the seam — the `./*.mjs` exports pattern
and the regex Vite alias are in place. This step only checks that the new file
lands inside it, because a silent failure here surfaces as three unrelated bugs
in Tasks 29, 30 and 34:

```bash
node -e "import('@botville/shared/appearance/derive.mjs').then(m => console.log('node:', typeof m.appearanceHash))"
npm run build --workspace=packages/client
npx tsc --noEmit -p packages/client/tsconfig.json
```

Expected: `node: function`, a clean build, and a clean typecheck. If the first
line says `ERR_PACKAGE_PATH_NOT_EXPORTED`, Plan 1 Task 2 Step 5b was skipped —
fix it there, not here.

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: PASS — 12 new tests.

One of them carries the weight:

- **`derive.mjs loads under bare node`** — the guard that this module has not
  reacquired a `.ts` dependency. It is the difference between `npm run
  bake:agents` working and failing with `ERR_MODULE_NOT_FOUND` in Task 29.

The `hashString` unit and cross-repo contract tests are **not** here — they
live in `test/shared-types.test.ts` (Plan 1 Task 2), beside the definition.

Also add `packages/shared/src/appearance/derive.mjs` to `NO_HOOK_MODULES` in
`test/harness-no-hook.test.mjs` — it stops skipping now that it exists.

- [ ] **Step 6: Commit**

```bash
git add packages/shared/src/appearance/derive.mjs test/appearance-derive.test.mjs test/harness-no-hook.test.mjs
git commit -m "feat(appearance): pure identity-derived appearance record on the shared cross-repo hash"
```

---

## Task 27: `AppearanceComposer`

**Needs the packs to bake real sheets; develops and tests against the fixture pack.** Composes an `AppearanceRecord` into a character sheet and a 32×32 portrait. Strategy is chosen by `capabilities.characterLayers` (spec §7.3) — the design works either way, only the achieved variety differs. For the real pack the flag is `true` (art-pack QA, 2026-07-29).

Two real-pack facts shape this task:

- **The body sheets are 927 px wide** — *not* a whole number of 16 px frames. The composer must size its canvas to whole frames (`floor(w / frameWidth) * frameWidth`, same for height), never to the raw sheet size, or every downstream frame-geometry assertion fails on the real pack.
- **Variant axes are sibling files, not rows.** The adapter aliases one index-0 file per layer (`Eyes_01.png`, `Hairstyle_01_01.png`, `Outfit_01_01.png`, ...); the pack ships 7 eye sheets, 200 hairstyle sheets and 132 outfit sheets as siblings. The composer resolves the concrete sheet for a record by replacing the index in the aliased file's name with the record's variant (`eyes: '04'` → `Eyes_04.png`; the record's `hairStyle`/`hairColor` select the hairstyle sheet the same way). One mechanism for all variant layers — do not invent a separate one per layer.

**Recommended Step 0 (real pack only, not blocking):** sit/sleep row coverage for the hair and accessory layers is still unverified — before trusting composed sit/sleep frames, alpha-sample those rows in a handful of hair/accessory sheets and record the answer in `docs/ASSETS.md`.

**Files:**
- Create: `scripts/lib/appearanceComposer.mjs`
- Test: `test/appearance-composer.test.mjs`

**Interfaces:**
- Consumes: `readSprite()`, `asSource()` (Task 9), `appearanceRecord()` (Task 26), the contract's `characters` block (Task 4).
- Produces `scripts/lib/appearanceComposer.mjs`:
  - `composeSheet(contract, adapter, record) → canvas` — full character sheet at the contract's frame geometry
  - `composePortrait(contract, adapter, record) → canvas` — 32×32 head-and-shoulders
  - `remapPalette(canvas, from[], to[]) → canvas` — the `characterLayers: false` path
  - `hexToRgba(hex) → [r,g,b,a]`

- [ ] **Step 1: Write the failing test**

`test/appearance-composer.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { appearanceRecord } from '../packages/shared/src/appearance/derive.mjs';
import { composeSheet, composePortrait, remapPalette, hexToRgba } from '../scripts/lib/appearanceComposer.mjs';
import { createCanvas, encodePng } from '../scripts/png-lib.mjs';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const c = loadContract();
const a = loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');
const rec = seed => appearanceRecord(seed, 'female');

test('a composed sheet has the contract frame geometry', () => {
  const cv = composeSheet(c, a, rec('aisha_khan'));
  assert.equal(cv.w % c.characters.frameWidth, 0);
  assert.equal(cv.h % c.characters.frameHeight, 0);
  assert.ok(cv.w >= c.characters.frameWidth * 6 * 4, 'at least four directions of six frames');
});

test('composition is deterministic', () => {
  assert.deepEqual([...composeSheet(c, a, rec('x')).data], [...composeSheet(c, a, rec('x')).data]);
});

test('two different seeds compose to different pixels', () => {
  assert.notDeepEqual([...composeSheet(c, a, rec('alpha')).data], [...composeSheet(c, a, rec('beta')).data]);
});

test('the portrait is 32x32', () => {
  const p = composePortrait(c, a, rec('aisha_khan'));
  assert.equal(p.w, 32);
  assert.equal(p.h, 32);
});

test('the portrait shares the record, so it cannot contradict the sprite', () => {
  const r = rec('aisha_khan');
  assert.deepEqual([...composePortrait(c, a, r).data], [...composePortrait(c, a, r).data]);
  assert.notDeepEqual([...composePortrait(c, a, r).data], [...composePortrait(c, a, rec('other')).data]);
});

test('hexToRgba parses a six-digit hex', () => {
  assert.deepEqual(hexToRgba('#c0392b'), [192, 57, 43, 255]);
});

test('remapPalette swaps declared colours and leaves the rest alone', () => {
  const cv = createCanvas(3, 1);
  cv.set(0, 0, [192, 57, 43, 255]);
  cv.set(1, 0, [1, 2, 3, 255]);
  const out = remapPalette(cv, [[192, 57, 43, 255]], [[9, 9, 9, 255]]);
  assert.deepEqual([out.data[0], out.data[1], out.data[2]], [9, 9, 9]);
  assert.deepEqual([out.data[4], out.data[5], out.data[6]], [1, 2, 3]);
});

test('remapPalette never touches transparent pixels', () => {
  const cv = createCanvas(1, 1);   // all zeroes = transparent
  const out = remapPalette(cv, [[0, 0, 0, 0]], [[255, 0, 0, 255]]);
  assert.equal(out.data[3], 0);
});

test('a 927px-wide body sheet composes to whole frames (the real-pack crop)', () => {
  // The real Bodies/Eyes/Hairstyles/Outfits/Accessories sheets are 927x656 —
  // NOT a whole number of 16px frames (927 = 57*16 + 15). The composer must
  // crop its canvas to whole frames, never size it to the raw sheet.
  const dir = mkdtempSync(join(tmpdir(), 'body927-'));
  writeFileSync(join(dir, 'wide.png'), encodePng(createCanvas(927, 656)));
  const src = {
    pack: 'wide-fixture',
    capabilities: { characterLayers: true },
    files: { wide: 'wide.png' },
    rects: Object.fromEntries(c.characters.parts.map(p => [`char_${p}`, { file: 'wide' }])),
  };
  writeFileSync(join(dir, 'wide.json'), JSON.stringify(src));
  const wide = loadAdapter(join(dir, 'wide.json'), dir);
  const cv = composeSheet(c, wide, rec('aisha_khan'));
  const fw = c.characters.frameWidth, fh = c.characters.frameHeight;
  assert.equal(cv.w, Math.floor(927 / fw) * fw);
  assert.equal(cv.h, Math.floor(656 / fh) * fh);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="a composed sheet has the contract frame geometry"`
Expected: FAIL — `Cannot find module '.../scripts/lib/appearanceComposer.mjs'`.

- [ ] **Step 3: Write the composer**

`scripts/lib/appearanceComposer.mjs`:

```js
/**
 * AppearanceRecord -> character sheet + portrait.
 *
 * Two strategies, chosen by the PACK, not by the record (spec §7.3):
 *   capabilities.characterLayers === true  -> stack separable parts.
 *       Full silhouette variation.
 *   capabilities.characterLayers === false -> palette-remap a premade base.
 *       Colour variation only; silhouette comes from the base sheet, so
 *       effective variety is bases x palettes. Nothing breaks; variety drops.
 *
 * The LimeZu packs DO ship separable 16x32 layers (Bodies/Eyes/Hairstyles/
 * Outfits/Accessories — verified 2026-07-29, recorded in docs/ASSETS.md), so
 * the layered path is the shipping path; remap survives as the fallback.
 */
import { createCanvas } from '../png-lib.mjs';
import { readSprite, asSource } from './spriteReader.mjs';

export function hexToRgba(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
}

/** Nearest-colour swap over an explicit from/to palette. Transparent stays transparent. */
export function remapPalette(canvas, from, to) {
  const out = createCanvas(canvas.w, canvas.h);
  canvas.data.copy(out.data);
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] === 0) continue;
    for (let k = 0; k < from.length; k++) {
      if (out.data[i] === from[k][0] && out.data[i + 1] === from[k][1] && out.data[i + 2] === from[k][2]) {
        out.data[i] = to[k][0]; out.data[i + 1] = to[k][1]; out.data[i + 2] = to[k][2];
        break;
      }
    }
  }
  return out;
}

/** Tint every opaque pixel of a layer toward a colour, preserving its shading. */
function tintLayer(src, [r, g, b]) {
  const out = createCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const p = src.px(x, y);
      if (p[3] === 0) continue;
      // luminance of the source drives the shade; the palette drives the hue
      const l = (p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114) / 255;
      out.set(x, y, [Math.round(r * l), Math.round(g * l), Math.round(b * l), p[3]]);
    }
  }
  return out;
}

/**
 * Which record field colours which part. `build` selects the body sheet
 * variant rather than a colour. `eyes` is a SHEET-SELECTION axis, never a
 * tint: each Eyes_NN.png sheet is its own colour, so eyes map to null here.
 * `hairStyle`/`hairColor` likewise select a hairstyle sheet (see the variant
 * note in the task header); the tint entry for hair covers the fixture pack,
 * whose single hair layer is tintable.
 */
const PART_COLOR = { body: 'skinTone', eyes: null, hair: 'hairColor', outfit: 'outfit', accessory: null };

export function composeSheet(contract, adapter, record) {
  const layered = adapter.capabilities.characterLayers === true;
  const parts = contract.characters.parts;

  const base = readSprite(adapter, `char_${parts[0]}`);
  // The real body sheets are 927px wide — NOT a whole number of 16px frames.
  // Size the canvas to whole frames so every consumer sees frame-aligned art.
  const fw = contract.characters.frameWidth;
  const fh = contract.characters.frameHeight;
  const sheetW = Math.floor(base.w / fw) * fw;
  const sheetH = Math.floor(base.h / fh) * fh;
  const out = createCanvas(sheetW, sheetH);

  if (!layered) {
    // Palette-remap path: one base sheet, recoloured. With a single `outfit`
    // axis the two garment ramps (#ecf0f1 top, #2c3e50 bottom) both map onto
    // record.outfit — deliberately degenerate: the fallback trades garment
    // variety for zero extra machinery. Document, don't "fix".
    const from = [hexToRgba('#ffdbac'), hexToRgba('#1a1a1a'), hexToRgba('#ecf0f1'), hexToRgba('#2c3e50')];
    const to = [hexToRgba(record.skinTone), hexToRgba(record.hairColor), hexToRgba(record.outfit), hexToRgba(record.outfit)];
    out.blit(asSource(base.canvas), 0, 0, sheetW, sheetH, 0, 0);
    return remapPalette(out, from, to);
  }

  // Layered path: stack body -> eyes -> hair -> outfit -> accessory.
  // Variant layers (eyes, and hair/outfit on the real pack) resolve their
  // concrete sibling sheet by index replacement in the aliased file's name —
  // see the task header. The fixture pack has one sheet per layer, so there
  // the alias is the sheet; the resolution helper is a no-op for it.
  for (const part of parts) {
    if (part === 'accessory' && record.accessory === 'none') continue;
    const layer = readSprite(adapter, `char_${part}`);
    const colorKey = PART_COLOR[part];
    const src = colorKey ? asSource(tintLayer(asSource(layer.canvas), hexToRgba(record[colorKey])))
                         : asSource(layer.canvas);
    out.blit(src, 0, 0, Math.min(layer.w, out.w), Math.min(layer.h, out.h), 0, 0);
  }
  return out;
}

/**
 * 32x32 head-and-shoulders, composed from the SAME record as the sprite —
 * so build, skin tone and hair colour agree across surfaces (spec §6.3).
 * The two depictions may look different; they must not contradict.
 */
export function composePortrait(contract, adapter, record) {
  const sheet = composeSheet(contract, adapter, record);
  const fw = contract.characters.frameWidth;
  const fh = contract.characters.frameHeight;

  // frame 0 of the idle row, facing 'down' — the last direction in the order
  const dirIndex = contract.characters.directionOrder.indexOf('down');
  const fpd = contract.characters.anims.idle.framesPerDirection;
  const sx = (dirIndex * fpd) * fw;
  const sy = fh;                      // row 1 is idle (row 0 is the preview strip)

  const out = createCanvas(32, 32);
  const src = asSource(sheet);
  // 2x nearest-neighbour of the top 16x16 of the frame
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const p = src.px(sx + x, sy + y);
      if (p[3] === 0) continue;
      out.set(x * 2, y * 2, p); out.set(x * 2 + 1, y * 2, p);
      out.set(x * 2, y * 2 + 1, p); out.set(x * 2 + 1, y * 2 + 1, p);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 9 new tests, exercising the **layered** path because `sources/fixture.json` declares `characterLayers: true`. To exercise the remap path: `node -e "..."` with a hand-edited copy, or flip the fixture capability temporarily.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/appearanceComposer.mjs test/appearance-composer.test.mjs
git commit -m "feat(appearance): composer with layered and palette-remap strategies, plus portrait"
```

---

## Task 28: `AgentBaker` — idempotent, atomic, content-addressed

`bake(record)` writes `baked/<hash>.png` and `baked/<hash>-portrait.png`, and is a no-op when they already exist. Writes are atomic (temp file + rename) so a concurrent reader never sees a half-written PNG (spec §7.2). **Batch and event call this same function** — that is why the two paths cannot drift (I-6).

**Files:**
- Create: `scripts/lib/agentBaker.mjs`
- Test: `test/agent-baker.test.mjs`

**Interfaces:**
- Consumes: `composeSheet()`, `composePortrait()` (Task 27), `appearanceHash()` (Task 26).
- Produces `scripts/lib/agentBaker.mjs`:
  - `bake(ctx, record) → Promise<{ hash, written: boolean, sheet: string, portrait: string }>`
  - `ctx = { contract, adapter, outDir }`
  - `bakedPath(outDir, hash) → string`, `portraitPath(outDir, hash) → string`

- [ ] **Step 1: Write the failing test**

`test/agent-baker.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { appearanceRecord, appearanceHash } from '../packages/shared/src/appearance/derive.mjs';
import { bake, bakedPath, portraitPath } from '../scripts/lib/agentBaker.mjs';

const ctx = () => ({
  contract: loadContract(),
  adapter: loadAdapter('sources/fixture.json', 'test/fixtures/pack-src'),
  outDir: mkdtempSync(join(tmpdir(), 'baked-')),
});
const rec = appearanceRecord('aisha_khan', 'female');

test('bake writes a sheet and a portrait named by the hash', async () => {
  const c = ctx();
  const r = await bake(c, rec);
  assert.equal(r.hash, appearanceHash(rec));
  assert.ok(existsSync(bakedPath(c.outDir, r.hash)));
  assert.ok(existsSync(portraitPath(c.outDir, r.hash)));
  assert.equal(r.written, true);
});

test('bake is idempotent — the second call writes nothing (I-6)', async () => {
  const c = ctx();
  const first = await bake(c, rec);
  const mtime = statSync(bakedPath(c.outDir, first.hash)).mtimeMs;
  const second = await bake(c, rec);
  assert.equal(second.written, false);
  assert.equal(statSync(bakedPath(c.outDir, second.hash)).mtimeMs, mtime);
});

test('concurrent bakes of the same hash produce one intact file', async () => {
  const c = ctx();
  const results = await Promise.all(Array.from({ length: 8 }, () => bake(c, rec)));
  const hash = results[0].hash;
  assert.equal(new Set(results.map(r => r.hash)).size, 1);
  const png = readFileSync(bakedPath(c.outDir, hash));
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  assert.deepEqual([...png.subarray(png.length - 8, png.length - 4)].map(n => String.fromCharCode(n)).join(''), 'IEND');
  assert.equal(readdirSync(c.outDir).filter(f => f.endsWith('.tmp')).length, 0, 'temp files left behind');
});

test('different records produce different hashes and different files', async () => {
  const c = ctx();
  const a = await bake(c, appearanceRecord('alpha', 'male'));
  const b = await bake(c, appearanceRecord('beta', 'female'));
  assert.notEqual(a.hash, b.hash);
  assert.notDeepEqual(readFileSync(bakedPath(c.outDir, a.hash)), readFileSync(bakedPath(c.outDir, b.hash)));
});

test('the same appearance from two different seeds bakes once', async () => {
  const c = ctx();
  // find two seeds that collide on the record
  let s1 = null, s2 = null;
  const seen = new Map();
  for (let i = 0; i < 20_000 && !s2; i++) {
    const h = appearanceHash(appearanceRecord(`a_${i}`, 'neutral'));
    if (seen.has(h)) { s1 = seen.get(h); s2 = `a_${i}`; } else seen.set(h, `a_${i}`);
  }
  assert.ok(s2, 'expected a collision within 20k seeds');
  const x = await bake(c, appearanceRecord(s1, 'neutral'));
  const y = await bake(c, appearanceRecord(s2, 'neutral'));
  assert.equal(x.hash, y.hash);
  assert.equal(y.written, false, 'content-addressing means one bake, not two');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="bake writes a sheet and a portrait"`
Expected: FAIL — `Cannot find module '.../scripts/lib/agentBaker.mjs'`.

- [ ] **Step 3: Write the baker**

`scripts/lib/agentBaker.mjs`:

```js
/**
 * Content-addressed, idempotent agent bake.
 *
 * ONE implementation. Batch and event both call bake() — that is why the
 * two paths cannot drift, the usual failure mode of a batch+streaming
 * pipeline (I-6).
 *
 * Writes are atomic (temp file + rename) so a concurrent reader never
 * observes a half-written PNG. The temp name includes the pid and a
 * counter so parallel bakes of the SAME hash cannot collide on it.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { rename, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { encodePng } from '../png-lib.mjs';
import { composeSheet, composePortrait } from './appearanceComposer.mjs';
import { appearanceHash } from '../../packages/shared/src/appearance/derive.mjs';

export const bakedPath = (outDir, hash) => join(outDir, `${hash}.png`);
export const portraitPath = (outDir, hash) => join(outDir, `${hash}-portrait.png`);

let tmpCounter = 0;

async function writeAtomic(finalPath, buf) {
  const tmp = `${finalPath}.${process.pid}.${tmpCounter++}.tmp`;
  await writeFile(tmp, buf);
  try {
    await rename(tmp, finalPath);          // atomic on the same filesystem
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

/**
 * @param {{contract: object, adapter: object, outDir: string}} ctx
 * @param {object} record an AppearanceRecord
 * @returns {Promise<{hash: string, written: boolean, sheet: string, portrait: string}>}
 */
export async function bake(ctx, record) {
  const hash = appearanceHash(record);
  const sheet = bakedPath(ctx.outDir, hash);
  const portrait = portraitPath(ctx.outDir, hash);

  if (existsSync(sheet) && existsSync(portrait)) {
    return { hash, written: false, sheet, portrait };
  }

  mkdirSync(ctx.outDir, { recursive: true });
  const sheetPng = encodePng(composeSheet(ctx.contract, ctx.adapter, record));
  const portraitPng = encodePng(composePortrait(ctx.contract, ctx.adapter, record));

  await Promise.all([writeAtomic(sheet, sheetPng), writeAtomic(portrait, portraitPng)]);
  return { hash, written: true, sheet, portrait };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 5 new tests, including the concurrency test that would catch a torn write.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/agentBaker.mjs test/agent-baker.test.mjs
git commit -m "feat(appearance): idempotent content-addressed AgentBaker with atomic writes (I-6)"
```

---

## Task 29: Batch and event entry points

Both call `bake()`. Batch sweeps a roster and bakes the missing set; event bakes one. Safe to re-run, safe to run concurrently with each other (spec §7.2).

**Files:**
- Create: `scripts/agent-bake.mjs`
- Modify: `package.json` — `bake:agents` script
- Modify: `.gitignore` — already covered by `baked/` from Task 18
- Test: `test/agent-bake-cli.test.mjs`

**Interfaces:**
- Consumes: `bake()` (Task 28), `appearanceRecord()` (Task 26).
- Produces `scripts/agent-bake.mjs`:
  - `bakeRoster(ctx, roster) → Promise<{ baked: number, skipped: number, hashes: string[] }>` — `roster` is `Array<{ spriteSeed, gender }>`
  - `bakeOne(ctx, spriteSeed, gender) → Promise<result>`
  - CLI: `node scripts/agent-bake.mjs --roster <file.json>` or `--seed <username> [--gender <value>]`

- [ ] **Step 1: Write the failing test**

`test/agent-bake-cli.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { bakeRoster, bakeOne } from '../scripts/agent-bake.mjs';

const ctx = () => ({
  contract: loadContract(),
  adapter: loadAdapter('sources/fixture.json', 'test/fixtures/pack-src'),
  outDir: mkdtempSync(join(tmpdir(), 'roster-')),
});
const roster = n => Array.from({ length: n }, (_, i) => ({ spriteSeed: `agent_${i}`, gender: i % 2 ? 'male' : 'female' }));

test('a batch bakes the whole roster', async () => {
  const c = ctx();
  const r = await bakeRoster(c, roster(40));
  assert.equal(r.baked + r.skipped, new Set(r.hashes).size);
  assert.equal(readdirSync(c.outDir).filter(f => f.endsWith('-portrait.png')).length, new Set(r.hashes).size);
});

test('re-running a batch bakes nothing new', async () => {
  const c = ctx();
  await bakeRoster(c, roster(20));
  const second = await bakeRoster(c, roster(20));
  assert.equal(second.baked, 0);
  assert.ok(second.skipped > 0);
});

test('batch and event agree — the event path adds nothing after a batch', async () => {
  const c = ctx();
  await bakeRoster(c, roster(20));
  const before = readdirSync(c.outDir).length;
  const one = await bakeOne(c, 'agent_7', 'male');
  assert.equal(one.written, false);
  assert.equal(readdirSync(c.outDir).length, before);
});

test('the event path bakes a new agent the batch never saw', async () => {
  const c = ctx();
  await bakeRoster(c, roster(5));
  const one = await bakeOne(c, 'brand_new_agent', 'female');
  assert.equal(one.written, true);
});

test('batch and event are safe to interleave', async () => {
  const c = ctx();
  const [batch, ev] = await Promise.all([
    bakeRoster(c, roster(30)),
    bakeOne(c, 'agent_3', 'male'),
  ]);
  assert.ok(batch.hashes.includes(ev.hash));
  assert.equal(readdirSync(c.outDir).filter(f => f.endsWith('.tmp')).length, 0);
});

test('an 85-agent roster collapses to far fewer bakes than agents', async () => {
  const c = ctx();
  const r = await bakeRoster(c, roster(85));
  assert.equal(r.baked, new Set(r.hashes).size);
  assert.ok(r.baked <= 85);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="a batch bakes the whole roster"`
Expected: FAIL — `Cannot find module '.../scripts/agent-bake.mjs'`.

- [ ] **Step 3: Write the entry points**

`scripts/agent-bake.mjs`:

```js
#!/usr/bin/env node
/**
 * Agent bake entry points. BOTH call bake() from lib/agentBaker.mjs —
 * one implementation, so batch and event cannot drift (I-6).
 *
 *   node scripts/agent-bake.mjs --roster roster.json
 *   node scripts/agent-bake.mjs --seed aisha_khan --gender female
 *
 * roster.json: [{ "spriteSeed": "aisha_khan", "gender": "female" }, ...]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';
import { bake } from './lib/agentBaker.mjs';
import { appearanceRecord } from '../packages/shared/src/appearance/derive.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const DEFAULT_OUT = join(ROOT, 'packages', 'client', 'public', 'assets', 'baked');

/** Event path: one agent, on creation or appearance change. */
export async function bakeOne(ctx, spriteSeed, gender) {
  return bake(ctx, appearanceRecord(spriteSeed, gender));
}

/**
 * Batch path: sweep the roster, bake the missing set. Safe to re-run and
 * safe to run concurrently with the event path.
 */
export async function bakeRoster(ctx, roster, { concurrency = 8 } = {}) {
  const hashes = [];
  let baked = 0, skipped = 0;

  const queue = [...roster];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const r = await bakeOne(ctx, item.spriteSeed, item.gender);
      hashes.push(r.hash);
      if (r.written) baked++; else skipped++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, roster.length || 1) }, worker));

  return { baked, skipped, hashes };
}

function makeCtx(pack, srcRoot, outDir) {
  return { contract: loadContract(), adapter: loadAdapter(`sources/${pack}.json`, srcRoot), outDir };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const pack = arg('--pack') ?? 'fixture';
  const srcRoot = arg('--src') ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');
  const ctx = makeCtx(pack, srcRoot, arg('--out') ?? DEFAULT_OUT);

  const rosterFile = arg('--roster');
  if (rosterFile) {
    const roster = JSON.parse(readFileSync(rosterFile, 'utf8'));
    const r = await bakeRoster(ctx, roster);
    console.log(`agent bake: ${r.baked} baked, ${r.skipped} already present, ${new Set(r.hashes).size} distinct appearances for ${roster.length} agents`);
  } else {
    const seed = arg('--seed');
    if (!seed) { console.error('usage: --roster <file.json> | --seed <username> [--gender <value>]'); process.exit(2); }
    const r = await bakeOne(ctx, seed, arg('--gender') ?? '');
    console.log(`agent bake: ${seed} -> ${r.hash} (${r.written ? 'written' : 'already present'})`);
  }
}
```

- [ ] **Step 4: Wire the script**

Root `package.json`, in `"scripts"`:

```json
    "bake:agents": "node scripts/agent-bake.mjs",
```

- [ ] **Step 5: Run tests and try it**

Run: `npm test && npm run bake:agents -- --seed aisha_khan --gender female`
Expected: 6 new tests PASS; then `agent bake: aisha_khan -> <8 hex chars> (written)`. Run it a second time: `(already present)`.

- [ ] **Step 6: Commit**

```bash
git add scripts/agent-bake.mjs package.json test/agent-bake-cli.test.mjs
git commit -m "feat(appearance): batch and event bake entry points sharing one implementation"
```

---

## Task 30: `AppearanceResolver`

`spriteSeed → appearanceHash → textureKey`, with a default-sheet fallback when a bake is missing. **An agent must never render as a missing texture** — this is the only new runtime behaviour in the design (spec §8.3). It also enforces I-13: no agent is ever assigned an animal appearance.

**Files:**
- Create: `packages/client/src/game/agents/AppearanceResolver.ts`
- Modify: `packages/client/src/game/agents/AgentSprite.ts:55-79`
- Modify: `packages/client/src/game/scenes/PreloaderScene.ts` — load baked sheets
- Test: `test/appearance-resolver.test.ts`

**Interfaces:**
- Consumes: `appearanceRecord`, `appearanceHash` (Task 26); `AVATAR_VARIANTS` (`assetManifest.ts:116`).
- Produces `packages/client/src/game/agents/AppearanceResolver.ts`:
  - `resolveAppearance(spriteSeed: string, gender: string): { hash: string; textureKey: string; url: string }`
  - `fallbackTextureKey(spriteSeed: string): string` — a **human** variant, chosen deterministically
  - `class AppearanceResolver { has(hash); textureFor(spriteSeed, gender) }` — the only impure part is `has()`, which asks Phaser's texture cache

- [ ] **Step 1: Write the failing test**

`test/appearance-resolver.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAppearance, fallbackTextureKey, HUMAN_VARIANT_IDS } from '../packages/client/src/game/agents/AppearanceResolver.ts';
import { appearanceHash, appearanceRecord } from '../packages/shared/src/appearance/derive.mjs';

test('the resolver agrees with the baker on the hash', () => {
  const r = resolveAppearance('aisha_khan', 'female');
  assert.equal(r.hash, appearanceHash(appearanceRecord('aisha_khan', 'female')));
});

test('the texture key is derived from the hash', () => {
  const r = resolveAppearance('aisha_khan', 'female');
  assert.equal(r.textureKey, `agent-${r.hash}`);
  assert.equal(r.url, `assets/baked/${r.hash}.png`);
});

test('resolution is deterministic and pure', () => {
  assert.deepEqual(resolveAppearance('x', 'male'), resolveAppearance('x', 'male'));
});

test('the fallback is always a human variant (I-13)', () => {
  for (let i = 0; i < 2000; i++) {
    const key = fallbackTextureKey(`agent_${i}`);
    assert.match(key, /^char-premade-\d\d$/, key);
  }
});

test('no animal texture key can ever be produced (I-13)', () => {
  for (let i = 0; i < 2000; i++) {
    const key = fallbackTextureKey(`agent_${i}`);
    for (const animal of ['animal-cow', 'animal-pig', 'animal-dog', 'animal-chicken'])
      assert.notEqual(key, animal);
  }
});

test('the fallback pool is exactly the twelve human variants', () => {
  assert.equal(HUMAN_VARIANT_IDS.length, 12);
  assert.ok(HUMAN_VARIANT_IDS.every(id => id >= 0 && id < 12));
});

test('the fallback spreads across the pool rather than collapsing', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i++) seen.add(fallbackTextureKey(`agent_${i}`));
  assert.ok(seen.size >= 10, `only ${seen.size} distinct fallbacks`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the resolver agrees with the baker"`
Expected: FAIL — `Cannot find module '.../AppearanceResolver.ts'`.

- [ ] **Step 3: Write the resolver**

`packages/client/src/game/agents/AppearanceResolver.ts`:

```ts
/**
 * spriteSeed -> appearanceHash -> texture key.
 *
 * A pure module (does not import Phaser) — tested under node --test.
 * The AppearanceResolver class below adds the SINGLE impure part:
 * asking Phaser's texture cache "is this baked appearance already loaded?".
 *
 * I-13: an agent is NEVER assigned an animal look. The rule binds precisely
 * this — the new — path. Existing BotVille agents (SQLite) keep their
 * avatar_variant, and the animal textures stay loaded, because the world is
 * still owned by agentLife.ts (out of scope). What is forbidden is DERIVING an
 * animal look, not drawing animals at all.
 */
import { appearanceHash, appearanceRecord, hashString } from '@botville/shared/appearance/derive.mjs';
import { AVATAR_VARIANTS } from '../assetManifest.js';

/** Humans are ids 0..11 in AVATAR_VARIANTS. Animals (12..15) are excluded for good. */
export const HUMAN_VARIANT_IDS: number[] = AVATAR_VARIANTS
  .filter(v => v.kind === 'human')
  .map(v => v.id);

export interface ResolvedAppearance {
  hash: string;
  textureKey: string;
  url: string;
}

export function resolveAppearance(spriteSeed: string, gender: string): ResolvedAppearance {
  const hash = appearanceHash(appearanceRecord(spriteSeed, gender));
  return { hash, textureKey: `agent-${hash}`, url: `assets/baked/${hash}.png` };
}

/**
 * The fallback sheet when no bake exists: a deterministic HUMAN premade.
 * An agent is never drawn with a broken texture (spec §8.3).
 */
export function fallbackTextureKey(spriteSeed: string): string {
  const id = HUMAN_VARIANT_IDS[hashString(spriteSeed, 'sprite:fallback') % HUMAN_VARIANT_IDS.length];
  return AVATAR_VARIANTS[id].textureKey;
}

/** A wrapper over the scene's texture cache. The module's only impure part. */
export class AppearanceResolver {
  /** An explicit field: a parameter property does not survive strip-only type stripping. */
  private readonly textures: { exists(key: string): boolean };

  constructor(textures: { exists(key: string): boolean }) {
    this.textures = textures;
  }

  has(hash: string): boolean {
    return this.textures.exists(`agent-${hash}`);
  }

  /** The texture key for an agent: a baked sheet or the fallback human. */
  textureFor(spriteSeed: string, gender: string): string {
    const r = resolveAppearance(spriteSeed, gender);
    return this.has(r.hash) ? r.textureKey : fallbackTextureKey(spriteSeed);
  }
}
```

- [ ] **Step 4: Load baked sheets in the preloader**

Baked art lives on a mounted volume, so the manifest is fetched at runtime rather than bundled. In `PreloaderScene.preload()`, after the avatar spritesheets:

```ts
    // Baked appearance sheets (on the volume, not in the image — see spec §7.2).
    // The manifest lists which hashes have been built; a missing file is not an
    // error, AppearanceResolver substitutes the fallback sheet.
    this.load.json('baked-manifest', 'assets/baked/manifest.json');
```

and in `create()`, before starting the district:

```ts
    const baked = (this.cache.json.get('baked-manifest') as { hashes?: string[] } | undefined)?.hashes ?? [];
    for (const hash of baked) {
      this.load.spritesheet(`agent-${hash}`, `assets/baked/${hash}.png`, {
        frameWidth: AVATAR_VARIANTS[0].frameWidth,
        frameHeight: AVATAR_VARIANTS[0].frameHeight,
      });
    }
    this.load.once(Phaser.Loader.Events.COMPLETE, () => this.scene.start('DistrictScene'));
    this.load.start();
```

Replace the existing `this.time.delayedCall(50, ...)` with that loader-complete handler.

In `scripts/agent-bake.mjs`, after the batch completes, write the manifest:

```js
    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(ctx.outDir, 'manifest.json'),
      JSON.stringify({ hashes: [...new Set(r.hashes)].sort() }, null, 2) + '\n');
```

- [ ] **Step 5: Use the resolver in `AgentSprite`**

In `AgentSprite.ts`, add the optional identity arguments and pick the texture through the resolver. Replace lines **57-79** (the constructor signature down to and including the `this.sprite = ...` line — note the constructor opens at **57**, and the range must keep the `spriteH`/`spriteW` locals and the shadow ellipse, which later lines consume):

```ts
  constructor(
    scene: Phaser.Scene,
    agentId: string,
    name: string,
    avatarVariant: number,
    pixelX: number,
    pixelY: number,
    /** TZ-BotVille: the identity for a derived appearance. Absent — the old path. */
    identity?: { spriteSeed: string; gender: string },
  ) {
    super(scene, pixelX, pixelY);
    this.agentId = agentId;
    // Compatibility: any old numeric variants (0..7 and beyond)
    // map deterministically into the current list via getVariant
    this.variantDef = getVariant(avatarVariant);
    const vd = this.variantDef;
    const spriteH = vd.frameHeight * vd.scale;
    const spriteW = vd.frameWidth * vd.scale;

    // Shadow ellipse under the feet (sized from frame width)
    this.shadow = scene.add.ellipse(0, 0, Math.max(10, spriteW * 0.7), Math.max(4, spriteW * 0.22), 0x000000, 0.3);
    this.shadow.setOrigin(0.5, 0.5);

    // Derived appearance (spec §6): a baked sheet or the fallback human.
    const textureKey = identity
      ? new AppearanceResolver(scene.textures).textureFor(identity.spriteSeed, identity.gender)
      : vd.textureKey;

    // Sprite: origin at the feet
    this.sprite = scene.add.sprite(0, 0, textureKey, 0);
```

Add the import: `import { AppearanceResolver } from './AppearanceResolver.js';`

**Known geometry caveat (do not "fix" here):** `spriteH` and `spriteW` are derived from `vd` — the *fallback* variant — not from the resolved `textureKey`. When `identity` is supplied and the resolver returns a baked sheet with a different frame size, the shadow and the name-label offset are computed against the wrong geometry. This snippet deliberately preserves current behaviour verbatim; making geometry follow the resolved texture is a later task.

- [ ] **Step 6: Run tests, typecheck, build**

Run: `npm test && npm run typecheck && npm run build`
Expected: 7 new tests PASS; typecheck clean; build succeeds.

- [ ] **Step 7: Commit**

```bash
git add packages/client/src/game/agents/AppearanceResolver.ts packages/client/src/game/agents/AgentSprite.ts packages/client/src/game/scenes/PreloaderScene.ts scripts/agent-bake.mjs test/appearance-resolver.test.ts
git commit -m "feat(appearance): AppearanceResolver with human-only fallback (I-13) and baked-sheet loading"
```

---

## Task 38: Palette separation check

Colour is an identity signal here (spec §10.2), so the palettes must stay distinguishable **under the night tint** — `DAY_TINT_KEYS` reaches `alpha: 0.45` over `#0a0a2e` — and for colour-vision deficiency. Name labels remain the authoritative identifier; colour is an aid, never the only channel. This task makes that an assertion rather than an intention.

**Files:**
- Create: `test/palette-separation.test.mjs`
- Modify: `packages/shared/src/appearance/derive.mjs` if any pair fails

**Interfaces:**
- Consumes: the palettes from Task 26.
- Produces: a test asserting minimum perceptual distance within each palette, in daylight, under the night tint, and under simulated deuteranopia.

- [ ] **Step 1: Write the failing test**

`test/palette-separation.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS,
} from '../packages/shared/src/appearance/derive.mjs';

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/** sRGB -> CIE Lab, so distance means something perceptually. */
function lab([r, g, b]) {
  const f = v => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g2 = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * g2(Y) - 16, 500 * (g2(X) - g2(Y)), 200 * (g2(Y) - g2(Z))];
}
const dE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

/** The night overlay: #0a0a2e at alpha 0.45 (DAY_TINT_KEYS). */
const night = ([r, g, b]) => [r, g, b].map((c, i) =>
  Math.round(c * 0.55 + [0x0a, 0x0a, 0x2e][i] * 0.45));

/** Deuteranopia (Brettel-style approximation) — the most common CVD. */
const deuter = ([r, g, b]) => [
  Math.round(0.625 * r + 0.375 * g),
  Math.round(0.700 * r + 0.300 * g),
  Math.round(0.300 * g + 0.700 * b),
];

// Eyes are deliberately absent: EYE_VARIANTS is a sheet-selection axis
// (each Eyes_NN.png sheet is its own colour) — there is no hex palette to
// separate, so the separation tests do not include eyes.
const PALETTES = { SKIN_TONES, HAIR_COLORS, OUTFIT_COLORS };

function worstPair(list, transform) {
  let worst = Infinity, pair = null;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const d = dE(transform(rgb(list[i])), transform(rgb(list[j])));
      if (d < worst) { worst = d; pair = [list[i], list[j]]; }
    }
  return { worst, pair };
}

test('every palette is perceptually separated in daylight', () => {
  for (const [name, list] of Object.entries(PALETTES)) {
    const { worst, pair } = worstPair(list, x => x);
    assert.ok(worst >= 12, `${name}: ${pair?.join(' vs ')} are only dE ${worst.toFixed(1)} apart`);
  }
});

test('every palette survives the night tint (alpha 0.45)', () => {
  for (const [name, list] of Object.entries(PALETTES)) {
    const { worst, pair } = worstPair(list, night);
    assert.ok(worst >= 7, `${name} at night: ${pair?.join(' vs ')} are only dE ${worst.toFixed(1)} apart`);
  }
});

test('every palette survives deuteranopia', () => {
  for (const [name, list] of Object.entries(PALETTES)) {
    const { worst, pair } = worstPair(list, deuter);
    assert.ok(worst >= 6, `${name} under CVD: ${pair?.join(' vs ')} are only dE ${worst.toFixed(1)} apart`);
  }
});

test('palettes are not evenly spaced in hue — separation is perceptual', () => {
  const hue = ([r, g, b]) => {
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    if (mx === mn) return 0;
    const d = mx - mn;
    const h = mx === r ? (g - b) / d % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return ((h * 60) + 360) % 360;
  };
  const hues = OUTFIT_COLORS.map(c => hue(rgb(c))).sort((a, b) => a - b);
  const gaps = hues.slice(1).map((h, i) => h - hues[i]);
  const spread = Math.max(...gaps) - Math.min(...gaps);
  assert.ok(spread > 20, 'hues look mechanically even-spaced rather than perceptually chosen');
});
```

- [ ] **Step 2: Run to see where the palettes stand**

Run: `npm test -- --test-name-pattern="perceptually separated"`
Expected: either PASS, or a failure naming the offending pair and its ΔE.

- [ ] **Step 3: Fix any failing pair**

If a test fails, adjust that one colour in `derive.mjs` and re-run. Do **not** loosen the threshold — the threshold is the requirement. Palette lengths must stay `6/10/8` (skin/hair/outfit) plus `12` hair styles, `7` eye variants and `5` accessories, because Task 26 asserts `appearanceSpaceSize() === 3*6*7*12*10*8*5`.

Likely candidate from the Task 26 values: `HAIR_COLORS` `#8c8c8c` vs `#f2f2f2` under the night tint. (The old worst offenders — the three near-identical dark blue-grey `BOTTOM_COLORS` — are gone with the top/bottom → outfit merge.)

- [ ] **Step 4: Re-run everything**

Run: `npm test`
Expected: all four palette tests PASS, and Task 26's `appearanceSpaceSize` and distribution tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/appearance/derive.mjs test/palette-separation.test.mjs
git commit -m "test(appearance): assert palette separation in daylight, under night tint and under CVD"
```
