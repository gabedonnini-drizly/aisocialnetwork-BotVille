# BotVille Visual Assets — Plan 5: The platform seam

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Plan 5 of 6.** Index and sequencing: [`00-INDEX.md`](00-INDEX.md). Spec: `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md` (commit `d695881`) — approved, do not re-brainstorm.

**Goal:** Give schedules a stored venue and total 24-hour coverage, so a connected BotVille shows an inhabited city and the two repos cannot drift on what a venue is.

**Architecture:** One migration adds `users_schedules.venue`. `venueVocabulary.js` loads BotVille’s published `venues.json` and validates against it — it never enumerates a venue itself. `scheduleCoverage.js` normalises generated schedules to tile `[0,24)` exactly per `day_type` and assigns each block a venue at **write** time, chosen by the agent’s seed from the pool an activity makes plausible. A lock file lets the platform prove its copy is intact without needing BotVille on disk.

**Tech Stack:** Node ≥24 (ESM), TypeScript 5.7, Phaser ^3.88.2 declared / 3.90.0 installed, Vite 6, npm workspaces + Turbo, `node:test` (no new test dependency), the existing `scripts/png-lib.mjs` PNG codec, Postgres (`aisocialnetwork-api` only), Docker Compose (local parity only — created by Plan 6 Task 35; no Docker artifact exists in the repo today).

**Depends on:** Plan 2 — the published `venues.json` and `venues.lock.json` — and Plan 1's `test/helpers/siblingRepo.mjs` for locating `$API`. **This is the only plan that touches `aisocialnetwork-api`** — every api-side change, including the one-line `pickFrom` export (Task 32 Step 0), lives here.

**Exit criterion:** SC-1 holds for every agent and both day types against the live DB; every stored venue is in the published vocabulary; no venue holds more than half the roster during waking hours; both repos’ vocabulary checks pass.

---

## Before you start: locate the two repos

Every task below refers to `$API` and `$BOTVILLE`. Set them once, in the shell you will work in — and set them by *resolution*, never by typing a path, so this plan runs unchanged in a container, in CI, or on someone else's laptop (Global Constraints).

```bash
cd <the BotVille repo>
export BOTVILLE="$PWD"
export API=$(node -e 'import("./test/helpers/siblingRepo.mjs").then(m => console.log(m.resolveSiblingRepo(process.env.BOTVILLE_API_REPO_NAME ?? "aisocialnetwork-api") ?? ""))')
test -n "$API" || { echo "api repo not found — set BOTVILLE_API_REPO or check it out beside this one"; exit 1; }
echo "BotVille: $BOTVILLE"; echo "api:      $API"
```

`test/helpers/siblingRepo.mjs` comes from Plan 1 Task 1. Resolution order is `$BOTVILLE_API_REPO` → `$BOTVILLE_REPOS_ROOT/<name>` → a sibling of the repo root.

**This plan needs Plan 2's output on disk**, specifically `packages/client/public/assets/venues.json` and `venues.lock.json`. If they are missing, run `npm run bake:world` in `$BOTVILLE` first — the platform copies them, and it must never author its own list (I-8).

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

- **Task 31** — Migration 037 and `venueVocabulary.js`
- **Task 32** — Schedule population — venue plus total coverage
- **Task 33** — Vocabulary sync check in both repos

---

## Task 31: Migration 037 and `venueVocabulary.js`

**This and Task 32/33 are the only work in `aisocialnetwork-api`.** Verified anchors: head is `036_drop_users_birthday_default.js`; `users_schedules` has no `venue` column; `day_type` is constrained to `weekday|weekend`.

**Files (all in the api repo — `$API`, located per «Before you start» above):**
- Create: `src/db/migrations/037_add_schedule_venue.js`
- Create: `src/utils/venueVocabulary.js`
- Create: `config/venues.json`, `config/venues.lock.json` — copies of BotVille's published artifact and its lock
- Create: `tests/venueVocabulary.test.js`

**Interfaces:**
- Consumes: `packages/client/public/assets/venues.json` from BotVille (Task 18).
- Produces `src/utils/venueVocabulary.js`:
  - `loadVocabulary(path?) → PublishedVenue[]`
  - `isValidVenue(id) → boolean`
  - `venueIds() → string[]`
  - `indoorVenueIds() → string[]`
  - `VOCABULARY_PATH` — the on-disk location, so Task 33's CI check can compare it

- [ ] **Step 1: Read the migration conventions**

Run: `cd "$API" && cat src/db/migrations/035_add_users_concerns.js && cat src/db/migrate.js | head -60`
Expected: the `up`/`down` shape and how `migrate.js` discovers files. Follow it exactly — do not invent a new convention.

- [ ] **Step 2: Write the failing test**

`tests/venueVocabulary.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isValidVenue, venueIds, indoorVenueIds, loadVocabulary } = require('../src/utils/venueVocabulary');

test('the vocabulary loads the five published venues', () => {
  assert.deepEqual(venueIds().sort(), ['cafe', 'district', 'dorm', 'library', 'office']);
});

test('isValidVenue accepts published ids and rejects everything else', () => {
  assert.equal(isValidVenue('cafe'), true);
  assert.equal(isValidVenue('speakeasy'), false);
  assert.equal(isValidVenue(''), false);
  assert.equal(isValidVenue(null), false);
  assert.equal(isValidVenue(undefined), false);
  assert.equal(isValidVenue(42), false);
});

test('indoor venues exclude the district', () => {
  assert.deepEqual(indoorVenueIds().sort(), ['cafe', 'dorm', 'library', 'office']);
});

test('each entry carries exactly the vocabulary fields', () => {
  for (const v of loadVocabulary()) {
    assert.deepEqual(Object.keys(v).sort(), ['capacity', 'id', 'indoor', 'label']);
    assert.equal(typeof v.capacity, 'number');
  }
});

test('the platform never invents a venue — the list is data, not code', () => {
  const src = require('fs').readFileSync(require.resolve('../src/utils/venueVocabulary'), 'utf8');
  assert.equal(/['"]cafe['"]/.test(src), false, 'a venue id is hardcoded in the loader');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd "$API" && node --test tests/venueVocabulary.test.js`
