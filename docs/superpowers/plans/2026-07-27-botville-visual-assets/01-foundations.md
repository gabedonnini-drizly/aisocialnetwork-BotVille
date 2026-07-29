# BotVille Visual Assets — Plan 1: Foundations

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Plan 1 of 6.** Index and sequencing: [`00-INDEX.md`](00-INDEX.md). Spec: `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md` (commit `d695881`) — approved, do not re-brainstorm.

**Goal:** Turn the art source into data — a pack-agnostic contract for what must exist, a curated record of which pixels are it and why, and a CI gate that fails the build rather than rendering a missing texture.

**Architecture:** Three artifacts and six modules. `contract/assets.contract.json` names things and their geometry and never mentions a file. `sources/<pack>.json` records which pixels each name resolves to, and every rect can carry a `note` — why this sprite, what it beat — and a `pin`, the sha256 of the chosen crop's pixels, so a pack update that shifts a sheet is a named build error, not a silently different chair. `scripts/index-pack.mjs` inventories a pack so choosing starts from a candidate list; `scripts/contact-sheet.mjs` renders every choice on its floor tile, at 2×, and under the night tint, so all 116 named judgements (64 explicit crops + 52 whole-file grabs) can be reviewed in one pass. `scripts/gen-fixture-pack.mjs` generates a synthetic pack with real pixels and known geometry so all of it is testable with zero licensed art.

**Tech Stack:** Node ≥24 (ESM), TypeScript 5.7, Phaser ^3.88.2 declared / 3.90.0 installed, Vite 6, npm workspaces + Turbo, `node:test` (no new test dependency), the existing `scripts/png-lib.mjs` PNG codec, Postgres (`aisocialnetwork-api` only), Docker Compose (local parity only — created by Plan 6 Task 35; no Docker artifact exists in the repo today).

**Depends on:** Nothing. This is the first plan.

**Exit criterion:** `npm run validate:contract` is green for both the fixture pack and (name-resolution only) the licensed pack. `npm test` passes on a fresh clone with no art present. The fixture pack is fully pinned — `npm run fixture` fills every `pin` from the generated pixels, and the committed manifest is byte-stable across runs. **Zero behaviour change** — nothing in `packages/` has been touched yet.


## Where curation happens

Four decisions stand between an art pack and a pixel on screen. Three of them had a home before this plan; the second did not.

| Decision | Home | Task |
|---|---|---|
| What must exist — the world needs a `bookshelf_a` | `contract/assets.contract.json` | 4 |
| **Which sprite is it, and why that one** | `note` + `pin` fields on `sources/<pack>.json` | **4a, 5–7, 9a** |
| Which sheets are worth copying at all | derived from the adapter | Plan 2, Task 19a |
| Where it goes in a place | `venues/<id>/venue.json` | Plan 2, Task 13 |

The middle row is what this plan adds. Before it, a rect in `sources/limezu.json` was the *answer* to a question nobody wrote down, chosen from a candidate set nobody enumerated, verifiable against nothing. `scripts/inspect-assets.mjs` says so in its own header: «Результаты фиксируются вручную» — recorded by hand.

Tasks 4a and 9a give that decision an inventory and a review artifact, and Tasks 5–7 record it on the adapter itself: every rect can carry a `note` saying why that sprite won — plus a **pin** (Task 9), so a pack update that shifts a sheet becomes a named build error instead of a silently different chair.

**What is deliberately not automated:** whether a sprite reads as a bookshelf at 16px, or whether the brown chair sits better on parquet than the grey one. No scorer is built and none is planned. The aim is to make taste cheap to apply and impossible to lose, not to replace it.

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

In execution order. Numbers are stable identifiers carried over from the
combined plan, so cross-references from later plans keep working; the `a`
suffixes are the curation tasks, inserted where they belong in the sequence.

- **Task 1** — Test harness
- **Task 2** — Shared asset types and SCHEMA_VERSION
- **Task 4** — `assets.contract.json` and the `AssetContract` loader
- **Task 4a** — The pack index — what is actually in there
- **Task 5** — `sources/limezu.json` — ground atlas tiles
- **Task 6** — `sources/limezu.json` — district props
- **Task 7** — `sources/limezu.json` — interior furniture, characters, emotes, animated objects
- **Task 8** — `SourceAdapter` and the synthetic fixture pack
- **Task 9** — `SpriteReader` and crop pins
- **Task 9a** — The contact sheet — the thing you actually look at
- **Task 10** — `ContractValidator` and the CI gate

Tasks 5–7 author the rects directly on the adapter, carrying the old build
scripts' hard-won corrections forward as `note` fields. The transcription (the
risky part, spec R-5) stays a pure move of numbers that already exist; Task 9's
pinner then verifies each crop against real pixels and records the hash beside
it.

---

## Task 1: Test harness

Nothing else in this plan can be verified without a runner. There is no test framework in the repo today and this plan adds none — Node's built-in runner handles both `.mjs` and `.ts` (type-stripping, verified working on the installed Node 22.22 and required Node 24).

**The one non-obvious part.** TypeScript source in this repo imports siblings with a `.js` extension (`import { X } from './foo.js'` where the file is `foo.ts`) — correct under `moduleResolution: "bundler"`, and what Vite and `tsc` both expect. **Node's type stripping does not rewrite that extension**, so a bare `node --test` cannot load any runtime `.ts` module that imports a sibling. Tasks 21, 30, 34 and 37 all test such modules. A 20-line resolve hook fixes it once, here. The stripping is also strip-*only* — it never generates code — which is why the Global Constraints ban non-erasable TypeScript (parameter properties, `enum`, `namespace`) in anything node-tested.

**The resolve hook is a test-only crutch, and that is a constraint, not a convenience.** Because it only exists inside `node --test`, any module that must *also* load under bare `node` (the bake CLIs) or under Vite (the client bundle) may not depend on it. That is the rule in Global Constraints: **`.mjs` never imports `.ts`.** Step 7 below adds the regression test that enforces it, so the rule fails loudly the first time someone breaks it rather than at `npm run bake:agents` three plans later.

**Four design decisions, made once here so 38 tasks inherit them:**

1. **The fixture pack is a test prerequisite, not a manual step.** `pretest` generates it. A fresh clone runs `npm test` and it works. (The generator lands in Task 8; `pretest` is wired then, and is a no-op until it exists.)
2. **Fast and slow tests are separate commands.** Pure-logic tests run in a second. Tests that bake a whole world, encode PNGs or sweep 10k seeds run in `npm run test:bake`. `npm run test:all` runs both and is what CI and the verification checklist use. Nobody skips a test suite that stays fast.
3. **Tests never write to the source tree.** Asserted by Task 18's clean-tree guard, made structurally impossible by making `outDir`/`generatedDir` required arguments.
4. **A skipped test says why, out loud.** Cross-repo and art-gated tests skip with a reason string, and `test/helpers/skip.mjs` prints a summary line at the end of the run so a silently-skipped suite cannot masquerade as a green one.

**Files:**
- Modify: `package.json` (root) — `pretest`, `test`, `test:bake`, `test:all`
- Create: `test/ts-resolve.mjs`
- Create: `test/helpers/siblingRepo.mjs`
- Create: `test/helpers/skip.mjs`
- Create: `test/harness.test.mjs`
- Create: `test/harness-ts.test.ts`
- Create: `test/harness-no-hook.test.mjs`
- Create: `test/harness-fixture/leaf.ts`, `test/harness-fixture/root.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `npm test` — builds `@botville/shared`, generates the fixture pack, runs every `test/**/*.test.mjs` and `test/**/*.test.ts` *except* `test/bake/**`, with `.js` → `.ts` resolution enabled.
  - `npm run test:bake` — the slow suite under `test/bake/`.
  - `npm run test:all` — both, then the shell-level clean-tree check.
  - `test/helpers/siblingRepo.mjs`: `resolveSiblingRepo(name) → string | null` and `skipUnlessSibling(name) → { skip: false } | { skip: string }`.
  - `test/helpers/skip.mjs`: `skipUnless(condition, reason) → { skip: false | string }`, recording every skip reason for the end-of-run summary.

  All later tasks add files under `test/` — slow ones under `test/bake/`.

- [ ] **Step 1: Write the failing tests**

`test/harness.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, encodePng } from '../scripts/png-lib.mjs';

test('the runner picks up .mjs tests and png-lib is importable', () => {
  const cv = createCanvas(2, 2);
  cv.set(0, 0, [255, 0, 0, 255]);
  const png = encodePng(cv);
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
});
```

`test/harness-fixture/leaf.ts`:

```ts
export const LEAF = 'leaf';
```

`test/harness-fixture/root.ts`:

```ts
// The repo-wide convention: a .ts sibling imported with a .js extension.
import { LEAF } from './leaf.js';
export const ROOT = `root:${LEAF}`;
```

`test/harness-ts.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROOT } from './harness-fixture/root.ts';

test('the runner strips TypeScript types', () => {
  const n: number = 41;
  assert.equal(n + 1, 42);
});

test('a .ts sibling imported with a .js extension resolves', () => {
  assert.equal(ROOT, 'root:leaf');
});

test('@botville/shared is importable from a test', async () => {
  const shared = await import('@botville/shared');
  assert.equal(typeof shared.AVATAR_VARIANT_COUNT, 'number');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test`
Expected: FAIL — `npm error Missing script: "test"`.

- [ ] **Step 3: Write the resolve hook**

`test/ts-resolve.mjs`:

```js
/**
 * Lets `node --test` load this repo's runtime TypeScript.
 *
 * TS source here imports siblings with a `.js` extension for a `.ts` file
 * (moduleResolution: "bundler" — what Vite and tsc expect). Node's type
 * stripping does NOT rewrite that extension, so plain `node --test` cannot
 * load venueRegistry.ts, AppearanceResolver.ts and friends. This hook maps
 * a relative `./x.js` onto `./x.ts` when only the .ts file exists.
 *
 * Test-only. Nothing in the shipped build depends on it.
 */
import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL && specifier.endsWith('.js') && /^\.{1,2}\//.test(specifier)) {
      const asJs = new URL(specifier, context.parentURL);
      const asTs = new URL(`${specifier.slice(0, -3)}.ts`, context.parentURL);
      if (!existsSync(fileURLToPath(asJs)) && existsSync(fileURLToPath(asTs))) {
        return { url: asTs.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
});
```

`registerHooks` is available from Node 22.15 and is present in the pinned Node 24.

- [ ] **Step 4: Write the two helpers**

`test/helpers/siblingRepo.mjs` — the only sanctioned way to find another repo:

```js
/**
 * Locating a sibling repo, without ever hardcoding a path.
 *
 * Resolution order, first hit wins:
 *   1. $BOTVILLE_<NAME>_REPO      explicit, e.g. BOTVILLE_API_REPO
 *   2. $BOTVILLE_REPOS_ROOT/<name> a directory holding all the repos
 *   3. <this repo>/../<name>       the conventional side-by-side checkout
 *
 * Returns null rather than guessing. Callers skip with a reason; nothing in
 * this repo may FAIL because another repo is absent (Global Constraints).
 */
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

const envKey = name => `BOTVILLE_${name.replace(/[^a-z0-9]+/gi, '_').toUpperCase()}_REPO`;

export function resolveSiblingRepo(name) {
  const candidates = [
    process.env[envKey(name)],
    process.env.BOTVILLE_REPOS_ROOT && join(process.env.BOTVILLE_REPOS_ROOT, name),
    resolve(REPO_ROOT, '..', name),
  ].filter(Boolean);
  return candidates.find(p => existsSync(p)) ?? null;
}

/** `test('...', skipUnlessSibling('aisocialnetwork-api'), () => {...})` */
export function skipUnlessSibling(name) {
  const path = resolveSiblingRepo(name);
  return path
    ? { skip: false }
    : { skip: `${name} not found — set ${envKey(name)} or check it out beside this repo` };
}
```

`test/helpers/skip.mjs` — makes a skipped suite visible:

```js
/**
 * A skipped test that nobody notices is a test that does not exist.
 * Every conditional skip in this repo records its reason here, and the
 * summary prints once at the end of the run.
 */
const reasons = new Set();

export function skipUnless(condition, reason) {
  if (condition) return { skip: false };
  reasons.add(reason);
  return { skip: reason };
}

process.on('exit', () => {
  if (!reasons.size) return;
  process.stderr.write(`\n! ${reasons.size} suite(s) skipped:\n`);
  for (const r of reasons) process.stderr.write(`!   ${r}\n`);
});
```

- [ ] **Step 5: Write the no-hook regression test**

`test/harness-no-hook.test.mjs`. This is the guard for the rule that a `.mjs`
module never depends on the resolve hook. It spawns bare `node` — no
`--import` — and imports every `.mjs` the bake CLIs and the client bundle
load. If someone adds a `.ts` import to one of them, this fails here rather
than at `npm run bake:agents` in Plan 4 or at `vite build` in Plan 3.

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

/**
 * Modules that must load under BARE node and under Vite — i.e. without
 * test/ts-resolve.mjs. Tasks append to this list as they create them.
 */
const NO_HOOK_MODULES = [
  'packages/shared/src/schemaVersion.mjs',
  'packages/shared/src/hash.mjs',
  'packages/shared/src/appearance/derive.mjs',
  'scripts/png-lib.mjs',
];

for (const mod of NO_HOOK_MODULES) {
  test(`${mod} loads under bare node (no resolve hook)`, { skip: existsSync(mod) ? false : `${mod} not created yet` }, () => {
    // No --import: if this module reaches a .ts file it throws ERR_MODULE_NOT_FOUND.
    const out = execFileSync(process.execPath,
      ['-e', `import(${JSON.stringify('./' + mod)}).then(() => console.log('ok'))`],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    assert.match(out, /ok/);
  });
}
```

- [ ] **Step 6: Add the scripts**

In root `package.json`, inside `"scripts"`, after `"typecheck": "turbo typecheck",`:

```json
    "pretest": "npm run build --workspace=packages/shared && npm run fixture --if-present",
    "test": "node --import ./test/ts-resolve.mjs --test --test-concurrency=4 --test-reporter=spec \"test/*.test.mjs\" \"test/*.test.ts\"",
    "test:bake": "npm run pretest && node --import ./test/ts-resolve.mjs --test --test-concurrency=2 \"test/bake/**/*.test.mjs\" \"test/bake/**/*.test.ts\"",
    "test:all": "npm test && npm run test:bake && node -e \"const d=require('child_process').execSync('git status --porcelain',{encoding:'utf8'}).split('\\n').filter(l=>l&&!l.startsWith('??'));if(d.length){console.error('tests modified tracked files:\\n'+d.join('\\n'));process.exit(1)}\"",
```

Four things worth knowing:

