# BotVille Visual Assets — Plan 6: Art and deployment

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Plan 6 of 6.** Index and sequencing: [`00-INDEX.md`](00-INDEX.md). Spec: `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md` (commit `d695881`) — approved, do not re-brainstorm.

**Goal:** Land the real pixels, prove the new pipeline reproduces the old one, and make the bake part of the deployments BotVille actually has.

**Architecture:** Task 3 is the one owner-gated task in the whole build: it needs four purchased packs and produces the golden baseline plus the answers to U-1 and U-2. Task 20 is a two-tier gate — byte-exact pixels and byte-exact tile layers; object placement is asserted against the descriptors by Plan 2's tests, and collision gets a one-time human diff. Task 35 wires the world bake into `vercel.json` and `deploy:client` and adds Docker for local parity. Task 39 re-renders the hero artifacts.

**Tech Stack:** Node ≥24 (ESM), TypeScript 5.7, Phaser ^3.88.2 declared / 3.90.0 installed, Vite 6, npm workspaces + Turbo, `node:test` (no new test dependency), the existing `scripts/png-lib.mjs` PNG codec, Postgres (`aisocialnetwork-api` only), Docker Compose (local parity only — created by Plan 6 Task 35; no Docker artifact exists in the repo today).

**Depends on:** Plans 1–5. Task 3 additionally needs the licensed packs on disk; Tasks 20 and 39 need Task 3.

**Exit criterion:** The golden gate is green with art present. A Vercel Git build produces a complete, art-free city. The Railway server build is unchanged and healthy. The hero images show the real world.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Node ≥ 24.** Root `package.json` `engines: { "node": ">=24.0.0" }`, `.nvmrc` = `24`. ESM: the three workspace packages (`client`, `server`, `shared`) each declare `"type": "module"`; the root `package.json` has **no** `type` key, so root-level scripts are ESM by their `.mjs` extension only.
- **No new npm dependencies.** Not in `packages/client`, not in `packages/server`, not at the root. Build tooling uses `node:` builtins plus the existing `scripts/png-lib.mjs`. Tests use `node:test` + `node:assert/strict`.
- **Build tooling is `.mjs` under `scripts/`; runtime is TypeScript under `packages/`.** Follow the existing split exactly.
- **Comments in `packages/client/` are English and load-bearing** — they record verified crop coordinates and frame layouts. Read them; preserve them and their intent; never delete or "clean up" an explanatory comment.
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

- **Task 3** — Acquire the packs, capture the golden baseline, resolve U-1 and U-2
- **Task 3b** — Delete the QA symlink compatibility layer (must follow Task 3)
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
- Modify: `sources/limezu.json` — fill in every `pin`, and any crop the review changes
- Create: `docs/ASSETS.md`
- Modify: `README.md:82-99`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `scripts/capture-golden-baseline.mjs` — `npm run golden:capture`, idempotent, prints a summary and refuses to write a partial baseline.
  - `test/golden/baseline.json` — `{ generatedAt, node, pack, images: { "<path under public/assets>": "<sha256>" } }`. Task 20 reads it.
  - `test/golden/tmj/<venue>.tmj` — the legacy maps, captured in the same run so Task 20 never has to reconstruct them from git history.
  - `docs/ASSETS.md` — records the U-1 answer. U-1 was already answered first-hand against the purchased packs (art-pack QA, 2026-07-29: separable layers exist, `capabilities.characterLayers` is `true` from Plan 1 Task 5); Step 7 re-verifies it on this machine's unpacked copy and writes the record.
  - a **fully pinned** `sources/limezu.json`: every crop verified against real pixels, so a future pack update fails `validate:contract` by name instead of silently changing the art.

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

Expected: `sync-assets: copied 90/90` with no `MISSING` block — the script's 61 hardcoded `[source, destination]` pair literals expand to **90 files at runtime** (39 `FILES` + 22 `PROPS` + 8 looped fence parts + 9 office singles + 12 premade character sheets); `district.tmj: 48x46, atlas of 23 tiles, objects: 272`; four interior lines; then `golden baseline: 121 images (<m> generated), 5 tilemaps`. The client at http://localhost:5173 renders the district with buildings, trees, lamps and agents — no missing-texture placeholders.