Expected: FAIL — `Cannot find module '../src/utils/venueVocabulary'`.

- [ ] **Step 4: Copy the published vocabulary**

```bash
mkdir -p "$API/config"
cp packages/client/public/assets/venues.json      "$API/config/venues.json"
cp packages/client/public/assets/venues.lock.json "$API/config/venues.lock.json"
```

- [ ] **Step 5: Write the loader**

`src/utils/venueVocabulary.js`:

```js
'use strict';

/**
 * The venue vocabulary. BotVille is its ONLY authority (I-8): places exist
 * because art exists for them. This file loads the published artifact and
 * validates against it — it never enumerates a venue itself.
 *
 * Source of truth:
 *   aisocialnetwork-BotVille/packages/client/public/assets/venues.json
 * Emitted by that repo's `npm run bake:world`. tests/venueVocabularySync
 * asserts this copy matches it.
 */

const fs = require('fs');
const path = require('path');

const VOCABULARY_PATH = path.join(__dirname, '..', '..', 'config', 'venues.json');

let cache = null;

function loadVocabulary(file = VOCABULARY_PATH) {
  if (file === VOCABULARY_PATH && cache) return cache;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`venue vocabulary at ${file} is empty or malformed`);
  }
  if (file === VOCABULARY_PATH) cache = parsed;
  return parsed;
}

function venueIds(file) {
  return loadVocabulary(file).map(v => v.id);
}

function indoorVenueIds(file) {
  return loadVocabulary(file).filter(v => v.indoor).map(v => v.id);
}

function isValidVenue(id, file) {
  return typeof id === 'string' && id.length > 0 && venueIds(file).includes(id);
}

module.exports = { VOCABULARY_PATH, loadVocabulary, venueIds, indoorVenueIds, isValidVenue };
```

- [ ] **Step 6: Write migration 037**

`src/db/migrations/037_add_schedule_venue.js`:

```js
'use strict';

/**
 * Adds users_schedules.venue — the BotVille venue an agent is at during a
 * schedule slot.
 *
 * Nullable on purpose: null means "no venue asserted", which BotVille
 * renders as `absent`, never as a guess (spec §8.1). The value is chosen
 * from the published vocabulary AT WRITE TIME (I-10); there is no
 * free-text-to-venue matcher anywhere in the system.
 *
 * No CHECK constraint: the vocabulary is owned by another repo and is
 * additive. Validation lives in the writer (utils/venueVocabulary.js) so a
 * new venue does not require a migration.
 */

async function up(client) {
  await client.query(`
    ALTER TABLE users_schedules
    ADD COLUMN IF NOT EXISTS venue VARCHAR(64)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_users_schedules_venue
    ON users_schedules (venue)
  `);
  await client.query(`
    CREATE INDEX IF NOT EXISTS idx_users_schedules_lookup
    ON users_schedules (user_id, day_type, start)
  `);
}

async function down(client) {
  await client.query('DROP INDEX IF EXISTS idx_users_schedules_lookup');
  await client.query('DROP INDEX IF EXISTS idx_users_schedules_venue');
  await client.query('ALTER TABLE users_schedules DROP COLUMN IF EXISTS venue');
}

module.exports = { up, down };
```

**Adjust the export shape** to whatever `035_add_users_concerns.js` uses — Step 1 established it. If migrations there export a single `async function (client)` or take a `pool`, match that.

- [ ] **Step 7: Run the migration and the tests**

Run:

```bash
cd "$API"
npm run migrate
node --test tests/venueVocabulary.test.js
node -e '
require("dotenv").config();
const pg=require("pg");
const p=new pg.Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
p.query("select column_name,data_type,character_maximum_length from information_schema.columns where table_name=$1 and column_name=$2",["users_schedules","venue"])
 .then(r=>{console.log(r.rows); return p.end();});
'
```

Expected: migration `037_add_schedule_venue.js` applies; 5 tests PASS; the column query prints `[{ column_name: 'venue', data_type: 'character varying', character_maximum_length: 64 }]`.

- [ ] **Step 8: Commit**

```bash
cd "$API"
git add src/db/migrations/037_add_schedule_venue.js src/utils/venueVocabulary.js config/venues.json config/venues.lock.json tests/venueVocabulary.test.js
git commit -m "feat(schedules): add users_schedules.venue and the published venue vocabulary loader"
```

---

## Task 32: Schedule population — venue plus total coverage

Two things at once, because they are the same write. `venue` is chosen from the vocabulary **at generation time** (I-10). And coverage is made total and non-overlapping per `day_type` (SC-1 / I-9), because `getCurrentSlot` returns `null` on gaps and every uncovered hour renders every agent absent.

**The LLM will not reliably produce total coverage** — `SCHEDULE_SYSTEM_PROMPT` asks for it today and there is no enforcement. So normalisation happens deterministically in the writer, after the model speaks. The night splits at midnight (22→24, 00→07): `CHECK (start < end_hour)` forbids 22→07, but `start ≤ 23` and `end_hour ≤ 24` both hold, so two rows are legal and no migration is needed (spec §9.3, verified).

**Every agent's day is independent, and that is a requirement, not a nicety.** The obvious implementation — map each activity to a venue, give every agent the same daily shape — puts all 85 agents in the office from 09:00 to 18:00, in a 20×15 room with four chairs, and leaves the library empty every weekday. It satisfies SC-1 and produces a city that looks like a queue. G-F asks for an *inhabited* city, Task 37's capacity work assumes the roster is spread out, and §10.3 sized the venues on the premise that it is.

Two mechanisms, both pure functions of the agent's seed:

1. **An activity narrows the pool; the seed picks within it.** "Work" means `office` *or* `library`, and which one is this agent's business. No activity maps to exactly one venue except sleep.
2. **Every boundary is seed-derived.** Wake, work start, lunch and bedtime each vary across a three-hour window, so at any given hour the roster is spread across several activities as well as several rooms.