- The shared build runs first because `packages/shared/package.json`'s `"node"` export condition points at `dist/index.js` — a stale `dist` would silently hide new types from every test.
- `--if-present` lets `pretest` be written now and become real in Task 8. Until then it is a no-op, so `npm test` works at every commit in between.
- The `test` glob is `test/*.test.*`, deliberately **not** `test/**/*.test.*`: slow suites live under `test/bake/` and are excluded by construction rather than by an ignore list somebody forgets to update.
- `test:all` ends with a clean-tree check: it fails if any *tracked* file changed during the run. This shell-level check is the authoritative one — it runs after every worker has exited, so `--test-concurrency` cannot reorder it. The in-suite guard (Task 18's `test/bake/zz-clean-tree.test.mjs`) is a best-effort early warning, not the gate.

- [ ] **Step 7: Run to verify it passes**

Run: `npm test`
Expected: PASS — 4 harness tests plus the no-hook tests that apply (`png-lib.mjs` runs; the three shared modules skip until Tasks 2 and 26 create them, with the reason printed).

- [ ] **Step 8: Commit**

```bash
git add package.json test/ts-resolve.mjs test/helpers/ test/harness.test.mjs test/harness-ts.test.ts test/harness-no-hook.test.mjs test/harness-fixture/
git commit -m "test: node:test harness, fast/slow split, sibling-repo resolution and a no-hook guard"
```

---

## Task 2: Shared asset types, SCHEMA_VERSION and the cross-repo hash

The types both packages and both bake stages agree on. Types only — no logic, no I/O — so a schema change is a compile error rather than a runtime surprise (spec §4.3). Plus the two `.mjs` primitives everything downstream hashes with, and the resolver plumbing that makes them importable by subpath.

**`SCHEMA_VERSION` lives in a `.mjs` file, and that is load-bearing.** It is hashed into every `appearanceHash` (I-7), so `packages/shared/src/appearance/derive.mjs` (Task 26) must read it. `derive.mjs` is loaded by bare `node` in the bake CLIs and by Vite in the client bundle, and **neither rewrites `.js` → `.ts`** — so `derive.mjs` cannot import it from a `.ts` file. Putting the constant in `schemaVersion.mjs` and having `Assets.ts` re-export it gives one definition, reachable from both worlds, with no resolve hook involved. Task 1 Step 5's no-hook test is what keeps it that way.

**`hashString` lives here for the same reason, one plan earlier than you would expect.** It is the FNV-1a the api already uses (`agentSeed.js:30`), and three unrelated consumers need it: `appearance/derive.mjs` (Plan 4 Task 26), `venueSlots.ts` (Plan 3 Task 37) and the api's `scheduleCoverage.js` (Plan 5). Defining it in Plan 4 makes Plan 3 depend on Plan 4 while Plan 4 depends on Plan 3 — a cycle no execution order satisfies. It is eight lines with no dependencies, so it belongs at the bottom of the stack.

**Files:**
- Create: `packages/shared/src/schemaVersion.mjs`
- Create: `packages/shared/src/hash.mjs`
- Create: `packages/shared/src/types/Assets.ts`
- Modify: `packages/shared/src/index.ts:5` (append an export)
- Modify: `packages/shared/package.json` — `exports` gains the `./*.mjs` subpath pattern (Step 5b)
- Modify: `packages/shared/tsconfig.json` and `packages/client/tsconfig.json` — `allowJs` (Step 5)
- Modify: `packages/client/vite.config.ts` — regex alias pair (Step 5b)
- Modify: `test/harness-no-hook.test.mjs` — the modules are now real
- Test: `test/shared-types.test.ts`

**Interfaces:**
- Consumes: `test/helpers/siblingRepo.mjs` (Task 1) — the cross-repo hash test.
- Produces `packages/shared/src/schemaVersion.mjs`:
  - `const SCHEMA_VERSION = 1` — the single definition, importable from `.mjs`
- Produces `packages/shared/src/hash.mjs`:
  - `hashString(str, salt = '') → number` — FNV-1a, unsigned 32-bit. Bit-identical to `aisocialnetwork-api/src/utils/agentSeed.js:30`; that is a contract, not a coincidence.
- Produces, all exported from `@botville/shared`:
  - `const SCHEMA_VERSION: 1` (re-exported)
  - `interface AgentPresence { id: string; displayName: string; spriteSeed: string; venueId: string | null }`
  - `type PresenceState = { kind: 'somewhere'; venueId: string } | { kind: 'absent' } | { kind: 'unknown' }`
  - `interface AppearanceRecord { build: Build; skinTone: string; eyes: string; hairStyle: string; hairColor: string; outfit: string; accessory: string }`
  - `type Build = 'masc' | 'fem' | 'neutral'`
  - `interface VenueDescriptor { id; label; indoor; sizeTiles; groundAtlas; capacity; ground?; generator?; furniture; seats; spawns; animated; doors; glows }`
  - `interface PublishedVenue { id: string; label: string; indoor: boolean; capacity: number }`

- [ ] **Step 1: Write the failing test**

`test/shared-types.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { SCHEMA_VERSION } from '../packages/shared/src/types/Assets.ts';
import type { AgentPresence, PresenceState, VenueDescriptor } from '../packages/shared/src/types/Assets.ts';
import { hashString } from '../packages/shared/src/hash.mjs';
import { resolveSiblingRepo, skipUnlessSibling } from './helpers/siblingRepo.mjs';

/** The platform repo's directory name. Located, never hardcoded — see helpers/siblingRepo.mjs. */
const API_REPO = process.env.BOTVILLE_API_REPO_NAME ?? 'aisocialnetwork-api';

test('SCHEMA_VERSION is 1', () => {
  assert.equal(SCHEMA_VERSION, 1);
});

test('SCHEMA_VERSION has exactly one definition, and it is reachable from .mjs', async () => {
  const fromMjs = await import('../packages/shared/src/schemaVersion.mjs');
  assert.equal(SCHEMA_VERSION, fromMjs.SCHEMA_VERSION,
    'Assets.ts must re-export schemaVersion.mjs, never declare its own copy');
  const { readFileSync } = await import('node:fs');
  const src = readFileSync('packages/shared/src/types/Assets.ts', 'utf8');
  assert.equal(/^\s*export\s+const\s+SCHEMA_VERSION\s*=/m.test(src), false,
    'Assets.ts declares a second SCHEMA_VERSION — derive.mjs cannot import it');
});

test('hashString is an unsigned 32-bit FNV-1a', () => {
  assert.equal(hashString('', ''), hashString('', ''));
  assert.ok(hashString('x', 'y') >= 0 && hashString('x', 'y') <= 0xffffffff);
  assert.notEqual(hashString('x', 'a'), hashString('x', 'b'), 'salt must change the hash');
});

test('hashString matches agentSeed.js bit for bit (cross-repo contract)',
  skipUnlessSibling(API_REPO), async () => {
    const apiRoot = resolveSiblingRepo(API_REPO)!;
    const require = createRequire(join(apiRoot, 'package.json'));
    const apiHash = require(join(apiRoot, 'src/utils/agentSeed.js')).hashString;
    for (const seed of ['aisha_khan', 'the_skeptic', 'Unit01', '', 'ünïcødé'])
      for (const salt of ['', 'city', 'sprite:skin', 'slot:offset'])
        assert.equal(hashString(seed, salt), apiHash(seed, salt), `${seed}/${salt}`);
  });

test('AgentPresence has exactly the four boundary fields', () => {
  const p: AgentPresence = { id: 'a', displayName: 'A', spriteSeed: 'a', venueId: null };
  assert.deepEqual(Object.keys(p).sort(), ['displayName', 'id', 'spriteSeed', 'venueId']);
});

test('PresenceState admits exactly three kinds', () => {
  const states: PresenceState[] = [
    { kind: 'somewhere', venueId: 'cafe' },
    { kind: 'absent' },
    { kind: 'unknown' },
  ];
  assert.deepEqual(states.map(s => s.kind), ['somewhere', 'absent', 'unknown']);
});

test('a minimal VenueDescriptor type-checks', () => {
  const v: VenueDescriptor = {
    id: 'fixture', label: 'Fixture', indoor: true, sizeTiles: [20, 15],
    groundAtlas: 'interiors_ground', capacity: 4,
    ground: { wallA: 'wallCafeA', wallB: 'wallCafeB', floor: 'floorCafe' },
    furniture: [], seats: [], spawns: [[9, 13]], animated: [], doors: [], glows: [],
  };
  assert.equal(v.id, 'fixture');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="SCHEMA_VERSION is 1"`
Expected: FAIL — `Cannot find module '.../packages/shared/src/types/Assets.ts'`.

- [ ] **Step 3: Write the schema version**

`packages/shared/src/schemaVersion.mjs`:

```js
/**
 * The one definition of SCHEMA_VERSION.
 *
 * Bumping it invalidates every baked appearance artifact, because it is
 * hashed into `appearanceHash` (I-7). There is no manual purge step.
 *
 * WHY .mjs AND NOT .ts: appearance/derive.mjs hashes this value, and that
 * module is loaded by bare `node` (scripts/agent-bake.mjs) and by Vite (the
 * client bundle). Neither rewrites a `.js` specifier onto a `.ts` file —
 * only test/ts-resolve.mjs does, and it exists only inside `node --test`.
 * A .mjs constant is reachable from every loader. types/Assets.ts
 * re-exports it so TypeScript consumers see it on @botville/shared.
 * test/harness-no-hook.test.mjs enforces this.
 */
export const SCHEMA_VERSION = 1;
```

- [ ] **Step 3b: Write the cross-repo hash**

`packages/shared/src/hash.mjs`:

```js
/**
 * Deterministic 32-bit string hash (FNV-1a variant). Not cryptographic —
 * it only needs to spread inputs evenly across buckets.
 *
 * CROSS-REPO CONTRACT: byte-for-byte the same function as
 * aisocialnetwork-api/src/utils/agentSeed.js:30. The api derives an agent's
 * city, traits and description seeds from it; BotVille derives that same
 * agent's appearance (Plan 4 Task 26) and its in-venue slot (Plan 3 Task 37).
 * If the two implementations drift, the sprite and the profile stop
 * describing the same person, silently. The test in shared-types.test.ts
 * pins it — and its skip is loud, never silent.
 *
 * WHY .mjs AND NOT .ts: same reason as schemaVersion.mjs — bare `node` (the
 * bake CLIs) and Vite (the client bundle) both load it, and neither rewrites
 * a `.js` specifier onto a `.ts` file.
 */
export function hashString(str, salt = '') {
  const input = `${salt}:${str}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0; // unsigned 32-bit integer
}
```

- [ ] **Step 4: Write the types**

`packages/shared/src/types/Assets.ts`:

```ts
/**
 * Types shared by the world bake, the agent bake and the Phaser runtime.
 * No logic, no I/O — a schema change here is a compile error, not a
 * runtime surprise (spec §4.3).
 */

/**
 * Re-exported, never redeclared — the definition is in schemaVersion.mjs so
 * that appearance/derive.mjs can reach it without a resolve hook (I-7).
 */
export { SCHEMA_VERSION } from '../schemaVersion.mjs';

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

/** Exactly three states. The client never invents a fourth (I-3). */
export type PresenceState =
  | { kind: 'somewhere'; venueId: string }
  | { kind: 'absent' }
  | { kind: 'unknown' };

// ── Appearance ──────────────────────────────────────────────────────────

/** Silhouette family. Normalised from free-text `users.gender`; never branched on raw values. */
export type Build = 'masc' | 'fem' | 'neutral';

export interface AppearanceRecord {
  build: Build;
  skinTone: string;
  /** Sheet-selection axis: '01'..'07' — each Eyes_NN.png sheet IS the colour. */
  eyes: string;
  hairStyle: string;
  hairColor: string;
  /** One whole-garment axis; replaces the earlier separate top/bottom pair. */
  outfit: string;
  accessory: string;
}

// ── Venues ──────────────────────────────────────────────────────────────

export type TileCoord = [number, number];

export interface VenueFurniture {
  name: string;
  /** tile coordinates; fractional is legal and used throughout the existing maps */
  at: TileCoord;
  /** default true — set false for wall-mounted or walk-through props */
  collide?: boolean;
}

export interface VenueSeat {
  at: TileCoord;
  side: 'right' | 'left';
  kind: 'chair' | 'stool' | 'bed';
}

export interface VenueAnimated { name: string; at: TileCoord }
export interface VenueDoor { name: string; at: TileCoord; targetVenue: string }
export interface VenueGlow { kind: 'lamp' | 'window' | 'sign' | 'headlight'; at: [number, number] }

/**
 * Ground for a simple rectangular room. Outdoor venues use `generator`
 * instead — a 48x46 procedural grid is not honest to express tile-by-tile.
 */
export interface VenueGround { wallA: string; wallB: string; floor: string }

export interface VenueGenerator {
  name: 'cityGrid';
  /** PRNG seed. Order of consumption is part of the contract — see Task 16. */
  seed: number;
  params: Record<string, unknown>;
}

export interface VenueDescriptor {
  id: string;
  label: string;
  indoor: boolean;
  sizeTiles: [number, number];
  groundAtlas: string;
  capacity: number;
  ground?: VenueGround;
  generator?: VenueGenerator;
  furniture: VenueFurniture[];
  seats: VenueSeat[];
  spawns: TileCoord[];
  animated: VenueAnimated[];
  doors: VenueDoor[];
  glows: VenueGlow[];
}

/** The bake output the platform consumes. BotVille is its only authority (I-8). */
export interface PublishedVenue {
  id: string;
  label: string;
  indoor: boolean;
  capacity: number;
}
```

- [ ] **Step 5: Export from the package index**

Append to `packages/shared/src/index.ts`:

```ts
export * from './types/Assets.js';
```

`tsc` must be told to follow the `.mjs` re-export, or the build fails with
*"Could not find a declaration file for module '../schemaVersion.mjs'"* (TS7016).
`tsconfig.base.json` has no `allowJs`, so add it to **two** package configs —
not to the base, because the server never has a `.mjs` in its program and
widening the whole repo buys nothing.

**`packages/shared/tsconfig.json`** — it owns the `.mjs` sources:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "noEmit": false,
    "allowJs": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

`include: ["src/**/*"]` already picks the `.mjs` files up. With `allowJs` on and
`declaration` inherited from the base config, `tsc` emits
`dist/schemaVersion.mjs` alongside `dist/types/Assets.js`, and the relative
import resolves in `dist` exactly as it does in `src`.

**`packages/client/tsconfig.json`** — the client ends up with a `.mjs` in its
program too, and this is the non-obvious half. Its `paths` map
`@botville/shared/*` → `../shared/src/*` and its `include` covers
`../shared/src/**/*`, so once Plan 3 Task 37 (`venueSlots.ts`) imports
`@botville/shared/hash.mjs` and Plan 4 Task 30 (`AppearanceResolver.ts`)
imports `@botville/shared/appearance/derive.mjs` from client `.ts` files,
`npx tsc --noEmit` fails with *"Could not find a declaration file for module
'@botville/shared/appearance/derive.mjs'"*. Setting it here, beside the seam it
belongs to, is what stops that surfacing two plans later as an
unrelated-looking typecheck break:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "jsx": "react-jsx",
    "noEmit": true,
    "allowJs": true,
    "paths": {
      "@botville/shared": ["../shared/src/index.ts"],
      "@botville/shared/*": ["../shared/src/*"]
    }
  },
  "include": ["src/**/*", "../shared/src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

`checkJs` stays off: the `.mjs` modules are typed by their JSDoc and their
tests, not by `tsc`.

Verify rather than assume — this is the one build step where the `.mjs`
decision could bite:

```bash
npm run build --workspace=packages/shared
node -e "import('./packages/shared/dist/index.js').then(m => console.log('dist SCHEMA_VERSION =', m.SCHEMA_VERSION))"
```

Expected: `dist SCHEMA_VERSION = 1`.

- [ ] **Step 5b: Open the `.mjs` seam for subpath imports**

`schemaVersion.mjs` and `hash.mjs` are imported by path, not through the
barrel — a `.ts` barrel is exactly what a `.mjs` consumer cannot go through.
Two independent resolvers have to agree, and neither does today:

**Node** (bare `node`, the bake CLIs, and `node --test`) reads `exports`. The
map currently has only `"."`, so every subpath is `ERR_PACKAGE_PATH_NOT_EXPORTED`.
In `packages/shared/package.json`:

```json
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "node": "./dist/index.js",
      "default": "./src/index.ts"
    },
    "./*.mjs": "./src/*.mjs"
  },