If `sync-assets.mjs` reports missing files, its path does not match your unpack layout. Where to fix it depends on where you are in the sequence: **before Task 19a**, the paths live in `scripts/sync-assets.mjs`'s explicit list; **after Task 19a**, the list is derived from the contract and the paths live in the `files` block of `sources/limezu.json`. Record the correction in `docs/ASSETS.md` either way.

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

The 116 rects in `sources/limezu.json` (64 explicit crops, 52 whole-file) were transcribed from build
scripts written months ago. Whether they still point at the sprites they were
chosen for has never been checkable. Now it is:

```bash
npm run pin limezu assets-src
```

Expected on a first run: `pinned 116 new crop(s); 116 total, all match`. Every
rect now carries a hash of the pixels it resolves to, and `npm run validate:contract`
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
3. **A sprite that fights its floor** — the TZ-08 note on `armchair_grey_r`
   records exactly this ("read as a concrete slab on warm parquet"), and it was
   found by accident. Now it is findable on purpose.
4. **Anything hovering `[UNPINNED]`** after Step 5. There should be none.

For each sprite you change, edit its entry in `sources/limezu.json`: the new
rect, a `note` saying what was wrong with the old one (and what it beat), and
the stale `pin` cleared. Then:

```bash
npm run pin limezu assets-src && npm run contact limezu assets-src
```

**A changed crop invalidates the baseline captured in Step 3.** That is correct
and expected — you have deliberately improved the art, so the "reproduce the
legacy output exactly" claim no longer holds for that sprite. After the review,
re-record the baseline (`UPDATE_GOLDEN=1 npm run test:bake`, Task 20) and read
the diff — it names exactly the images your crop changes moved, and nothing
else may appear in it. Record each one in `docs/ASSETS.md`. An unexplained
line in that diff is a bug; an explained one is a decision.

If you change nothing, that is a real result too: it means 116 transcribed
crops survived first contact with a proper review, and the record now says so.

- [ ] **Step 7: Re-verify U-1 — separable character layers**

U-1 is already answered (art-pack QA, 2026-07-29): the Character Generator ships separable 16×32 layer directories — Bodies (9), Eyes (7), Hairstyles (200), Outfits (132), Accessories (84) — so **Task 27 composes** and `characterLayers` is `true` from Plan 1 Task 5. This step re-verifies that on the copy you just unpacked, so the record in `docs/ASSETS.md` names this machine's evidence:

```bash
node scripts/inspect-assets.mjs "assets-src/interiors/2_Characters/Character_Generator/0_Premade_Characters/16x16/Premade_Character_01.png"
node scripts/png-grid.mjs "assets-src/interiors/2_Characters/Character_Generator/Bodies/16x16/Body_01.png" 16 32
ls "assets-src/interiors/2_Characters/Character_Generator"
```