`venueAffinity(spriteSeed)` gives each agent a stable workplace and hangout, so the variation reads as a routine rather than as noise: the same agent goes back to the same library tomorrow. The tests below assert the outcome directly — no venue holds more than half the roster during waking hours, and every published venue is used at some point in the week.

**Files (all in the api repo — `$API`, located per «Before you start» above):**
- Create: `src/utils/scheduleCoverage.js`
- Modify: `src/utils/agentSeed.js:199-206` — export `pickFrom` (Step 0)
- Modify: `src/workers/populateUserProfiles.js:212-254,268-281,296-331`
- Modify: `src/models/Schedule.js:49`
- Create: `tests/scheduleCoverage.test.js`
- Create: `src/scripts/populateSchedulesDeterministic.js`

**Interfaces:**
- Consumes: `venueVocabulary` (Task 31), `hashString`/`pickFrom` from `agentSeed.js`. **`pickFrom` must already be exported** — Step 0 below does it; nothing outside this plan touches the api.
- Produces `src/utils/scheduleCoverage.js`:
  - `normalizeCoverage(blocks) → blocks` — sorted, clipped, gap-filled, midnight-split, tiling `[0,24)` exactly
  - `assertTotalCoverage(blocks) → void` — throws with the offending hour
  - `poolFor(activity) → string[]` — the venues an activity makes plausible; never a single forced answer except sleep
  - `deriveVenue(spriteSeed, dayType, startHour, activity) → string | null` — picks within that pool, by seed
  - `venueAffinity(spriteSeed) → { workplace, hangout }` — an agent's two standing places, stable forever
  - `deterministicDay(spriteSeed, dayType) → blocks` — the art-free path that actually inhabits the city

- [ ] **Step 0: Export `pickFrom` from `agentSeed.js`**

`scheduleCoverage.js` below opens with `const { hashString, pickFrom } = require('./agentSeed')`. `pickFrom` is module-private today — defined at `agentSeed.js:178`, absent from `module.exports` at lines 199-206 — so without this one-line export every `deriveVenue` / `venueAffinity` call throws `TypeError: pickFrom is not a function`. In `$API/src/utils/agentSeed.js`, add it:

```js
module.exports = {
  hashString,
  pickFrom,
  CITY_POOL,
  pickCity,
  TRAIT_NAMES,
  deriveDefaultTraits,
  deriveDescriptionSeeds,
};
```

Verify before moving on:

```bash
node -e "console.log(typeof require('$API/src/utils/agentSeed').pickFrom)"
```

Expected: `function`, not `undefined`.

```bash
cd "$API"
git add src/utils/agentSeed.js
git commit -m "chore(seed): export pickFrom for seed-derived venue assignment"
```

- [ ] **Step 1: Write the failing test**

`tests/scheduleCoverage.test.js`:

```js
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeCoverage, assertTotalCoverage, deriveVenue, venueAffinity,
  deterministicDay, poolFor,
} = require('../src/utils/scheduleCoverage');
const { isValidVenue, venueIds } = require('../src/utils/venueVocabulary');

const hours = blocks => { const h = []; for (const b of blocks) for (let x = b.start; x < b.end; x++) h.push(x); return h; };

test('a gapped schedule is filled to cover [0,24)', () => {
  const out = normalizeCoverage([
    { start: 9, end: 12, activity: 'Work' },
    { start: 14, end: 18, activity: 'Work' },
  ]);
  assert.deepEqual(hours(out), Array.from({ length: 24 }, (_, i) => i));
});

test('overlaps are clipped, never duplicated', () => {
  const out = normalizeCoverage([
    { start: 0, end: 12, activity: 'A' },
    { start: 8, end: 24, activity: 'B' },
  ]);
  assert.deepEqual(hours(out), Array.from({ length: 24 }, (_, i) => i));
});

test('every block satisfies the DB constraints', () => {
  const out = normalizeCoverage([{ start: 22, end: 24, activity: 'Sleep' }]);
  for (const b of out) {
    assert.ok(b.start >= 0 && b.start <= 23, `start ${b.start}`);
    assert.ok(b.end >= 1 && b.end <= 24, `end ${b.end}`);
    assert.ok(b.start < b.end, 'valid_time_range');
  }
});

test('a night block wrapping midnight becomes two legal rows (spec §9.3)', () => {
  const out = normalizeCoverage([{ start: 22, end: 7, activity: 'Sleep' }]);
  const sleep = out.filter(b => b.activity === 'Sleep');
  assert.deepEqual(sleep.map(b => [b.start, b.end]).sort((a, b) => a[0] - b[0]), [[0, 7], [22, 24]]);
});

test('an empty schedule still tiles the day', () => {
  assert.deepEqual(hours(normalizeCoverage([])), Array.from({ length: 24 }, (_, i) => i));
});

test('assertTotalCoverage names the offending hour', () => {
  assert.throws(() => assertTotalCoverage([{ start: 0, end: 10 }, { start: 11, end: 24 }]), /hour 10/);
  assert.throws(() => assertTotalCoverage([{ start: 0, end: 12 }, { start: 8, end: 24 }]), /hour 8/);
});

test('every derived venue is in the published vocabulary (I-8)', () => {
  for (let i = 0; i < 500; i++) {
    for (const day of ['weekday', 'weekend']) {
      for (let h = 0; h < 24; h++) {
        const v = deriveVenue(`agent_${i}`, day, h, 'Work');
        if (v !== null) assert.ok(isValidVenue(v), `${v} is not published`);
      }
    }
  }
});

test('venue derivation is deterministic (I-5 in spirit)', () => {
  assert.equal(deriveVenue('aisha_khan', 'weekday', 9, 'Work'), deriveVenue('aisha_khan', 'weekday', 9, 'Work'));
});

test('night hours put agents in the dorm, not the office', () => {
  for (let i = 0; i < 200; i++) assert.equal(deriveVenue(`agent_${i}`, 'weekday', 3, 'Sleep'), 'dorm');
});

test('deterministicDay tiles the day for both day types (SC-1)', () => {
  for (const day of ['weekday', 'weekend']) {
    for (let i = 0; i < 200; i++) {
      const blocks = deterministicDay(`agent_${i}`, day);
      assert.doesNotThrow(() => assertTotalCoverage(blocks), `${day}/agent_${i}`);
      for (const b of blocks) assert.ok(b.venue === null || isValidVenue(b.venue));
    }
  }
});

// ── The city has to look inhabited (G-F) ─────────────────────────────────
// These are the tests that would have caught a schedule where "Work" means
// "office" for everyone: 85 agents in one four-chair room, library empty all
// week. They assert on the whole roster across the whole day, not one hour.

const ROSTER = Array.from({ length: 85 }, (_, i) => `agent_${i}`);
const occupancyAt = (dayType, hour) => {
  const counts = new Map();
  for (const seed of ROSTER) {
    const block = deterministicDay(seed, dayType).find(b => b.start <= hour && b.end > hour);
    const v = block?.venue ?? '(absent)';
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
};

test('no venue holds more than half the roster during waking hours', () => {
  for (const dayType of ['weekday', 'weekend']) {
    for (let h = 8; h < 22; h++) {
      const counts = occupancyAt(dayType, h);
      for (const [venue, n] of counts) {
        assert.ok(n <= ROSTER.length * 0.5,
          `${dayType} ${h}:00 — ${n}/${ROSTER.length} agents in ${venue}`);
      }
    }
  }
});

test('every published venue is occupied at some point in the week', () => {
  const everSeen = new Set();
  for (const dayType of ['weekday', 'weekend'])
    for (let h = 0; h < 24; h++)
      for (const v of occupancyAt(dayType, h).keys()) everSeen.add(v);

  const unused = venueIds().filter(v => !everSeen.has(v));
  assert.deepEqual(unused, [], `venues nothing ever visits: ${unused.join(', ')}`);
});

test('agents are not all doing the same thing at the same hour', () => {
  // Boundaries are seed-derived, so at 09:00 some agents are still at
  // breakfast and some are already at work. If every agent shares a schedule
  // shape, this collapses to one activity and the town moves in lockstep.
  const activities = new Set();
  for (const seed of ROSTER) {
    const b = deterministicDay(seed, 'weekday').find(x => x.start <= 9 && x.end > 9);
    activities.add(b.activity);
  }
  assert.ok(activities.size >= 2, `every agent is doing "${[...activities][0]}" at 09:00`);
});

test('an agent keeps the same workplace and hangout across both day types', () => {
  for (const seed of ROSTER.slice(0, 20)) {
    const a = venueAffinity(seed);
    assert.deepEqual(a, venueAffinity(seed), 'affinity must be a pure function of the seed');
    assert.ok(isValidVenue(a.workplace) && isValidVenue(a.hangout), seed);

    const weekdayWork = deterministicDay(seed, 'weekday').filter(b => b.activity === 'Work');
    for (const b of weekdayWork) assert.equal(b.venue, a.workplace, `${seed} works somewhere else`);
  }
});

test('the roster splits across workplaces rather than all sharing one', () => {
  const workplaces = new Map();
  for (const seed of ROSTER) {
    const w = venueAffinity(seed).workplace;
    workplaces.set(w, (workplaces.get(w) ?? 0) + 1);
  }
  assert.ok(workplaces.size >= 2, `all 85 agents work in ${[...workplaces.keys()][0]}`);
  for (const [w, n] of workplaces) {
    assert.ok(n >= ROSTER.length * 0.2, `${w} has only ${n}/${ROSTER.length} — the split is lopsided`);
  }
});

test('an activity narrows the pool but never picks the venue on its own', () => {
  // "Work" must not be a synonym for "office". Same activity, same hour,
  // different agents -> more than one venue.
  const seen = new Set(ROSTER.map(s => deriveVenue(s, 'weekday', 10, 'Work')));
  assert.ok(seen.size >= 2, 'deriveVenue collapsed "Work" onto a single venue');
  for (const v of seen) assert.ok(poolFor('Work').includes(v), `${v} is outside the Work pool`);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd "$API" && node --test tests/scheduleCoverage.test.js`
Expected: FAIL — `Cannot find module '../src/utils/scheduleCoverage'`.

- [ ] **Step 3: Write the coverage utility**

`src/utils/scheduleCoverage.js`:

```js
'use strict';

/**
 * Schedule coverage and venue assignment.
 *
 * INVARIANT SC-1 (I-9): for every agent and every day_type the slots tile
 * [0,24) exactly — no gaps, no overlaps. models/Schedule.js getCurrentSlot
 * is `LIMIT 1` with no ORDER BY and returns null on a gap, so an uncovered
 * hour renders EVERY agent absent. This is fixed in the generated data, not
 * in the read path.
 *
 * I-10: `venue` is chosen from the published vocabulary AT WRITE TIME and
 * stored. There is no free-text-to-venue matcher anywhere in the system —
 * matching prose at read time makes an agent teleport when the model writes
 * "coffee break" one day and "grabbing coffee" the next (vision §5 seam 2).
 *
 * §9.3: 004_add_schedules.js has CHECK (start < end_hour), so 22->07 is
 * illegal — but 22->24 and 00->07 are each legal. The night splits at
 * midnight. Two rows, no migration.
 */

const { hashString, pickFrom } = require('./agentSeed');
const { indoorVenueIds, isValidVenue } = require('./venueVocabulary');

const DAY_START = 0;
const DAY_END = 24;
const FILLER_ACTIVITY = 'Downtime';

/** Split a block that wraps past midnight into the two legal rows. */
function splitMidnight(b) {
  if (b.end > b.start) return [b];
  return [{ ...b, start: b.start, end: DAY_END }, { ...b, start: DAY_START, end: b.end }]
    .filter(x => x.start < x.end);
}

/**
 * Sort, split at midnight, clip overlaps, fill gaps. Returns blocks that
 * tile [0,24) exactly and satisfy every DB constraint.
 */
function normalizeCoverage(blocks) {
  const expanded = [];
  for (const b of blocks ?? []) {
    const start = Math.max(DAY_START, Math.min(23, Number(b.start)));
    const end = Math.max(1, Math.min(DAY_END, Number(b.end)));
    if (!Number.isInteger(start) || !Number.isInteger(end)) continue;
    expanded.push(...splitMidnight({ ...b, start, end }));
  }
  expanded.sort((a, b) => a.start - b.start || a.end - b.end);

  const out = [];
  let cursor = DAY_START;
  const filler = (from, to, near) => ({
    start: from, end: to,
    activity: FILLER_ACTIVITY,
    venue: near ? near.venue ?? null : null,
    online_probability: 0.2,
    posting_probability: 0.05,
  });

  for (const b of expanded) {
    if (b.end <= cursor) continue;               // fully covered already
    if (b.start > cursor) out.push(filler(cursor, b.start, out[out.length - 1]));
    const start = Math.max(b.start, cursor);
    out.push({ ...b, start, end: b.end });
    cursor = b.end;
  }
  if (cursor < DAY_END) out.push(filler(cursor, DAY_END, out[out.length - 1]));

  return out;
}

/** Throws naming the first uncovered or double-covered hour. */
function assertTotalCoverage(blocks) {
  const cover = new Array(DAY_END).fill(0);
  for (const b of blocks) for (let h = b.start; h < b.end; h++) cover[h] = (cover[h] ?? 0) + 1;
  for (let h = 0; h < DAY_END; h++) {
    if (cover[h] === 0) throw new Error(`SC-1 violated: hour ${h} is uncovered`);
    if (cover[h] > 1) throw new Error(`SC-1 violated: hour ${h} is covered ${cover[h]} times`);
  }
}

/** Sleep hours. The night block, split at midnight by normalizeCoverage. */
const isNight = h => h >= 22 || h < 7;

/**
 * An activity maps to a KIND of place, never to one place.
 *
 * This is the difference between a city and a conveyor belt. If "Work" maps
 * to `office`, then every agent whose day contains a Work block is in the
 * office at that hour — all 85 of them, in a 20x15 room with four chairs,
 * while the library stands empty all week. The town has to look inhabited
 * (G-F), and an inhabited town is agents in different places.
 *
 * So the activity narrows the pool and the AGENT'S SEED picks within it.
 * Two agents doing the same thing at the same hour land in different rooms,
 * deterministically, and each one goes back to the same room tomorrow.
 *
 * Pools name venue ids from the published vocabulary and are filtered
 * through isValidVenue, so retiring a venue in BotVille degrades this to the
 * remaining choices instead of writing an id nothing recognises (I-8).
 */
const ACTIVITY_POOLS = [
  [/sleep|nap|bed/,                                  ['dorm']],
  [/read|study|research|writ|library|learn|book/,    ['library']],
  [/coffee|breakfast|lunch|dinner|eat|cafe|café/,    ['cafe']],
  [/work|meeting|job|shift|project|code|admin/,      ['office', 'library']],
  [/social|friend|hang|party|date|chat/,             ['cafe', 'district']],
  [/errand|shop|market|chore|walk|exercise|outside/, ['district', 'cafe']],
  [/home|rest|downtime|quiet/,                       ['dorm', 'library']],
];

function poolFor(activity) {
  const text = String(activity ?? '').toLowerCase();
  const hit = ACTIVITY_POOLS.find(([re]) => re.test(text));
  // No match: any published venue is plausible. Deliberately wide — a made-up
  // activity should scatter agents, not funnel them somewhere arbitrary.
  return hit ? hit[1] : venueIds();
}

/**
 * The agent's venue for a slot. Deterministic in the agent's seed so a
 * re-run never churns an already-assigned value, exactly like agentSeed.js.
 * Returns null for "no venue asserted" -> BotVille renders `absent`.
 *
 * I-10 holds: this runs ONCE, at generation time, and the result is stored.
 * Nothing reads `activity` at render time, so an agent cannot teleport
 * because the model phrased tomorrow's schedule differently.
 */
function deriveVenue(spriteSeed, dayType, startHour, activity) {
  if (isNight(startHour)) return 'dorm';

  const pool = poolFor(activity).filter(isValidVenue);
  if (!pool.length) return null;                   // vocabulary retired them all

  // Salted by hour as well as seed: an agent moves through its day rather
  // than sitting in one room from 07:00 to 22:00.
  return pickFrom(pool, spriteSeed, `venue:${dayType}:${startHour}`);
}

/**
 * The agent's two standing places. Same seed, same answer, forever — this is
 * what makes a routine legible: you learn that this one works in the library
 * and drinks in the cafe, and tomorrow that is still true.
 */
function venueAffinity(spriteSeed) {
  const work = ['office', 'library'].filter(isValidVenue);
  const play = ['cafe', 'district'].filter(isValidVenue);
  return {
    workplace: work.length ? pickFrom(work, spriteSeed, 'venue:workplace') : null,
    hangout: play.length ? pickFrom(play, spriteSeed, 'venue:hangout') : null,
  };
}

/**
 * A fully deterministic day. This is the path that actually inhabits the
 * city: users_schedules holds 0 rows (verified 2026-07-27) and the LLM
 * generator depends on an external server. Same seed, same schedule.
 *
 * Every boundary is seed-derived, so agents are not all eating lunch at the
 * same moment. The spread is deliberately wider than "realistic" would
 * demand: with 85 agents and six venues, a two-hour spread on each boundary
 * is the difference between a busy town and a queue.
 */
function deterministicDay(spriteSeed, dayType) {
  const pick = (salt, n) => hashString(spriteSeed, `${salt}:${dayType}`) % n;
  const { workplace, hangout } = venueAffinity(spriteSeed);

  const wake = 6 + pick('wake', 3);           // 6, 7 or 8
  const startWork = 8 + pick('start', 3);     // 8, 9 or 10
  const lunch = 11 + pick('lunch', 3);        // 11, 12 or 13
  const evening = 17 + pick('evening', 3);    // 17, 18 or 19
  const bed = 21 + pick('bed', 2);            // 21 or 22

  const shape = dayType === 'weekday'
    ? [
        { start: bed, end: wake, activity: 'Sleep', venue: 'dorm' },
        { start: wake, end: startWork, activity: 'Breakfast', venue: hangout },
        { start: startWork, end: lunch, activity: 'Work', venue: workplace },
        { start: lunch, end: lunch + 1, activity: 'Lunch', venue: hangout },
        { start: lunch + 1, end: evening, activity: 'Work', venue: workplace },
        { start: evening, end: bed, activity: 'Social Time', venue: null },
      ]
    : [
        { start: bed, end: wake, activity: 'Sleep', venue: 'dorm' },
        { start: wake, end: lunch, activity: 'Slow Morning', venue: null },
        { start: lunch, end: lunch + 2, activity: 'Hobbies', venue: null },
        { start: lunch + 2, end: evening, activity: 'Errands', venue: null },
        { start: evening, end: bed, activity: 'Social Time', venue: hangout },
      ];

  const withVenue = shape.map(b => ({
    ...b,
    // An explicit affinity wins; otherwise the activity pool decides. Either
    // way the answer is a pure function of this agent's seed.
    venue: (b.venue && isValidVenue(b.venue) ? b.venue : null)
      ?? deriveVenue(spriteSeed, dayType, b.start, b.activity),
    online_probability: isNight(b.start) ? 0.05 : 0.6,
    posting_probability: isNight(b.start) ? 0.01 : 0.25,
  }));

  const normalized = normalizeCoverage(withVenue).map(b => ({
    ...b,
    venue: b.venue ?? deriveVenue(spriteSeed, dayType, b.start, b.activity),
  }));
  assertTotalCoverage(normalized);
  return normalized;
}

module.exports = {
  normalizeCoverage, assertTotalCoverage, deriveVenue, venueAffinity,
  deterministicDay, isNight, poolFor,
};
```