```

One pattern covers `schemaVersion.mjs`, `hash.mjs` and `appearance/derive.mjs`
(Plan 4) — `*` in an exports pattern matches `/`. It deliberately does **not**
expose `.ts` files: the barrel stays the only TypeScript entry point.

**Vite** reads `resolve.alias`. `@rollup/plugin-alias` prefix-matches *string*
keys, so a single `'@botville/shared'` string alias rewrites
`@botville/shared/appearance/derive.mjs` into
`…/shared/src/index.ts/appearance/derive.mjs` and dies with `ENOTDIR`. Regex
keys do not prefix-match, so the exact/subpath pair has to be spelled out. In
`packages/client/vite.config.ts`, replace the object alias with an array:

```ts
  resolve: {
    alias: [
      // Точное совпадение -> бочка пакета.
      { find: /^@botville\/shared$/, replacement: path.resolve(__dirname, '../shared/src/index.ts') },
      // Подпуть -> файл в src/. Строковый alias здесь ломается: rollup
      // сопоставляет по префиксу и клеит путь ЧЕРЕЗ index.ts (ENOTDIR).
      { find: /^@botville\/shared\//, replacement: path.resolve(__dirname, '../shared/src') + '/' },
    ],
  },
```

The trailing `'/'` is load-bearing: `path.resolve` strips it, and without it
the replacement concatenates into `…/srcappearance/derive.mjs`.

Verify both resolvers now, not two plans later:

```bash
node -e "import('@botville/shared/schemaVersion.mjs').then(m => console.log('node subpath SCHEMA_VERSION =', m.SCHEMA_VERSION))"
npm run build --workspace=packages/client
```

Expected: `node subpath SCHEMA_VERSION = 1`, and a clean client build.

- [ ] **Step 6: Run tests and typecheck**

Run: `npm test && npm run typecheck`
Expected: PASS — 7 new tests pass, including `SCHEMA_VERSION has exactly one definition` and the two `hashString` tests (the cross-repo one skips with a printed reason if the api repo is absent); the `schemaVersion.mjs` and `hash.mjs` entries in `test/harness-no-hook.test.mjs` now run instead of skipping; typecheck clean. `npx turbo typecheck --force` must report 3 successful projects, matching the baseline this task starts from — a cached pass here proves nothing, because the config changed.

- [ ] **Step 7: Commit**

```bash
git add packages/shared/src/schemaVersion.mjs packages/shared/src/hash.mjs packages/shared/src/types/Assets.ts packages/shared/src/index.ts packages/shared/package.json packages/shared/tsconfig.json packages/client/tsconfig.json packages/client/vite.config.ts test/shared-types.test.ts
git commit -m "feat(shared): asset, venue and presence types; SCHEMA_VERSION and hashString in .mjs, importable from every loader"
```

---

## Task 4: `assets.contract.json` and the `AssetContract` loader

The pack-agnostic authority for *what must exist*. It names things and their shape and never mentions a file or a coordinate — that is the whole point of I-1. Every name below is transcribed from `config.ts:156,169` and `assetManifest.ts`; do not invent names.

**No test in this task hardcodes a count.** The tile and prop lists are the highest-risk transcription in the plan (spec R-5), and "assert it equals 23" only proves the author typed 23 twice. Instead a script *extracts* the lists from the code being replaced into a committed snapshot, and the tests reconcile the contract against that snapshot — order included, because order defines GID. The snapshot survives Task 19 and Task 24 deleting their sources, so the check keeps working after the originals are gone.

**Files:**
- Create: `contract/assets.contract.json`
- Create: `scripts/lib/assetContract.mjs`
- Create: `scripts/snapshot-legacy-names.mjs`
- Create: `test/golden/legacy-names.json` (generated, committed)
- Create: `test/helpers/legacySource.mjs`
- Test: `test/asset-contract.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces `scripts/lib/assetContract.mjs`:
  - `loadContract(path = 'contract/assets.contract.json') → Contract`
  - `Contract = { schemaVersion, tileSize, groundAtlases, props, characters, animatedObjects, emotes, allNames(): string[] }`
  - `allNames()` returns every name the contract requires: all ground-atlas tiles, all district props, all interior props, all animated-object keys, all emote statuses, all character part slots.
- Produces `test/helpers/legacySource.mjs`:
  - `legacyAtlasTiles() → { district_ground: string[], interiors_ground: string[] }`
  - `legacyPropNames() → { district: string[], interior: string[] }`
  - both read `test/golden/legacy-names.json`, so they keep working after the sources are deleted.

- [ ] **Step 1: Write the failing test**

`test/asset-contract.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { legacyAtlasTiles, legacyPropNames } from './helpers/legacySource.mjs';

test('contract loads with schemaVersion 1 and 16px tiles', () => {
  const c = loadContract();
  assert.equal(c.schemaVersion, 1);
  assert.equal(c.tileSize, 16);
});

test('ground atlas order reconciles with the scripts it replaces', () => {
  const c = loadContract();
  for (const [atlasId, legacy] of Object.entries(legacyAtlasTiles())) {
    // Order defines GID. Not "the same names" — the same names IN ORDER.
    assert.deepEqual(c.groundAtlases[atlasId].tiles, legacy, atlasId);
  }
});

test('prop names reconcile with DISTRICT_IMAGES and INTERIOR_IMAGES', () => {
  const c = loadContract();
  for (const [group, legacy] of Object.entries(legacyPropNames())) {
    assert.deepEqual(Object.keys(c.props[group]).sort(), [...legacy].sort(), group);
  }
});

test('emotes name statuses, never frame indices (I-1)', () => {
  const c = loadContract();
  assert.deepEqual(c.emotes.icons.statuses,
    ['work', 'task_running', 'task_done', 'chat_npc', 'rest', 'error']);
  assert.equal(JSON.stringify(c).includes('byStatus'), false);
});

test('character geometry is 16x32 with four directions of six frames', () => {
  const c = loadContract();
  assert.equal(c.characters.frameWidth, 16);
  assert.equal(c.characters.frameHeight, 32);
  assert.equal(c.characters.anims.walk.framesPerDirection, 6);
  assert.equal(c.characters.anims.walk.directions, 4);
});

test('allNames() is unique and covers every class', () => {
  const names = loadContract().allNames();
  assert.equal(new Set(names).size, names.length, 'duplicate name in contract');
  assert.ok(names.includes('grass'));           // ground
  assert.ok(names.includes('office_building')); // district prop
  assert.ok(names.includes('bookshelf_a'));     // interior prop
  assert.ok(names.includes('coffee_steam'));    // animated
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="contract loads"`
Expected: FAIL — `Cannot find module '.../scripts/lib/assetContract.mjs'`.

- [ ] **Step 3: Snapshot the lists the contract must reproduce**

`scripts/snapshot-legacy-names.mjs`:

```js
#!/usr/bin/env node
/**
 * Extracts the asset name lists from the code this plan replaces, into a
 * committed snapshot the contract is reconciled against.
 *
 * Extraction, not transcription: a name typed twice by hand proves nothing.
 * The snapshot outlives its sources (Task 19 retires the build scripts,
 * Task 24 deletes the config.ts lists), which is why it is committed.
 *
 * Re-record deliberately, never incidentally:
 *   UPDATE_GOLDEN=1 node scripts/snapshot-legacy-names.mjs
 * Without the flag it verifies and exits non-zero on any difference.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const OUT = join(ROOT, 'test', 'golden', 'legacy-names.json');

const find = (...rel) => rel.map(r => join(ROOT, r)).find(existsSync);

/** `['name', SHEET, tx, ty]` tuples from an ATLAS_TILES array literal. */
function atlasTiles(file) {
  const src = readFileSync(file, 'utf8');
  const block = src.match(/const ATLAS_TILES\s*=\s*\[([\s\S]*?)\n\];/);
  if (!block) throw new Error(`no ATLAS_TILES in ${file}`);
  return [...block[1].matchAll(/\[\s*'([^']+)'/g)].map(m => m[1]);
}

/** A `const NAME = [ 'a', 'b' ] as const;` string array from config.ts. */
function stringList(src, name) {
  const block = src.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const;`));
  if (!block) throw new Error(`no ${name} in config.ts`);
  return [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

const districtScript = find('test/golden/legacy/build-district.mjs', 'scripts/build-district.mjs');
const interiorsScript = find('test/golden/legacy/build-interiors.mjs', 'scripts/build-interiors.mjs');
const configTs = find('packages/client/src/game/config.ts');

if (!districtScript || !interiorsScript || !configTs) {
  if (existsSync(OUT)) { console.log('legacy sources gone; snapshot already recorded — nothing to do'); process.exit(0); }
  console.error('error: legacy sources are gone and no snapshot exists');
  process.exit(1);
}

const config = readFileSync(configTs, 'utf8');
const snapshot = {
  source: {
    district_ground: districtScript.replace(`${ROOT}/`, ''),
    interiors_ground: interiorsScript.replace(`${ROOT}/`, ''),
    props: configTs.replace(`${ROOT}/`, ''),
  },
  atlasTiles: {
    district_ground: atlasTiles(districtScript),
    interiors_ground: atlasTiles(interiorsScript),
  },
  propNames: {
    district: stringList(config, 'DISTRICT_IMAGES'),
    interior: stringList(config, 'INTERIOR_IMAGES'),
  },
};

const next = JSON.stringify(snapshot, null, 2) + '\n';
if (process.env.UPDATE_GOLDEN === '1' || !existsSync(OUT)) {
  writeFileSync(OUT, next);
  console.log(`legacy names snapshot: ${snapshot.atlasTiles.district_ground.length}+${snapshot.atlasTiles.interiors_ground.length} tiles, ${snapshot.propNames.district.length}+${snapshot.propNames.interior.length} props -> ${OUT.replace(`${ROOT}/`, '')}`);
} else if (readFileSync(OUT, 'utf8') !== next) {
  console.error('error: legacy sources changed since the snapshot was recorded.');
  console.error('       Review the diff, then re-record with UPDATE_GOLDEN=1.');
  process.exit(1);
} else {
  console.log('legacy names snapshot: unchanged');
}
```

`test/helpers/legacySource.mjs`:

```js
/**
 * The committed snapshot of the name lists the contract replaces.
 * Reading a file, not re-parsing source, so these keep working after
 * Task 19 and Task 24 delete the originals.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './siblingRepo.mjs';

const snapshot = JSON.parse(
  readFileSync(join(REPO_ROOT, 'test', 'golden', 'legacy-names.json'), 'utf8'));

export const legacyAtlasTiles = () => snapshot.atlasTiles;
export const legacyPropNames = () => snapshot.propNames;
```

Run it, and wire it into `package.json` `"scripts"`:

```json
    "golden:names": "node scripts/snapshot-legacy-names.mjs",
```

Run: `npm run golden:names`
Expected: `legacy names snapshot: 23+13 tiles, 32+36 props -> test/golden/legacy-names.json`. Those numbers come out of the code; if they differ, the code differs, and the contract in Step 4 must match whatever the snapshot says.

- [ ] **Step 4: Write the contract**

`contract/assets.contract.json`. Ground-atlas tile order is transcribed from `ATLAS_TILES` in `build-district.mjs:29-53` and `build-interiors.mjs:30-40` — **order defines GID, so it must not change**. Prop names come from `config.ts:169-179` and `config.ts:156-166`.

```json
{
  "schemaVersion": 1,
  "tileSize": 16,
  "groundAtlases": {
    "district_ground": {
      "columns": 8,
      "tiles": [
        "grass", "grassA", "grassB",
        "sideA", "sideB", "sideC", "sideD",
        "asphA", "asphB", "asphC", "asphD",
        "dashH", "dashV",
        "zebHa1", "zebHb1", "zebHa2", "zebHb2",
        "zebVa1", "zebVb1", "zebVa2", "zebVb2",
        "dirt", "dirtA"
      ]
    },
    "interiors_ground": {
      "columns": 8,
      "tiles": [
        "border",
        "wallOfficeA", "wallOfficeB",
        "wallCafeA", "wallCafeB",
        "wallDormA", "wallDormB",
        "wallLibA", "wallLibB",
        "floorOffice", "floorCafe", "floorDorm", "floorLib"
      ]
    }
  },
  "props": {
    "district": {
      "office_building":   { "maxSize": [208, 320] },
      "cafe_building":     { "maxSize": [128, 208] },
      "villa_building":    { "maxSize": [168, 240] },
      "library_building":  { "maxSize": [144, 160] },
      "barn":              { "maxSize": [144, 176] },
      "tree_oak_big":      { "maxSize": [96, 112] },
      "tree_oak_med":      { "maxSize": [80, 96] },
      "tree_birch":        { "maxSize": [64, 80] },
      "street_lamp":       { "maxSize": [48, 80] },
      "bench":             { "maxSize": [48, 48] },
      "trash_can":         { "maxSize": [48, 48] },
      "hydrant":           { "maxSize": [32, 48] },
      "car_right_1":       { "maxSize": [80, 64] },
      "car_left_1":        { "maxSize": [80, 64] },
      "car_right_2":       { "maxSize": [80, 64] },
      "car_down_1":        { "maxSize": [80, 64] },
      "car_down_2":        { "maxSize": [80, 64] },
      "bush_1":            { "maxSize": [32, 32] },
      "bush_2":            { "maxSize": [32, 32] },
      "crop_cabbage":      { "maxSize": [32, 32] },
      "crop_berry":        { "maxSize": [32, 32] },
      "soil_left":         { "maxSize": [32, 48] },
      "soil_mid":          { "maxSize": [32, 48] },
      "soil_right":        { "maxSize": [32, 48] },
      "fence_top_left":      { "maxSize": [32, 32] },
      "fence_top_middle":    { "maxSize": [32, 32] },
      "fence_top_right":     { "maxSize": [32, 32] },
      "fence_middle_left":   { "maxSize": [32, 32] },
      "fence_middle_right":  { "maxSize": [32, 32] },
      "fence_bottom_left":   { "maxSize": [32, 32] },
      "fence_bottom_middle": { "maxSize": [32, 32] },
      "fence_bottom_right":  { "maxSize": [32, 32] }
    },
    "interior": {
      "bed_green":       { "maxSize": [48, 64] },
      "bed_blue":        { "maxSize": [48, 64] },
      "bed_teal":        { "maxSize": [48, 64] },
      "nightstand":      { "maxSize": [32, 32] },
      "rug_pink":        { "maxSize": [48, 48] },
      "chair_blue_r":    { "maxSize": [24, 40] },
      "chair_blue_l":    { "maxSize": [24, 40] },
      "chair_red_r":     { "maxSize": [24, 40] },
      "chair_red_l":     { "maxSize": [24, 40] },
      "chair_yellow_r":  { "maxSize": [24, 40] },
      "chair_yellow_l":  { "maxSize": [24, 40] },
      "table_plain":     { "maxSize": [48, 48] },
      "armchair_grey_r": { "maxSize": [32, 48] },
      "armchair_grey_l": { "maxSize": [32, 48] },
      "armchair_blue_r": { "maxSize": [32, 48] },
      "armchair_blue_l": { "maxSize": [32, 48] },
      "lamp_red":        { "maxSize": [24, 48] },
      "plant_palm":      { "maxSize": [32, 64] },
      "bookshelf_a":     { "maxSize": [48, 64] },
      "bookshelf_b":     { "maxSize": [48, 64] },
      "bookshelf_narrow":{ "maxSize": [16, 64] },
      "lectern":         { "maxSize": [32, 48] },
      "globe":           { "maxSize": [16, 32] },
      "chalkboard":      { "maxSize": [32, 48] },
      "counter_wide":    { "maxSize": [64, 32] },
      "stool":           { "maxSize": [16, 16] },
      "doormat":         { "maxSize": [32, 48] },
      "plant_small":     { "maxSize": [32, 32] },
      "plant_pot":       { "maxSize": [32, 32] },
      "office_chair_right": { "maxSize": [32, 48] },
      "office_chair_left":  { "maxSize": [32, 48] },
      "whiteboard":      { "maxSize": [48, 48] },
      "printer":         { "maxSize": [32, 48] },
      "workstation_single": { "maxSize": [48, 48] },
      "workstation_double": { "maxSize": [80, 48] },
      "coffee_machine":  { "maxSize": [32, 48] }
    }
  },
  "characters": {
    "frameWidth": 16,
    "frameHeight": 32,
    "directionOrder": ["right", "up", "left", "down"],
    "parts": ["body", "eyes", "hair", "outfit", "accessory"],
    "anims": {
      "idle":  { "framesPerDirection": 6, "directions": 4 },
      "walk":  { "framesPerDirection": 6, "directions": 4 },
      "sit":   { "framesPerDirection": 6, "sides": ["right", "left"] },
      "sleep": { "framesPerDirection": 6 }
    }
  },
  "animatedObjects": {
    "coffee_steam":  { "frameWidth": 16, "frameHeight": 32, "frames": 6,  "frameRate": 4 },
    "cake_fridge":   { "frameWidth": 32, "frameHeight": 48, "frames": 14, "frameRate": 3 },
    "tv_news":       { "frameWidth": 32, "frameHeight": 32, "frames": 36, "frameRate": 5 },
    "office_screen": { "frameWidth": 32, "frameHeight": 32, "frames": 6,  "frameRate": 3 },
    "cuckoo_clock":  { "frameWidth": 16, "frameHeight": 32, "frames": 10, "frameRate": 4 }
  },
  "emotes": {
    "think": { "frameWidth": 16, "frameHeight": 32, "appearFrames": 4, "loopFrames": 2, "frameRate": 6 },
    "icons": {
      "frameWidth": 16,
      "frameHeight": 16,
      "frameRate": 2,
      "statuses": ["work", "task_running", "task_done", "chat_npc", "rest", "error"]
    }
  }
}
```

Note what is **absent**: no file paths, no `x/y/w/h`, no `byStatus` frame indices. Frame indices are pack-specific and live in the adapter (Task 7) — moving them out of `assetManifest.ts:211-218` is exactly what I-1 requires. `maxSize` is an upper bound for layout sanity, not an assertion; true sizes come from baked bitmaps (spec §5.1).

- [ ] **Step 5: Write the loader**

`scripts/lib/assetContract.mjs`:

```js
/**
 * Loads and shallow-validates contract/assets.contract.json.
 * The contract names things and their shape; it never names a file or a
 * coordinate (I-1). Anything pack-specific belongs in sources/<pack>.json.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

export function loadContract(path = join(ROOT, 'contract', 'assets.contract.json')) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));

  if (raw.schemaVersion !== 1) throw new Error(`unsupported contract schemaVersion ${raw.schemaVersion}`);
  if (raw.tileSize !== 16) throw new Error(`unsupported tileSize ${raw.tileSize}`);
  for (const [id, atlas] of Object.entries(raw.groundAtlases)) {
    if (!Array.isArray(atlas.tiles) || atlas.tiles.length === 0) throw new Error(`atlas ${id} has no tiles`);
    if (new Set(atlas.tiles).size !== atlas.tiles.length) throw new Error(`atlas ${id} has duplicate tiles`);
  }

  return {
    ...raw,
    /** Every name the active adapter must resolve. Order is stable. */
    allNames() {
      const names = [];
      for (const atlas of Object.values(raw.groundAtlases)) names.push(...atlas.tiles);
      for (const group of Object.values(raw.props)) names.push(...Object.keys(group));
      names.push(...Object.keys(raw.animatedObjects));
      names.push('emote_sheet', 'ui_sheet');
      for (const part of raw.characters.parts) names.push(`char_${part}`);
      return names;
    },
    /** gid for a tile name in a given atlas. gid = index + 1, per the .tmj convention. */
    gidOf(atlasId, tileName) {
      const i = raw.groundAtlases[atlasId].tiles.indexOf(tileName);
      if (i < 0) throw new Error(`tile ${tileName} not in atlas ${atlasId}`);
      return i + 1;
    },
  };
}
```

- [ ] **Step 6: Run tests**

Run: `npm test && npm run golden:names`
Expected: PASS — 6 new tests, including the two reconciliation tests proving the contract reproduces the legacy lists in order; `legacy names snapshot: unchanged`.

- [ ] **Step 7: Commit**

```bash
git add contract/assets.contract.json scripts/lib/assetContract.mjs scripts/snapshot-legacy-names.mjs test/golden/legacy-names.json test/helpers/legacySource.mjs package.json test/asset-contract.test.mjs
git commit -m "feat(contract): pack-agnostic asset contract, loader, and reconciliation against the lists it replaces"
```

## Task 4a: The pack index — what is actually in there

Before anyone can choose a sprite, something has to enumerate the candidates. Four LimeZu packs hold on the order of 15,000 16×16 cells; `scripts/inspect-assets.mjs` prints sheet dimensions and `png-grid.mjs` prints an occupancy map for one sheet at a time, and both were built to be read by a human once. Neither produces an artifact.

That is why curation is currently invisible: a rect in `sources/limezu.json` is the *answer* to a question nobody wrote down, chosen from a candidate set nobody enumerated.

**Two outputs, deliberately different in size and lifetime:**

| File | Contents | Committed? |
|---|---|---|
| `sources/<pack>.sheets.json` | One row per sheet: path, dimensions, `sha256` of the file | **Yes** — small, diffable, and the thing that catches a pack update |
| `sources/<pack>.index.json` | Every non-empty cell in every sheet: bbox, trimmed size, opaque-pixel count, dominant palette, crop hash | **No** — regenerable, large, a browsing aid |

The sheets manifest is the important one. It is a few hundred lines, it lives in git, and when LimeZu ships an update it shows as a diff naming exactly which sheets moved — which is the signal that some crops need re-reviewing.

**Files:**
- Create: `scripts/index-pack.mjs`
- Modify: `package.json` — `pack:index` script
- Modify: `.gitignore` — ignore `sources/*.index.json`
- Test: `test/bake/pack-index.test.mjs`

**Interfaces:**
- Consumes: `decodePng` from `scripts/png-lib.mjs`, `loadContract()` (Task 4) for `tileSize`.
- Produces `scripts/index-pack.mjs`:
  - `indexPack({ srcRoot, tileSize, out }) → { sheets, cells }`
  - `cellSignature(img, x, y, w, h) → { trimmed, opaque, palette, sha256 } | null` — `null` for a fully transparent cell
  - CLI `npm run pack:index [pack] [srcRoot]`, default `fixture`

- [ ] **Step 1: Write the failing test**

`test/bake/pack-index.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { indexPack, cellSignature } from '../../scripts/index-pack.mjs';
import { decodePng } from '../../scripts/png-lib.mjs';
import { loadContract } from '../../scripts/lib/assetContract.mjs';

const c = loadContract();
const run = () => indexPack({
  srcRoot: 'test/fixtures/pack-src',
  tileSize: c.tileSize,
  out: mkdtempSync(join(tmpdir(), 'pack-index-')),
});

test('every PNG in the pack is inventoried', () => {
  const { sheets } = run();
  assert.ok(Object.keys(sheets).length > 0);
  for (const [path, s] of Object.entries(sheets)) {
    assert.match(path, /\.png$/);
    assert.ok(s.w > 0 && s.h > 0, path);
    assert.match(s.sha256, /^[0-9a-f]{64}$/, path);
  }
});

test('sheet paths are relative and forward-slashed, so the manifest is portable', () => {
  for (const path of Object.keys(run().sheets)) {
    assert.equal(path.startsWith('/'), false, path);
    assert.equal(path.includes('\\'), false, path);
  }
});

test('a fully transparent cell is not a candidate', () => {
  // The fixture insets every block by 1px, so the corner cell of a big sprite
  // has content but a 1px-wide slice of the margin does not.
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  assert.equal(cellSignature(img, 0, 0, 1, 1), null, 'transparent margin counted as a candidate');
  assert.ok(cellSignature(img, 0, 0, 16, 16), 'the tile itself should be a candidate');
});

test('a candidate reports its trimmed bounds, not the cell it sits in', () => {
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  const cell = cellSignature(img, 0, 0, 16, 16);
  // 1px transparent margin on every side
  assert.deepEqual(cell.trimmed, { x: 1, y: 1, w: 14, h: 14 });
  assert.equal(cell.opaque, 14 * 14);
});

test('the palette is the dominant colours, most-used first', () => {
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  const { palette } = cellSignature(img, 0, 0, 16, 16);
  assert.ok(palette.length >= 1 && palette.length <= 4);
  for (const c of palette) assert.match(c, /^#[0-9a-f]{6}$/);
});

test('the crop hash is stable and content-addressed', () => {
  const img = decodePng('test/fixtures/pack-src/tiles/grass.png');
  const a = cellSignature(img, 0, 0, 16, 16);
  const b = cellSignature(img, 0, 0, 16, 16);
  assert.equal(a.sha256, b.sha256);
  // A different tile must hash differently — colours are derived from the name.
  const other = cellSignature(decodePng('test/fixtures/pack-src/tiles/dirt.png'), 0, 0, 16, 16);
  assert.notEqual(a.sha256, other.sha256);
});

test('the index reports candidates as well as sheets', () => {
  const { cells } = run();
  const total = Object.values(cells).reduce((n, list) => n + list.length, 0);
  assert.ok(total >= Object.keys(run().sheets).length,
    'every non-empty sheet should yield at least one candidate');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:bake -- --test-name-pattern="every PNG in the pack is inventoried"`
Expected: FAIL — `Cannot find module '.../scripts/index-pack.mjs'`.

- [ ] **Step 3: Write the indexer**

`scripts/index-pack.mjs`:

```js
#!/usr/bin/env node
/**
 * Inventories an art pack, so choosing a sprite starts from a candidate list
 * instead of from someone's memory of what they scrolled past.
 *
 * Two outputs, on purpose:
 *
 *   sources/<pack>.sheets.json   COMMITTED. One row per sheet with a file
 *       hash. Small and diffable: when a pack ships an update, this file's
 *       diff names exactly which sheets moved, which is the signal that the
 *       crops taken from them need re-reviewing.
 *
 *   sources/<pack>.index.json    GITIGNORED. Every non-empty cell, with its
 *       trimmed bounds, opaque-pixel count, dominant palette and crop hash.
 *       Regenerable, large, and used for browsing while curating.
 *
 *   node scripts/index-pack.mjs [pack] [srcRoot]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './png-lib.mjs';
import { loadContract } from './lib/assetContract.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

/** Every .png under a directory, as forward-slashed relative paths, sorted. */
function pngsUnder(root) {
  const out = [];
  (function walk(d) {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.toLowerCase().endsWith('.png')) out.push(relative(root, p).split('\\').join('/'));
    }
  })(root);
  return out.sort();
}

