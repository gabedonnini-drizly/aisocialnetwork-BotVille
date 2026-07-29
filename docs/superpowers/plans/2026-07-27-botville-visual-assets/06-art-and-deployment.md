# BotVille Visual Assets — Plan 6: Art and deployment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Plan 6 of 6.** Index and sequencing: [`00-INDEX.md`](00-INDEX.md). Spec: `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md` (commit `d695881`) — approved, do not re-brainstorm.

**Goal:** Land the real pixels, prove the new pipeline reproduces the old one, and make the bake part of the deployments BotVille actually has.

**Architecture:** Task 3 is the one owner-gated task in the whole build: it needs four purchased packs and produces the golden baseline plus the answers to U-1 and U-2. Task 20 is a tiered gate — byte-exact pixels, byte-exact tile layers, semantic object comparison, and coverage (not equality) for derived collision — with every intentional difference declared as data. Task 35 wires the world bake into `vercel.json` and `deploy:client` and adds Docker for local parity. Task 39 re-renders the hero artifacts.

**Tech Stack:** Node ≥24 (ESM), TypeScript 5.7, Phaser 3.88, Vite 6, npm workspaces + Turbo, `node:test` (no new test dependency), the existing `scripts/png-lib.mjs` PNG codec, Postgres (`aisocialnetwork-api` only), Docker Compose.

**Depends on:** Plans 1–5. Task 3 additionally needs the licensed packs on disk; Tasks 20 and 39 need Task 3.

**Exit criterion:** The golden gate is green with art present. A Vercel Git build produces a complete, art-free city. The Railway server build is unchanged and healthy. The hero images show the real world.

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

- **Task 3** — Acquire the packs, capture the golden baseline, resolve U-1 and U-2
- **Task 20** — The golden gate
- **Task 35** — Deployment — bake in the real pipelines, Docker for parity
- **Task 39** — Hero re-render

---

## Task 3: Acquire the packs, capture the golden baseline, resolve U-1 and U-2

**OWNER-GATED — and the only task in this plan that is.** It needs four purchased LimeZu packs on disk. It produces the byte-level baseline Task 20 asserts the rewritten pipeline reproduces, and it answers the two unverified questions recorded against Task 27.

**This task runs at any point in the sequence.** It drives the *frozen legacy pipeline* — `test/golden/legacy/build-{district,interiors}.mjs`, preserved by Task 19 — so it does not care whether Plan 2 has already replaced those scripts. If you are running Plan 6 in order, they are frozen; if you somehow have art before Plan 2, they are still in `scripts/`. `scripts/capture-golden-baseline.mjs` finds whichever exists.

**Files:**
- Create: `assets-src/` (gitignored, populated by hand)
- Create: `scripts/capture-golden-baseline.mjs`
- Create: `test/golden/baseline.json`, `test/golden/tmj/*.tmj`
- Create: `sources/limezu.sheets.json` (pack inventory, committed)
- Modify: `sources/limezu.decisions.json` — fill in every `pin`, and any crop the review changes
- Create: `docs/ASSETS.md`
- Modify: `README.md:82-99`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `scripts/capture-golden-baseline.mjs` — `npm run golden:capture`, idempotent, prints a summary and refuses to write a partial baseline.
  - `test/golden/baseline.json` — `{ generatedAt, node, pack, images: { "<path under public/assets>": "<sha256>" } }`. Task 20 reads it.
  - `test/golden/tmj/<venue>.tmj` — the legacy maps, captured in the same run so Task 20 never has to reconstruct them from git history.
  - `docs/ASSETS.md` — records the U-1 answer, which Task 27's `capabilities.characterLayers` flag encodes.
  - a **fully pinned** `sources/limezu.decisions.json`: every crop verified against real pixels, so a future pack update fails `validate:contract` by name instead of silently changing the art.

- [ ] **Step 1: Buy and unpack the four 16×16 packs**

`scripts/sync-assets.mjs` reads four trees. The README lists only two of them — that is the bug corrected in Step 9.