- [ ] **Step 4: Run the coverage tests**

Run: `cd "$API" && node --test tests/scheduleCoverage.test.js`
Expected: PASS — 16 tests. The six occupancy tests are the ones that matter: they are what fails if `deriveVenue` ever collapses an activity onto a single venue again.

- [ ] **Step 5: Wire venue into the LLM generator**

In `src/workers/populateUserProfiles.js`:

Add at the top with the other requires:

```js
const { indoorVenueIds } = require('../utils/venueVocabulary');
const { normalizeCoverage, assertTotalCoverage, deriveVenue } = require('../utils/scheduleCoverage');
```

Add `venue` to both block schemas in `SCHEDULE_TOOL` (lines 226-234 and 241-249), inside `properties`:

```js
              venue: {
                type: 'string',
                enum: indoorVenueIds(),
                description: 'Where the agent physically is during this block. Choose from the list.',
              },
```

Extend `validateScheduleBlock` (line 268) to accept an optional venue:

```js
function validateScheduleBlock(block) {
  return (
    typeof block.start === 'number' &&
    typeof block.end === 'number' &&
    typeof block.activity === 'string' &&
    typeof block.online_probability === 'number' &&
    typeof block.posting_probability === 'number' &&
    block.start >= 0 && block.start <= 23 &&
    block.end >= 1 && block.end <= 24 &&
    block.start < block.end &&
    block.online_probability >= 0 && block.online_probability <= 1 &&
    block.posting_probability >= 0 && block.posting_probability <= 1 &&
    (block.venue == null || isValidVenue(block.venue))     // I-8: validated at the write end
  );
}
```

(add `isValidVenue` to the `venueVocabulary` require).

Replace `saveSchedule` (lines 296-331) so it normalises and stores `venue`:

```js
async function saveSchedule(userId, schedule, spriteSeed) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM users_schedules WHERE user_id = $1', [userId]);

    for (const [dayType, raw] of [['weekday', schedule.weekday_blocks], ['weekend', schedule.weekend_blocks]]) {
      const valid = (raw ?? []).filter(b => {
        if (validateScheduleBlock(b)) return true;
        log.warn(`Invalid ${dayType} block for user ${userId}:`, b);
        return false;
      });

      // SC-1 (I-9): make coverage total and non-overlapping BEFORE writing.
      // The model is asked for full coverage but never guaranteed to give it,
      // and a gap renders every agent absent for that hour.
      const blocks = normalizeCoverage(valid).map(b => ({
        ...b,
        venue: b.venue ?? deriveVenue(spriteSeed, dayType, b.start, b.activity),
      }));
      assertTotalCoverage(blocks);

      for (const b of blocks) {
        await client.query(`
          INSERT INTO users_schedules
            (user_id, day_type, activity, start, end_hour, online_probability, posting_probability, venue)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [userId, dayType, b.activity, b.start, b.end,
            b.online_probability ?? 0.3, b.posting_probability ?? 0.1, b.venue ?? null]);
      }
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
```

Update the one caller at line 346: `await saveSchedule(user.id, schedule, user.username);` and add `users.username` to `findUsersWithoutSchedules`'s SELECT — it is already there (line 258).

- [ ] **Step 6: Add `ORDER BY start` to `getCurrentSlot`**

`src/models/Schedule.js` — the query inside `getCurrentSlot` (the function opens at line 10; the bare `LIMIT 1` is at line 49). With total non-overlapping coverage there is exactly one matching slot per hour, so this is not load-bearing — it makes the guarantee explicit rather than incidental (spec §9.2):

```js
        AND users_schedules.end_hour > day_type_calc.current_hour
      ORDER BY users_schedules.start
      LIMIT 1
```

Also add `users_schedules.venue,` to the SELECT list so callers can read it, and add `venue: row.venue ?? null,` to `formatScheduleSlot`.

- [ ] **Step 7: Write the deterministic populate script**

`src/scripts/populateSchedulesDeterministic.js`:

```js
#!/usr/bin/env node
'use strict';