/**
 * What a candidate cell looks like. Returns null when the cell is entirely
 * transparent — an empty cell is not a candidate, and most of a tilesheet is
 * empty.
 *
 * `palette` is quantised to 5 bits per channel before counting, so two shades
 * a human reads as "the same brown" group together instead of producing four
 * near-identical entries.
 */
export function cellSignature(img, x, y, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1, opaque = 0;
  const counts = new Map();

  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const p = img.px(x + xx, y + yy);
      if (p[3] <= 8) continue;                 // same alpha threshold as SpriteReader
      opaque++;
      if (xx < minX) minX = xx;
      if (xx > maxX) maxX = xx;
      if (yy < minY) minY = yy;
      if (yy > maxY) maxY = yy;
      const key = ((p[0] >> 3) << 10) | ((p[1] >> 3) << 5) | (p[2] >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  if (maxX < 0) return null;

  const hex = key => '#' + [(key >> 10) & 31, (key >> 5) & 31, key & 31]
    .map(v => (v << 3).toString(16).padStart(2, '0')).join('');
  const palette = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 4)
    .map(([key]) => hex(key));

  // Hash the TRIMMED pixels: the same sprite at a different offset in a
  // re-laid-out sheet still hashes the same, which is what makes the adapter's
  // `pin` field survive a cosmetic pack reshuffle.
  const hash = createHash('sha256');
  const row = Buffer.alloc((maxX - minX + 1) * 4);
  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      const p = img.px(x + xx, y + yy);
      const i = (xx - minX) * 4;
      row[i] = p[0]; row[i + 1] = p[1]; row[i + 2] = p[2]; row[i + 3] = p[3];
    }
    hash.update(row);
  }

  return {
    trimmed: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    opaque,
    palette,
    sha256: hash.digest('hex'),
  };
}

export function indexPack({ srcRoot, tileSize = 16, out }) {
  const root = resolve(ROOT, srcRoot);
  const sheets = {};
  const cells = {};

  for (const rel of pngsUnder(root)) {
    const file = join(root, rel);
    sheets[rel] = {
      ...(({ w, h }) => ({ w, h }))(decodePng(file)),
      sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
    };

    const img = decodePng(file);
    const list = [];

    // A sheet smaller than two cells in both axes is a single sprite, not a
    // grid — the packs ship hundreds of those under Singles/ directories.
    const single = img.w < tileSize * 2 && img.h < tileSize * 2;
    const step = single ? Math.max(img.w, img.h) : tileSize;

    for (let y = 0; y < img.h; y += step) {
      for (let x = 0; x < img.w; x += step) {
        const w = Math.min(step, img.w - x);
        const h = Math.min(step, img.h - y);
        const sig = cellSignature(img, x, y, w, h);
        if (sig) list.push({ x, y, w, h, ...sig });
      }
    }
    if (list.length) cells[rel] = list;
  }

  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'sheets.json'), JSON.stringify(sheets, null, 2) + '\n');
    writeFileSync(join(out, 'index.json'), JSON.stringify(cells, null, 2) + '\n');
  }
  return { sheets, cells };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pack = process.argv[2] ?? 'fixture';
  const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');
  const { sheets, cells } = indexPack({ srcRoot, tileSize: loadContract().tileSize });

  writeFileSync(join(ROOT, 'sources', `${pack}.sheets.json`), JSON.stringify(sheets, null, 2) + '\n');
  writeFileSync(join(ROOT, 'sources', `${pack}.index.json`), JSON.stringify(cells, null, 2) + '\n');

  const candidates = Object.values(cells).reduce((n, l) => n + l.length, 0);
  console.log(`pack index: ${Object.keys(sheets).length} sheets, ${candidates} candidate cells -> sources/${pack}.{sheets,index}.json`);
}
```

- [ ] **Step 4: Wire the script and ignore the big file**

Root `package.json`, in `"scripts"`:

```json
    "pack:index": "node scripts/index-pack.mjs",
