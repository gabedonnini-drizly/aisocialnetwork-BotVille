# BotVille Visual Assets — Plan 5: The platform seam

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Plan 5 of 6.** Index and sequencing: [`00-INDEX.md`](00-INDEX.md). Spec: `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md` (commit `d695881`) — approved, do not re-brainstorm.

**Goal:** Give schedules a stored venue and total 24-hour coverage, so a connected BotVille shows an inhabited city and the two repos cannot drift on what a venue is.

**Architecture:** One migration adds `users_schedules.venue`. `venueVocabulary.js` loads BotVille’s published `venues.json` and validates against it — it never enumerates a venue itself. `scheduleCoverage.js` normalises generated schedules to tile `[0,24)` exactly per `day_type` and assigns each block a venue at **write** time, by **querying the published affordances** (addendum §I.1): an activity resolves to an affordance token, `deriveVenuesAffording` returns the open venues supporting it, and the agent’s seed picks within that pool. Sleep goes to the agent’s own residence via the creation-order-stable `deriveHomeVenue` (addendum §I.2) — pure function, zero rows. No venue id is named in api code, anywhere. A lock file lets the platform prove its copy is intact without needing BotVille on disk.

**Tech Stack:** Node ≥24 (ESM), TypeScript 5.7, Phaser ^3.88.2 declared / 3.90.0 installed, Vite 6, npm workspaces + Turbo, `node:test` (no new test dependency), the existing `scripts/png-lib.mjs` PNG codec, Postgres (`aisocialnetwork-api` only), Docker Compose (the self-hosted deployment packaging, D-20 — created by Plan 6 Task 35; no Docker artifact exists in the repo today).

**Depends on:** Plan 2 — the published `venues.json` and `venues.lock.json` — Plan 3 — `venueRegistry.ts`, which Task 33's BotVille-side sync test imports — and Plan 1's `test/helpers/siblingRepo.mjs` for locating `$API`. **This is the only plan that touches `aisocialnetwork-api`** — every api-side change, including the one-line `pickFrom` export (Task 32 Step 0), lives here.

**Exit criterion:** SC-1 holds for every agent and both day types against the live DB; every stored venue is in the published vocabulary; no venue holds more than half the roster at **any** hour — nights included, now that sleep distributes across residences (F-12 resolved per the addendum's night rule) and the seeded night-owl minority spreads across the night-open venues; both repos’ vocabulary checks pass.

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

**This plan needs Plan 2's output on disk**, specifically `packages/client/public/assets/venues.json`, `venues.lock.json` and `venues.schema.json`. If they are missing, run `npm run bake:world` in `$BOTVILLE` first — the platform copies them, and it must never author its own list (I-8).

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
- **Deployment is self-hosted (D-20), like the BotTown api and frontend.** Local dev servers for development; production is the owner's own server, Docker-packaged for convenience. `vercel.json`, `railway.toml` and the `deploy:*` scripts are retired legacy. No raw sheets or `assets-src/` in any image pushed anywhere (I-12); real-art bakes happen on the host, never in a committed image. See Task 35.
- **Invariants I-1 … I-13 (spec §11) are binding.** Each is asserted by a named test in this plan.
- **Scope bar (owner, binding):** art-driven changes only. Do not repoint `packages/client/src/lib/api.ts`, do not delete or modify `packages/server/src/world/agentLife.ts`, do not replace SQLite, do not touch the key vault / model picker / heartbeat / MCP registry. This is not the integration work.

---

**Api-repo exemption (this plan only).** The constraints block above is shared verbatim across all six plans and describes the **BotVille** repo. Work performed inside `$API` (`aisocialnetwork-api`) follows *that* repo's conventions instead: CommonJS (`'use strict'`, `require`/`module.exports`), the Node version the api pins (22 — do not add an `engines` bump), and its `tests/` layout under `node --test`. The Node ≥ 24 / ESM / workspace bullets bind only the BotVille side of this plan; everything genuinely cross-repo (no hardcoded sibling paths, no new dependencies, derived test expectations, I-8) binds both.

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
- Create: `tests/db/migrations/037_add_schedule_venue.test.js` — the paired migration lint test; every migration since 030 ships one
- Create: `src/utils/venueVocabulary.js`
- Create: `config/venues.json`, `config/venues.lock.json`, `config/venues.schema.json` — copies of BotVille's published artifact, its lock and its schema
- Create: `tests/venueVocabulary.test.js`

**Interfaces:**
- Consumes: `packages/client/public/assets/venues.json` from BotVille (Task 18) — each entry carrying `id, label, indoor, capacity, archetype, roles, affords, hours` per `venues.schema.json` (addendum §I.1 and its Conventions table).
- Produces `src/utils/venueVocabulary.js`:
  - `loadVocabulary(path?) → PublishedVenue[]` — **validates the schema'd shape at load time** (the api end of the Conventions table's "validated at both ends"; structural checks, no JSON-Schema engine — the api has no such dependency and gains none)
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