Expected: the five layer directories listed above, and the layer sheets at 927×656 (whole-frame cropping is Plan 4 Task 27's job). If your unpacked edition differs — layers missing, different sizes — stop and reconcile before Task 27: the fallback (`characterLayers: false`, palette-remap of a premade base; variety drops to `bases × palettes`, nothing breaks — spec §7.3) still exists, but flipping to it is a decision to record, not a silent fix.

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
        sources/limezu.sheets.json sources/limezu.json \
        docs/ASSETS.md README.md scripts/sync-assets.mjs
git commit -m "chore(assets): index and pin the packs, capture the golden baseline, resolve U-1/U-2"
```

---

## Task 3b: Delete the QA symlink compatibility layer

During the 2026-07-29 art-pack QA, nine symlinks were planted in `assets-src/` so the legacy scripts' short paths kept resolving against the real pack layout:

```
exteriors/themes          exteriors/animated        office/room-builder
office/singles            interiors/ui              interiors/characters-premade
interiors/Room_Builder_16x16.png                    interiors/themes
interiors/animated
```

They are a compatibility shim, not a fix. The durable fix is already in place: the `files` blocks in `sources/limezu.json` (Plan 1 Tasks 5–7) name the **real** pack paths, so nothing in the new pipeline needs the links. What *does* need them is the past — `scripts/sync-assets.mjs`'s legacy list and the frozen `build-district.mjs` / `build-interiors.mjs`, which Task 3 just ran to capture the golden baseline.

**Ordering is the whole task: Task 3 precedes Task 3b.** The baseline must be captured through the legacy paths *before* the links die. From this task onward, the legacy scripts (and any pre-Task-19a `sync-assets.mjs`) are broken by design — if you ever need to re-capture the baseline from scratch, recreate the links, capture, and delete them again.

**Files:**
- Delete: the nine symlinks under `assets-src/` (gitignored — this changes only the local tree)

- [ ] **Step 1: Confirm the baseline exists**

```bash
test -s test/golden/baseline.json && ls test/golden/tmj/ | wc -l
```

Expected: a non-empty `baseline.json` and 5 tilemaps. If not, do Task 3 first — deleting the links before capture strands the golden gate.

- [ ] **Step 2: Delete the links**

```bash
find assets-src -maxdepth 2 -type l -print -delete
find assets-src -type l
```

Expected: nine paths printed by the first command, nothing by the second.

- [ ] **Step 3: Prove the new pipeline never needed them**

```bash
npm run validate:contract -- limezu assets-src
npm test
```

Expected: `contract validation OK` with pixels checked, tests PASS. Every `files` entry resolves through its real path.

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

A gate that fails on all four teaches people to ignore it. A gate loosened until it passes proves nothing. So this one is **tiered**, and it gates exactly the two things that have no legitimate reason to differ:

1. **Pixels — byte-exact.** Ground atlases and prop PNGs are pure crops of the same source rectangles. There is no legitimate reason for a single byte to differ. `sha256`, no tolerance.
2. **Tile layers — byte-exact.** The `data` arrays for `ground` and `roads` are what `cityGrid` and the interior painter emit. A PRNG-order mistake in Task 16 shows up here as thousands of differing tiles — and nothing else executable checks it: Plan 2's `districtGround` tests are structural, and a mis-ported variant order would pass every one of them while being visually near-invisible.

Object layers and collision are deliberately **not** gated against the legacy maps. All three of the table's non-identical changes land in those layers, so a legacy comparison would spend its machinery explaining its own exceptions — and the invariants it would guard already have better homes. Object placement is asserted against the descriptors by Plan 2's `venueBaker` tests, and the descriptors were verified against the legacy maps tuple by tuple when they were written (Task 13). Collision is derived and structurally tested (Task 15: walls, borders, the doorway gap, colliding furniture) — those tests pin walkability *going forward*, which is the durable claim. The one comparison the migration itself deserves is a single human look at the collision diff, and Step 3 says exactly how to take it.

The only declared mapping the gate carries is `renames` — the `limezu/` → `pack/` path rename, same bytes under a new path. A crop the Task 3 review deliberately improved is handled by **re-recording the baseline** and reviewing the diff (Task 3 Step 6), not by declaring an exception the gate would then have to interpret.

### Re-recording

`UPDATE_GOLDEN=1 npm run test:bake` re-records the baseline. It prints the full diff first and refuses to run without `assets-src/` present. Re-recording is a deliberate act with a diff to review — never a way to make a red test green.

**Files:**
- Create: `test/bake/golden.test.mjs`
- Modify: `test/golden/baseline.json` — add the `renames` block

**Interfaces:**
- Consumes: `test/golden/baseline.json` and `test/golden/tmj/` (Task 3), `worldBake()` (Task 18), `loadContract()` (Task 4), the frozen scripts (Task 19).
- Produces: a suite that **skips with a reason** when `assets-src/` is absent and writes `test/golden/report.json` on failure.

- [ ] **Step 1: Declare the renames**

Add to `test/golden/baseline.json`, as a sibling of `images`:

```json
  "renames": {
    "tilesets/limezu/": "tilesets/pack/",
    "sprites/limezu/district/": "sprites/pack/district/",
    "sprites/limezu/interior/": "sprites/pack/interior/"
  }
```

A rename is a mapping, not an exception: the same bytes under a new path.
Content differences get no declaration mechanism at all — a crop the Task 3
review deliberately changed is handled by re-recording the baseline and
reviewing the diff (Task 3 Step 6), so the gate never learns to interpret an
excuse.

- [ ] **Step 2: Write the gate**

`test/bake/golden.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { worldBake } from '../../scripts/world-bake.mjs';
import { loadContract } from '../../scripts/lib/assetContract.mjs';
import { skipUnless } from '../helpers/skip.mjs';

const HAVE_ART = existsSync('assets-src');
const GATE = skipUnless(HAVE_ART, 'assets-src/ absent — run Task 3 to capture the baseline');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

const golden = JSON.parse(readFileSync('test/golden/baseline.json', 'utf8'));
const sha = p => createHash('sha256').update(readFileSync(p)).digest('hex');
const rename = p => Object.entries(golden.renames).reduce((s, [from, to]) => s.replace(from, to), p);

// "Generated" is decided by NAME, derived from the contract — never by path
// prefix. The baseline also hashes the raw sync-assets copies that live under
// the same directories, and those are bake INPUTS, not outputs.
const contract = loadContract();
const generatedNames = new Set([
  ...Object.keys(contract.groundAtlases).map(id => `tilesets/limezu/${id}.png`),
  ...Object.entries(contract.props).flatMap(([group, defs]) =>
    Object.keys(defs).map(n => `sprites/limezu/${group}/${n}.png`)),
]);
const isGenerated = p => generatedNames.has(p);

const readTmj = p => JSON.parse(readFileSync(p, 'utf8'));

/** The venues the legacy pipeline knew about — read, not listed. */
const legacyVenueIds = () =>
  readdirSync('test/golden/tmj').filter(f => f.endsWith('.tmj')).map(f => f.replace('.tmj', '')).sort();

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

const report = { images: [] };
function writeReport() {
  if (report.images.length) {
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

  // The report is written BEFORE any assertion, so a failure always leaves
  // the full picture on disk, not just the first bad comparison.
  writeReport();
  assert.ok(compared > 0, 'compared no images — the rename map or the baseline is wrong');
  assert.equal(compared, Object.keys(golden.images).filter(isGenerated).length,
    'some baseline images were not produced by the bake — see test/golden/report.json');
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

// ── Re-recording, deliberately ───────────────────────────────────────────
test('UPDATE_GOLDEN re-records the baseline', skipUnless(HAVE_ART && UPDATE, 'set UPDATE_GOLDEN=1 to re-record'), () => {
  console.warn('\n!! Re-recording the golden baseline. Review the diff before committing:');
  console.warn('!!   git diff test/golden/\n');
  execFileSync(process.execPath, ['scripts/capture-golden-baseline.mjs'], { stdio: 'inherit' });
});
```

- [ ] **Step 3: Run it without art, then with**

Run: `npm run test:bake`

Expected **without art**: two skips, and `test/helpers/skip.mjs` prints
`! 1 suite(s) skipped: assets-src/ absent — run Task 3 to capture the baseline`
at the end of the run. A skip you can see is a skip you can act on.

Expected **with art**: both tiers PASS.

If Tier 1 fails with `drift`, read `test/golden/report.json` — it names the
image, and the fix is that name's rect in `sources/limezu.json`. Compare
against the frozen original:

```bash
grep -n -A3 "'<name>'" test/golden/legacy/build-interiors.mjs
```

If Tier 2 fails, the PRNG consumption order in `cityGrid` (Task 16) differs
from the original. The tile data diff will show it starting from the first
differing index.

Then, with both tiers green, take the **one-time collision look** — the only
legacy comparison the object data gets, and deliberately a human one. Derived
collision is *supposed* to differ from the hand-authored boxes; what must hold
is that it blocks the same walls and furniture and leaves the same doorway
open. Plan 2's structural tests (Task 15) pin that invariant going forward;
this look checks once that the *migration* dropped nothing the old boxes
covered. Bake to the real output directory and dump both sides:

```bash
npm run bake:world -- limezu assets-src
node -e '
const fs = require("node:fs");
const boxes = p => (JSON.parse(fs.readFileSync(p, "utf8")).layers
  .find(l => l.name === "collision")?.objects ?? [])
  .map(o => [o.x, o.y, o.width, o.height].join(",")).sort().join("  ");
for (const f of fs.readdirSync("test/golden/tmj")) {
  const id = f.replace(".tmj", "");
  console.log(`${id}\n  legacy: ${boxes(`test/golden/tmj/${f}`)}\n  baked:  ${boxes(`packages/client/public/assets/tilemaps/${f}`)}`);
}'
```

Eyeball each venue once — every wall and every colliding piece of furniture
still blocked, the doorway gap still open, no derived box swallowing the room —
and record the outcome in `docs/ASSETS.md`, one line per venue. No committed
tooling: a comparison that runs once does not earn a helper.

- [ ] **Step 4: Commit**

```bash
git add test/bake/golden.test.mjs test/golden/baseline.json
git commit -m "test(bake): golden gate — exact pixels, exact tiles against the frozen legacy pipeline"
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
  // Every stage must name the real pack. A bare sync-assets.mjs would copy
  // the FIXTURE character sheets next to real tiles, silently.
  assert.match(cmd, /sync-assets\.mjs limezu assets-src/);
  assert.match(cmd, /bake:world -- limezu assets-src/);
  assert.match(cmd, /bake:agents -- --pack limezu --src assets-src/);
  assert.match(cmd, /--prebuilt/, 'prebuilt is what makes the local bake reach production');
  assert.equal(/\.\.\./.test(cmd), false, 'a literal "..." means a plan placeholder leaked into package.json');
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
    "deploy:client": "node scripts/sync-assets.mjs limezu assets-src && npm run bake:world -- limezu assets-src && npm run bake:agents -- --pack limezu --src assets-src && vercel pull --yes --environment=production && vercel build --prod && vercel deploy --prebuilt --prod",
```

This is the one full definition of the key — Plan 2 Task 19a Step 5 only added the `limezu assets-src` arguments to the `sync-assets.mjs` invocation and deferred the rest to here. Every stage names the real pack explicitly: `sync-assets.mjs` with no arguments would copy the *fixture* character sheets next to real tiles, silently.

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

## Task 38b: The LimeZu credit link — a licence obligation, not decoration

The Modern Interiors and Modern UI licences **require** credit; the addendum
(Part III.1) records that no task covered it. The credit is one permanent,
clickable line in the client UI: `Art: LimeZu` → `https://limezu.itch.io/`.

**Files:**
- Modify: `packages/client/src/App.tsx` — mount the credit line
- Create: `packages/client/src/ui/ArtCredit.tsx`
- Test: `test/art-credit.test.mjs`

**Interfaces:**
- Consumes: nothing — static UI.
- Produces: the licence-required attribution, pinned by test so no refactor can
  silently drop it.

- [ ] **Step 1: Write the failing test**

`test/art-credit.test.mjs` — the plans' static-grep idiom: the obligation is
that the link *ships*, which a source assertion pins without a browser:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('the LimeZu credit link is present and wired into the app', () => {
  const credit = readFileSync('packages/client/src/ui/ArtCredit.tsx', 'utf8');
  assert.match(credit, /https:\/\/limezu\.itch\.io\//, 'licence requires the credit URL');
  assert.match(credit, /LimeZu/, 'the artist is named');
  const app = readFileSync('packages/client/src/App.tsx', 'utf8');
  assert.match(app, /ArtCredit/, 'the credit is actually mounted');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="LimeZu"`
Expected: FAIL — `ENOENT … ArtCredit.tsx`.

- [ ] **Step 3: Implement**

`packages/client/src/ui/ArtCredit.tsx`:

```tsx
// The LimeZu licences (Modern Interiors, Modern UI) REQUIRE attribution.
// This line is a licence condition, not decoration: do not remove during a redesign.
export function ArtCredit() {
  return (
    <a
      href="https://limezu.itch.io/"
      target="_blank"
      rel="noreferrer"
      style={{
        position: 'fixed', right: 8, bottom: 4, zIndex: 300,
        fontSize: 10, opacity: 0.7, color: 'inherit', textDecoration: 'none',
      }}
    >
      Art: LimeZu
    </a>
  );
}
```

In `packages/client/src/App.tsx`, import it and render `<ArtCredit />` as the
last child of the root element (beside the existing overlay mounts).

- [ ] **Step 4: Run to verify it passes**

Run: `npm test -- --test-name-pattern="LimeZu"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/client/src/ui/ArtCredit.tsx packages/client/src/App.tsx test/art-credit.test.mjs
git commit -m "feat: LimeZu attribution link (licence requirement)"
```

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