```

Append to `.gitignore`:

```
# Full per-cell pack inventory — regenerable browsing aid (npm run pack:index).
# The small sheets manifest beside it IS committed: its diff is how a pack
# update announces itself.
sources/*.index.json
```

- [ ] **Step 5: Index the fixture pack and run the tests**

Run: `npm run pack:index && npm run test:bake -- --test-name-pattern="pack"`
Expected: `pack index: <n> sheets, <m> candidate cells -> sources/fixture.{sheets,index}.json`, then 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add scripts/index-pack.mjs package.json .gitignore sources/fixture.sheets.json test/bake/pack-index.test.mjs
git commit -m "feat(curation): index a pack into a committed sheets manifest and a candidate inventory"
```

---


---

## Task 5: `sources/limezu.json` — ground atlas tiles

The first third of the largest mechanical task in this build (spec R-5). Transcribe `ATLAS_TILES` from both build scripts into adapter rects. **Every number here already exists in the repo** — read it from the source, never guess. The coordinates in the build scripts are in *tiles*; the adapter stores *pixels*, so multiply by 16.

**Files:**
- Create: `sources/limezu.json`
- Test: `test/source-limezu-ground.test.mjs`

**Interfaces:**
- Consumes: `loadContract().groundAtlases` (Task 4).
- Produces: `sources/limezu.json` with `{ pack, capabilities, files, rects }`. `files` is a short alias map so rects stay readable. Tasks 6 and 7 append to the same `rects` object.

A rect is `{ file, x, y, w, h, trim }` — everything but `file` optional; no `x/y/w/h` means "the whole file" (spec §5.2) — plus two optional curation fields:

- `note` — free text: why this sprite, what it beat, what went wrong last time. Tasks 5–7 carry the Russian build-script comments forward here; a reviewed crop change later adds its reason the same way.
- `pin` — the sha256 of the post-trim crop's pixels, absent (or `null`) until the pack is on disk. Filled and verified by `npm run pin` (Task 9); a crop whose pixels no longer match its pin fails `validate:contract` by name (Task 10).

`loadAdapter()` (Task 8) picks the keys it resolves with and ignores the rest, so both fields ride on the adapter with zero loader changes — one committed file per pack, and the reason travels with the rect it explains.

- [ ] **Step 1: Write the failing test**

`test/source-limezu-ground.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const src = JSON.parse(readFileSync('sources/limezu.json', 'utf8'));

test('the adapter declares its pack and capabilities', () => {
  assert.equal(src.pack, 'limezu');
  assert.equal(typeof src.capabilities.characterLayers, 'boolean');
});

test('every ground tile in the contract has a rect', () => {
  const c = loadContract();
  const missing = [];
  for (const atlas of Object.values(c.groundAtlases))
    for (const t of atlas.tiles) if (!src.rects[t]) missing.push(t);
  assert.deepEqual(missing, []);
});

test('ground rects are 16x16 and carry a file alias', () => {
  const c = loadContract();
  for (const atlas of Object.values(c.groundAtlases)) {
    for (const t of atlas.tiles) {
      const r = src.rects[t];
      assert.equal(r.w, 16, `${t} width`);
      assert.equal(r.h, 16, `${t} height`);
      assert.ok(src.files[r.file], `${t} names an unknown file alias ${r.file}`);
    }
  }
});

test('grass matches build-district.mjs ATLAS_TILES (TERR tile 1,12)', () => {
  assert.deepEqual(src.rects.grass, { file: 'terrains', x: 16, y: 192, w: 16, h: 16 });
});

test('border matches build-interiors.mjs ATLAS_TILES (RB tile 1,44)', () => {
  assert.deepEqual(src.rects.border, { file: 'room_builder', x: 16, y: 704, w: 16, h: 16 });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the adapter declares its pack"`
Expected: FAIL — `ENOENT: no such file or directory, open 'sources/limezu.json'`.

- [ ] **Step 3: Write the ground half of the adapter**

`sources/limezu.json`. Transcribed from `build-district.mjs:24-53` and `build-interiors.mjs:21-40`; tile coordinates × 16.

```json
{
  "pack": "limezu",
  "capabilities": { "characterLayers": true },
  "files": {
    "city_terrains": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/2_City_Terrains_16x16.png",
    "terrains": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/1_Terrains_and_Fences_16x16.png",
    "farm_terrains": "farm/16x16/1_Terrains_16x16.png",
    "villas": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/7_Villas_16x16.png",
    "room_builder": "interiors/1_Interiors/16x16/Room_Builder_16x16.png",
    "bedroom": "interiors/1_Interiors/16x16/Theme_Sorter/4_Bedroom_16x16.png",
    "livingroom": "interiors/1_Interiors/16x16/Theme_Sorter/2_LivingRoom_16x16.png",
    "classroom": "interiors/1_Interiors/16x16/Theme_Sorter/5_Classroom_and_library_16x16.png",
    "kitchen": "interiors/1_Interiors/16x16/Theme_Sorter/12_Kitchen_16x16.png"
  },
  "rects": {
    "grass":  { "file": "terrains", "x": 16,  "y": 192, "w": 16, "h": 16 },
    "grassA": { "file": "terrains", "x": 48,  "y": 80,  "w": 16, "h": 16 },
    "grassB": { "file": "terrains", "x": 64,  "y": 80,  "w": 16, "h": 16 },
    "sideA":  { "file": "city_terrains", "x": 144, "y": 0,  "w": 16, "h": 16 },
    "sideB":  { "file": "city_terrains", "x": 160, "y": 0,  "w": 16, "h": 16 },
    "sideC":  { "file": "city_terrains", "x": 176, "y": 0,  "w": 16, "h": 16 },
    "sideD":  { "file": "city_terrains", "x": 192, "y": 0,  "w": 16, "h": 16 },
    "asphA":  { "file": "city_terrains", "x": 0,  "y": 64, "w": 16, "h": 16 },
    "asphB":  { "file": "city_terrains", "x": 16, "y": 64, "w": 16, "h": 16 },
    "asphC":  { "file": "city_terrains", "x": 32, "y": 64, "w": 16, "h": 16 },
    "asphD":  { "file": "city_terrains", "x": 48, "y": 64, "w": 16, "h": 16 },
    "dashH":  { "file": "city_terrains", "x": 192, "y": 96, "w": 16, "h": 16 },
    "dashV":  { "file": "city_terrains", "x": 176, "y": 96, "w": 16, "h": 16 },
    "zebHa1": { "file": "city_terrains", "x": 112, "y": 64,  "w": 16, "h": 16 },
    "zebHb1": { "file": "city_terrains", "x": 128, "y": 64,  "w": 16, "h": 16 },
    "zebHa2": { "file": "city_terrains", "x": 112, "y": 80,  "w": 16, "h": 16 },
    "zebHb2": { "file": "city_terrains", "x": 128, "y": 80,  "w": 16, "h": 16 },
    "zebVa1": { "file": "city_terrains", "x": 80,  "y": 96,  "w": 16, "h": 16 },
    "zebVb1": { "file": "city_terrains", "x": 96,  "y": 96,  "w": 16, "h": 16 },
    "zebVa2": { "file": "city_terrains", "x": 80,  "y": 112, "w": 16, "h": 16 },
    "zebVb2": { "file": "city_terrains", "x": 96,  "y": 112, "w": 16, "h": 16 },
    "dirt":   { "file": "farm_terrains", "x": 288, "y": 80, "w": 16, "h": 16 },
    "dirtA":  { "file": "farm_terrains", "x": 304, "y": 80, "w": 16, "h": 16 },

    "border":      { "file": "room_builder", "x": 16, "y": 704, "w": 16, "h": 16 },
    "wallOfficeA": { "file": "room_builder", "x": 16, "y": 336, "w": 16, "h": 16 },
    "wallOfficeB": { "file": "room_builder", "x": 16, "y": 352, "w": 16, "h": 16 },
    "wallCafeA":   { "file": "room_builder", "x": 16, "y": 272, "w": 16, "h": 16 },
    "wallCafeB":   { "file": "room_builder", "x": 16, "y": 288, "w": 16, "h": 16 },
    "wallDormA":   { "file": "room_builder", "x": 16, "y": 176, "w": 16, "h": 16 },
    "wallDormB":   { "file": "room_builder", "x": 16, "y": 192, "w": 16, "h": 16 },
    "wallLibA":    { "file": "room_builder", "x": 16, "y": 592, "w": 16, "h": 16 },
    "wallLibB":    { "file": "room_builder", "x": 16, "y": 608, "w": 16, "h": 16 },
    "floorOffice": { "file": "room_builder", "x": 544, "y": 176, "w": 16, "h": 16 },
    "floorCafe":   { "file": "room_builder", "x": 672, "y": 176, "w": 16, "h": 16 },
    "floorDorm":   { "file": "room_builder", "x": 624, "y": 384, "w": 16, "h": 16 },
    "floorLib":    { "file": "room_builder", "x": 672, "y": 304, "w": 16, "h": 16 }
  }
}
```

`capabilities.characterLayers` is `true`: U-1 was answered first-hand against the purchased packs (art-pack QA, 2026-07-29) — the Character Generator ships separable Bodies/Eyes/Hairstyles/Outfits/Accessories layer sheets, so the layered path ships. The palette-remap branch in Task 27 survives as the documented fallback for a pack without layers.

The `files` paths are the **real pack paths** — no symlink compatibility layer stands between the adapter and `assets-src/`. (The legacy QA symlinks are deleted in Plan 6 Task 3b, after the golden baseline is captured.)

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 5 new tests. `every ground tile in the contract has a rect` proves the 36 ground names are covered.

- [ ] **Step 5: Commit**

```bash
git add sources/limezu.json test/source-limezu-ground.test.mjs
git commit -m "feat(adapter): migrate ground-atlas crop coordinates into sources/limezu.json"
```

---

## Task 6: `sources/limezu.json` — district props

32 names from `config.ts:169-179`. Two are special and the transcription must preserve that: `villa_building` is a *crop* from `7_Villas_16x16.png` (`build-district.mjs:71`), and `library_building` is a *generated* sprite — the pack has no book shop, so `build-district.mjs:96-126` stamps a "BOOKS" plate onto a hardware-store PNG. Generated props get a `"generated"` key instead of a rect.

**Files:**
- Modify: `sources/limezu.json` — extend `files` and `rects`
- Test: `test/source-limezu-district.test.mjs`

**Interfaces:**
- Consumes: Task 5's `sources/limezu.json`.
- Produces: a rect (or `{ "generated": "<generator name>" }`) for each of the 32 district prop names. The one generator name introduced is `"bookSign"`, implemented in Task 12.

- [ ] **Step 1: Write the failing test**

`test/source-limezu-district.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const src = JSON.parse(readFileSync('sources/limezu.json', 'utf8'));
const c = loadContract();

test('every district prop resolves to a rect or a generator', () => {
  // No count assertion: Task 4 already reconciles the contract against the
  // snapshot of DISTRICT_IMAGES. Here the only claim is total coverage.
  const missing = Object.keys(c.props.district).filter(n => !src.rects[n]);
  assert.deepEqual(missing, []);
  assert.ok(Object.keys(c.props.district).length > 0, 'contract declares no district props');
});

test('whole-file props carry a file alias and no x/y/w/h', () => {
  const r = src.rects.office_building;
  assert.ok(src.files[r.file]);
  assert.equal(r.x, undefined);
  assert.equal(r.w, undefined);
});

test('villa_building keeps build-district.mjs region 152,216 148x232', () => {
  assert.deepEqual(src.rects.villa_building,
    { file: 'villas', x: 152, y: 216, w: 148, h: 232, trim: true });
});

test('library_building is generated, not cropped — the pack has no book shop', () => {
  assert.equal(src.rects.library_building.generated, 'bookSign');
  assert.ok(src.files[src.rects.library_building.file], 'generator still needs a base file');
});

test('every rect file alias is declared', () => {
  for (const [name, r] of Object.entries(src.rects))
    assert.ok(src.files[r.file], `${name} names unknown alias ${r.file}`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="every district prop resolves"`
Expected: FAIL — `missing` lists every district prop name.

- [ ] **Step 3: Extend the adapter**

Add these aliases to `sources/limezu.json` `"files"` (the file *choices* are transcribed from `sync-assets.mjs:79-109`; the paths are the **real pack paths** verified on disk 2026-07-29, not the legacy symlink shortcuts that script uses):

```json
    "office_single":     "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/16_Office_Singles_16x16/ME_Singles_Office_16x16_Example_1.png",
    "market_single":     "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/9_Shopping_Center_and_Markets_Singles_16x16/ME_Singles_Shopping_Center_and_Markets_16x16_Market_Big_1.png",
    "hardware_single":   "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/4_Generic_Building_Singles_16x16/ME_Singles_Generic_Building_16x16_Hardware_Store.png",
    "barn_single":       "farm/16x16/Single_Files_16x16/Props_and_Buildings_16x16/Barn_Small_16x16.png",
    "tree_oak_big_s":    "farm/16x16/Single_Files_16x16/Trees_16x16/Tree_Oak_Green_Big_16x16.png",
    "tree_oak_med_s":    "farm/16x16/Single_Files_16x16/Trees_16x16/Tree_Oak_Green_Medium_16x16.png",
    "tree_birch_s":      "farm/16x16/Single_Files_16x16/Trees_16x16/Tree_Birch_Green_Medium_16x16.png",
    "lamp_single":       "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/3_City_Props_Singles_16x16/ME_Singles_City_Props_16x16_Street_Lamp_1.png",
    "bench_single":      "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/3_City_Props_Singles_16x16/ME_Singles_City_Props_16x16_Bench_1.png",
    "trash_single":      "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/3_City_Props_Singles_16x16/ME_Singles_City_Props_16x16_Black_Closed_Trash_Can.png",
    "hydrant_single":    "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/3_City_Props_Singles_16x16/ME_Singles_City_Props_16x16_Hydrant_1.png",
    "car_r1_single":     "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Right_1.png",
    "car_l1_single":     "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Left_5.png",
    "car_r2_single":     "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Right_12.png",
    "car_d1_single":     "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Down_1.png",
    "car_d2_single":     "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/10_Vehicles_Singles_16x16/ME_Singles_Vehicles_16x16_Car_Down_12.png",
    "bush1_single":      "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/17_Garden_Singles_16x16/ME_Singles_Garden_16x16_Bush_1.png",
    "bush2_single":      "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/17_Garden_Singles_16x16/ME_Singles_Garden_16x16_Bush_4.png",
    "crop_cabbage_s":    "farm/16x16/Single_Files_16x16/Crops_16x16/Crop_Cabbage_Ripe_16x16.png",
    "crop_berry_s":      "farm/16x16/Single_Files_16x16/Crops_16x16/Crop_Berry_Ripe_16x16.png",
    "soil_left_s":       "farm/16x16/Single_Files_16x16/Fences_16x16/Topsoil_Arable_Small_Horizontal_Modular_Left_16x16.png",
    "soil_mid_s":        "farm/16x16/Single_Files_16x16/Fences_16x16/Topsoil_Arable_Small_Horizontal_Modular_Middle_16x16.png",
    "soil_right_s":      "farm/16x16/Single_Files_16x16/Fences_16x16/Topsoil_Arable_Small_Horizontal_Modular_Right_16x16.png",
    "fence_tl": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/24_Additional_Houses_Singles_16x16/24_Additional_Houses_Fence_1_Top_Left_16x16.png",
    "fence_tm": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/24_Additional_Houses_Singles_16x16/24_Additional_Houses_Fence_1_Top_Middle_16x16.png",
    "fence_tr": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/24_Additional_Houses_Singles_16x16/24_Additional_Houses_Fence_1_Top_Right_16x16.png",
    "fence_ml": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/24_Additional_Houses_Singles_16x16/24_Additional_Houses_Fence_1_Middle_Left_16x16.png",
    "fence_mr": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/24_Additional_Houses_Singles_16x16/24_Additional_Houses_Fence_1_Middle_Right_16x16.png",
    "fence_bl": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/24_Additional_Houses_Singles_16x16/24_Additional_Houses_Fence_1_Bottom_Left_16x16.png",
    "fence_bm": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/24_Additional_Houses_Singles_16x16/24_Additional_Houses_Fence_1_Bottom_Middle_16x16.png",
    "fence_br": "exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16/24_Additional_Houses_Singles_16x16/24_Additional_Houses_Fence_1_Bottom_Right_16x16.png"
```

Add these to `"rects"`. A rect with no `x/y/w/h` means "the whole file" (spec §5.2).

```json
    "office_building":  { "file": "office_single" },
    "cafe_building":    { "file": "market_single" },
    "villa_building":   { "file": "villas", "x": 152, "y": 216, "w": 148, "h": 232, "trim": true },
    "library_building": { "file": "hardware_single", "generated": "bookSign" },
    "barn":             { "file": "barn_single" },
    "tree_oak_big":     { "file": "tree_oak_big_s" },
    "tree_oak_med":     { "file": "tree_oak_med_s" },
    "tree_birch":       { "file": "tree_birch_s" },
    "street_lamp":      { "file": "lamp_single" },
    "bench":            { "file": "bench_single" },
    "trash_can":        { "file": "trash_single" },
    "hydrant":          { "file": "hydrant_single" },
    "car_right_1":      { "file": "car_r1_single" },
    "car_left_1":       { "file": "car_l1_single" },
    "car_right_2":      { "file": "car_r2_single" },
    "car_down_1":       { "file": "car_d1_single" },
    "car_down_2":       { "file": "car_d2_single" },
    "bush_1":           { "file": "bush1_single" },
    "bush_2":           { "file": "bush2_single" },
    "crop_cabbage":     { "file": "crop_cabbage_s" },
    "crop_berry":       { "file": "crop_berry_s" },
    "soil_left":        { "file": "soil_left_s" },
    "soil_mid":         { "file": "soil_mid_s" },
    "soil_right":       { "file": "soil_right_s" },
    "fence_top_left":      { "file": "fence_tl" },
    "fence_top_middle":    { "file": "fence_tm" },
    "fence_top_right":     { "file": "fence_tr" },
    "fence_middle_left":   { "file": "fence_ml" },
    "fence_middle_right":  { "file": "fence_mr" },
    "fence_bottom_left":   { "file": "fence_bl" },
    "fence_bottom_middle": { "file": "fence_bm" },
    "fence_bottom_right":  { "file": "fence_br" }
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS — 5 new tests, and Task 5's `every rect file alias is declared` still passes.

- [ ] **Step 5: Commit**

```bash
git add sources/limezu.json test/source-limezu-district.test.mjs
git commit -m "feat(adapter): migrate district prop sources into sources/limezu.json"
```

---

## Task 7: `sources/limezu.json` — interior furniture, characters, emotes, animated objects

The last and largest third. 27 furniture rects come from `FURNITURE` in `build-interiors.mjs:63-100` — those coordinates were re-verified against the current sheets under ТЗ-08 and the Russian comments explain *why* each one is where it is. Preserve those comments as `"note"` fields; they are the record of what went wrong last time.

This task also moves the emote frame indices out of `assetManifest.ts:211-218` — the coupling I-1 names explicitly.

**Files:**
- Modify: `sources/limezu.json`
- Test: `test/source-limezu-interior.test.mjs`

**Interfaces:**
- Consumes: Task 6's `sources/limezu.json`.
- Produces: rects for all 36 interior props, the five animated objects, `emote_sheet`, `ui_sheet`, the five `char_*` part slots, plus a top-level `"emoteFrames"` object mapping each contract status to a `[a, b]` frame pair.

- [ ] **Step 1: Write the failing test**

`test/source-limezu-interior.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const src = JSON.parse(readFileSync('sources/limezu.json', 'utf8'));
const c = loadContract();

test('every interior prop resolves', () => {
  const missing = Object.keys(c.props.interior).filter(n => !src.rects[n]);
  assert.deepEqual(missing, []);
  assert.ok(Object.keys(c.props.interior).length > 0, 'contract declares no interior props');
});

test('chair_red_r keeps build-interiors.mjs region 81,224 14x32', () => {
  const r = src.rects.chair_red_r;
  assert.equal(r.file, 'bedroom');
  assert.deepEqual([r.x, r.y, r.w, r.h], [81, 224, 14, 32]);
  assert.equal(r.trim, true);
});

test('counter_wide keeps region 192,268 52x22 from the kitchen sheet', () => {
  const r = src.rects.counter_wide;
  assert.equal(r.file, 'kitchen');
  assert.deepEqual([r.x, r.y, r.w, r.h], [192, 268, 52, 22]);
});

test('every animated object in the contract resolves', () => {
  const missing = Object.keys(c.animatedObjects).filter(n => !src.rects[n]);
  assert.deepEqual(missing, []);
});

test('emote frame indices live in the adapter, not the contract (I-1)', () => {
  assert.deepEqual(Object.keys(src.emoteFrames).sort(), [...c.emotes.icons.statuses].sort());
  for (const [status, pair] of Object.entries(src.emoteFrames)) {
    assert.equal(pair.length, 2, `${status} needs a two-frame pulse`);
    assert.ok(Number.isInteger(pair[0]) && Number.isInteger(pair[1]));
  }
});

test('emoteFrames matches the verified assetManifest byStatus layout', () => {
  assert.deepEqual(src.emoteFrames, {
    work: [44, 45], task_running: [40, 41], task_done: [64, 65],
    chat_npc: [66, 67], rest: [56, 57], error: [50, 51],
  });
});

test('contract.allNames() is fully covered by the adapter (I-2 precondition)', () => {
  const unresolved = c.allNames().filter(n => !src.rects[n]);
  assert.deepEqual(unresolved, []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="every interior prop resolves"`
Expected: FAIL — `missing` lists every interior prop name.

- [ ] **Step 3: Extend `files`**

```json
    "office_singles_99":  "office/4_Modern_Office_singles/16x16/Modern_Office_Singles_99.png",
    "office_singles_100": "office/4_Modern_Office_singles/16x16/Modern_Office_Singles_100.png",
    "office_singles_103": "office/4_Modern_Office_singles/16x16/Modern_Office_Singles_103.png",
    "office_singles_104": "office/4_Modern_Office_singles/16x16/Modern_Office_Singles_104.png",
    "office_singles_116": "office/4_Modern_Office_singles/16x16/Modern_Office_Singles_116.png",
    "office_singles_156": "office/4_Modern_Office_singles/16x16/Modern_Office_Singles_156.png",
    "office_singles_225": "office/4_Modern_Office_singles/16x16/Modern_Office_Singles_225.png",
    "office_singles_227": "office/4_Modern_Office_singles/16x16/Modern_Office_Singles_227.png",
    "office_singles_323": "office/4_Modern_Office_singles/16x16/Modern_Office_Singles_323.png",
    "anim_coffee":       "interiors/3_Animated_objects/16x16/spritesheets/animated_coffee.png",
    "anim_cake_fridge":  "interiors/3_Animated_objects/16x16/spritesheets/animated_canteen_big_fridge_cake_16x16.png",
    "anim_tv":           "interiors/3_Animated_objects/16x16/spritesheets/animated_TV_reportage.png",
    "anim_office_screen":"interiors/3_Animated_objects/16x16/spritesheets/animated_control_room_facebook_scrolling.png",
    "anim_cuckoo":       "interiors/3_Animated_objects/16x16/spritesheets/animated_cuckoo_clock.png",
    "ui":                "interiors/4_User_Interface_Elements/UI_16x16.png",
    "ui_emotes":         "interiors/4_User_Interface_Elements/UI_thinking_emotes_animation_16x16.png",
    "char_body_sheet":      "interiors/2_Characters/Character_Generator/Bodies/16x16/Body_01.png",
    "char_eyes_sheet":      "interiors/2_Characters/Character_Generator/Eyes/16x16/Eyes_01.png",
    "char_hair_sheet":      "interiors/2_Characters/Character_Generator/Hairstyles/16x16/Hairstyle_01_01.png",
    "char_outfit_sheet":    "interiors/2_Characters/Character_Generator/Outfits/16x16/Outfit_01_01.png",
    "char_accessory_sheet": "interiors/2_Characters/Character_Generator/Accessories/16x16/Accessory_01_Ladybug_01.png"
```

- [ ] **Step 4: Extend `rects`**

Furniture, transcribed from `build-interiors.mjs:63-100`. `trim: true` reproduces the alpha-bbox trim that loop performs. The `note` fields carry the Russian comments' meaning forward — they record hard-won corrections, not decoration.

```json
    "bed_green":  { "file": "bedroom", "x": 128, "y": 320, "w": 32, "h": 56, "trim": true },
    "bed_blue":   { "file": "bedroom", "x": 160, "y": 320, "w": 32, "h": 56, "trim": true },
    "bed_teal":   { "file": "bedroom", "x": 192, "y": 320, "w": 32, "h": 56, "trim": true },
    "nightstand": { "file": "bedroom", "x": 224, "y": 296, "w": 16, "h": 21, "trim": true },
    "rug_pink":   { "file": "bedroom", "x": 7,   "y": 349, "w": 36, "h": 34, "trim": true },

    "chair_blue_r":   { "file": "bedroom", "x": 81, "y": 192, "w": 14, "h": 32, "trim": true,
      "note": "dining sets: clean chairs without the adjoining table corner — 2nd (left, x=34) and 3rd (right, x=81)" },
    "chair_blue_l":   { "file": "bedroom", "x": 34, "y": 192, "w": 14, "h": 32, "trim": true },
    "chair_red_r":    { "file": "bedroom", "x": 81, "y": 224, "w": 14, "h": 32, "trim": true },
    "chair_red_l":    { "file": "bedroom", "x": 34, "y": 224, "w": 14, "h": 32, "trim": true },
    "chair_yellow_r": { "file": "bedroom", "x": 81, "y": 256, "w": 14, "h": 32, "trim": true },
    "chair_yellow_l": { "file": "bedroom", "x": 34, "y": 256, "w": 14, "h": 32, "trim": true },
    "table_plain":    { "file": "bedroom", "x": 48, "y": 208, "w": 32, "h": 40, "trim": true },

    "armchair_grey_r": { "file": "livingroom", "x": 145, "y": 582, "w": 22, "h": 42, "trim": true,
      "note": "BROWN pair (row 582), not grey — the grey one read as a concrete slab on warm parquet (ТЗ-08 v2 acceptance). _r faces right = back on the left" },
    "armchair_grey_l": { "file": "livingroom", "x": 121, "y": 582, "w": 22, "h": 42, "trim": true },
    "armchair_blue_r": { "file": "livingroom", "x": 145, "y": 518, "w": 22, "h": 42, "trim": true },
    "armchair_blue_l": { "file": "livingroom", "x": 121, "y": 518, "w": 22, "h": 42, "trim": true },
    "lamp_red":        { "file": "livingroom", "x": 206, "y": 150, "w": 17, "h": 36, "trim": true },
    "plant_palm":      { "file": "livingroom", "x": 214, "y": 0,   "w": 28, "h": 50, "trim": true },

    "bookshelf_a":      { "file": "classroom", "x": 0,   "y": 360, "w": 48, "h": 50, "trim": true },
    "bookshelf_b":      { "file": "classroom", "x": 0,   "y": 424, "w": 48, "h": 50, "trim": true },
    "bookshelf_narrow": { "file": "classroom", "x": 195, "y": 354, "w": 13, "h": 62, "trim": true },
    "lectern":          { "file": "classroom", "x": 230, "y": 282, "w": 20, "h": 34, "trim": true },
    "globe":            { "file": "classroom", "x": 208, "y": 16,  "w": 16, "h": 24, "trim": true },
    "chalkboard":       { "file": "classroom", "x": 160, "y": 78,  "w": 28, "h": 34, "trim": true },

    "counter_wide": { "file": "kitchen", "x": 192, "y": 268, "w": 52, "h": 22, "trim": true },
    "stool":        { "file": "kitchen", "x": 1,   "y": 177, "w": 14, "h": 15, "trim": true },
    "doormat":      { "file": "kitchen", "x": 105, "y": 432, "w": 30, "h": 38, "trim": true },

    "plant_small":         { "file": "office_singles_99" },
    "plant_pot":           { "file": "office_singles_100" },
    "office_chair_right":  { "file": "office_singles_103" },
    "office_chair_left":   { "file": "office_singles_104" },
    "whiteboard":          { "file": "office_singles_116" },
    "printer":             { "file": "office_singles_156" },
    "workstation_single":  { "file": "office_singles_225" },
    "workstation_double":  { "file": "office_singles_227" },
    "coffee_machine":      { "file": "office_singles_323" },

    "coffee_steam":  { "file": "anim_coffee" },
    "cake_fridge":   { "file": "anim_cake_fridge" },
    "tv_news":       { "file": "anim_tv" },
    "office_screen": { "file": "anim_office_screen" },
    "cuckoo_clock":  { "file": "anim_cuckoo" },

    "emote_sheet": { "file": "ui_emotes" },
    "ui_sheet":    { "file": "ui" },

    "char_body":      { "file": "char_body_sheet" },
    "char_eyes":      { "file": "char_eyes_sheet" },
    "char_hair":      { "file": "char_hair_sheet" },
    "char_outfit":    { "file": "char_outfit_sheet" },
    "char_accessory": { "file": "char_accessory_sheet" }
```

The five `char_*` slots each point at their own real Character Generator layer directory — U-1 is answered: the pack ships separable layers (Bodies 9, Eyes 7, Hairstyles 200, Outfits 132, Accessories 84 sheets; art-pack QA 2026-07-29), and `capabilities.characterLayers` is `true` from Task 5. Each alias names the **index-0 file** of its directory; the composer (Plan 4 Task 27) resolves the concrete variant sheet by replacing the index in the file name. One pack caveat is load-bearing: the layer sheets are **927×656** — 927 is *not* a whole number of 16px frames, so the composer crops to whole frames (Plan 4 Task 27) and the validator asserts the shared canvas (Task 10 block 4b).

- [ ] **Step 5: Add `emoteFrames`**

At the top level of `sources/limezu.json`, as a sibling of `rects`:

```json
  "emoteFrames": {
    "work":         [44, 45],
    "task_running": [40, 41],
    "task_done":    [64, 65],
    "chat_npc":     [66, 67],
    "rest":         [56, 57],
    "error":        [50, 51]
  },
```

These are the `row*10+col` pairs from `assetManifest.ts:211-218`, verified frame-by-frame under ТЗ-08. Task 23 makes `assetManifest.ts` read them from here instead of hardcoding them.

- [ ] **Step 6: Run tests**

Run: `npm test`
Expected: PASS — 7 new tests. `contract.allNames() is fully covered by the adapter` is the important one: it is the static half of I-2.

- [ ] **Step 7: Commit**

```bash
git add sources/limezu.json test/source-limezu-interior.test.mjs
git commit -m "feat(adapter): migrate interior, character and emote sources; move emote frame indices out of code"
```

---

## Task 8: `SourceAdapter` and the synthetic fixture pack

The adapter API, plus the thing that unblocks everything else: a generated pack with real PNGs and known geometry, so the bake is testable with zero licensed pixels.

**Files:**
- Create: `scripts/lib/sourceAdapter.mjs`
- Create: `scripts/gen-fixture-pack.mjs`
- Create: `sources/fixture.json`
- Test: `test/source-adapter.test.mjs`
- Modify: `.gitignore` — ignore the generated fixture pixels

**Interfaces:**
- Consumes: `loadContract()` (Task 4).
- Produces `scripts/lib/sourceAdapter.mjs`:
  - `loadAdapter(path, srcRoot) → Adapter`
  - `Adapter = { pack, capabilities, emoteFrames, has(name), resolve(name), names(), unresolved(contractNames) }`
  - `resolve(name) → { name, absPath, x, y, w, h, trim, generated }` — `x/y` default `0`, `w/h` default `null` meaning "whole file".
- Produces `scripts/gen-fixture-pack.mjs`: `npm run fixture` writes `test/fixtures/pack-src/**` and is idempotent.
- Produces `sources/fixture.json`: same shape as `sources/limezu.json`, resolving every `contract.allNames()` entry against the generated pack.

- [ ] **Step 1: Write the failing test**

`test/source-adapter.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';

const fixture = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('the fixture adapter declares itself', () => {
  const a = fixture();
  assert.equal(a.pack, 'fixture');
  assert.equal(a.capabilities.characterLayers, true);
});

test('resolve() returns an absolute path that exists', () => {
  const r = fixture().resolve('grass');
  assert.ok(r.absPath.endsWith('.png'));
  assert.ok(existsSync(r.absPath), `${r.absPath} missing — run npm run fixture`);
});

test('a rect with no w/h means the whole file', () => {
  const r = fixture().resolve('office_building');
  assert.equal(r.x, 0);
  assert.equal(r.y, 0);
  assert.equal(r.w, null);
  assert.equal(r.h, null);
});

test('unresolved() reports names the pack cannot supply', () => {
  const a = fixture();
  assert.deepEqual(a.unresolved(['grass', 'definitely_not_a_real_prop']),
    ['definitely_not_a_real_prop']);
});

test('the fixture pack covers every contract name (I-2 on the fixture)', () => {
  assert.deepEqual(fixture().unresolved(loadContract().allNames()), []);
});

test('resolve() throws rather than returning a guess', () => {
  assert.throws(() => fixture().resolve('nope'), /unresolved name: nope/);
});

test('the limezu adapter loads and covers every contract name', () => {
  const a = loadAdapter('sources/limezu.json', 'assets-src');
  assert.equal(a.pack, 'limezu');
  assert.deepEqual(a.unresolved(loadContract().allNames()), []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the fixture adapter declares itself"`
Expected: FAIL — `Cannot find module '.../scripts/lib/sourceAdapter.mjs'`.

- [ ] **Step 3: Write the adapter**

`scripts/lib/sourceAdapter.mjs`:

```js
/**
 * Loads sources/<pack>.json — the ONLY pack-specific artifact in the
 * system (I-1). Runtime code must never import this module.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const abs = p => (isAbsolute(p) ? p : join(ROOT, p));

export function loadAdapter(manifestPath, srcRoot) {
  const raw = JSON.parse(readFileSync(abs(manifestPath), 'utf8'));
  const root = abs(srcRoot);

  const resolve = name => {
    const r = raw.rects[name];
    if (!r) throw new Error(`unresolved name: ${name} (pack ${raw.pack})`);
    const file = raw.files[r.file];
    if (!file) throw new Error(`name ${name} points at undeclared file alias ${r.file}`);
    return {
      name,
      absPath: join(root, file),
      x: r.x ?? 0,
      y: r.y ?? 0,
      w: r.w ?? null,   // null = whole file
      h: r.h ?? null,
      trim: r.trim === true,
      generated: r.generated ?? null,
    };
  };

  return {
    pack: raw.pack,
    capabilities: raw.capabilities,
    /** Pack-specific emote frame pairs. Belongs here, never in the contract. */
    emoteFrames: raw.emoteFrames ?? {},
    has: name => Object.hasOwn(raw.rects, name),
    names: () => Object.keys(raw.rects),
    unresolved: contractNames => contractNames.filter(n => !Object.hasOwn(raw.rects, n)),
    resolve,
  };
}
```

- [ ] **Step 4: Write the fixture-pack generator**

`scripts/gen-fixture-pack.mjs`. Every sprite is a flat colour block with a 1px darker border and one transparent margin row, so trimming, atlas packing and size derivation all have something real to measure. Colours are derived from the name so a wrong crop shows up as a wrong colour in a test.

```js
#!/usr/bin/env node
/**
 * Generates a synthetic art pack under test/fixtures/pack-src/.
 * Real PNGs, known geometry, zero licensed pixels — this is what makes
 * the world bake testable in CI and on a machine with no packs.
 * Deterministic: same input, byte-identical output.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, encodePng } from './png-lib.mjs';
import { loadContract } from './lib/assetContract.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const OUT = join(ROOT, 'test', 'fixtures', 'pack-src');

/** FNV-1a — the same spread function the rest of the system uses. */
function hash(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
const colorFor = name => {
  const h = hash(name);
  return [(h & 0xff) | 0x20, ((h >> 8) & 0xff) | 0x20, ((h >> 16) & 0xff) | 0x20, 255];
};

/** A block of `w`x`h` with a 1px transparent margin and a darker border. */
function block(name, w, h) {
  const cv = createCanvas(w, h);
  const [r, g, b] = colorFor(name);
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const edge = x === 1 || y === 1 || x === w - 2 || y === h - 2;
      cv.set(x, y, edge ? [r >> 1, g >> 1, b >> 1, 255] : [r, g, b, 255]);
    }
  return cv;
}