| `assets-src/` subtree | Pack |
|---|---|
| `exteriors/` | [Modern Exteriors](https://limezu.itch.io/modernexteriors) 16×16 |
| `interiors/` | [Modern Interiors](https://limezu.itch.io/moderninteriors) 16×16 |
| `farm/16x16/` | [Modern Farm](https://limezu.itch.io/modernfarm) 16×16 |
| `office/` | [Modern Office](https://limezu.itch.io/modernoffice) 16×16 |

Unpack each keeping its own folder layout. `assets-src/` is already gitignored (`.gitignore:21`).

- [ ] **Step 2: Write the capture script**

`scripts/capture-golden-baseline.mjs`. A committed script rather than an inline
`node -e` blob: Task 20 re-runs it, `UPDATE_GOLDEN=1` re-records with it, and a
reviewer can read what it hashes.

```js
#!/usr/bin/env node
/**
 * Records what the LEGACY pipeline produces, so the data-driven bake can be
 * proven byte-identical to it (Task 20).
 *
 * Runs whichever copy of the old scripts exists: scripts/ before Plan 2 has
 * retired them, test/golden/legacy/ after. That is what lets this task run at
 * any point in the sequence, whenever the art lands.
 *
 *   node scripts/capture-golden-baseline.mjs
 *
 * Refuses to write a partial baseline: if the legacy scripts are missing, or
 * assets-src/ is absent, or fewer images turn up than there are contract
 * names, it exits non-zero and writes nothing.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from './lib/assetContract.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const PUB = join(ROOT, 'packages', 'client', 'public', 'assets');
const GOLDEN = join(ROOT, 'test', 'golden');

/** Legacy script locations, in the order we look for them. */
const legacy = name => [
  join(ROOT, 'test', 'golden', 'legacy', `build-${name}.mjs`),
  join(ROOT, 'scripts', `build-${name}.mjs`),
].find(existsSync);

const district = legacy('district');
const interiors = legacy('interiors');
if (!district || !interiors) {
  console.error('error: neither test/golden/legacy/ nor scripts/ has the legacy build scripts');
  process.exit(1);
}
if (!existsSync(join(ROOT, 'assets-src'))) {
  console.error('error: assets-src/ is absent — this task needs the licensed packs (Step 1)');
  process.exit(1);
}

const run = f => execFileSync(process.execPath, [f], { cwd: ROOT, stdio: 'inherit' });
run(join(ROOT, 'scripts', 'sync-assets.mjs'));
run(district);
run(interiors);

const images = {};
(function walk(d) {
  for (const e of readdirSync(d).sort()) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.png')) images[relative(PUB, p).split('\\').join('/')] =
      createHash('sha256').update(readFileSync(p)).digest('hex');
  }
})(PUB);

// The bake must produce one image per contract name, plus the two atlases.
const contract = loadContract();
const expected = Object.values(contract.props).reduce((n, g) => n + Object.keys(g).length, 0)
  + Object.keys(contract.groundAtlases).length;
const generated = Object.keys(images).filter(p => /^(tilesets|sprites)\/limezu\//.test(p)).length;
if (generated < expected) {
  console.error(`error: captured ${generated} generated images, expected at least ${expected} — refusing to write a partial baseline`);
  process.exit(1);
}

mkdirSync(join(GOLDEN, 'tmj'), { recursive: true });
for (const f of readdirSync(join(PUB, 'tilemaps')).filter(f => f.endsWith('.tmj'))) {
  cpSync(join(PUB, 'tilemaps', f), join(GOLDEN, 'tmj', f));
}

writeFileSync(join(GOLDEN, 'baseline.json'), JSON.stringify({
  // No timestamp: the baseline must be byte-stable so re-capturing a clean
  // tree produces no diff, and any diff is a real one.
  node: process.version.replace(/\.\d+$/, '.x'),
  pack: 'limezu',
  images: Object.fromEntries(Object.keys(images).sort().map(k => [k, images[k]])),
}, null, 2) + '\n');

console.log(`golden baseline: ${Object.keys(images).length} images (${generated} generated), ${readdirSync(join(GOLDEN, 'tmj')).length} tilemaps`);
```

Add to root `package.json` `"scripts"`:

```json
    "golden:capture": "node scripts/capture-golden-baseline.mjs",
```

- [ ] **Step 3: Capture the baseline and look at the result**

```bash
npm run golden:capture
npm run dev
```

Expected: `sync-assets: скопировано 110/110` with no `ОТСУТСТВУЮТ` block; `district.tmj: 48x46, атлас 23 тайлов, объектов: N`; four interior lines; then `golden baseline: <n> images (<m> generated), 5 tilemaps`. The client at http://localhost:5173 renders the district with buildings, trees, lamps and agents — no missing-texture placeholders.

If `sync-assets.mjs` reports missing files, its path does not match your unpack layout. Fix the path in `scripts/sync-assets.mjs` (that is what the explicit list is for) and record the correction in `docs/ASSETS.md`.

- [ ] **Step 4: Index the packs**

This is the first time anything has enumerated what is actually in them.

```bash
npm run pack:index limezu assets-src
git diff --stat sources/limezu.sheets.json
```

Expected: `pack index: <n> sheets, <m> candidate cells`. The sheets manifest is
committed; the per-cell index is gitignored.

**If `sources/limezu.sheets.json` already exists and the diff is non-empty, stop
and read it.** A changed hash means a sheet you unpacked differs from the one
the current crops were chosen against — either you have a newer pack version, or
a different pack edition (16×16 vs 32×32). Step 5 will tell you exactly which
sprites are affected.

- [ ] **Step 5: Pin every crop, and find out what the packs changed under us**

The ninety rects in `sources/limezu.decisions.json` were transcribed from build
scripts written months ago. Whether they still point at the sprites they were
chosen for has never been checkable. Now it is:

```bash
npm run adapt:pin limezu assets-src
```

Expected on a first run: `pinned 90 crop(s); 0 still unpinned`. Every decision
now carries a hash of the pixels it resolves to, and `npm run validate:contract`
will fail by name if a future pack update moves any of them.

If it exits non-zero with `crop(s) no longer match their pin`, the pack has
changed under a crop that was already pinned. Do not clear the pins to make it
pass — that is the check working. Go to Step 6, look at the sprite, and decide.

- [ ] **Step 6: Review the contact sheets**

```bash
npm run contact limezu assets-src
open contact/district.html contact/interior.html
```

This is the review that has never been possible before: every chosen sprite,
1× on the floor tile it will sit on, 2× so you can see the crop edges, and
night-tinted so you can see what survives `DAY_TINT_KEYS` at alpha 0.45.

Go through both sheets once and look for four things:

1. **A crop with a neighbour's pixels in it** — visible at 2× as a stray line
   along an edge. That is a wrong `w`/`h`, and it is the R-5 failure mode the
   golden gate cannot catch, because the old scripts had the same wrong crop.
2. **A sprite that vanishes at night.** Dark props on dark ground stop existing
   under the tint. Spec §10.2 makes legibility a requirement, not a preference.
3. **A sprite that fights its floor** — the ТЗ-08 note on `armchair_grey_r`
   records exactly this ("read as a concrete slab on warm parquet"), and it was
   found by accident. Now it is findable on purpose.
4. **Anything hovering `[UNPINNED]`** after Step 5. There should be none.

For each sprite you change, edit its entry in `sources/limezu.decisions.json`:
new `chosen` rect, a `why` saying what was wrong with the old one, the old rect
moved into `alternatives`, and `reviewedBy` / `reviewedAt` filled in. Then:

```bash
npm run adapt limezu && npm run adapt:pin limezu assets-src && npm run contact limezu assets-src
```

**A changed crop invalidates the baseline captured in Step 3.** That is correct
and expected — you have deliberately improved the art, so the "reproduce the
legacy output exactly" claim no longer holds for that sprite. Record each one in
`docs/ASSETS.md` and add an entry to `expectedDifferences` in
`test/golden/baseline.json` (Task 20 Step 2) naming the sprite and the reason.
An undeclared difference is a bug; a declared one is a decision.

If you change nothing, that is a real result too: it means ninety transcribed
crops survived first contact with a proper review, and the record now says so.

- [ ] **Step 7: Resolve U-1 — separable character layers**

Inspect a premade character sheet and whatever the pack calls its character generator:

```bash
node scripts/inspect-assets.mjs assets-src/interiors/characters-premade/Premade_Character_01.png
node scripts/png-grid.mjs assets-src/interiors/characters-premade/Premade_Character_01.png 16 32
ls assets-src/interiors | grep -i -E 'generator|parts|layer|custom'
```

Answer exactly one of:
- **Layers available** — the pack ships separable 16×32 part sheets (bodies, hairstyles, clothes) that can be stacked. Task 27 composes.
- **No layers** — only premade full-character sheets. Task 27 palette-remaps. Variety drops to `bases × palettes`; nothing breaks (spec §7.3).

- [ ] **Step 8: Resolve U-2 — the licence text**

Read the licence file shipped inside each pack (`LICENSE`, `README`, or the itch.io purchase page terms). Record verbatim what it says about redistribution and about distributing derived/baked images. `README.md:83`'s "permits use but forbids redistribution" is an unsourced paraphrase — replace it with a quotation or correct it.

This decides Task 35's default: **private registry** if redistribution is forbidden, public registry if not. The design works either way.

- [ ] **Step 9: Write `docs/ASSETS.md` and fix the README**

Create `docs/ASSETS.md` — the file `assetManifest.ts:5` and both build scripts have always cited and which has never existed. It records: the four packs and their `assets-src/` layout; the U-1 answer from Step 7 with the command that produced it; the U-2 licence quotation from Step 8; any `sync-assets.mjs` path corrections from Step 3; and the note that crop coordinates were verified with `scripts/inspect-assets.mjs`, `png-grid.mjs`, `crop.mjs` and `tile-strip.mjs`.

In `README.md`, replace the numbered buy-list at lines 87-91 with all four packs, matching the table in Step 1, and drop "optional" from any pack `sync-assets.mjs` actually reads.

- [ ] **Step 10: Prove the legacy pipeline is deterministic**

The whole golden gate rests on the old scripts producing the same bytes twice.
Verify it rather than assuming it:

```bash
rm -rf packages/client/public/assets/tilesets packages/client/public/assets/sprites
npm run golden:capture
git diff --stat test/golden/
```

Expected: **no diff.** `baseline.json` carries no timestamp precisely so this
check is meaningful — a clean re-capture must be a no-op.

If anything drifts, the existing pipeline is not deterministic and Task 20's
gate is unachievable as specified. Stop and find the source (almost certainly
an object-id counter or a `Date.now()` in the old scripts) before continuing;
the gate can be scoped around it, but only deliberately.

- [ ] **Step 11: Commit**

```bash
git add scripts/capture-golden-baseline.mjs package.json test/golden/baseline.json test/golden/tmj/ \
        sources/limezu.sheets.json sources/limezu.decisions.json sources/limezu.json \
        docs/ASSETS.md README.md scripts/sync-assets.mjs
git commit -m "chore(assets): index and pin the packs, capture the golden baseline, resolve U-1/U-2"
```

---

## Task 20: The golden gate

**NEEDS THE ART PACKS (Task 3).** The spec's phase-3 exit criterion: the data-driven bake reproduces what the legacy pipeline produced, paths renamed, content unchanged. This is what catches an R-5 transcription error — a chair cropped two pixels off becomes a failed gate here rather than a screenshot nobody looks at.

### Why this is not one big checksum

The obvious gate — hash every output, compare to a recorded hash — is wrong here, and shipping it would produce a red build on day one for reasons that are not bugs. Three of this plan's deliberate improvements change the output:

| Change | Where | Byte-identical? |
|---|---|---|
| `limezu/` → `pack/` path segment | Task 18 | Yes — content unchanged, only the path |
| `targetScene` → `targetVenue` door property | Task 15 | **No** — a property name changed |
| Collision **derived** from footprints instead of hand-authored | Task 15 | **No, and deliberately so** |
| A doormat added at every interior doorway | Task 15 | **No** — one extra object per interior |

A gate that fails on all four teaches people to ignore it. A gate loosened until it passes proves nothing. So this one is **tiered**, and every expected difference is **declared as data** rather than absorbed into a weaker assertion:

1. **Pixels — byte-exact.** Ground atlases and prop PNGs are pure crops of the same source rectangles. There is no legitimate reason for a single byte to differ. `sha256`, no tolerance.
2. **Tile layers — byte-exact.** The `data` arrays for `ground` and `roads` are what `cityGrid` and the interior painter emit. A PRNG-order mistake in Task 16 shows up here as thousands of differing tiles.
3. **Object layers — semantic, order-insensitive.** Compare by `(name, x, y, width, height, type, properties)` with `id` dropped, as multisets. Tiled object ids are allocation order, not meaning, and asserting on them makes the gate brittle for no benefit.
4. **Collision — coverage, not equality.** Derived collision is *supposed* to differ. What must hold is that it does not open a hole: every legacy collision rectangle is still covered, and the derived total area has not ballooned. That is the actual invariant; rectangle-by-rectangle equality never was.

The declared-difference list is the important part. `EXPECTED_DIFFERENCES` is a committed constant naming each intentional change with the task that made it. Anything not on that list is a failure. Adding to it is a code review, not a test tweak.

### Re-recording

`UPDATE_GOLDEN=1 npm run test:bake` re-records the baseline. It prints the full diff first and refuses to run without `assets-src/` present. Re-recording is a deliberate act with a diff to review — never a way to make a red test green.

**Files:**
- Create: `test/bake/golden.test.mjs`
- Create: `test/helpers/tmjDiff.mjs`
- Modify: `test/golden/baseline.json` — add the `renames` and `expectedDifferences` blocks

**Interfaces:**
- Consumes: `test/golden/baseline.json` and `test/golden/tmj/` (Task 3), `worldBake()` (Task 18), the frozen scripts (Task 19).
- Produces:
  - `test/helpers/tmjDiff.mjs`: `normalizeObjects(layer) → object[]`, `diffObjectLayers(a, b) → {onlyInLegacy, onlyInBaked}`, `coversAll(legacyRects, bakedRects) → {uncovered: rect[], areaRatio: number}`
  - a suite that **skips with a reason** when `assets-src/` is absent and writes `test/golden/report.json` on failure.

- [ ] **Step 1: Write the diff helper**

`test/helpers/tmjDiff.mjs`:

```js
/**
 * Comparing Tiled object layers without asserting on things that carry no
 * meaning.
 *
 * Tiled `id` is allocation order. Two maps that describe the same world can
 * number their objects differently and be equally correct, so id is dropped
 * before comparison and layers are compared as MULTISETS, not sequences.
 */

/** A stable, id-free, order-independent key for one Tiled object. */
export function objectKey(o) {
  const props = (o.properties ?? [])
    .map(p => `${p.name}=${JSON.stringify(p.value)}`)
    .sort()
    .join(',');
  return JSON.stringify([
    o.name ?? '', o.type ?? '',
    Math.round(o.x ?? 0), Math.round(o.y ?? 0),
    Math.round(o.width ?? 0), Math.round(o.height ?? 0),
    o.point === true, props,
  ]);
}

export function normalizeObjects(layer) {
  return (layer?.objects ?? []).map(objectKey).sort();
}

/** Multiset difference in both directions. Empty both ways means identical. */
export function diffObjectLayers(legacy, baked) {
  const count = keys => keys.reduce((m, k) => m.set(k, (m.get(k) ?? 0) + 1), new Map());
  const a = count(normalizeObjects(legacy));
  const b = count(normalizeObjects(baked));
  const onlyInLegacy = [], onlyInBaked = [];
  for (const [k, n] of a) for (let i = 0; i < n - (b.get(k) ?? 0); i++) onlyInLegacy.push(JSON.parse(k));
  for (const [k, n] of b) for (let i = 0; i < n - (a.get(k) ?? 0); i++) onlyInBaked.push(JSON.parse(k));
  return { onlyInLegacy, onlyInBaked };
}

const rect = o => ({ x: o.x ?? 0, y: o.y ?? 0, w: o.width ?? 0, h: o.height ?? 0 });
const area = r => Math.max(0, r.w) * Math.max(0, r.h);

/**
 * Does the baked collision still block everything the legacy collision blocked?
 *
 * Sampled on a 4px lattice rather than solved exactly: at 16px tiles a 4px
 * probe cannot miss a blocking rectangle that mattered, and an exact
 * rectangle-union is a lot of machinery for a test. Deterministic — no
 * randomness, so a failure is reproducible.
 */
export function coversAll(legacyObjects, bakedObjects, step = 4) {
  const legacy = legacyObjects.map(rect);
  const baked = bakedObjects.map(rect);
  const inside = (r, x, y) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

  const uncovered = [];
  for (const r of legacy) {
    for (let y = r.y + step / 2; y < r.y + r.h; y += step) {
      for (let x = r.x + step / 2; x < r.x + r.w; x += step) {
        if (!baked.some(b => inside(b, x, y))) { uncovered.push({ ...r, at: [x, y] }); break; }
      }
      if (uncovered.at(-1)?.x === r.x && uncovered.at(-1)?.y === r.y) break;
    }
  }

  const sum = rs => rs.reduce((n, r) => n + area(r), 0);
  return { uncovered, areaRatio: sum(legacy) ? sum(baked) / sum(legacy) : 1 };
}
```

- [ ] **Step 2: Declare the expected differences**

Add to `test/golden/baseline.json`, as siblings of `images`:

```json
  "renames": {
    "tilesets/limezu/": "tilesets/pack/",
    "sprites/limezu/district/": "sprites/pack/district/",
    "sprites/limezu/interior/": "sprites/pack/interior/"
  },
  "expectedDifferences": [
    {
      "id": "door-property-rename",
      "task": 15,
      "layers": ["doors", "buildings"],
      "why": "targetScene -> targetVenue: doors point at venues, not Phaser scene classes",
      "rule": "property-renamed:targetScene:targetVenue"
    },
    {
      "id": "derived-collision",
      "task": 15,
      "layers": ["collision"],
      "why": "collision is derived from furniture footprints, so a moved prop cannot leave a stale box",
      "rule": "coverage-only"
    },
    {
      "id": "generated-doormat",
      "task": 15,
      "layers": ["furniture"],
      "why": "the doormat is placed by the baker at the doorway rather than authored per venue",
      "rule": "extra-objects-named:doormat"
    }
  ]
```

Anything the gate finds that no entry explains is a failure. Adding an entry is a reviewed decision with a stated reason and the task that caused it — which is the whole point of writing them down instead of relaxing an assertion.

- [ ] **Step 3: Write the gate**

`test/bake/golden.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldBake } from '../../scripts/world-bake.mjs';
import { diffObjectLayers, coversAll } from '../helpers/tmjDiff.mjs';
import { skipUnless } from '../helpers/skip.mjs';

const HAVE_ART = existsSync('assets-src');
const GATE = skipUnless(HAVE_ART, 'assets-src/ absent — run Task 3 to capture the baseline');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

const golden = JSON.parse(readFileSync('test/golden/baseline.json', 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const rename = p => Object.entries(golden.renames).reduce((s, [from, to]) => s.replace(from, to), p);
const isGenerated = p => /^(tilesets\/limezu\/|sprites\/limezu\/)/.test(p);

let baked = null;
function bakeOnce() {
  if (!baked) {
    const out = mkdtempSync(join(tmpdir(), 'golden-out-'));
    const gen = mkdtempSync(join(tmpdir(), 'golden-gen-'));
    worldBake({ pack: 'limezu', srcRoot: 'assets-src', outDir: out, generatedDir: gen });
    baked = out;
  }
  return baked;
}

const report = { images: [], layers: [], collision: [] };
function writeReport() {
  if (report.images.length || report.layers.length || report.collision.length) {
    writeFileSync('test/golden/report.json', JSON.stringify(report, null, 2) + '\n');
  }
}

// ── Tier 1: pixels are byte-exact ────────────────────────────────────────
test('every generated image is byte-identical to the legacy pipeline', GATE, () => {
  const out = bakeOnce();
  let compared = 0;

  for (const [rel, want] of Object.entries(golden.images)) {
    if (!isGenerated(rel)) continue;              // raw sync-assets copies are not bake outputs
    const p = join(out, rename(rel));
    if (!existsSync(p)) { report.images.push({ path: rel, status: 'missing' }); continue; }
    compared++;
    const got = sha(p);
    if (got !== want) report.images.push({ path: rel, status: 'drift', want, got });
  }

  assert.ok(compared > 0, 'compared no images — the rename map or the baseline is wrong');
  assert.equal(compared, Object.keys(golden.images).filter(isGenerated).length,
    'some baseline images were not produced by the bake');
  writeReport();
  assert.deepEqual(report.images, [],
    'pixels drifted — a rect in sources/limezu.json is wrong. See test/golden/report.json');
});

// ── Tier 2: tile layers are byte-exact ───────────────────────────────────
test('every tile layer reproduces exactly', GATE, () => {
  const out = bakeOnce();
  for (const id of legacyVenueIds()) {
    const now = readTmj(join(out, 'tilemaps', `${id}.tmj`));
    const was = readTmj(`test/golden/tmj/${id}.tmj`);
    assert.deepEqual(now.layers.map(l => l.name), was.layers.map(l => l.name), `${id}: layer set`);
    assert.deepEqual([now.width, now.height], [was.width, was.height], `${id}: size`);
    for (const l of now.layers.filter(l => l.type === 'tilelayer')) {
      const w = was.layers.find(x => x.name === l.name);
      assert.deepEqual(l.data, w.data,
        `${id}/${l.name}: tile data drifted — check the PRNG consumption order in cityGrid`);
    }
  }
});

// ── Tier 3: object layers differ only where we said they would ───────────
test('object layers differ only in declared ways', GATE, () => {
  const out = bakeOnce();
  const declared = new Map(golden.expectedDifferences.flatMap(d => d.layers.map(l => [l, d])));

  for (const id of legacyVenueIds()) {
    const now = readTmj(join(out, 'tilemaps', `${id}.tmj`));
    const was = readTmj(`test/golden/tmj/${id}.tmj`);

    for (const l of now.layers.filter(l => l.type === 'objectgroup')) {
      const w = was.layers.find(x => x.name === l.name);
      const rule = declared.get(l.name)?.rule;
      if (rule === 'coverage-only') continue;                    // handled by the next test

      const { onlyInLegacy, onlyInBaked } = diffObjectLayers(w, l);
      const explained = explain(rule, onlyInLegacy, onlyInBaked);
      if (explained.onlyInLegacy.length || explained.onlyInBaked.length) {
        report.layers.push({ venue: id, layer: l.name, rule: rule ?? null, ...explained });
      }
    }
  }
  writeReport();
  assert.deepEqual(report.layers, [],
    'undeclared object-layer differences. Either it is a bug, or add an entry to expectedDifferences with a reason. See test/golden/report.json');
});

// ── Tier 4: derived collision may differ, but must not open a hole ───────
test('derived collision covers everything the legacy collision blocked', GATE, () => {
  const out = bakeOnce();
  for (const id of legacyVenueIds()) {
    const now = readTmj(join(out, 'tilemaps', `${id}.tmj`));
    const was = readTmj(`test/golden/tmj/${id}.tmj`);
    const legacy = was.layers.find(l => l.name === 'collision')?.objects ?? [];
    const derived = now.layers.find(l => l.name === 'collision')?.objects ?? [];

    const { uncovered, areaRatio } = coversAll(legacy, derived);
    if (uncovered.length) report.collision.push({ venue: id, uncovered: uncovered.slice(0, 20) });

    // A derived box that swallows the room would "cover everything" and make
    // the venue unwalkable. Bound the total area as well as the coverage.
    assert.ok(areaRatio <= 1.6,
      `${id}: derived collision is ${areaRatio.toFixed(2)}x the legacy area — footprints are too generous`);
  }
  writeReport();
  assert.deepEqual(report.collision, [],
    'derived collision leaves a gap where the legacy map blocked movement. See test/golden/report.json');
});

// ── Re-recording, deliberately ───────────────────────────────────────────
test('UPDATE_GOLDEN re-records the baseline', skipUnless(HAVE_ART && UPDATE, 'set UPDATE_GOLDEN=1 to re-record'), () => {
  console.warn('\n!! Re-recording the golden baseline. Review the diff before committing:');
  console.warn('!!   git diff test/golden/\n');
  execFileSync(process.execPath, ['scripts/capture-golden-baseline.mjs'], { stdio: 'inherit' });
});
```

with these two small helpers at the top of the file:

```js
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const readTmj = p => JSON.parse(readFileSync(p, 'utf8'));

/** The venues the legacy pipeline knew about — read, not listed. */
const legacyVenueIds = () =>
  readdirSync('test/golden/tmj').filter(f => f.endsWith('.tmj')).map(f => f.replace('.tmj', '')).sort();

/**
 * Remove the differences an expectedDifferences rule says are legitimate.
 * Anything left is a real difference.
 */
function explain(rule, onlyInLegacy, onlyInBaked) {
  if (!rule) return { onlyInLegacy, onlyInBaked };

  const [kind, ...args] = rule.split(':');
  if (kind === 'extra-objects-named') {
    const [name] = args;
    return { onlyInLegacy, onlyInBaked: onlyInBaked.filter(o => o[0] !== name) };
  }
  if (kind === 'property-renamed') {
    // [name, type, x, y, w, h, point, props] — props is index 7
    const [from, to] = args;
    const swap = o => [...o.slice(0, 7), o[7].split(',').map(p => p.replace(`${from}=`, `${to}=`)).sort().join(',')];
    const l = onlyInLegacy.map(swap).map(o => JSON.stringify(o));
    const b = onlyInBaked.map(o => JSON.stringify(o));
    return {
      onlyInLegacy: l.filter(k => !b.includes(k)).map(JSON.parse),
      onlyInBaked: b.filter(k => !l.includes(k)).map(JSON.parse),
    };
  }
  return { onlyInLegacy, onlyInBaked };
}
```

- [ ] **Step 4: Run it without art, then with**

Run: `npm run test:bake`

Expected **without art**: four skips, and `test/helpers/skip.mjs` prints
`! 1 suite(s) skipped: assets-src/ absent — run Task 3 to capture the baseline`
at the end of the run. A skip you can see is a skip you can act on.

Expected **with art**: all four tiers PASS.

If Tier 1 fails with `drift`, read `test/golden/report.json` — it names the
image, and the fix is that name's rect in `sources/limezu.json`. Compare
against the frozen original:

```bash
grep -n -A3 "'<name>'" test/golden/legacy/build-interiors.mjs
```

If Tier 2 fails, the PRNG consumption order in `cityGrid` (Task 16) differs
from the original. The tile data diff will show it starting from the first
differing index.

If Tier 3 fails, decide honestly: a bug, or a change worth declaring. If it is
a change, add an `expectedDifferences` entry naming the task and the reason.

- [ ] **Step 5: Commit**

```bash
git add test/bake/golden.test.mjs test/helpers/tmjDiff.mjs test/golden/baseline.json
git commit -m "test(bake): tiered golden gate — exact pixels, exact tiles, semantic objects, collision coverage"
```

---

## Task 35: Deployment — bake in the real pipelines, Docker for parity

Spec §13 asks for containerisation (G-H). Taken literally that reads as "write a Dockerfile", and an earlier draft of this plan did exactly that: two Dockerfiles, nginx, and two compose files describing a deployment BotVille does not have.

**BotVille already deploys, and not with Docker.** Before writing anything, look at what is in the repo:

| Path | What it says |
|---|---|
| `railway.toml` | The **server** builds on Railway with Nixpacks from the repo root, `npx turbo build --filter=@botville/server`, starts `node packages/server/dist/index.js`, health-checks `/health` |
| `scripts/deploy-server.mjs` | That build runs from a **private mirror repo** (`botville-app`) populated by `git archive` of HEAD, with `docs/`, `.env` and the asset directories stripped by a safety gate |
| `vercel.json` | The **client** is a static Vite build — `npm run build --workspace=packages/client`, output `packages/client/dist`, SPA rewrite |
| `package.json` `deploy:client` | `sync-assets.mjs` → `vercel pull` → `vercel build --prod` → `vercel deploy --prebuilt --prod` |

So the deliverable is not a second deployment story. It is: **make the world bake part of the deployments that already exist**, and add Docker as a local-parity and self-host option that reuses the same commands.

### The licence fork falls out of the existing pipelines

The earlier draft invented `docker-compose.public.yml` to express "an image with art" versus "an image without art". That distinction already exists in the real setup, for free:

| Path | Has `assets-src/`? | Result |
|---|---|---|
| **Vercel Git build** (push to the repo) | No — it is gitignored and never uploaded | Bakes the **fixture pack**. A complete, renderable, publishable city with **zero licensed pixels** (I-12) |
| **`npm run deploy:client`** (local, `--prebuilt`) | Yes, on the owner's machine | Bakes the **real pack** and uploads the built output to the production deployment |
| **Railway server** | No, and does not need art | Serves no art at all |

That is the whole fork, and it is better than the invented one: the *public* path is art-free **by construction**, not by remembering to use a different compose file. Nothing has to be got right at deploy time.

The one thing that must be true for this to work is that a bake with no art produces a working city — which is exactly what the fixture pack (Task 8) is for. Plans 1–5 have been proving it on every commit.

### Where baked appearance sheets live

Spec §7.2 says baked artifacts belong on a mounted volume, not in the image, because they grow with the realized appearance space. That is right for a container. It is not available on Vercel, where the static output is immutable.

So the output location is a **deploy-target choice**, expressed as `--out`, and safe on all three because `AppearanceResolver` falls back to a default sheet when a sheet is missing (spec §8.3):

| Target | `--out` | Why |
|---|---|---|
| Vercel | `packages/client/public/assets/baked` (baked during `deploy:client`) | Static hosting; ~85 small PNGs for the current roster is nothing |
| Docker / self-host | a mounted volume | Grows with the roster; image stays fixed-size |
| Local dev | `packages/client/public/assets/baked` (gitignored) | Whatever is there is served |

A missing sheet is never an error, so a target that has not baked yet degrades to default sprites rather than breaking.

**Files:**
- Create: `Dockerfile.client`, `Dockerfile.server`, `docker-compose.yml`, `.dockerignore`
- Modify: `vercel.json` — bake before building
- Modify: `package.json` — `deploy:client` bakes with the real pack
- Modify: `scripts/deploy-server.mjs` — add the bake outputs to the safety gate
- Modify: `README.md`, `DEPLOY.md`
- Test: `test/deploy-config.test.mjs`

**Interfaces:**
- Consumes: `npm run bake:world`, `npm run bake:agents`, `npm run build`.
- Produces: a Vercel build that bakes the fixture pack; a `deploy:client` that bakes the real one; `docker compose up` serving the client on `:8080` and the server on `:3001`.

- [ ] **Step 1: Write the failing test**

`test/deploy-config.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const vercel = JSON.parse(readFileSync('vercel.json', 'utf8'));

// ── The real deploy paths ────────────────────────────────────────────────

test('the Vercel build bakes the world before building the client', () => {
  assert.match(vercel.buildCommand, /bake:world/,
    'a Vercel build without a bake ships a client with no maps');
  assert.ok(vercel.buildCommand.indexOf('bake:world') < vercel.buildCommand.indexOf('build'),
    'the bake has to run first — vite copies public/ at build time');
});

test('a Vercel Git build cannot contain licensed art (I-12)', () => {
  // assets-src/ is gitignored, so a Git-triggered build has no packs and the
  // bake falls back to the fixture. Belt and braces: the command must not
  // name the licensed pack.
  assert.equal(/limezu/.test(vercel.buildCommand), false,
    'the public build command names the licensed pack — a Git build must be art-free');
});

test('deploy:client bakes with the real pack before uploading prebuilt output', () => {
  const cmd = pkg.scripts['deploy:client'];
  assert.match(cmd, /bake:world/);
  assert.match(cmd, /limezu/, 'the owner-run deploy is the one that carries real art');
  assert.match(cmd, /--prebuilt/, 'prebuilt is what makes the local bake reach production');
});

test('the Railway server build is untouched by the art pipeline', () => {
  const railway = readFileSync('railway.toml', 'utf8');
  assert.match(railway, /turbo build --filter=@botville\/server/);
  assert.equal(/bake:world/.test(railway), false,
    'the server serves no art; baking in its build is wasted time and a licence risk');
});

test('the server deploy snapshot still strips every art directory (I-12)', () => {
  const src = readFileSync('scripts/deploy-server.mjs', 'utf8');
  for (const p of ['assets-src', 'baked'])
    assert.ok(src.includes(p), `deploy-server.mjs no longer strips ${p}`);
});

// ── Docker: parity, not a second deployment ──────────────────────────────

test('the container files exist', () => {
  for (const f of ['Dockerfile.client', 'Dockerfile.server', 'docker-compose.yml', '.dockerignore'])
    assert.ok(existsSync(f), f);
});

test('there is exactly one compose file — the pack is a build arg, not a fork', () => {
  assert.equal(existsSync('docker-compose.public.yml'), false,
    'a second compose file duplicates the deploy story; PACK/SRC_ROOT already express the fork');
});

test('compose declares the baked-artifact volume (spec §7.2)', () => {
  const c = readFileSync('docker-compose.yml', 'utf8');
  assert.match(c, /botville-baked/);
  assert.match(c, /assets\/baked/);
});

test('the future Postgres seam is declared but inactive (R-6)', () => {
  const c = readFileSync('docker-compose.yml', 'utf8');
  assert.match(c, /#\s*BOTVILLE_PLATFORM_DB_URL/);
  assert.equal(/^\s*BOTVILLE_PLATFORM_DB_URL\s*[:=]/m.test(c), false,
    'the DB connection must stay commented out');
});

test('.dockerignore excludes the licensed art from every build context (I-12)', () => {
  const d = readFileSync('.dockerignore', 'utf8');
  for (const p of ['assets-src', 'node_modules', 'packages/client/public/assets/baked'])
    assert.ok(d.includes(p), `missing ${p}`);
});

test('the images pin the same Node major as the rest of the repo', () => {
  const engines = pkg.engines.node.replace(/[^\d]/g, '').slice(0, 2);
  for (const f of ['Dockerfile.client', 'Dockerfile.server'])
    assert.match(readFileSync(f, 'utf8'), new RegExp(`FROM node:${engines}`), f);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the Vercel build bakes"`
Expected: FAIL — `vercel.json` `buildCommand` has no bake step.

- [ ] **Step 3: Bake in the Vercel build**

`vercel.json`:

```json
{
  "buildCommand": "npm run bake:world && npm run build --workspace=packages/client",
  "outputDirectory": "packages/client/dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

No pack argument: `bake:world` defaults to `fixture`, and a Git-triggered build has no `assets-src/` anyway. A push to the repo therefore produces a **complete, renderable, art-free** deployment. That is the publishable artifact I-12 asks for, and it needs no special care to keep that way.

The bake must precede the build because Vite copies `public/` during `vite build`; a bake afterwards writes files nothing will ever serve.

- [ ] **Step 4: Bake the real pack in the owner's deploy**

Root `package.json`:

```json
    "deploy:client": "node scripts/sync-assets.mjs && npm run bake:world -- limezu assets-src && npm run bake:agents -- --pack limezu --src assets-src && vercel pull --yes --environment=production && vercel build --prod && vercel deploy --prebuilt --prod",
```

`--prebuilt` uploads locally-built output, so this is the path where real pixels reach production — deliberately, from a machine that holds the licence. It fails loudly without `assets-src/` because `sync-assets.mjs` already does.

- [ ] **Step 5: Keep the server deploy art-free**

`railway.toml` needs no change: the server serves no art, and adding a bake to its build would put licensed pixels in the mirror repo for nothing.

Confirm `scripts/deploy-server.mjs`'s safety gate covers the new outputs. It already strips `assets-src/` and the asset directories; add `packages/client/public/assets/baked` to the same list if it is not covered by an existing prefix rule, and add a line to its forbidden-path check so a future baked artifact cannot ride along into the public-ish mirror.

Run: `node scripts/deploy-server.mjs --dry-run`
Expected: the preview lists no `assets`, `assets-src` or `baked` path.

- [ ] **Step 6: Write `.dockerignore`**

```
node_modules
**/node_modules
**/dist
.turbo
**/.turbo
.git
assets-src
test/fixtures/pack-src
packages/client/public/assets/tilesets/pack
packages/client/public/assets/sprites/pack
packages/client/public/assets/baked
*.db
*.db-shm
*.db-wal
.env
.env.*
```

- [ ] **Step 7: Write `Dockerfile.client`**

```dockerfile
# BotVille client — local parity and self-hosting.
#
# This is NOT how BotVille deploys. Production is Vercel (see vercel.json);
# this image exists so the same bake can be reproduced on a machine that has
# nothing but Docker, and so a self-hoster has a supported path.
#
# The default PACK is `fixture`: no licensed pixel enters the image unless
# someone deliberately passes PACK=limezu with assets-src in the build
# context. Keep it that way before pushing anywhere public (I-12).
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/client/package.json packages/client/
COPY packages/server/package.json packages/server/
RUN npm ci

COPY . .

ARG PACK=fixture
ARG SRC_ROOT=test/fixtures/pack-src
RUN if [ "$PACK" = "fixture" ]; then npm run fixture; fi \
 && node scripts/world-bake.mjs "$PACK" "$SRC_ROOT" \
 && npm run build --workspace=packages/client

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/packages/client/dist /usr/share/nginx/html
# Baked appearance sheets arrive on a volume, not in the image: they grow with
# the realized appearance space while the image stays fixed-size (spec §7.2).
VOLUME ["/usr/share/nginx/html/assets/baked"]
EXPOSE 80
```

- [ ] **Step 8: Write `Dockerfile.server`**

```dockerfile
# BotVille server — local parity only. Production is Railway/Nixpacks
# (railway.toml), which builds from the repo root with turbo. This image
# reproduces that build so `docker compose up` gives a working pair.
#
# SQLite stays. Replacing it is integration work and out of scope (spec §13).
FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/client/package.json packages/client/
RUN npm ci

COPY packages/shared packages/shared
COPY packages/server packages/server
# The same filter Railway uses, so a green container is evidence about production.
RUN npx turbo build --filter=@botville/server

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/packages/shared/dist packages/shared/dist
COPY --from=build /app/packages/shared/package.json packages/shared/
COPY --from=build /app/packages/server/dist packages/server/dist
COPY --from=build /app/packages/server/package.json packages/server/
VOLUME ["/app/data"]
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "packages/server/dist/index.js"]
```

The healthcheck hits the same `/health` endpoint `railway.toml` does — one definition of "up", not two.

- [ ] **Step 9: Write `nginx.conf`**

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  # Pixel art must never be re-encoded or transformed in transit.
  location /assets/ {
    add_header Cache-Control "public, max-age=3600";
    try_files $uri =404;
  }

  # A baked sheet that is not there yet is not an error — AppearanceResolver
  # falls back to a default sheet (spec §8.3). Keep 404s cheap and quiet.
  location /assets/baked/ {
    add_header Cache-Control "public, max-age=86400, immutable";
    access_log off;
    try_files $uri =404;
  }

  # SPA fallback, matching vercel.json's rewrite so both hosts behave alike.
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 10: Write `docker-compose.yml`**

One file. The art fork is `PACK` / `SRC_ROOT`, the same two knobs the Dockerfile takes — a second compose file would be a second description of the same decision, and the two would drift.

```yaml
# BotVille — local parity and self-hosting.
#
# Production is Vercel (client) + Railway (server); see DEPLOY.md. This file
# is for running the pair locally and for self-hosters.
#
# ART: PACK defaults to `fixture`, so `docker compose build` with no
# environment produces images containing no licensed pixel (I-12). Set
# BOTVILLE_PACK=limezu and BOTVILLE_SRC_ROOT=assets-src to build with the real
# art — and then treat the images as private.

services:
  client:
    build:
      context: .
      dockerfile: Dockerfile.client
      args:
        PACK: ${BOTVILLE_PACK:-fixture}
        SRC_ROOT: ${BOTVILLE_SRC_ROOT:-test/fixtures/pack-src}
    ports:
      - "8080:80"
    volumes:
      - botville-baked:/usr/share/nginx/html/assets/baked:ro
    depends_on:
      - server

  server:
    build:
      context: .
      dockerfile: Dockerfile.server
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      PORT: 3001
    env_file:
      - packages/server/.env
    volumes:
      - botville-data:/app/data

  # Batch agent bake. Runs to completion and exits; safe to re-run, and safe
  # to run concurrently with the event path (I-6). Writes to the SAME volume
  # the client serves read-only.
  agent-bake:
    build:
      context: .
      dockerfile: Dockerfile.client
      target: build
    profiles: ["bake"]
    command: >
      node scripts/agent-bake.mjs
      --pack ${BOTVILLE_PACK:-fixture}
      --src ${BOTVILLE_SRC_ROOT:-test/fixtures/pack-src}
      --roster /roster/roster.json
      --out /baked
    volumes:
      - botville-baked:/baked
      - ./roster:/roster:ro

  # ── FUTURE INTEGRATION SEAM (spec R-6) ────────────────────────────────
  # BotVille's server has no Postgres client and reading the platform DB is
  # UNBUILT and out of scope. This stanza marks where that connection will
  # attach, so the seam is visible rather than discovered later.
  #
  #   BOTVILLE_PLATFORM_DB_URL: postgres://user:pass@host:5432/ai_social_network
  #
  # Until it exists, packages/server/src/world/agentLife.ts still owns the
  # world and the client polls GET /api/agents/locations.

volumes:
  botville-baked:
  botville-data:
```

- [ ] **Step 11: Verify all three paths**

Docker:

```bash
mkdir -p roster && echo '[{"spriteSeed":"aisha_khan","gender":"female"},{"spriteSeed":"the_skeptic","gender":"male"}]' > roster/roster.json
docker compose build
docker compose --profile bake run --rm agent-bake
docker compose up -d
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:8080/
curl -sS http://localhost:3001/health
curl -sS http://localhost:8080/assets/venues.json | head -5
```

Expected: `200`, a healthy server, the venues array, and http://localhost:8080 rendering the city with the fixture pack.

Then confirm I-12 on the image itself:

```bash
docker run --rm --entrypoint sh botville-client -c 'ls /usr/share/nginx/html/assets/sprites/pack | head'
```

Expected: fixture-derived props. With the default `PACK`, no licensed pixel is present.

Vercel, the art-free path — simulate what a Git build does:

```bash
git stash -u                      # make the tree look like a fresh clone
npm ci && npx vercel build
ls .vercel/output/static/assets/tilemaps
git stash pop
```

Expected: the build succeeds with no `assets-src/`, and the tilemaps are there. **This is the check that matters most in this task** — it proves a public deploy renders a city without shipping a licensed pixel.

Railway, the server path:

```bash
npm install --include=dev && npx turbo build --filter=@botville/server
node packages/server/dist/index.js &
curl -sS localhost:3001/health && kill %1
```

Expected: the exact `railway.toml` build command succeeds locally and the health endpoint answers.

- [ ] **Step 12: Document and commit**

Rewrite `DEPLOY.md`'s **Art** paragraph, which currently says a clean checkout "renders missing-texture placeholders". That stopped being true in Plan 1:

```markdown
**Art.** A build with no licensed packs is no longer broken — it bakes the
synthetic fixture pack and renders a complete city in flat colours. That is
what a Vercel Git build produces, and it is deliberately art-free (I-12).

To deploy the real art, run `npm run deploy:client` from a machine that has
`assets-src/`: it bakes with the licensed pack and uploads the built output
with `vercel deploy --prebuilt`. The packs never enter the repo or a Git build.
```

Add a `Docker` section to `README.md` covering the single compose file, the `BOTVILLE_PACK` knob, and the `roster/roster.json` shape — framed as local parity, not as the deployment.

```bash
git add Dockerfile.client Dockerfile.server docker-compose.yml nginx.conf .dockerignore vercel.json package.json scripts/deploy-server.mjs README.md DEPLOY.md test/deploy-config.test.mjs roster/.gitkeep
git commit -m "feat(deploy): bake the world in the Vercel and deploy:client pipelines; Docker for local parity"
```

---

## Task 39: Hero re-render

**Needs the art packs.** `packages/client/public/hero/district-night.{png,gif,mp4,webm}` are pre-rendered artifacts from when someone had the packs — currently the only visual evidence BotVille exists. Re-render them from the new pipeline so the product documents show the real thing.

**Files:**
- Modify: `packages/client/public/hero/district-night.{png,gif,mp4,webm}`
- Modify: `scripts/record-hero.mjs` if its selectors moved
- Test: `test/hero-assets.test.mjs`

**Interfaces:**
- Consumes: the full pipeline, Tasks 3–38.
- Produces: refreshed hero artifacts and a test asserting they exist and are non-trivial.

- [ ] **Step 1: Write the failing test**

`test/hero-assets.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, statSync } from 'node:fs';

const HERO = 'packages/client/public/hero';

test('every hero artifact exists and is non-trivial', () => {
  for (const f of ['district-night.png', 'district-night.gif', 'district-night.mp4', 'district-night.webm']) {
    const p = `${HERO}/${f}`;
    assert.ok(existsSync(p), p);
    assert.ok(statSync(p).size > 10_000, `${f} is only ${statSync(p).size} bytes`);
  }
});

test('the still is a PNG', async () => {
  const { readFileSync } = await import('node:fs');
  assert.equal(readFileSync(`${HERO}/district-night.png`).subarray(1, 4).toString('ascii'), 'PNG');
});
```

- [ ] **Step 2: Run to establish the current state**

Run: `npm test -- --test-name-pattern="every hero artifact exists"`
Expected: PASS against the existing pre-rendered files. This test is a regression guard — it must keep passing after the re-render.

- [ ] **Step 3: Read the recorder and check its assumptions**

Run: `cat scripts/record-hero.mjs`

Confirm what it drives: which URL, which scene, which game hour, which zoom. Two things changed under this plan and may need updating:
- `CAMERA.initialZoom` is now `2`, not `1.8` (Task 36).
- Scene keys for interiors are now `VenueScene:<id>`, not `CafeScene` etc. (Task 21).

If the recorder references either, update it. Do not change its framing or duration — the product documents already use this composition.

- [ ] **Step 4: Bake with the real pack and record**

```bash
node scripts/sync-assets.mjs
npm run bake:world -- limezu assets-src
npm run bake:agents -- --pack limezu --src assets-src --roster roster/roster.json
npm run build
node scripts/record-hero.mjs
```

Expected: the recorder writes all four files. Open `district-night.png` and confirm: real LimeZu art, lit windows and street lamps under the night tint, sharp pixel edges at zoom 2 (no shimmer — that is Task 36 visible), and agents with distinct appearances rather than sixteen repeats.

- [ ] **Step 5: Verify**

Run: `npm test`
Expected: all tests PASS, including the hero test and the Task 20 golden gate.

- [ ] **Step 6: Commit**

```bash
git add packages/client/public/hero/ scripts/record-hero.mjs test/hero-assets.test.mjs
git commit -m "chore(hero): re-render the district hero from the data-driven pipeline"
```