test('the vocabulary carries the public venues and the baked residences', () => {
  const ids = venueIds();
  for (const id of ['cafe', 'district', 'dorm', 'library', 'office']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate venue id');
});

test('residence instances are published and afford sleep (addendum I.2)', () => {
  const homes = loadVocabulary().filter(v => v.roles.includes('home'));
  assert.ok(homes.length >= 1, 'no residences published — re-run BotVille\'s bake and re-copy');
  for (const h of homes) assert.ok(h.affords.includes('sleep'), h.id);
  // Only residences afford sleep: the schedule writer cannot put a sleeping
  // agent anywhere else (the F-12 night rule, by data).
  assert.deepEqual(loadVocabulary().filter(v => v.affords.includes('sleep')), homes);
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
  const indoor = indoorVenueIds();
  assert.equal(indoor.includes('district'), false);
  for (const id of ['cafe', 'dorm', 'library', 'office']) assert.ok(indoor.includes(id), id);
});

test('each entry carries exactly the schema fields (venues.schema.json)', () => {
  for (const v of loadVocabulary()) {
    assert.deepEqual(Object.keys(v).sort(),
      ['affords', 'archetype', 'capacity', 'hours', 'id', 'indoor', 'label', 'roles']);
    assert.equal(typeof v.capacity, 'number');
    for (const w of v.hours) assert.ok(w.open >= 0 && w.close <= 24 && w.open < w.close, v.id);
  }
});

test('a copy missing the affordance fields is refused at load time', () => {
  const { mkdtempSync, writeFileSync } = require('fs');
  const { join } = require('path');
  const { tmpdir } = require('os');
  const file = join(mkdtempSync(join(tmpdir(), 'vocab-')), 'venues.json');
  writeFileSync(file, JSON.stringify([{ id: 'cafe', label: 'Café', indoor: true, capacity: 9 }]));
  assert.throws(() => loadVocabulary(file), /roles/,
    'the loader must name the missing field — this is the api end of the schema check');
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
cp packages/client/public/assets/venues.json        "$API/config/venues.json"
cp packages/client/public/assets/venues.lock.json   "$API/config/venues.lock.json"
cp packages/client/public/assets/venues.schema.json "$API/config/venues.schema.json"
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
 *
 * The artifact is governed by config/venues.schema.json (2026-07-29 addendum,
 * Conventions table: schema'd files are validated at BOTH ends). This loader
 * is the api end: a dependency-free structural check mirroring the schema —
 * the api ships no JSON-Schema engine and gains none.
 */

const fs = require('fs');
const path = require('path');

const VOCABULARY_PATH = path.join(__dirname, '..', '..', 'config', 'venues.json');

/** Mirrors config/venues.schema.json `required`. */
const REQUIRED_FIELDS = ['id', 'label', 'indoor', 'capacity', 'archetype', 'roles', 'affords', 'hours'];
const LIST_FIELDS = ['roles', 'affords', 'hours'];

function assertVocabularyShape(parsed, file) {
  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new Error(`venue vocabulary at ${file} is empty or malformed`);
  }
  for (const v of parsed) {
    for (const field of REQUIRED_FIELDS) {
      if (!(field in v)) {
        throw new Error(`venue vocabulary at ${file}: entry "${v.id ?? '?'}" is missing "${field}" (see config/venues.schema.json)`);
      }
    }
    for (const field of LIST_FIELDS) {
      if (!Array.isArray(v[field])) {
        throw new Error(`venue vocabulary at ${file}: entry "${v.id}" field "${field}" must be an array`);
      }
    }
  }
}

let cache = null;

function loadVocabulary(file = VOCABULARY_PATH) {
  if (file === VOCABULARY_PATH && cache) return cache;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  assertVocabularyShape(parsed, file);
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

- [ ] **Step 6b: Write the paired migration lint test**

Every migration since 030 ships a lint test under `tests/db/migrations/`; 037 is no exception. Create `tests/db/migrations/037_add_schedule_venue.test.js` following the pattern of the latest existing migration test (036's) exactly — same requires, same assertion style — adjusted for what 037 declares: the `venue` column (`VARCHAR(64)`, nullable, no CHECK — the vocabulary is another repo's, validated in the writer) and the two indexes, with `down` dropping all three in reverse.

- [ ] **Step 7: Run the migration and the tests**

Run:

```bash
cd "$API"
npm run migrate
node --test tests/venueVocabulary.test.js tests/db/migrations/037_add_schedule_venue.test.js
node -e '
require("dotenv").config();
const pg=require("pg");
const p=new pg.Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,database:process.env.DB_NAME,user:process.env.DB_USER,password:process.env.DB_PASSWORD});
p.query("select column_name,data_type,character_maximum_length from information_schema.columns where table_name=$1 and column_name=$2",["users_schedules","venue"])
 .then(r=>{console.log(r.rows); return p.end();});
'
```

Expected: migration `037_add_schedule_venue.js` applies; the 7 vocabulary tests plus the migration lint test PASS; the column query prints `[{ column_name: 'venue', data_type: 'character varying', character_maximum_length: 64 }]`.

- [ ] **Step 8: Commit**

```bash
cd "$API"
git add src/db/migrations/037_add_schedule_venue.js tests/db/migrations/037_add_schedule_venue.test.js src/utils/venueVocabulary.js config/venues.json config/venues.lock.json config/venues.schema.json tests/venueVocabulary.test.js
git commit -m "feat(schedules): add users_schedules.venue and the schema-validated venue vocabulary loader"
```

---

## Task 32: Schedule population — venue plus total coverage

Two things at once, because they are the same write. `venue` is chosen from the vocabulary **at generation time** (I-10). And coverage is made total and non-overlapping per `day_type` (SC-1 / I-9), because `getCurrentSlot` returns `null` on gaps and every uncovered hour renders every agent absent.

**The LLM will not reliably produce total coverage** — `SCHEDULE_SYSTEM_PROMPT` asks for it today and there is no enforcement. So normalisation happens deterministically in the writer, after the model speaks. The night splits at midnight (22→24, 00→07): `CHECK (start < end_hour)` forbids 22→07, but `start ≤ 23` and `end_hour ≤ 24` both hold, so two rows are legal and no migration is needed (spec §9.3, verified).

**Every agent's day is independent, and that is a requirement, not a nicety.** The obvious implementation — map each activity to a venue, give every agent the same daily shape — puts all 85 agents in the office from 09:00 to 18:00, in a 20×15 room with four chairs, and leaves the library empty every weekday. It satisfies SC-1 and produces a city that looks like a queue. G-F asks for an *inhabited* city, Task 37's capacity work assumes the roster is spread out, and §10.3 sized the venues on the premise that it is.

Four mechanisms, all pure functions:

1. **An activity resolves to an affordance; the venues affording it are the pool; the seed picks within it** (addendum §I.1). "Work" resolves to the `work` affordance, which today the office and the library afford — and which one is this agent's business. No activity names a venue, ever.
2. **Sleep goes home** (addendum §I.2, Part 0 — the night rule that resolves F-12). `deriveHomeVenue(agent, roster, residences)` assigns each agent a residence by roster **creation order**, filling each residence to its *published capacity* before the next opens. Both the roster prefix and the residence instance list are stable, so an existing agent's home never changes when the town grows — with zero stored rows. When moving/marriage land (D-11), a stored column takes precedence via the addendum's `stored ?? derived` registry and this stays the fallback; the registry itself is the platform (MCP) plan set's work, not this plan's.
3. **Every boundary is seed-derived.** Wake, work start, lunch and bedtime each vary across a three-hour window, so at any given hour the roster is spread across several activities as well as several rooms.
4. **A seeded night-attendance preference (owner decision — night venues).** The night rule stands: sleep is the default night block and goes home. But `deriveIsNightOwl(spriteSeed)` marks a stable minority of the town as night-owls — a derived axis computed from the seed via the existing `hashString`, stored nowhere. A night-owl's evening runs on into the night life: a block from bedtime to the town's night closing hour — `deriveNightCloseHour`, the latest after-midnight close among the published venues, capped at 02:00 — at a venue **open in that window, chosen by affordance** like every other block; then sleep at home for the remainder. Non-night-owls keep the plain 22–07 night. The night district is thus *mostly* empty, not dead — night-owls attend the night-open venues — while total coverage, the sleep-at-home rule and the crowding invariant all hold unchanged.

**`ACTIVITY_POOLS` never ships — this supersedes F-7.** An earlier draft of this task mapped activity regexes to hardcoded venue-id lists in this repo, which made every new venue a two-repo change and carried an unmatched-activity branch that threw a `ReferenceError` for every weekend schedule (finding F-7: `venueIds` used but never imported, and `'Slow Morning'`/`'Hobbies'` matching no pool). The affordance model removes the error *class*, not the instance: `deriveVenuesAffording` is **total by data** — an activity matching nothing falls back to the venues affording `idle`, and the district always affords `idle`, around the clock (asserted in Plan 2 Task 14). There is no unmatched branch left to throw. Adding a venue is now a data change in one file, in one repo.

`deriveWorkplaceVenue` / `deriveHangoutVenue` give each agent stable standing places — seeded picks among the venues whose `roles` say `work` / `hangout` — so the variation reads as a routine rather than as noise: the same agent goes back to the same library tomorrow. The tests below assert the outcome directly — no venue holds more than half the roster at any hour, and every public venue is used at some point in the week.

**Files (all in the api repo — `$API`, located per «Before you start» above):**
- Create: `src/utils/scheduleCoverage.js`
- Modify: `src/utils/agentSeed.js:199-206` — export `pickFrom` (Step 0)
- Modify: `src/workers/populateUserProfiles.js:212-254,268-281,296-331`
- Modify: `src/models/Schedule.js:49`
- Create: `tests/scheduleCoverage.test.js`
- Create: `src/scripts/populateSchedulesDeterministic.js`

**Interfaces:**
- Consumes: `venueVocabulary` (Task 31) — including the `roles` / `affords` / `hours` fields — and `hashString`/`pickFrom` from `agentSeed.js`. **`pickFrom` must already be exported** — Step 0 below does it; nothing outside this plan touches the api.
- Produces `src/utils/scheduleCoverage.js` (naming per the addendum's Conventions: pure derivations are `derive<Thing>`):
  - `normalizeCoverage(blocks) → blocks` — sorted, clipped, gap-filled, midnight-split, tiling `[0,24)` exactly
  - `assertTotalCoverage(blocks) → void` — throws with the offending hour
  - `deriveAffordance(activity) → string` — free text → affordance token; **total**, anything unmatched is `'idle'`
  - `deriveVenuesAffording(activity, venues) → venue[]` — the public venues whose `affords` answer the activity; never empty (idle fallback); `home`-role venues are never public candidates
  - `deriveHomeVenue(spriteSeed, roster, residences) → string | null` — creation-order stable home assignment; pure, zero rows
  - `deriveResidenceVenues(venues) → venue[]` — the published homes, in stable instance order
  - `deriveIsNightOwl(spriteSeed) → boolean` — the seeded night-attendance preference (owner decision); a stable minority, derived from the seed alone, stored nowhere
  - `deriveNightCloseHour(venues) → number` — how late the night life runs: the latest after-midnight close among public venues, capped at 2; purely from published `hours`
  - `deriveWorkplaceVenue(spriteSeed, venues) → string | null` / `deriveHangoutVenue(spriteSeed, venues) → string | null` — an agent's standing places, from `roles`
  - `deriveVenue(spriteSeed, dayType, startHour, activity, town) → string | null` — the write-time assignment; `town = { venues, roster }`; sleep goes home, everything else is a seeded pick among the affording venues open at that hour
  - `deterministicDay(spriteSeed, dayType, town) → blocks` — the art-free path that actually inhabits the city

- [ ] **Step 0: Export `pickFrom` from `agentSeed.js`**

`scheduleCoverage.js` below opens with `const { hashString, pickFrom } = require('./agentSeed')`. `pickFrom` is module-private today — defined at `agentSeed.js:178`, absent from `module.exports` at lines 199-206 — so without this one-line export every `deriveVenue` / `deriveWorkplaceVenue` call throws `TypeError: pickFrom is not a function`. In `$API/src/utils/agentSeed.js`, add it:

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
  normalizeCoverage, assertTotalCoverage, deriveAffordance, deriveVenuesAffording,
  deriveVenue, deriveHomeVenue, deriveResidenceVenues, deriveIsNightOwl,
  deriveWorkplaceVenue, deriveHangoutVenue, deterministicDay,
} = require('../src/utils/scheduleCoverage');
const { isValidVenue, venueIds, loadVocabulary } = require('../src/utils/venueVocabulary');

const VENUES = loadVocabulary();
const ROSTER = Array.from({ length: 85 }, (_, i) => `agent_${i}`);
const TOWN = { venues: VENUES, roster: ROSTER };

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

// ── Affordances (addendum I.1) — the model that supersedes F-7 ───────────

test('every activity resolves to an affordance, and an unknown one to idle', () => {
  assert.equal(deriveAffordance('Sleep'), 'sleep');
  assert.equal(deriveAffordance('Deep Work Sprint'), 'work');
  assert.equal(deriveAffordance('Night Out'), 'socialize');
  assert.equal(deriveAffordance('Interpretive Yodeling'), 'idle');
  assert.equal(deriveAffordance(''), 'idle');
  assert.equal(deriveAffordance(null), 'idle');
});

test('deriveVenuesAffording is total: any activity yields venues (supersedes F-7)', () => {
  // F-7 was every weekend schedule throwing because 'Slow Morning' and
  // 'Hobbies' matched no pool regex. There is no unmatched branch any more:
  // the fallback is the venues affording 'idle', and the district always
  // does. The two F-7 activities are pinned here as the regression case.
  for (const activity of ['Slow Morning', 'Hobbies', 'Work', 'Interpretive Yodeling', '', null, 42]) {
    const pool = deriveVenuesAffording(activity, VENUES);
    assert.ok(pool.length > 0, `no venue affords anything for ${JSON.stringify(activity)}`);
  }
});

test('residences are never public candidates — a home is reached only via the home assignment', () => {
  for (const activity of ['Work', 'Lunch', 'Social Time', 'Interpretive Yodeling']) {
    for (const v of deriveVenuesAffording(activity, VENUES)) {
      assert.equal(v.roles.includes('home'), false, `${v.id} offered publicly for ${activity}`);
    }
  }
});

test('every derived venue is in the published vocabulary (I-8)', () => {
  for (const seed of ROSTER) {
    for (const day of ['weekday', 'weekend']) {
      for (let h = 0; h < 24; h++) {
        const v = deriveVenue(seed, day, h, 'Work', TOWN);
        if (v !== null) assert.ok(isValidVenue(v), `${v} is not published`);
      }
    }
  }
});

test('venue derivation is deterministic (I-5 in spirit)', () => {
  assert.equal(deriveVenue('aisha_khan', 'weekday', 9, 'Work', TOWN),
               deriveVenue('aisha_khan', 'weekday', 9, 'Work', TOWN));
});

test('a venue outside its hours is not a candidate (D-12)', () => {
  // Work at 03:00: the work-affording venues are closed, so the assignment
  // degrades to an open idle venue rather than placing anyone behind a
  // locked door. The day/night cycle emerges from data.
  for (const seed of ROSTER.slice(0, 20)) {
    const id = deriveVenue(seed, 'weekday', 3, 'Work', TOWN);
    const venue = VENUES.find(x => x.id === id);
    assert.ok(venue.hours.some(w => w.open <= 3 && 3 < w.close), `${id} is closed at 03:00`);
  }
});

// ── The night rule (addendum Part 0 / I.2) — resolves F-12 ───────────────

test('sleeping agents are present in their own residence (F-12)', () => {
  for (const seed of ROSTER) {
    const home = deriveVenue(seed, 'weekday', 3, 'Sleep', TOWN);
    const venue = VENUES.find(v => v.id === home);
    assert.ok(venue, `${seed} sleeps in unpublished ${home}`);
    assert.ok(venue.roles.includes('home'), `${seed} sleeps in ${home}, which is not a residence`);
  }
});

test('home assignment fills residences to published capacity, in roster creation order', () => {
  const residences = deriveResidenceVenues(VENUES);
  const counts = new Map();
  for (const seed of ROSTER) {
    const home = deriveHomeVenue(seed, ROSTER, residences);
    counts.set(home, (counts.get(home) ?? 0) + 1);
  }
  for (const [id, n] of counts) {
    const cap = residences.find(r => r.id === id).capacity;
    assert.ok(n <= cap, `${id} houses ${n} agents against capacity ${cap}`);
  }
  // The first residents share the first residence: creation order, not hash order.
  const first = residences[0];
  for (const seed of ROSTER.slice(0, first.capacity)) {
    assert.equal(deriveHomeVenue(seed, ROSTER, residences), first.id, seed);
  }
});

test("an existing agent's home never changes when the town grows (addendum I.2)", () => {
  const residences = deriveResidenceVenues(VENUES);
  const grown = [...ROSTER, 'newcomer_1', 'newcomer_2'];
  for (const seed of ROSTER) {
    assert.equal(deriveHomeVenue(seed, ROSTER, residences),
                 deriveHomeVenue(seed, grown, residences), seed);
  }
});

// ── Night venues (owner decision) — a seeded minority attends night life ─

test('night-owls are a stable seeded minority — derived, stored nowhere', () => {
  const owls = ROSTER.filter(s => deriveIsNightOwl(s));
  assert.ok(owls.length > 0, 'no night-owls at all — the night would always be sleep-only');
  assert.ok(owls.length < ROSTER.length / 2,
    'night-owls must be a minority — sleep stays the default night block');
  // A function of the seed ALONE (the signature takes nothing else), so
  // roster growth cannot flip anyone; re-derivation is identical, always.
  for (const seed of ROSTER) assert.equal(deriveIsNightOwl(seed), deriveIsNightOwl(seed), seed);
});

test("a night-owl's late block is at a public venue open after midnight (D-12), then sleep at home", () => {
  const owls = ROSTER.filter(s => deriveIsNightOwl(s));
  assert.ok(owls.length > 0);
  for (const seed of owls) {
    const day = deterministicDay(seed, 'weekday', TOWN);
    const late = day.find(b => b.start === 0 && b.activity === 'Night Out');
    assert.ok(late, `${seed} is a night-owl but has no after-midnight block`);
    const venue = VENUES.find(v => v.id === late.venue);
    assert.ok(venue, `${seed} goes out to unpublished ${late.venue}`);
    assert.ok(venue.hours.some(w => w.open <= 0 && 0 < w.close), `${late.venue} is closed after midnight`);
    assert.equal(venue.roles.includes('home'), false, 'night life happens in public venues');
    const rest = day.find(b => b.start === late.end && b.activity === 'Sleep');
    assert.ok(rest, `${seed} must sleep for the remainder of the night`);
    assert.ok(VENUES.find(v => v.id === rest.venue).roles.includes('home'),
      `${seed} sleeps in ${rest.venue}, which is not a residence`);
  }
});

test('non-night-owls keep the default night: asleep at home after midnight', () => {
  const sleepers = ROSTER.filter(s => !deriveIsNightOwl(s));
  assert.ok(sleepers.length > 0);
  for (const seed of sleepers) {
    const b = deterministicDay(seed, 'weekday', TOWN).find(x => x.start <= 0 && x.end > 0);
    assert.equal(b.activity, 'Sleep', seed);
  }
});

test('deterministicDay tiles the day for both day types (SC-1)', () => {
  for (const day of ['weekday', 'weekend']) {
    for (const seed of ROSTER) {
      const blocks = deterministicDay(seed, day, TOWN);
      assert.doesNotThrow(() => assertTotalCoverage(blocks), `${day}/${seed}`);
      for (const b of blocks) assert.ok(b.venue === null || isValidVenue(b.venue));
    }
  }
});

// ── The city has to look inhabited (G-F) ─────────────────────────────────
// These are the tests that would have caught a schedule where "Work" means
// "office" for everyone: 85 agents in one four-chair room, library empty all
// week. They assert on the whole roster across the whole day, not one hour.

const occupancyAt = (dayType, hour) => {
  const counts = new Map();
  for (const seed of ROSTER) {
    const block = deterministicDay(seed, dayType, TOWN).find(b => b.start <= hour && b.end > hour);
    const v = block?.venue ?? '(absent)';
    counts.set(v, (counts.get(v) ?? 0) + 1);
  }
  return counts;
};

test('no venue holds more than half the roster at ANY hour — nights included (F-12)', () => {
  // The old exit criterion said "during waking hours" because the night was
  // known to violate it 100% of the time. With sleep distributed across
  // residences there is no excluded window left: the invariant holds around
  // the clock, and this test says so.
  for (const dayType of ['weekday', 'weekend']) {
    for (let h = 0; h < 24; h++) {
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
    const b = deterministicDay(seed, 'weekday', TOWN).find(x => x.start <= 9 && x.end > 9);
    activities.add(b.activity);
  }
  assert.ok(activities.size >= 2, `every agent is doing "${[...activities][0]}" at 09:00`);
});

test('an agent keeps the same workplace and hangout across both day types', () => {
  for (const seed of ROSTER.slice(0, 20)) {
    const w = deriveWorkplaceVenue(seed, VENUES);
    const g = deriveHangoutVenue(seed, VENUES);
    assert.equal(w, deriveWorkplaceVenue(seed, VENUES), 'workplace must be a pure function of the seed');
    assert.ok(isValidVenue(w) && isValidVenue(g), seed);

    const weekdayWork = deterministicDay(seed, 'weekday', TOWN).filter(b => b.activity === 'Work');
    for (const b of weekdayWork) assert.equal(b.venue, w, `${seed} works somewhere else`);
  }
});

test('the roster splits across workplaces rather than all sharing one', () => {
  const workplaces = new Map();
  for (const seed of ROSTER) {
    const w = deriveWorkplaceVenue(seed, VENUES);
    workplaces.set(w, (workplaces.get(w) ?? 0) + 1);
  }
  assert.ok(workplaces.size >= 2, `all 85 agents work in ${[...workplaces.keys()][0]}`);
  for (const [w, n] of workplaces) {
    assert.ok(n >= ROSTER.length * 0.15, `${w} has only ${n}/${ROSTER.length} — the split is lopsided`);
  }
});

test('an activity narrows the pool but never picks the venue on its own', () => {
  // "Work" must not be a synonym for "office". Same activity, same hour,
  // different agents -> more than one venue.
  const seen = new Set(ROSTER.map(s => deriveVenue(s, 'weekday', 10, 'Work', TOWN)));
  assert.ok(seen.size >= 2, 'deriveVenue collapsed "Work" onto a single venue');
  const pool = deriveVenuesAffording('Work', VENUES).map(v => v.id);
  for (const v of seen) assert.ok(pool.includes(v), `${v} is outside the Work pool`);
});

test('no venue id is named in code — placement is a query over data (I.1)', () => {
  const src = require('fs').readFileSync(require.resolve('../src/utils/scheduleCoverage'), 'utf8');
  for (const id of venueIds()) {
    assert.equal(new RegExp(`['"\`]${id}['"\`]`).test(src), false,
      `scheduleCoverage.js names venue "${id}" — adding a venue must be a data change in one repo`);
  }
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
 * Schedule coverage and affordance-based venue assignment.
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
 * ADDENDUM §I.1 (2026-07-29): activities map to venues by QUERYING
 * AFFORDANCES, never by naming venue ids. No venue id appears in this file
 * (a test pins that). An activity matching nothing falls back to venues
 * affording 'idle' — the district always does, around the clock — so the
 * assignment is total by data. This supersedes finding F-7: the unmatched
 * branch that threw is not fixed, it no longer exists.
 *
 * ADDENDUM §I.2 / Part 0 (the night rule, resolves F-12): sleeping agents
 * are present in their own residence. deriveHomeVenue assigns homes by
 * roster CREATION ORDER, filling each residence to its published capacity —
 * pure function, zero rows, stable under growth because the residence
 * instance list is append-only.
 *
 * NIGHT VENUES (owner decision, night-venues amendment): a seeded minority
 * of night-owls (deriveIsNightOwl — derived, stored nowhere) spends the
 * front of the night at a venue open in that window, chosen by affordance,
 * before sleeping at home. Sleep remains the default night block; which
 * venues host night life is purely `hours` data published by BotVille.
 *
 * §9.3: 004_add_schedules.js has CHECK (start < end_hour), so 22->07 is
 * illegal — but 22->24 and 00->07 are each legal. The night splits at
 * midnight. Two rows, no migration.
 */

const { hashString, pickFrom } = require('./agentSeed');
const { isValidVenue } = require('./venueVocabulary');

const DAY_START = 0;
const DAY_END = 24;
const FILLER_ACTIVITY = 'Downtime';

/** Split a block that wraps past midnight into the two legal rows. */
function splitMidnight(b) {
  if (b.end > b.start) return [b];
  return [{ ...b, start: b.start, end: DAY_END }, { ...b, start: DAY_START, end: b.end }]
    .filter(x => x.start < x.end);
}

// AMENDED IN EXECUTION (2026-07-30, controller adjudication after review round 1;
// owner informed): venue openness is gated on FULL-SPAN containment (a venue is
// a candidate only if one hours window contains the whole block — the plain
// D-12 reading; gating on any single sampled hour stores agents at closed
// venues). Because containment concentrates early-waking cohorts on the
// always-open venues (F-12 crowding), multi-hour blocks are additionally SPLIT
// at each in-span venue-opening boundary before assignment —
// `deriveSplitPoints`/`splitAtOpenings` in the shipped `scheduleCoverage.js` —
// generalising this same midnight-split convention. Split points derive purely
// from published venue hours; each sub-block gets an independent seeded pick
// (salt from sub-block start hour). Sleep blocks and degenerate spans are
// exempt. Shipped with a D-12 whole-span invariant test (every stored block
// fully inside its venue's hours) and an unweakened F-12 crowding test.

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

/**
 * Default sleep hours. The night block, split at midnight by
 * normalizeCoverage. Night-owls (below) carve a night-out block from the
 * front of this window; sleep stays the default for everyone else.
 */
const isNight = h => h >= 22 || h < 7;

/**
 * Seeded night-attendance preference (owner decision, night-venues
 * amendment): a stable minority of the town prefers going out at night —
 * the club-goers, the late-gym crowd, the closing-shift regulars. Derived
 * from the seed ALONE via the existing hash — stored nowhere, so it cannot
 * drift, and roster growth cannot flip anyone.
 */
const NIGHT_OWL_PERCENT = 25;
function deriveIsNightOwl(spriteSeed) {
  return hashString(spriteSeed, 'nightowl') % 100 < NIGHT_OWL_PERCENT;
}

/**
 * How late the town's night life runs: the latest after-midnight close
 * among PUBLIC venues, capped at NIGHT_OWL_LATEST. Purely from published
 * `hours` — late windows split at midnight, so their after-midnight half
 * has open === 0. A venue gaining a later window extends the night with
 * zero code change here; a town with no night life returns 0 and every
 * night-owl degrades to the default sleep block.
 */
const NIGHT_OWL_LATEST = 2;
function deriveNightCloseHour(venues) {
  const closes = venues
    .filter(v => !v.roles.includes('home'))
    .flatMap(v => v.hours)
    .filter(w => w.open === 0)
    .map(w => Math.min(w.close, NIGHT_OWL_LATEST));
  return closes.length ? Math.max(...closes) : 0;
}

/**
 * Free text -> affordance token. The right-hand side is VOCABULARY, never a
 * venue id: this table changes when a new KIND of activity exists, not when
 * a venue is added. TOTAL: anything unmatched is 'idle', so there is no
 * unmatched branch to throw (the F-7 class, gone by construction).
 */
const ACTIVITY_AFFORDANCES = [
  [/sleep|nap|bed/,                                   'sleep'],
  [/read|study|research|writ|library|learn|book/,     'read'],
  [/coffee|breakfast|lunch|dinner|eat|caf|meal|snack/, 'eat'],
  [/work|meeting|job|shift|project|code|admin/,       'work'],
  [/social|friend|hang|party|date|chat|visit|night out|club/, 'socialize'],
  [/errand|shop|market|chore|walk|exercise|outside/,  'wander'],
];

function deriveAffordance(activity) {
  const text = String(activity ?? '').toLowerCase();
  const hit = ACTIVITY_AFFORDANCES.find(([re]) => re.test(text));
  return hit ? hit[1] : 'idle';
}

/** Is the venue open at this hour? Windows never wrap — split at midnight. */
function isOpenAtHour(venue, hour) {
  return venue.hours.some(w => w.open <= hour && hour < w.close);
}

/** The published residences, in stable instance order (house_2 before house_10). */
function deriveResidenceVenues(venues) {
  return venues
    .filter(v => v.roles.includes('home'))
    .sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
}

/**
 * The venues whose affordances answer an activity (addendum I.1).
 *
 * An activity maps to a KIND of place, never to one place: "Work" resolves
 * to the work affordance and every venue affording it is a candidate. This
 * is the difference between a city and a conveyor belt — if "Work" meant
 * one venue, all 85 agents would share one room while the rest stood empty.
 *
 * Residences are NEVER public candidates: a home is reached only through
 * the home assignment, so strangers do not lunch in a living room.
 *
 * Total by data: an unmatched activity falls back to the venues affording
 * 'idle', and the district always affords 'idle' (Plan 2 Task 14 pins it).
 */
function deriveVenuesAffording(activity, venues) {
  const publicVenues = venues.filter(v => !v.roles.includes('home'));
  const wanted = deriveAffordance(activity);
  const hits = publicVenues.filter(v => v.affords.includes(wanted));
  return hits.length ? hits : publicVenues.filter(v => v.affords.includes('idle'));
}

/**
 * Creation-order stable home assignment (addendum I.2). Agents fill each
 * residence to its PUBLISHED capacity before the next opens. The roster
 * prefix and the residence-instance prefix are both stable, so an existing
 * agent's home never changes when the town grows — with zero stored rows.
 * When moving/marriage land (D-11), a stored column takes precedence via
 * the `stored ?? derived` registry and this function remains the fallback.
 */
function deriveHomeVenue(spriteSeed, roster, residences) {
  const index = roster.indexOf(spriteSeed);
  if (index === -1 || residences.length === 0) return null;
  let remaining = index;
  for (const home of residences) {
    if (remaining < home.capacity) return home.id;
    remaining -= home.capacity;
  }
  // The roster outgrew the last bake: the newest agents share the last
  // residence until BotVille re-bakes with the new population.
  return residences[residences.length - 1].id;
}

/**
 * The agent's standing places. Same seed, same answer, forever — this is
 * what makes a routine legible: you learn that this one works in the
 * library and drinks in the cafe, and tomorrow that is still true. The
 * pools come from published `roles`, so a new work venue joins them by
 * being published, not by an edit here.
 */
function deriveWorkplaceVenue(spriteSeed, venues) {
  const pool = venues.filter(v => v.roles.includes('work')).map(v => v.id);
  return pool.length ? pickFrom(pool, spriteSeed, 'venue:workplace') : null;
}

function deriveHangoutVenue(spriteSeed, venues) {
  const pool = venues.filter(v => v.roles.includes('hangout')).map(v => v.id);
  return pool.length ? pickFrom(pool, spriteSeed, 'venue:hangout') : null;
}

/**
 * The agent's venue for a slot. Deterministic in the agent's seed so a
 * re-run never churns an already-assigned value, exactly like agentSeed.js.
 * Returns null for "no venue asserted" -> BotVille renders `absent`.
 *
 * Sleep goes HOME (the addendum's night rule, F-12). Everything else is a
 * seeded pick among the affording venues open at that hour; if every
 * affording venue is closed, the open idle venues catch it.
 *
 * I-10 holds: this runs ONCE, at generation time, and the result is stored.
 * Nothing reads `activity` at render time, so an agent cannot teleport
 * because the model phrased tomorrow's schedule differently.
 *
 * @param {{venues: object[], roster: string[]}} town — the published
 *   vocabulary and the full username roster in creation order.
 */
function deriveVenue(spriteSeed, dayType, startHour, activity, town) {
  const { venues, roster } = town;

  if (deriveAffordance(activity) === 'sleep') {
    return deriveHomeVenue(spriteSeed, roster, deriveResidenceVenues(venues));
  }

  const affording = deriveVenuesAffording(activity, venues).filter(v => isOpenAtHour(v, startHour));
  // Everything affording this is closed right now: fall back to the open
  // idle venues (null derives to 'idle' by construction — the total default).
  const pool = (affording.length
    ? affording
    : deriveVenuesAffording(null, venues).filter(v => isOpenAtHour(v, startHour)))
    .map(v => v.id)
    .filter(isValidVenue);
  if (!pool.length) return null;   // every venue closed at this hour — absent, never a guess

  // Salted by hour as well as seed: an agent moves through its day rather
  // than sitting in one room from 07:00 to 22:00.
  return pickFrom(pool, spriteSeed, `venue:${dayType}:${startHour}`);
}

/**
 * A fully deterministic day. This is the path that actually inhabits the
 * city: users_schedules holds 0 rows (verified 2026-07-27) and the LLM
 * generator depends on an external server. Same seed, same schedule.
 *
 * Every boundary is seed-derived, so agents are not all eating lunch at the
 * same moment. Weekend afternoons additionally split by STYLE — errands,
 * reading, visiting — so a single-venue affordance (wandering happens
 * outdoors) cannot funnel the whole roster into one place.
 */
function deterministicDay(spriteSeed, dayType, town) {
  const pick = (salt, n) => hashString(spriteSeed, `${salt}:${dayType}`) % n;
  const workplace = deriveWorkplaceVenue(spriteSeed, town.venues);
  const hangout = deriveHangoutVenue(spriteSeed, town.venues);
  const home = deriveHomeVenue(spriteSeed, town.roster, deriveResidenceVenues(town.venues));

  const wake = 6 + pick('wake', 3);           // 6, 7 or 8
  const startWork = 8 + pick('start', 3);     // 8, 9 or 10
  const lunch = 11 + pick('lunch', 3);        // 11, 12 or 13
  const evening = 17 + pick('evening', 3);    // 17, 18 or 19
  const bed = 21 + pick('bed', 2);            // 21 or 22

  // Weekend afternoons differ per agent, structurally: a third of the town
  // runs errands, a third reads, a third visits — each style resolving to a
  // different affordance pool.
  const afternoonStyles = ['Errands', 'Reading', 'Visiting Friends'];
  const afternoon = afternoonStyles[pick('weekendStyle', afternoonStyles.length)];

  // Night venues (owner decision): a night-owl's evening runs on into the
  // night life — bedtime to the town's night close (≤ 02:00), at a venue
  // open in that window, then sleep at home for the remainder. The venue is
  // derived at hour 0, the after-midnight half of the split block, so the
  // D-12 guarantee (never behind a locked door) holds where it bites.
  // Everyone else keeps the plain night: sleep, at home, bed -> wake.
  const nightEnd = deriveIsNightOwl(spriteSeed) ? deriveNightCloseHour(town.venues) : 0;
  const night = nightEnd > 0
    ? [
        { start: bed, end: nightEnd, activity: 'Night Out',
          venue: deriveVenue(spriteSeed, dayType, 0, 'Night Out', town) },
        { start: nightEnd, end: wake, activity: 'Sleep', venue: home },
      ]
    : [{ start: bed, end: wake, activity: 'Sleep', venue: home }];

  const shape = dayType === 'weekday'
    ? [
        ...night,
        { start: wake, end: startWork, activity: 'Breakfast', venue: hangout },
        { start: startWork, end: lunch, activity: 'Work', venue: workplace },
        { start: lunch, end: lunch + 1, activity: 'Lunch', venue: hangout },
        { start: lunch + 1, end: evening, activity: 'Work', venue: workplace },
        { start: evening, end: bed, activity: 'Social Time', venue: null },
      ]
    : [
        ...night,
        { start: wake, end: lunch, activity: 'Slow Morning', venue: null },
        { start: lunch, end: lunch + 2, activity: 'Hobbies', venue: null },
        { start: lunch + 2, end: evening, activity: afternoon, venue: null },
        { start: evening, end: bed, activity: 'Social Time', venue: hangout },
      ];

  const withVenue = shape.map(b => ({
    ...b,
    // An explicit assignment (home, workplace, hangout) wins; otherwise the
    // affordance query decides. Either way the answer is a pure function of
    // this agent's seed — and the sleep block passes through isValidVenue
    // like every other, closing F-12's smaller I-8 gap.
    venue: (b.venue && isValidVenue(b.venue) ? b.venue : null)
      ?? deriveVenue(spriteSeed, dayType, b.start, b.activity, town),
    online_probability: isNight(b.start) ? 0.05 : 0.6,
    posting_probability: isNight(b.start) ? 0.01 : 0.25,
  }));

  const normalized = normalizeCoverage(withVenue).map(b => ({
    ...b,
    venue: b.venue ?? deriveVenue(spriteSeed, dayType, b.start, b.activity, town),
  }));
  assertTotalCoverage(normalized);
  return normalized;
}

module.exports = {
  normalizeCoverage, assertTotalCoverage, isNight,
  deriveAffordance, deriveVenuesAffording, deriveVenue,
  deriveHomeVenue, deriveResidenceVenues,
  deriveIsNightOwl, deriveNightCloseHour,
  deriveWorkplaceVenue, deriveHangoutVenue,
  deterministicDay,
};
```

- [ ] **Step 4: Run the coverage tests**

Run: `cd "$API" && node --test tests/scheduleCoverage.test.js`
Expected: PASS — 26 tests. Four groups matter most: the F-7 regression pins (`'Slow Morning'` / `'Hobbies'` must resolve to venues, totally), the night-rule group (sleep lands in the agent's own residence, stably under growth), the night-owl group (a stable seeded minority spends the front of the night at a night-open public venue, then sleeps at home — everyone else keeps the default night), and the occupancy group — which now covers **all 24 hours**, because with F-12 resolved there is no window in which the crowding invariant is allowed to fail; the night-owl minority is small enough that it never threatens the half-roster bound.

- [ ] **Step 5: Wire venue into the LLM generator**

In `src/workers/populateUserProfiles.js`:

Add at the top with the other requires:

```js
const { loadVocabulary, isValidVenue } = require('../utils/venueVocabulary');
const { normalizeCoverage, assertTotalCoverage, deriveVenue } = require('../utils/scheduleCoverage');
```

Add `venue` to both block schemas in `SCHEDULE_TOOL` (lines 226-234 and 241-249), inside `properties`. The enum offers the **public** venues only — residences are reached through the home assignment, never named by the model:

```js
              venue: {
                type: 'string',
                enum: loadVocabulary().filter(v => !v.roles.includes('home')).map(v => v.id),
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

(the `isValidVenue` require is already in place from the top-of-file edit).

Replace `saveSchedule` (lines 296-331) so it normalises and stores `venue`. It takes a `town` — the published venues plus the **full** username roster in creation order — because the home assignment (sleep blocks) depends on the whole roster, not on the user being written:

```js
async function saveSchedule(userId, schedule, spriteSeed, town) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM users_schedules WHERE user_id = $1', [userId]);

    // A model-supplied venue must be a PUBLIC one: a residence id is treated
    // as unassigned and re-derived, so the model cannot put an agent in
    // someone's living room.
    const isPublicVenue = id => {
      const v = town.venues.find(x => x.id === id);
      return !!v && !v.roles.includes('home');
    };

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
        venue: (b.venue != null && isPublicVenue(b.venue) ? b.venue : null)
          ?? deriveVenue(spriteSeed, dayType, b.start, b.activity, town),
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

Then build the town once per worker run, before the per-user loop, and pass it through. Above the loop that processes users:

```js
  // The FULL roster in creation order — the home assignment (addendum I.2)
  // is a function of it, independent of which users need schedules today.
  const { rows: rosterRows } = await pool.query('SELECT username FROM users ORDER BY created_at');
  const town = { venues: loadVocabulary(), roster: rosterRows.map(r => r.username) };
```

Update the one caller at line 346: `await saveSchedule(user.id, schedule, user.username, town);` and add `users.username` to `findUsersWithoutSchedules`'s SELECT — it is already there (line 258).

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
const { isValidVenue, loadVocabulary } = require('../utils/venueVocabulary');

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

async function main() {
  // The FULL roster in creation order, independent of who needs populating:
  // the home assignment (addendum I.2) is a pure function of it, and using a
  // subset would give agents different homes on different runs.
  const { rows: rosterRows } = await pool.query('SELECT username FROM users ORDER BY created_at');
  const town = { venues: loadVocabulary(), roster: rosterRows.map(r => r.username) };

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
    const days = ['weekday', 'weekend'].map(d => [d, deterministicDay(user.username, d, town)]);
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