function write(rel, canvas) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, encodePng(canvas));
}

const c = loadContract();
const rects = {};
const files = {};

// One 16x16 tile per ground-atlas name, each in its own file.
for (const atlas of Object.values(c.groundAtlases)) {
  for (const t of atlas.tiles) {
    const alias = `t_${t}`;
    files[alias] = `tiles/${t}.png`;
    rects[t] = { file: alias, x: 0, y: 0, w: 16, h: 16 };
    write(`tiles/${t}.png`, block(t, 16, 16));
  }
}

// One whole-file PNG per prop, sized to its contract maxSize. The `note` is
// honest rather than decorative — it flows to the contact sheet's tooltip
// (Task 9a), which must render notes and has to have one to render.
for (const group of Object.values(c.props)) {
  for (const [name, def] of Object.entries(group)) {
    const [w, h] = def.maxSize;
    const alias = `p_${name}`;
    files[alias] = `props/${name}.png`;
    rects[name] = { file: alias, trim: true,
      note: 'generated fixture sprite — geometry is derived from the contract, not chosen' };
    write(`props/${name}.png`, block(name, w, h));
  }
}

// Animated objects: `frames` cells laid out in a horizontal strip.
for (const [name, def] of Object.entries(c.animatedObjects)) {
  const cv = createCanvas(def.frameWidth * def.frames, def.frameHeight);
  for (let f = 0; f < def.frames; f++) {
    const cell = block(`${name}:${f}`, def.frameWidth, def.frameHeight);
    cv.blit({ w: cell.w, h: cell.h, px: (x, y) => {
      const i = (y * cell.w + x) * 4;
      return [cell.data[i], cell.data[i + 1], cell.data[i + 2], cell.data[i + 3]];
    } }, 0, 0, def.frameWidth, def.frameHeight, f * def.frameWidth, 0);
  }
  const alias = `a_${name}`;
  files[alias] = `animated/${name}.png`;
  rects[name] = { file: alias };
  write(`animated/${name}.png`, cv);
}

// Emote sheet: 10 columns x 10 rows of 16x16, matching the real layout.
files.emotes = 'ui/emotes.png';
rects.emote_sheet = { file: 'emotes' };
write('ui/emotes.png', block('emotes', 160, 160));
files.ui = 'ui/ui.png';
rects.ui_sheet = { file: 'ui' };
write('ui/ui.png', block('ui', 160, 160));

// Character parts: separable 16x32 layers, 56 columns x 8 rows — the
// *subset* AVATAR_VARIANTS uses (rows 0-7). The real premade sheets are
// 896x656 (20.5 rows of 32px); the fixture generates only the rows the
// runtime reads.
for (const part of c.characters.parts) {
  const alias = `c_${part}`;
  files[alias] = `characters/${part}.png`;
  rects[`char_${part}`] = { file: alias };
  write(`characters/${part}.png`, block(`char_${part}`, 16 * 56, 32 * 8));
}

writeFileSync(join(ROOT, 'sources', 'fixture.json'), JSON.stringify({
  pack: 'fixture',
  capabilities: { characterLayers: true },
  emoteFrames: Object.fromEntries(
    c.emotes.icons.statuses.map((s, i) => [s, [40 + i * 2, 41 + i * 2]])),
  files,
  rects,
}, null, 2) + '\n');

// Coverage is the claim, not a count: the generated pack must resolve every
// name the contract requires. Assert it here so a contract addition that the
// generator forgot fails at generation, not three tasks later in the bake.
const unresolved = c.allNames().filter(n => !rects[n]);
if (unresolved.length) {
  console.error(`fixture pack is incomplete — no pixels for: ${unresolved.join(', ')}`);
  process.exit(1);
}

console.log(`fixture pack: ${Object.keys(rects).length} names (contract requires ${c.allNames().length}), ${Object.keys(files).length} files`);
```

- [ ] **Step 5: Wire the script and gitignore the pixels**

Root `package.json`, in `"scripts"`:

```json
    "fixture": "node scripts/gen-fixture-pack.mjs",
```

Append to `.gitignore`:

```
# Generated synthetic test pack (npm run fixture) — pixels are derived, not authored
test/fixtures/pack-src/
```

`sources/fixture.json` **is** committed — it is the manifest, not the pixels, and the adapter tests read it.

- [ ] **Step 6: Generate and run tests**

Run: `npm run fixture && npm test`
Expected: `fixture pack: <n> names (contract requires <n>), <m> files` — the two counts must be equal, and the script exits non-zero if they are not. Then PASS. The final test (`the limezu adapter loads and covers every contract name`) passes even without `assets-src/` present — it only reads the manifest, never the pixels.

`npm test` now runs `pretest`, which runs `npm run fixture`, so the explicit `npm run fixture` above is only for seeing the output. From here on a fresh clone can run `npm test` with nothing else.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/sourceAdapter.mjs scripts/gen-fixture-pack.mjs sources/fixture.json package.json .gitignore test/source-adapter.test.mjs
git commit -m "feat(adapter): SourceAdapter plus a synthetic fixture pack for art-free testing"
```

---

## Task 9: `SpriteReader` and crop pins

Crop a rect out of a pack PNG, trim transparent margins, report true bounds. This is the alpha-bbox loop that currently appears twice — `build-district.mjs:73-85` and `build-interiors.mjs:103-123` — extracted once.

This is also where the **pin** gets its teeth. `armchair_grey_r` is "(145,582) 22×42 in `2_LivingRoom_16x16.png`" — if LimeZu ships an update that inserts a row, that rect silently becomes a different chair, deterministically, with no error anywhere. `pinFor()` hashes the crop's actual pixels, and `scripts/pin.mjs` fills the `pin` field on every rect in `sources/<pack>.json` and **fails when a pinned crop's pixels have changed**, so Task 10's validator can turn that silence into a named build failure.

**Files:**
- Create: `scripts/lib/spriteReader.mjs`
- Create: `scripts/pin.mjs`
- Modify: `package.json` — `pin` script; extend `fixture` with the pin pass
- Modify: `sources/fixture.json` — gains a `pin` per rect (via `npm run fixture`)
- Test: `test/sprite-reader.test.mjs`

**Interfaces:**
- Consumes: `loadAdapter()` (Task 8), `decodePng` / `createCanvas` from `scripts/png-lib.mjs`.
- Produces `scripts/lib/spriteReader.mjs`:
  - `readSprite(adapter, name) → { name, w, h, canvas }` — `canvas` is a `png-lib` canvas; `w`/`h` are the true post-trim bounds.
  - `asSource(canvas) → { w, h, px }` — adapts a mutable canvas back into the read-only shape `blit` expects.
  - `pinFor(adapter, name) → string` — sha256 of the post-trim crop's pixels.