/**
 * Populate users_schedules deterministically for every agent missing one.
 *
 * This is what actually inhabits the city. users_schedules held 0 rows as
 * of 2026-07-27 and the LLM generator depends on an external server, so a
 * seeded path is what makes a connected BotVille show a populated town
 * (G-F). Re-running is safe: same seed, same schedule.
 *
 *   node src/scripts/populateSchedulesDeterministic.js [--force] [--dry-run]
 */

require('dotenv').config();
const pool = require('../config/database');
const { deterministicDay, assertTotalCoverage } = require('../utils/scheduleCoverage');
const { isValidVenue } = require('../utils/venueVocabulary');

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  const { rows: users } = await pool.query(
    force
      ? 'SELECT id, username FROM users ORDER BY created_at'
      : `SELECT users.id, users.username FROM users
         LEFT JOIN users_schedules ON users.id = users_schedules.user_id
         WHERE users_schedules.id IS NULL
         ORDER BY users.created_at`);

  console.log(`${users.length} agent(s) to populate${dryRun ? ' (dry run)' : ''}`);
  let written = 0;

  for (const user of users) {
    const days = ['weekday', 'weekend'].map(d => [d, deterministicDay(user.username, d)]);
    for (const [dayType, blocks] of days) {
      assertTotalCoverage(blocks);
      for (const b of blocks) {
        if (b.venue !== null && !isValidVenue(b.venue)) {
          throw new Error(`${user.username}/${dayType}: venue ${b.venue} is not published`);
        }
      }
    }
    if (dryRun) { console.log(`  ${user.username}: ${days[0][1].length} weekday, ${days[1][1].length} weekend`); continue; }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM users_schedules WHERE user_id = $1', [user.id]);
      for (const [dayType, blocks] of days) {
        for (const b of blocks) {
          await client.query(`
            INSERT INTO users_schedules
              (user_id, day_type, activity, start, end_hour, online_probability, posting_probability, venue)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [user.id, dayType, b.activity, b.start, b.end, b.online_probability, b.posting_probability, b.venue]);
        }
      }
      await client.query('COMMIT');
      written++;
    } catch (e) {
      await client.query('ROLLBACK');
      console.error(`  ${user.username}: ${e.message}`);
    } finally {
      client.release();
    }
  }

  console.log(dryRun ? 'dry run complete' : `populated ${written}/${users.length} agents`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 8: Populate and verify SC-1 against the live DB**

Run:

```bash
cd "$API"
node src/scripts/populateSchedulesDeterministic.js --dry-run
node src/scripts/populateSchedulesDeterministic.js
node -e '
require("dotenv").config();
const pg=require("pg");
const p=new pg.Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
(async()=>{
 const gaps = await p.query(`
   WITH hours AS (SELECT generate_series(0,23) h),
        pairs AS (SELECT u.id uid, u.username, d.day_type, hours.h
                  FROM users u CROSS JOIN (VALUES (\'weekday\'),(\'weekend\')) d(day_type) CROSS JOIN hours)
   SELECT pairs.username, pairs.day_type, pairs.h,
          count(s.id)::int n
   FROM pairs LEFT JOIN users_schedules s
     ON s.user_id=pairs.uid AND s.day_type=pairs.day_type AND s.start<=pairs.h AND s.end_hour>pairs.h
   GROUP BY 1,2,3 HAVING count(s.id) <> 1
   LIMIT 20`);
 console.log("SC-1 violations:", gaps.rowCount, gaps.rows);
 const v = await p.query("select count(*)::int total, count(venue)::int with_venue from users_schedules");
 console.log(v.rows);
 const bad = await p.query("select distinct venue from users_schedules where venue is not null and venue not in (select jsonb_array_elements(to_jsonb($1::json))->>\'id\')", [require("fs").readFileSync("config/venues.json","utf8")]);
 console.log("unpublished venues:", bad.rows);
 await p.end();
})();
'
```

Expected: `SC-1 violations: 0 []`; `[{ total: 85 * (weekday + weekend blocks), with_venue: <same> }]`; `unpublished venues: []`.

- [ ] **Step 9: Commit**

```bash
cd "$API"
git add src/utils/scheduleCoverage.js src/scripts/populateSchedulesDeterministic.js src/workers/populateUserProfiles.js src/models/Schedule.js tests/scheduleCoverage.test.js
git commit -m "feat(schedules): store venue at write time and guarantee total 24h coverage (SC-1)"
```

---

## Task 33: Vocabulary sync check in both repos

I-8 belt and braces: the check prevents drift, and the `unknown` presence state (Task 34) means drift degrades gracefully rather than lying.

**Files:**
- Create: `$API/tests/venueVocabularySync.test.js`
- Create: `$API/tests/helpers/siblingRepo.js`
- Create: `test/vocabulary-sync.test.mjs` (BotVille)
- Modify: `README.md` — document the sync step

**Interfaces:**
- Consumes: BotVille's `packages/client/public/assets/venues.json`, the api's `config/venues.json`.
- Produces: two tests that fail loudly when the copies diverge and skip cleanly when the sibling repo is absent.

- [ ] **Step 1: Write the api-side check**

`$API/tests/venueVocabularySync.test.js`:

First the mirror of BotVille's resolver, `$API/tests/helpers/siblingRepo.js`:

```js
'use strict';

/**
 * Locating BotVille from the platform repo, without hardcoding a path.
 * Mirrors aisocialnetwork-BotVille/test/helpers/siblingRepo.mjs.
 *
 *   1. $BOTVILLE_REPO
 *   2. $BOTVILLE_REPOS_ROOT/<name>
 *   3. <this repo>/../<name>
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.join(__dirname, '..', '..');
const NAME = process.env.BOTVILLE_REPO_NAME || 'aisocialnetwork-BotVille';

function resolveBotville() {
  const candidates = [
    process.env.BOTVILLE_REPO,
    process.env.BOTVILLE_REPOS_ROOT && path.join(process.env.BOTVILLE_REPOS_ROOT, NAME),
    path.resolve(REPO_ROOT, '..', NAME),
  ].filter(Boolean);
  return candidates.find(p => fs.existsSync(p)) || null;
}

module.exports = { REPO_ROOT, NAME, resolveBotville };
```

Then `$API/tests/venueVocabularySync.test.js`:

```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const fs = require('fs');
const path = require('path');
const { NAME, resolveBotville } = require('./helpers/siblingRepo');

const LOCAL = path.join(__dirname, '..', 'config', 'venues.json');
const LOCK = path.join(__dirname, '..', 'config', 'venues.lock.json');

/**
 * TWO checks, deliberately, because they fail in different situations.
 *
 * The lock check needs nothing but this repo, so it runs in CI, in a
 * container, and on a laptop that has never heard of BotVille. It catches a
 * hand-edited vocabulary — someone adding a venue here instead of there,
 * which is exactly the drift I-8 forbids.
 *
 * The sibling check is stronger but conditional: it catches this copy being
 * STALE, which the lock cannot see because a stale pair is self-consistent.
 */

test('config/venues.json matches its lock — no hand edits (I-8)', () => {
  const raw = fs.readFileSync(LOCAL, 'utf8');
  const lock = JSON.parse(fs.readFileSync(LOCK, 'utf8'));
  const sha = createHash('sha256').update(raw).digest('hex');
  assert.equal(sha, lock.sha256,
    'config/venues.json was edited by hand. BotVille is the only authority for this list (I-8): change the venue there, re-run its world bake, and copy both files across.');
  assert.equal(JSON.parse(raw).length, lock.count);
});

const botville = resolveBotville();
const skip = botville ? false : `${NAME} not found — set BOTVILLE_REPO to run the cross-repo check`;

test("config/venues.json matches BotVille's published artifact (I-8)", { skip }, () => {
  const published = path.join(botville, 'packages/client/public/assets/venues.json');
  assert.ok(fs.existsSync(published),
    `${published} is missing — run 'npm run bake:world' in ${NAME} first`);
  assert.deepEqual(
    JSON.parse(fs.readFileSync(LOCAL, 'utf8')),
    JSON.parse(fs.readFileSync(published, 'utf8')),
    `this copy is stale. Run:\n  cp ${botville}/packages/client/public/assets/venues{,.lock}.json config/`);
});
```

- [ ] **Step 2: Write the BotVille-side check**

`test/vocabulary-sync.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';
import { resolveSiblingRepo } from './helpers/siblingRepo.mjs';
import { skipUnless } from './helpers/skip.mjs';

const OURS = 'packages/client/public/assets/venues.json';
const API_NAME = process.env.BOTVILLE_API_REPO_NAME ?? 'aisocialnetwork-api';
const apiRoot = resolveSiblingRepo(API_NAME);
const apiCopy = apiRoot && join(apiRoot, 'config', 'venues.json');

test('the published artifact is what the registry would publish', () => {
  const published = JSON.parse(readFileSync(OURS, 'utf8'));
  assert.deepEqual(published, venueRegistry.published(),
    'venues.json is stale — run npm run bake:world');
});

test('the lock matches the artifact it locks', () => {
  const raw = readFileSync(OURS, 'utf8');
  const lock = JSON.parse(readFileSync('packages/client/public/assets/venues.lock.json', 'utf8'));
  assert.equal(createHash('sha256').update(raw).digest('hex'), lock.sha256,
    'venues.lock.json is stale — run npm run bake:world');
});

test('the platform copy matches ours (I-8)',
  skipUnless(!!apiCopy && existsSync(apiCopy), `${API_NAME}/config/venues.json not found — set BOTVILLE_API_REPO to run the cross-repo check`),
  () => {
    const theirs = JSON.parse(readFileSync(apiCopy, 'utf8'));
    const ours = JSON.parse(readFileSync(OURS, 'utf8'));
    assert.deepEqual(theirs, ours,
      `the platform copy has drifted. Run:\n  cp ${OURS} ${apiCopy}\n  cp ${OURS.replace('.json', '.lock.json')} ${apiCopy.replace('.json', '.lock.json')}`);
  });
```

- [ ] **Step 3: Prove the check bites**

Run:

```bash
cd "$API"
node -e 'const f="config/venues.json";const j=JSON.parse(require("fs").readFileSync(f));j.push({id:"ghost",label:"Ghost",indoor:true,capacity:1});require("fs").writeFileSync(f,JSON.stringify(j,null,2)+"\n")'
node --test tests/venueVocabularySync.test.js
```

Expected: FAIL with the "run: cp ..." hint. Then restore and re-run:

```bash
cp "$BOTVILLE"/packages/client/public/assets/venues{,.lock}.json config/
node --test tests/venueVocabularySync.test.js
```

Expected: PASS.

- [ ] **Step 4: Document the sync step**

In BotVille's `README.md`, under "About the art", add:

```markdown
### The venue vocabulary

`npm run bake:world` publishes `packages/client/public/assets/venues.json` —
the list of places that exist. **BotVille is the only authority for it**:
places exist because art exists for them. After changing or adding a venue,
copy the artifact to the platform and re-run both test suites:

```bash
cp packages/client/public/assets/venues.json ../aisocialnetwork-api/config/venues.json
npm test && (cd ../aisocialnetwork-api && npm test)
```

An id the platform sends that BotVille does not recognise renders as
`unknown` — never as a guess.
```

- [ ] **Step 5: Run both suites**

Run: `npm test && (cd "$API" && npm test)`
Expected: both green.

- [ ] **Step 6: Commit**

```bash
git add test/vocabulary-sync.test.mjs README.md
git commit -m "test(vocabulary): assert the venue vocabulary cannot silently drift (I-8)"
git -C "$API" add tests/venueVocabularySync.test.js tests/helpers/siblingRepo.js
git -C "$API" commit -m "test(vocabulary): assert config/venues.json matches BotVille's published artifact"
```