- Produces `scripts/pin.mjs`: `npm run pin [pack] [srcRoot]` — fills missing pins from real pixels, exits `1` if any pinned crop no longer matches. A CLI writing an authored file, which the Global Constraints permit — only *library* functions may not write the tree. The pinner never gates and the validator (Task 10) never writes: one job per tool.

- [ ] **Step 1: Write the failing test**

`test/sprite-reader.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { readSprite, asSource, pinFor } from '../scripts/lib/spriteReader.mjs';
import { createCanvas } from '../scripts/png-lib.mjs';

const a = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('a whole-file read returns the file size', () => {
  const s = readSprite(a(), 'grass');
  assert.equal(s.w, 16);
  assert.equal(s.h, 16);
});

test('trim removes the transparent margin the fixture builds in', () => {
  // fixture props are drawn inset by 1px on every side of maxSize
  const s = readSprite(a(), 'bookshelf_a');   // maxSize [48, 64]
  assert.equal(s.w, 46);
  assert.equal(s.h, 62);
});

test('the trimmed canvas has an opaque top-left pixel', () => {
  const s = readSprite(a(), 'bookshelf_a');
  const i = 0;
  assert.equal(s.canvas.data[i + 3], 255, 'trim left a transparent edge');
});

test('reading is a pure function of the pack: two reads are byte-identical', () => {
  const x = readSprite(a(), 'counter_wide');
  const y = readSprite(a(), 'counter_wide');
  assert.deepEqual([...x.canvas.data], [...y.canvas.data]);
});

test('a fully transparent region throws rather than emitting an empty PNG', () => {
  const empty = createCanvas(8, 8);
  assert.throws(() => readSprite({
    resolve: () => ({ name: 'blank', absPath: null, x: 0, y: 0, w: 8, h: 8, trim: true, generated: null }),
    _override: asSource(empty),
  }, 'blank'), /empty crop: blank/);
});

test('asSource round-trips a canvas into a readable source', () => {
  const cv = createCanvas(2, 1);
  cv.set(1, 0, [1, 2, 3, 255]);
  assert.deepEqual(asSource(cv).px(1, 0), [1, 2, 3, 255]);
});

test('pinFor is a pure function of the pixels — same crop, same pin; different crop, different pin', () => {
  assert.equal(pinFor(a(), 'counter_wide'), pinFor(a(), 'counter_wide'));
  assert.notEqual(pinFor(a(), 'counter_wide'), pinFor(a(), 'stool'));
});

test('npm run fixture leaves the fixture pack fully pinned', () => {
  // The fixture's pixels are generated, so there is no excuse for an
  // unpinned crop — and the pins are deterministic, so the committed
  // manifest stays byte-stable across runs (the clean-tree guard holds).
  const src = JSON.parse(readFileSync('sources/fixture.json', 'utf8'));
  const unpinned = Object.entries(src.rects).filter(([, r]) => !r.pin).map(([n]) => n);
  assert.deepEqual(unpinned, []);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="a whole-file read"`
Expected: FAIL — `Cannot find module '.../scripts/lib/spriteReader.mjs'`.

- [ ] **Step 3: Write the reader**

`scripts/lib/spriteReader.mjs`:

```js
/**
 * Crops a rect out of a pack PNG and trims its transparent margins.
 * This is the alpha-bbox loop that used to be duplicated in
 * build-district.mjs:73-85 and build-interiors.mjs:103-123.
 */
import { createHash } from 'node:crypto';
import { decodePng, createCanvas } from '../png-lib.mjs';

const cache = new Map();
function decodeCached(path) {
  if (!cache.has(path)) cache.set(path, decodePng(path));
  return cache.get(path);
}

/** Adapt a mutable png-lib canvas back into the read-only {w,h,px} shape blit() wants. */
export function asSource(canvas) {
  return {
    w: canvas.w,
    h: canvas.h,
    px: (x, y) => {
      if (x < 0 || y < 0 || x >= canvas.w || y >= canvas.h) return [0, 0, 0, 0];
      const i = (y * canvas.w + x) * 4;
      return [canvas.data[i], canvas.data[i + 1], canvas.data[i + 2], canvas.data[i + 3]];
    },
  };
}

/**
 * @returns {{name:string, w:number, h:number, canvas:object}} true post-trim bounds
 */
export function readSprite(adapter, name) {
  const r = adapter.resolve(name);
  const img = adapter._override ?? decodeCached(r.absPath);

  const rx = r.x;
  const ry = r.y;
  const rw = r.w ?? img.w;
  const rh = r.h ?? img.h;

  let minX = rw, minY = rh, maxX = -1, maxY = -1;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (img.px(rx + x, ry + y)[3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`empty crop: ${name}`);

  // trim:false keeps the declared rect; trim:true shrinks to real content
  const ox = r.trim ? minX : 0;
  const oy = r.trim ? minY : 0;
  const w = r.trim ? maxX - minX + 1 : rw;
  const h = r.trim ? maxY - minY + 1 : rh;

  const cv = createCanvas(w, h);
  cv.blit(img, rx + ox, ry + oy, w, h, 0, 0);
  return { name, w, h, canvas: cv };
}

/**
 * The pin: a hash of the CHOSEN PIXELS, not of the coordinates.
 *
 * Hashing the post-trim crop rather than the rect is the point. A pack that
 * re-lays out a sheet moves the coordinates and keeps the sprite — the rect
 * check would scream and the sprite would be fine. A pack that redraws the
 * sprite keeps the coordinates and changes the art — the rect check would say
 * nothing and the art would be wrong. Only the pixels distinguish the two.
 */
export function pinFor(adapter, name) {
  const s = readSprite(adapter, name);
  return createHash('sha256').update(Buffer.from(s.canvas.data)).digest('hex');
}
```

Note the alpha threshold is `> 8`, matching both original loops exactly. Changing it would shift every trimmed sprite by a pixel and break Task 20.

- [ ] **Step 4: Write the pinner and wire the scripts**

`scripts/pin.mjs`:

```js
#!/usr/bin/env node
/**
 * Fills and verifies the `pin` on every rect in sources/<pack>.json.
 *
 *   node scripts/pin.mjs [pack] [srcRoot]
 *
 * Needs the pack's pixels on disk (for limezu that is Plan 6 Task 3).
 * A missing pin is filled; a pin that no longer matches is an ERROR —
 * the pack changed under a chosen crop, and that must be a decision,
 * never a silent update.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAdapter } from './lib/sourceAdapter.mjs';
import { pinFor } from './lib/spriteReader.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const pack = process.argv[2] ?? 'fixture';
const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');

const path = join(ROOT, 'sources', `${pack}.json`);
const raw = JSON.parse(readFileSync(path, 'utf8'));
const adapter = loadAdapter(`sources/${pack}.json`, srcRoot);

let filled = 0;
const changed = [];
for (const [name, r] of Object.entries(raw.rects)) {
  const pin = pinFor(adapter, name);
  if (!r.pin) { r.pin = pin; filled++; }
  else if (r.pin !== pin) changed.push(name);
}

if (changed.length) {
  console.error(`error: ${changed.length} crop(s) no longer match their pin:`);
  for (const n of changed) console.error(`  ${n}`);
  console.error('\nThe pack changed under a chosen crop. Re-review those sprites (npm run contact),');
  console.error('then clear the stale pins deliberately and re-run.');
  process.exit(1);
}

writeFileSync(path, JSON.stringify(raw, null, 2) + '\n');
console.log(`pinned ${filled} new crop(s); ${Object.keys(raw.rects).length} total, all match`);
```

Root `package.json`, in `"scripts"` — add `pin`, and extend `fixture` so the generated pack is always pinned:

```json
    "pin": "node scripts/pin.mjs",
    "fixture": "node scripts/gen-fixture-pack.mjs && node scripts/pin.mjs fixture test/fixtures/pack-src",
```

The fixture's pins are deterministic hashes of generated pixels, so re-running `npm run fixture` rewrites `sources/fixture.json` to the same bytes — the clean-tree guard (Task 18) still holds.

- [ ] **Step 5: Run tests**

Run: `npm run fixture && npm test`
Expected: `pinned <n> new crop(s); <n> total, all match` on the first run, then PASS — 8 new tests.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/spriteReader.mjs scripts/pin.mjs package.json sources/fixture.json test/sprite-reader.test.mjs
git commit -m "feat(bake): SpriteReader — single alpha-bbox crop and trim — plus crop pins on the adapter"
```

## Task 9a: The contact sheet — the thing you actually look at

Everything so far makes curation *recordable*. This makes it *reviewable*.

A rect is unjudgeable as text. `{ "file": "livingroom", "x": 145, "y": 582, "w": 22, "h": 42 }` tells you nothing about whether the chair reads as a chair at 16px, whether it fights the floor it sits on, or whether it disappears under the night tint. Every judgement in `sources/limezu.json` was originally made by cropping one sprite at a time with `scripts/crop.mjs` and squinting — which is why re-reviewing 116 of them is unthinkable and therefore never happens.

The contact sheet makes it a two-minute job: **one page per prop group, every chosen sprite at 1× and 2×, on the floor tile it will actually sit on, beside a night-tinted copy, labelled.**

**Two files per group, and no embedded font.** The PNG carries pixels; a sibling HTML file lays labels over it with CSS grid. Rendering text into the PNG would mean shipping a bitmap font in the repo to caption art we can caption for free in a browser.

**Files:**
- Create: `scripts/contact-sheet.mjs`
- Modify: `package.json` — `contact` script
- Modify: `.gitignore` — ignore `contact/`
- Test: `test/bake/contact-sheet.test.mjs`

**Interfaces:**
- Consumes: `loadContract()`, `loadAdapter()`, `readSprite()`, `asSource()`, and the `note`/`pin` fields read straight from `sources/<pack>.json`.
- Produces `scripts/contact-sheet.mjs`:
  - `contactSheet(contract, adapter, group, { floorTile, columns }) → { canvas, cells }`
  - `nightTint(canvas) → canvas` — the same `#0a0a2e` at alpha 0.45 the palette test uses
  - CLI `npm run contact [pack] [srcRoot]` → `contact/<group>.png` + `contact/<group>.html`

- [ ] **Step 1: Write the failing test**

`test/bake/contact-sheet.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../../scripts/lib/sourceAdapter.mjs';
import { contactSheet, nightTint, writeContactSheets } from '../../scripts/contact-sheet.mjs';
import { createCanvas } from '../../scripts/png-lib.mjs';

const c = loadContract();
const a = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('every prop in a group appears exactly once', () => {
  const { cells } = contactSheet(c, a(), 'interior', { floorTile: 'floorCafe', columns: 8 });
  assert.equal(cells.length, Object.keys(c.props.interior).length);
  assert.equal(new Set(cells.map(x => x.name)).size, cells.length);
});

test('cells are alphabetical, so the same sprite sits in the same place across packs', () => {
  const { cells } = contactSheet(c, a(), 'district', { floorTile: 'grass', columns: 8 });
  assert.deepEqual(cells.map(x => x.name), [...cells.map(x => x.name)].sort());
});

test('every cell reports where it landed, so the HTML can label it', () => {
  const { cells, canvas } = contactSheet(c, a(), 'interior', { floorTile: 'floorCafe', columns: 8 });
  for (const cell of cells) {
    assert.ok(cell.x >= 0 && cell.x < canvas.w, cell.name);
    assert.ok(cell.y >= 0 && cell.y < canvas.h, cell.name);
    assert.ok(cell.w > 0 && cell.h > 0, cell.name);
  }
});

test('the night tint darkens without flattening to black', () => {
  const cv = createCanvas(1, 1);
  cv.set(0, 0, [200, 100, 50, 255]);
  const out = nightTint(cv);
  const [r, g, b, alpha] = [out.data[0], out.data[1], out.data[2], out.data[3]];
  assert.ok(r < 200 && g < 100, 'not darkened');
  assert.ok(r > 0 && b > 0, 'flattened to black — the tint is too strong to review under');
  assert.equal(alpha, 255);
});

test('a transparent pixel stays transparent under the tint', () => {
  const cv = createCanvas(1, 1);
  assert.equal(nightTint(cv).data[3], 0);
});

test('sheets are deterministic, so a diff means the ART changed', () => {
  const x = contactSheet(c, a(), 'interior', { floorTile: 'floorCafe', columns: 8 });
  const y = contactSheet(c, a(), 'interior', { floorTile: 'floorCafe', columns: 8 });
  assert.deepEqual([...x.canvas.data], [...y.canvas.data]);
});

test('writeContactSheets emits a png and an html per group', () => {
  const out = mkdtempSync(join(tmpdir(), 'contact-'));
  writeContactSheets(c, a(), out);
  const files = readdirSync(out).sort();
  for (const group of Object.keys(c.props)) {
    assert.ok(files.includes(`${group}.png`), group);
    assert.ok(files.includes(`${group}.html`), group);
  }
});

test('the html labels every cell and cites the reason the sprite was chosen', () => {
  const out = mkdtempSync(join(tmpdir(), 'contact-html-'));
  writeContactSheets(c, a(), out);
  const html = readFileSync(join(out, 'interior.html'), 'utf8');
  for (const name of Object.keys(c.props.interior)) assert.ok(html.includes(name), name);
  assert.match(html, /generated fixture sprite/, 'the note should be visible on hover');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:bake -- --test-name-pattern="every prop in a group appears exactly once"`
Expected: FAIL — `Cannot find module '.../scripts/contact-sheet.mjs'`.

- [ ] **Step 3: Write the sheet builder**

`scripts/contact-sheet.mjs`:

```js
#!/usr/bin/env node
/**
 * Renders every chosen sprite in a group onto one page, so a human can judge
 * 116 curation decisions in one pass instead of 116.
 *
 * Each cell shows the sprite THREE ways, because those are the three ways it
 * fails:
 *   1x on its floor tile   — does it read at all, and does it fight the floor
 *   2x                     — is the crop clean, or is a neighbour's pixel in it
 *   1x night-tinted        — does it survive DAY_TINT_KEYS at alpha 0.45
 *
 * Labels live in a sibling .html rather than in the pixels: captioning inside
 * the PNG would mean shipping a bitmap font to do what CSS does for free.
 *
 *   node scripts/contact-sheet.mjs [pack] [srcRoot]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, encodePng } from './png-lib.mjs';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';
import { readSprite, asSource } from './lib/spriteReader.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const PAD = 8;

/** DAY_TINT_KEYS at its darkest: #0a0a2e over the sprite at alpha 0.45. */
export function nightTint(canvas) {
  const out = createCanvas(canvas.w, canvas.h);
  const TINT = [0x0a, 0x0a, 0x2e];
  for (let i = 0; i < canvas.data.length; i += 4) {
    if (canvas.data[i + 3] === 0) continue;
    for (let k = 0; k < 3; k++) out.data[i + k] = Math.round(canvas.data[i + k] * 0.55 + TINT[k] * 0.45);
    out.data[i + 3] = canvas.data[i + 3];
  }
  return out;
}

function scale(src, factor) {
  const out = createCanvas(src.w * factor, src.h * factor);
  for (let y = 0; y < out.h; y++)
    for (let x = 0; x < out.w; x++)
      out.set(x, y, src.px(Math.floor(x / factor), Math.floor(y / factor)));
  return out;
}

function tileFloor(canvas, floor, x0, y0, w, h) {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      canvas.set(x0 + x, y0 + y, floor.px(x % floor.w, y % floor.h));
}

/**
 * @returns {{canvas: object, cells: Array<{name,x,y,w,h}>}}
 */
export function contactSheet(contract, adapter, group, { floorTile, columns = 8 }) {
  const names = Object.keys(contract.props[group]).sort();
  const floor = asSource(readSprite(adapter, floorTile).canvas);

  const sprites = names.map(name => ({ name, s: readSprite(adapter, name) }));
  // One cell width for the whole sheet: a ragged grid is unreadable, and a
  // sprite that overflows its cell is itself a finding.
  const cellW = Math.max(...sprites.map(({ s }) => s.w * 3 + PAD * 4));
  const cellH = Math.max(...sprites.map(({ s }) => s.h * 2 + PAD * 2));
  const rows = Math.ceil(sprites.length / columns);

  const canvas = createCanvas(columns * cellW, rows * cellH);
  const cells = [];

  sprites.forEach(({ name, s }, i) => {
    const cx = (i % columns) * cellW;
    const cy = Math.floor(i / columns) * cellH;
    tileFloor(canvas, floor, cx, cy, cellW, cellH);

    const src = asSource(s.canvas);
    const baseY = cy + cellH - PAD - s.h;

    canvas.blit(src, 0, 0, s.w, s.h, cx + PAD, baseY);                       // 1x on the floor
    const big = scale(src, 2);
    canvas.blit(asSource(big), 0, 0, big.w, big.h, cx + PAD * 2 + s.w, cy + cellH - PAD - big.h);
    const night = nightTint(s.canvas);
    canvas.blit(asSource(night), 0, 0, s.w, s.h, cx + PAD * 3 + s.w * 3, baseY);

    cells.push({ name, x: cx, y: cy, w: cellW, h: cellH });
  });

  return { canvas, cells, columns, cellW, cellH };
}

const esc = s => String(s ?? '').replace(/[&<>"]/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

function html(group, sheet, rects) {
  const cells = sheet.cells.map(c => {
    const r = rects[c.name] ?? {};
    return `    <a class="cell" style="left:${c.x}px;top:${c.y}px;width:${c.w}px;height:${c.h}px"
       title="${esc(r.note ?? 'no reason recorded')}${r.pin ? '' : '  [UNPINNED]'}"
       ><span>${esc(c.name)}</span></a>`;
  }).join('\n');

  return `<!doctype html><meta charset="utf-8"><title>${esc(group)} — contact sheet</title>
<style>
  body { background:#14141c; color:#ddd; font:12px/1.3 ui-monospace,monospace; margin:16px }
  .sheet { position:relative; display:inline-block; image-rendering:pixelated }
  .sheet img { display:block; image-rendering:pixelated }
  .cell { position:absolute; box-sizing:border-box; border:1px solid #ffffff22; text-decoration:none; color:inherit }
  .cell:hover { border-color:#7fd1ff; background:#7fd1ff18 }
  .cell span { position:absolute; left:2px; bottom:2px; background:#000c; padding:1px 3px; border-radius:2px }
  h1 { font-size:14px; font-weight:600 }
  p { color:#999; max-width:70ch }
</style>
<h1>${esc(group)} — ${sheet.cells.length} sprites</h1>
<p>Each cell: 1&times; on its floor tile, 2&times;, then night-tinted (#0a0a2e @ 0.45).
   Hover a cell for the reason it was chosen. <b>[UNPINNED]</b> means the crop has never been
   verified against real pixels.</p>
<div class="sheet"><img src="${esc(group)}.png" alt="">
${cells}
</div>
`;
}

export function writeContactSheets(contract, adapter, outDir, pack = adapter.pack) {
  // Notes and pins live on the adapter's rects; the Adapter API deliberately
  // does not expose them (the bake has no business seeing why a crop won), so
  // the review artifact reads the authored file directly.
  const { rects } = JSON.parse(readFileSync(join(ROOT, 'sources', `${pack}.json`), 'utf8'));
  // The floor each group is actually seen against.
  const FLOOR = { district: 'grass', interior: 'floorCafe' };
  mkdirSync(outDir, { recursive: true });

  const written = [];
  for (const group of Object.keys(contract.props)) {
    const sheet = contactSheet(contract, adapter, group, { floorTile: FLOOR[group] ?? 'grass', columns: 8 });
    writeFileSync(join(outDir, `${group}.png`), encodePng(sheet.canvas));
    writeFileSync(join(outDir, `${group}.html`), html(group, sheet, rects));
    written.push(group);
  }
  return written;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pack = process.argv[2] ?? 'fixture';
  const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');
  const out = join(ROOT, 'contact');
  const groups = writeContactSheets(loadContract(), loadAdapter(`sources/${pack}.json`, srcRoot), out, pack);
  console.log(`contact sheets: ${groups.join(', ')} -> contact/  (open contact/${groups[0]}.html)`);
}
```

- [ ] **Step 4: Wire the script and ignore the output**

Root `package.json`, in `"scripts"`:

```json
    "contact": "node scripts/contact-sheet.mjs",
```

Append to `.gitignore`:

```
# Contact sheets — regenerable review artifacts (npm run contact). They render
# licensed pixels when built against a real pack, so they never enter git.
contact/
```

- [ ] **Step 5: Generate and look at it**

Run: `npm run contact && open contact/interior.html`
Expected: a page of coloured blocks — the fixture pack, so the *content* is meaningless and the *layout* is the point. Confirm each sprite appears three times, the night column is visibly darker but not black, hovering shows the note, and no cell reads `[UNPINNED]` — `npm run fixture` pins every crop as it generates.

This is the artifact Plan 6 Task 3 uses against real art. Getting it right on the fixture pack now is what makes that review cheap later.

- [ ] **Step 6: Run tests**

Run: `npm run test:all`
Expected: PASS — 8 new tests.

- [ ] **Step 7: Commit**

```bash
git add scripts/contact-sheet.mjs package.json .gitignore test/bake/contact-sheet.test.mjs
git commit -m "feat(curation): contact sheets — every chosen sprite on its floor, at 2x, and under the night tint"
```

---


---

## Task 10: `ContractValidator` and the CI gate

I-2: an unresolved name fails the **build**, never renders as a missing texture at runtime. This is the gate that catches the R-5 transcription errors from Tasks 5–7.

**Files:**
- Create: `scripts/lib/contractValidator.mjs`
- Create: `scripts/validate-contract.mjs`
- Modify: `package.json` — `validate:contract` script
- Test: `test/contract-validator.test.mjs`

**Interfaces:**
- Consumes: `loadContract()`, `loadAdapter()`, `readSprite()` / `pinFor()` (Task 9).
- Produces `scripts/lib/contractValidator.mjs`:
  - `validate(contract, adapter, { checkPixels = true, venues = [], pins = null }) → { errors: string[], warnings: string[] }`
  - `checkPixels: false` runs name resolution only — usable with no art on disk.
  - `pins` is `{ name → sha256 }` from the adapter's `pin` fields (Task 5's schema, filled by `npm run pin`). A **mismatch is an error**; a **missing pin is a warning**, because the licensed pack is legitimately absent on most machines.
- Produces `scripts/validate-contract.mjs`: CLI, exits `1` on any error, printing each one.

- [ ] **Step 1: Write the failing test**

`test/contract-validator.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { validate } from '../scripts/lib/contractValidator.mjs';
import { createCanvas, encodePng } from '../scripts/png-lib.mjs';

const c = loadContract();
const fixture = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('the fixture pack validates clean, pixels and all', () => {
  const { errors } = validate(c, fixture(), { checkPixels: true });
  assert.deepEqual(errors, []);
});

test('the limezu adapter validates clean without pixels (I-2 static half)', () => {
  const { errors } = validate(c, loadAdapter('sources/limezu.json', 'assets-src'), { checkPixels: false });
  assert.deepEqual(errors, []);
});

test('a missing name is an error, not a warning', () => {
  const broken = { ...fixture(), unresolved: () => ['ghost_prop'] };
  const { errors } = validate(c, broken, { checkPixels: false });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /ghost_prop/);
});

test('a prop that exceeds its contract maxSize is an error', () => {
  const a = fixture();
  const inflated = { ...c, props: { ...c.props, interior: { ...c.props.interior, stool: { maxSize: [4, 4] } } } };
  const { errors } = validate(inflated, a, { checkPixels: true });
  assert.ok(errors.some(e => /stool/.test(e) && /maxSize/.test(e)), errors.join('\n'));
});

test('a venue prop absent from the contract is an error', () => {
  const venues = [{ id: 'v', furniture: [{ name: 'not_a_prop', at: [0, 0] }], seats: [], animated: [], doors: [], glows: [], spawns: [] }];
  const { errors } = validate(c, fixture(), { checkPixels: false, venues });
  assert.ok(errors.some(e => /not_a_prop/.test(e)), errors.join('\n'));
});

test('layered char sheets must share one whole-frame canvas (4b)', () => {
  // The fixture is layered; its five char_* sheets are identical in size, so
  // it passes (covered by 'the fixture pack validates clean'). A pack whose
  // hair layer is a different size must fail — stacking would silently
  // misalign frames. Build a two-layer throwaway pack with mismatched sheets.
  const dir = mkdtempSync(join(tmpdir(), 'layers-'));
  writeFileSync(join(dir, 'a.png'), encodePng(createCanvas(16 * 4, 32 * 2)));
  writeFileSync(join(dir, 'b.png'), encodePng(createCanvas(16 * 4 - 1, 32 * 2)));
  const src = {
    pack: 'mismatch',
    capabilities: { characterLayers: true },
    emoteFrames: {},
    files: { a: 'a.png', b: 'b.png' },
    rects: Object.fromEntries(c.characters.parts.map((p, i) =>
      [`char_${p}`, { file: i === 0 ? 'a' : 'b' }])),
  };
  writeFileSync(join(dir, 'mismatch.json'), JSON.stringify(src));
  const { errors } = validate(c, loadAdapter(join(dir, 'mismatch.json'), dir), { checkPixels: true });
  assert.ok(errors.some(e => /char_/.test(e) && /one canvas/.test(e)), errors.join('\n'));
});

test('a crop whose pixels no longer match its pin is an error', () => {
  // The failure this exists for: a pack ships an update, a sheet gains a row,
  // and a chosen rect silently becomes a different sprite. Coordinates still
  // resolve, the build still succeeds, the chair is just wrong.
  const { errors } = validate(c, fixture(), {
    checkPixels: true,
    pins: { stool: 'deadbeef'.repeat(8) },
  });
  assert.ok(errors.some(e => /stool/.test(e) && /pin/.test(e)), errors.join('\n'));
});

test('an unpinned crop is a warning, not an error — the pack may not be here yet', () => {
  const { errors, warnings } = validate(c, fixture(), { checkPixels: true, pins: {} });
  assert.deepEqual(errors, []);
  assert.ok(warnings.some(w => /unpinned/.test(w)));
});

test('the fixture pack validates clean against its own real pins', () => {
  const src = JSON.parse(readFileSync('sources/fixture.json', 'utf8'));
  const pins = Object.fromEntries(Object.entries(src.rects).map(([n, r]) => [n, r.pin ?? null]));
  const { errors } = validate(c, fixture(), { checkPixels: true, pins });
  assert.deepEqual(errors, [], 'the fixture pins should always match — its pixels are generated');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm test -- --test-name-pattern="the fixture pack validates clean"`
Expected: FAIL — `Cannot find module '.../scripts/lib/contractValidator.mjs'`.

- [ ] **Step 3: Write the validator**

`scripts/lib/contractValidator.mjs`:

```js
/**
 * The CI gate behind I-2: every contract name resolves in the active
 * adapter, every venue prop exists in the contract, and declared
 * geometry matches the real bitmaps. An unresolved name fails the
 * BUILD — never a missing texture at runtime.
 */
import { readSprite, pinFor } from './spriteReader.mjs';

export function validate(contract, adapter, { checkPixels = true, venues = [], pins = null } = {}) {
  const errors = [];
  const warnings = [];

  // 1. Every contract name resolves.
  for (const name of adapter.unresolved(contract.allNames())) {
    errors.push(`unresolved contract name in pack "${adapter.pack}": ${name}`);
  }

  // 2. Every emote status has a frame pair in the adapter (indices are pack-specific).
  for (const status of contract.emotes.icons.statuses) {
    const pair = adapter.emoteFrames[status];
    if (!Array.isArray(pair) || pair.length !== 2) {
      errors.push(`pack "${adapter.pack}" has no two-frame emote pair for status: ${status}`);
    }
  }

  // 3. Every venue prop, seat kind, animated object and glow kind is known.
  const knownProps = new Set([...Object.keys(contract.props.district), ...Object.keys(contract.props.interior)]);
  const knownAnimated = new Set(Object.keys(contract.animatedObjects));
  for (const v of venues) {
    for (const f of v.furniture ?? []) {
      if (!knownProps.has(f.name)) errors.push(`venue ${v.id}: furniture "${f.name}" is not in the contract`);
    }
    for (const an of v.animated ?? []) {
      if (!knownAnimated.has(an.name)) errors.push(`venue ${v.id}: animated "${an.name}" is not in the contract`);
    }
    if (v.groundAtlas && !contract.groundAtlases[v.groundAtlas]) {
      errors.push(`venue ${v.id}: unknown groundAtlas "${v.groundAtlas}"`);
    }
  }

  if (!checkPixels) return { errors, warnings };

  // 4. Declared geometry matches real bitmaps.
  for (const atlasId of Object.keys(contract.groundAtlases)) {
    for (const t of contract.groundAtlases[atlasId].tiles) {
      if (!adapter.has(t)) continue;
      let s;
      try { s = readSprite(adapter, t); } catch (e) { errors.push(`tile ${t}: ${e.message}`); continue; }
      if (s.w !== contract.tileSize || s.h !== contract.tileSize) {
        errors.push(`tile ${t} is ${s.w}x${s.h}, expected ${contract.tileSize}x${contract.tileSize}`);
      }
    }
  }
  for (const [group, defs] of Object.entries(contract.props)) {
    for (const [name, def] of Object.entries(defs)) {
      if (!adapter.has(name)) continue;
      let s;
      try { s = readSprite(adapter, name); } catch (e) { errors.push(`prop ${name}: ${e.message}`); continue; }
      const [mw, mh] = def.maxSize;
      if (s.w > mw || s.h > mh) {
        errors.push(`prop ${group}/${name} is ${s.w}x${s.h}, exceeds contract maxSize ${mw}x${mh}`);
      }
    }
  }
  for (const [name, def] of Object.entries(contract.animatedObjects)) {
    if (!adapter.has(name)) continue;
    let s;
    try { s = readSprite(adapter, name); } catch (e) { errors.push(`animated ${name}: ${e.message}`); continue; }
    const need = def.frameWidth * def.frames;
    if (s.w < need) errors.push(`animated ${name} sheet is ${s.w}px wide, needs ${need}px for ${def.frames} frames`);
    if (s.h < def.frameHeight) errors.push(`animated ${name} sheet is ${s.h}px tall, needs ${def.frameHeight}px`);
  }

  // 4b. Layered characters share one canvas, in whole frames.
  //
  // The real Character Generator sheets are 927x656 — 927 is NOT a whole
  // number of 16px frames, so the composer crops to whole frames (Plan 4
  // Task 27). What it cannot survive is the LAYERS disagreeing with each
  // other: stacking assumes every char_* sheet has the same dimensions and
  // at least one whole frame each way. Assert that here, per pack.
  if (adapter.capabilities.characterLayers === true) {
    const { frameWidth: cfw, frameHeight: cfh, parts } = contract.characters;
    let first = null;
    for (const part of parts) {
      const name = `char_${part}`;
      if (!adapter.has(name)) continue;
      let s;
      try { s = readSprite(adapter, name); } catch (e) { errors.push(`char layer ${name}: ${e.message}`); continue; }
      if (Math.floor(s.w / cfw) < 1 || Math.floor(s.h / cfh) < 1) {
        errors.push(`char layer ${name} is ${s.w}x${s.h} — smaller than one ${cfw}x${cfh} frame`);
      }
      if (!first) { first = { name, w: s.w, h: s.h }; continue; }
      if (s.w !== first.w || s.h !== first.h) {
        errors.push(`char layer ${name} is ${s.w}x${s.h} but ${first.name} is ${first.w}x${first.h} — `
          + `layered composition requires all char_* sheets on one canvas`);
      }
    }
  }

  // 5. Every crop still contains the pixels that were chosen (the `pin`
  //    field, Task 9).
  //
  // Coordinates resolving is not the same as the sprite being right. A pack
  // update that inserts a row leaves every rect valid and every crop
  // different — the build succeeds and the chair is wrong. The pin is the
  // only check that catches that, so a MISMATCH is an error while a MISSING
  // pin is a warning: the licensed pack legitimately is not on most machines.
  if (pins) {
    for (const name of adapter.names()) {
      const want = pins[name];
      if (!want) { warnings.push(`unpinned crop: ${name} has never been verified against real pixels`); continue; }
      let got;
      try { got = pinFor(adapter, name); } catch (e) { errors.push(`pin ${name}: ${e.message}`); continue; }
      if (got !== want) {
        errors.push(`pin mismatch: ${name} no longer contains the pixels it was chosen for `
          + `(expected ${want.slice(0, 12)}…, got ${got.slice(0, 12)}…). `
          + `The pack changed under this crop — re-review it with 'npm run contact'.`);
      }
    }
  }

  return { errors, warnings };
}
```

- [ ] **Step 4: Write the CLI**

`scripts/validate-contract.mjs`:

```js
#!/usr/bin/env node
/**
 * CI gate (I-2). Usage:
 *   node scripts/validate-contract.mjs [pack] [srcRoot]
 * Defaults to the fixture pack so it runs with no licensed art present.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';
import { validate } from './lib/contractValidator.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const pack = process.argv[2] ?? 'fixture';
const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');

const venuesDir = join(ROOT, 'venues');
const venues = existsSync(venuesDir)
  ? readdirSync(venuesDir).map(id => JSON.parse(readFileSync(join(venuesDir, id, 'venue.json'), 'utf8')))
  : [];

const checkPixels = existsSync(join(ROOT, srcRoot));
if (!checkPixels) console.warn(`! ${srcRoot} not present — running name resolution only`);

// Pins live on the adapter's rects (the `pin` field, Task 9). Only meaningful
// with pixels on disk: without them there is nothing to hash.
const pins = checkPixels
  ? Object.fromEntries(Object.entries(
      JSON.parse(readFileSync(join(ROOT, 'sources', `${pack}.json`), 'utf8')).rects,
    ).map(([n, r]) => [n, r.pin ?? null]))
  : null;

const { errors, warnings } = validate(loadContract(), loadAdapter(`sources/${pack}.json`, srcRoot), { checkPixels, venues, pins });

for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\ncontract validation FAILED: ${errors.length} error(s) in pack "${pack}"`);
  process.exit(1);
}
console.log(`contract validation OK: pack "${pack}", ${venues.length} venue(s), pixels ${checkPixels ? 'checked' : 'skipped'}`);
```

- [ ] **Step 5: Wire the script**

Root `package.json`, in `"scripts"`:

```json
    "validate:contract": "node scripts/validate-contract.mjs",
```

- [ ] **Step 6: Run tests and the gate**

Run: `npm test && npm run validate:contract && npm run validate:contract -- limezu assets-src`
Expected: 9 new tests PASS (count the `test(` calls in Step 1 — including the layered one-canvas check 4b); `contract validation OK: pack "fixture", 0 venue(s), pixels checked`; then for limezu, `! assets-src not present — running name resolution only` followed by `contract validation OK`.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/contractValidator.mjs scripts/validate-contract.mjs package.json test/contract-validator.test.mjs
git commit -m "feat(bake): ContractValidator CI gate — unresolved names fail the build (I-2)"
```
