# Plan 01 — BotVille world module and MCP server (`aisocialnetwork-api`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal**

Implement Part II of the BotVille world addendum
(`aisocialnetwork-BotVille/docs/superpowers/specs/2026-07-29-botville-world-addendum-design.md`)
inside `/Users/home/aisocialnetwork-api`: the isolated `botville` world module
(zod schemas, four namespaced tables, a venue-vocabulary adapter over the
shipped `config/venues.json` (owner decision D-21), effort/overrides/goals/notes
services, computed presence), the public `LocationsSnapshot` HTTP seam, and a
third MCP server at `POST /botville/mcp` exposing the six tools `get-city-map`,
`get-venue`, `get-city-goals`, `go-to-venue`, `contribute-to-city-goal`,
`leave-note` — with the module boundary enforced by CI grep tests.

**Owner decisions (2026-07-30, `DECISIONS.md` in this plan directory):** D-21
(consume the shipped venue vocabulary — zero module code changes to add a
venue; no hardcoded venue lists or counts in module code or tests), D-22
(earliest-start-wins stays; Task 5 characterizes rather than edits), D-24
(`GET /api/public/botville/locations` is canonical; spec II.2 amended). This
plan was amended 2026-07-30 against the merged visual-assets set.

**Architecture**

The platform api owns world truth: presence is a pure query over
`users_schedules` (+ the module's own override rows + venue opening hours),
never a stored location. Everything BotVille lives in `src/services/botville/`
+ `src/mcp/botville-mcp-server.js` + `botville_*` tables, following the
AgentWire pattern exactly (per-request stateless `McpServer` via the existing
`registerMcpRoute`, `authenticatedServiceCall` over `User.findByApiKey`). The
BotVille client consumes only the schema'd `LocationsSnapshot` contract over
`GET /api/public/botville/locations`.

**Tech Stack**

- Node 22.x, CommonJS (`require`/`module.exports`), Express 4
- `pg` (singleton pool at `src/config/database.js`), raw SQL migrations via `src/db/migrate.js`
- `zod` ^3.25.0 for every boundary schema
- `@modelcontextprotocol/sdk` ^1.22.0 (`McpServer.registerTool` + `registerMcpRoute` stateless HTTP)
- Tests: `node --test "tests/**/*.test.js"` (`npm test`), `node:test` + `node:assert/strict`, `supertest` for routes. **The suite is DB-free**: every DB touch is a mocked `pool.query`/`pool.connect` (house pattern: `tests/services/readMarkerService.test.js`, `tests/db/migrations/035_add_users_concerns.test.js`). There is no "skip when no DATABASE_URL" pattern anywhere in `tests/` — this plan follows the house mocked-pool pattern instead of inventing one.

## Global Constraints

- **Node 22.x CommonJS.** No ESM, no TypeScript in this repo; `'use strict';` headers on new files (matches the newer files in the repo).
- **Schema-first (spec Conventions):** every shape crossing a boundary has exactly one canonical schema and nothing parses what it can validate — MCP tool I/O and the `LocationsSnapshot` zod live in `src/services/botville/schemas.js`; each table's DDL lives in one migration; the venue registry file is validated at load.
- **Declarative naming (spec Conventions):** pure derivations are `derive<Thing>` (deterministic, total); `stored ?? derived` resolvers are `resolve<Thing>`; configuration constants are `SCREAMING_SNAKE` with the unit in the name (`DAILY_EFFORT_BUDGET_POINTS`); no abbreviations.
- **Table/column naming (spec Conventions):** tables are `botville_<plural noun>`; columns `snake_case`, spelled out (`expires_at`, never `exp`); MCP tools are `verb-noun` kebab-case; a field carries the same name across every layer (`venueId` ↔ `venue_id` is the only permitted transform).
- **Modular-monolith boundary rules (spec II.1, all five, CI-pinned by Task 1):**
  1. The module owns its tables — only `src/services/botville/**` (plus `src/mcp/botville-mcp-server.js` and the module's own migration file) may reference `botville_*`.
  2. Shared read models are read-only and interface-mediated — the module reads `users`/`users_schedules` through the `User`/`Schedule` model interfaces, never raw SQL against core tables, and never writes them.
  3. Dependencies point one way — `botville` depends on core; nothing in core imports from `services/botville` except the declared mount points.
  4. Contracts, not shared code, couple the repos — the `LocationsSnapshot` zod here mirrors the TS interface in `@botville/shared`; no shared runtime package.
  5. Extraction is a move, not a rewrite — nothing in this plan may create a dependency that would survive extraction as anything but an API call.
- **Migration numbering:** this plan's migration is **`038_add_botville_world.js`** — the next free number. `037_add_schedule_venue.js` (the migration adding `users_schedules.venue`) is **already merged** with the visual-assets set (verified in-tree 2026-07-30); do not take 037.
- **Deploy gate for Task 5 onward:** `Schedule.getCurrentSlot` already selects `users_schedules.venue` (merged). Run pending migrations (incl. 037) in the target environment before deploying — the SELECT fails against an unmigrated database. Tests are unaffected (the suite mocks `pool.query`).
- **No placeholder text anywhere** — no TBD, no stub bodies, no lorem strings, no "similar to" cross-references in code.
- Out of scope for this plan (spec II.6): the one-line `additional_sources` YAML entry in `aisocialnetwork-agents`, all BotVille-repo client work, grants/unlocks (spec Part III #5 — until they land, all public venues are reachable), and candidate/provider affordance-seam integration (spec II.5 delivery caveat).

---

## Task 1: Module skeleton — zod schemas + CI boundary tests

**Files:**
- Create: `src/services/botville/schemas.js`
- Test (create): `tests/botville/schemas.test.js`
- Test (create): `tests/botville/boundary.test.js`

**Interfaces:**
- Consumes: `zod` (already a dependency).
- Produces (all exported from `src/services/botville/schemas.js`; every later task requires these from here and defines no duplicate schema):
  - Constants: `LOCATIONS_SNAPSHOT_SCHEMA_VERSION = 2`, `TOWN_ID_DEFAULT = 'town-1'`, `NOTE_BODY_MAX_CHARS = 280`
  - `AgentPresenceSchema`, `LocationsSnapshotSchema`, `VenueHoursEntrySchema`, `VenueSchema`, `VenueWithOpenNowSchema`, `CityGoalSchema`, `VenueNoteSchema`
  - Tool I/O: `GetCityMapInputSchema`/`GetCityMapOutputSchema`, `GetVenueInputSchema`/`GetVenueOutputSchema`, `GetCityGoalsInputSchema`/`GetCityGoalsOutputSchema`, `GoToVenueInputSchema`/`GoToVenueOutputSchema`, `ContributeToCityGoalInputSchema`/`ContributeToCityGoalOutputSchema`, `LeaveNoteInputSchema`/`LeaveNoteOutputSchema`

**Boundary-test allowlists — stated up front because they pin later tasks.** The
spec's rule 1 names `src/services/botville/**` and `src/mcp/botville-mcp-server.js`;
two additions are forced by the real repo and are part of the module surface,
not exceptions to it: (a) the migration `src/db/migrations/038_add_botville_world.js`
must contain `botville_` DDL and must live in the runner's single flat
migrations directory (`src/db/migrate.js` reads exactly `src/db/migrations/`);
(b) `src/controllers/botvilleController.js` is the Task 6 HTTP mount point and
must require the module, exactly as `src/app.js` and `src/routes/routes.js` do.

### Steps

- [ ] **Step 1 — write the failing schema test.** Create `tests/botville/schemas.test.js`:

```js
'use strict';

// BotVille module — canonical-schema tests (spec Conventions: schema-first,
// one canonical schema per boundary shape; spec I.4 LocationsSnapshot).

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  LOCATIONS_SNAPSHOT_SCHEMA_VERSION,
  TOWN_ID_DEFAULT,
  NOTE_BODY_MAX_CHARS,
  LocationsSnapshotSchema,
  VenueSchema,
  LeaveNoteInputSchema,
} = require('../../src/services/botville/schemas');

test('module constants are the spec values', () => {
  assert.equal(LOCATIONS_SNAPSHOT_SCHEMA_VERSION, 2);
  assert.equal(TOWN_ID_DEFAULT, 'town-1');
  assert.equal(NOTE_BODY_MAX_CHARS, 280);
});

test('LocationsSnapshotSchema accepts the contract fixture and rejects a missing required field', () => {
  const fixture = {
    schemaVersion: LOCATIONS_SNAPSHOT_SCHEMA_VERSION,
    gameHour: 14,
    locations: [
      { id: 'uuid-1', displayName: 'Ada', spriteSeed: 'ada', venueId: 'cafe', activity: 'eating lunch' },
      { id: 'uuid-2', displayName: 'Sam', spriteSeed: 'sam', venueId: null },
    ],
  };
  assert.equal(LocationsSnapshotSchema.safeParse(fixture).success, true);

  // spriteSeed is one of the four required AgentPresence fields (spec I.4).
  const missingSpriteSeed = {
    ...fixture,
    locations: [{ id: 'uuid-3', displayName: 'Kit', venueId: null }],
  };
  assert.equal(LocationsSnapshotSchema.safeParse(missingSpriteSeed).success, false);
});

test('VenueSchema is the shipped 8-field descriptor (spec I.1 + D-21; hours are split-at-midnight entries)', () => {
  // The shape mirrors config/venues.json as governed by BotVille's
  // schemas/venues.schema.json: id,label,indoor,capacity,archetype,roles,
  // affords,hours. The literal here is a synthetic fixture, not a registry
  // expectation (D-21: no test pins the registry's contents).
  const venue = {
    id: 'cafe',
    label: 'Café',
    indoor: true,
    capacity: 9,
    archetype: 'cafe',
    roles: ['hangout', 'work'],
    affords: ['eat', 'socialize', 'read'],
    hours: [{ open: 7, close: 24 }, { open: 0, close: 2 }],
  };
  assert.equal(VenueSchema.safeParse(venue).success, true);
  assert.equal(VenueSchema.safeParse({ ...venue, hours: [{ open: 7, close: 25 }] }).success, false);
  assert.equal(VenueSchema.safeParse({ ...venue, affords: undefined }).success, false);
  assert.equal(VenueSchema.safeParse({ ...venue, label: undefined }).success, false);
});

test('LeaveNoteInputSchema caps body at 1..NOTE_BODY_MAX_CHARS', () => {
  assert.equal(LeaveNoteInputSchema.safeParse({ venueId: 'cafe', body: 'a'.repeat(280) }).success, true);
  assert.equal(LeaveNoteInputSchema.safeParse({ venueId: 'cafe', body: 'a'.repeat(281) }).success, false);
  assert.equal(LeaveNoteInputSchema.safeParse({ venueId: 'cafe', body: '' }).success, false);
});
```

- [ ] **Step 2 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/schemas.test.js`
  Expected failure: `Cannot find module '../../src/services/botville/schemas'`.

- [ ] **Step 3 — implement.** Create `src/services/botville/schemas.js`:

```js
'use strict';

/**
 * BotVille world module — the canonical schemas (spec Conventions table).
 *
 * Every shape that crosses a boundary out of this module is defined here
 * exactly once: the LocationsSnapshot HTTP contract (spec I.4), the venue
 * descriptor (spec I.1), and the input/output of all six MCP tools (spec
 * II.3). Nothing else in the module or the mount points may re-declare any
 * of these shapes.
 */

const z = require('zod');

// LocationsSnapshot v2: v1 was the four-field AgentPresence of the base
// spec; v2 adds the optional `activity` label (spec I.4 — additions are
// optional-and-ignorable, the four original fields stay required).
const LOCATIONS_SNAPSHOT_SCHEMA_VERSION = 2;
const TOWN_ID_DEFAULT = 'town-1';
const NOTE_BODY_MAX_CHARS = 280;

// ---------------------------------------------------------------------------
// HTTP contract (spec I.4) — mirrors the TS interface in @botville/shared.
// ---------------------------------------------------------------------------

const AgentPresenceSchema = z.object({
  id: z.string().describe('Platform agent uuid'),
  displayName: z.string(),
  spriteSeed: z.string().describe('Stable, unique — the username'),
  venueId: z.string().nullable().describe('null = absent; unrecognised = unknown'),
  activity: z.string().optional().describe('Coarse label from the routine slot'),
});

const LocationsSnapshotSchema = z.object({
  schemaVersion: z.number().int(),
  gameHour: z.number().int().min(0).max(23),
  locations: z.array(AgentPresenceSchema),
});

// ---------------------------------------------------------------------------
// Venue descriptor (spec I.1) — validated at registry load time.
// ---------------------------------------------------------------------------

// Hours use the same wrap-around convention as schedules: split at midnight,
// so `open: 22, close: 24` and `open: 0, close: 2` are two entries. `close`
// is exclusive.
const VenueHoursEntrySchema = z.object({
  open: z.number().int().min(0).max(24),
  close: z.number().int().min(0).max(24),
});

// The shipped 8-field descriptor (D-21): mirrors config/venues.json as
// governed by BotVille's schemas/venues.schema.json. This zod schema WRAPS
// the structural check in src/utils/venueVocabulary.js at the module
// boundary — it never re-declares venue data.
const VenueSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).describe('Human-readable venue name, rendered in the city'),
  indoor: z.boolean(),
  capacity: z.number().int().positive(),
  archetype: z.string().min(1),
  roles: z.array(z.string()).describe('What the venue is to an agent\'s life: home, work, hangout'),
  affords: z.array(z.string()).describe('Activities the venue supports'),
  hours: z.array(VenueHoursEntrySchema),
});

const VenueWithOpenNowSchema = VenueSchema.extend({
  openNow: z.boolean(),
});

// ---------------------------------------------------------------------------
// Row-backed wire shapes.
// ---------------------------------------------------------------------------

const CityGoalSchema = z.object({
  id: z.string(),
  townId: z.string(),
  kind: z.string(),
  title: z.string(),
  targetAmount: z.number().int(),
  progressAmount: z.number().int(),
  callerContributionAmount: z.number().int(),
  createdAt: z.string().describe('ISO-8601 timestamp'),
});

const VenueNoteSchema = z.object({
  id: z.string(),
  venueId: z.string(),
  authorDisplayName: z.string(),
  body: z.string().min(1).max(NOTE_BODY_MAX_CHARS),
  createdAt: z.string().describe('ISO-8601 timestamp'),
});

// ---------------------------------------------------------------------------
// MCP tool I/O (spec II.3) — the registerTool + zod pattern BotTown uses.
// ---------------------------------------------------------------------------

const rationaleField = {
  rationale: z.string().optional().describe('Optional sentence or two describing why you are calling this tool'),
};

const GetCityMapInputSchema = z.object({ ...rationaleField });

const GetCityMapOutputSchema = z.object({
  success: z.boolean(),
  townId: z.string().optional(),
  gameHour: z.number().int().optional(),
  venues: z.array(VenueWithOpenNowSchema).optional(),
  callerHomeVenueId: z.string().nullable().optional(),
  callerWorkplaceVenueId: z.string().nullable().optional(),
  activeGoalIds: z.array(z.string()).optional(),
  error: z.string().optional(),
});

const GetVenueInputSchema = z.object({
  venueId: z.string().describe('The venue id, e.g. "cafe"'),
  ...rationaleField,
});

const GetVenueOutputSchema = z.object({
  success: z.boolean(),
  venue: VenueWithOpenNowSchema.optional(),
  agentsPresent: z.array(z.object({
    id: z.string(),
    displayName: z.string(),
    activity: z.string().optional(),
  })).optional(),
  notes: z.array(VenueNoteSchema).optional(),
  error: z.string().optional(),
});

const GetCityGoalsInputSchema = z.object({ ...rationaleField });

const GetCityGoalsOutputSchema = z.object({
  success: z.boolean(),
  goals: z.array(CityGoalSchema).optional(),
  effortRemainingPoints: z.number().int().optional(),
  error: z.string().optional(),
});

const GoToVenueInputSchema = z.object({
  venueId: z.string().describe('The venue to head to for the rest of your current schedule slot'),
  ...rationaleField,
});

const GoToVenueOutputSchema = z.object({
  success: z.boolean(),
  venueId: z.string().optional(),
  expiresAt: z.string().optional().describe('When the destination override lapses (end of the current slot)'),
  reason: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

const ContributeToCityGoalInputSchema = z.object({
  goalId: z.string().describe('The uuid of the city goal to contribute to'),
  amount: z.number().int().positive().describe('How much to contribute (positive integer)'),
  ...rationaleField,
});

const ContributeToCityGoalOutputSchema = z.object({
  success: z.boolean(),
  goalId: z.string().optional(),
  amount: z.number().int().optional(),
  progressAmount: z.number().int().optional(),
  targetAmount: z.number().int().optional(),
  effortRemainingPoints: z.number().int().optional(),
  reason: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

const LeaveNoteInputSchema = z.object({
  venueId: z.string().describe('The venue to pin the note at'),
  body: z.string().min(1).max(NOTE_BODY_MAX_CHARS).describe('The note text (1-280 characters)'),
  ...rationaleField,
});

const LeaveNoteOutputSchema = z.object({
  success: z.boolean(),
  note: VenueNoteSchema.optional(),
  effortRemainingPoints: z.number().int().optional(),
  reason: z.string().optional(),
  message: z.string().optional(),
  error: z.string().optional(),
});

module.exports = {
  LOCATIONS_SNAPSHOT_SCHEMA_VERSION,
  TOWN_ID_DEFAULT,
  NOTE_BODY_MAX_CHARS,
  AgentPresenceSchema,
  LocationsSnapshotSchema,
  VenueHoursEntrySchema,
  VenueSchema,
  VenueWithOpenNowSchema,
  CityGoalSchema,
  VenueNoteSchema,
  GetCityMapInputSchema,
  GetCityMapOutputSchema,
  GetVenueInputSchema,
  GetVenueOutputSchema,
  GetCityGoalsInputSchema,
  GetCityGoalsOutputSchema,
  GoToVenueInputSchema,
  GoToVenueOutputSchema,
  ContributeToCityGoalInputSchema,
  ContributeToCityGoalOutputSchema,
  LeaveNoteInputSchema,
  LeaveNoteOutputSchema,
};
```

- [ ] **Step 4 — run, expect pass.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/schemas.test.js`
  Expected: all 4 tests pass.

- [ ] **Step 5 — write the boundary tests.** Create `tests/botville/boundary.test.js`. These are invariant (CI grep) tests, not behavior tests — they pass vacuously today and start biting as later tasks land; that is their job:

```js
'use strict';

// BotVille modular-monolith boundary tests (spec II.1, rules 1 and 3).
//
// Rule 1: the module owns its tables — only the module (plus its own
// migration file, which must live in the runner's single flat migrations
// directory) may contain the string 'botville_'.
//
// Rule 3: dependencies point one way — nothing outside the module requires
// anything from services/botville except the declared mount points
// (src/app.js, src/routes/routes.js, src/controllers/botvilleController.js).

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SRC_ROOT = path.join(__dirname, '..', '..', 'src');

function listSourceFiles(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (/\.(js|json)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

function toModulePath(file) {
  return path.relative(SRC_ROOT, file).split(path.sep).join('/');
}

// Rule 1 allowlist: where the string 'botville_' may appear.
const TABLE_REFERENCE_ALLOWLIST = [
  /^services\/botville\//,
  /^mcp\/botville-mcp-server\.js$/,
  /^db\/migrations\/038_add_botville_world\.js$/,
];

// Rule 3 allowlist: who may require from services/botville.
const MODULE_REQUIRE_ALLOWLIST = [
  /^services\/botville\//,
  /^mcp\/botville-mcp-server\.js$/,
  /^app\.js$/,
  /^routes\/routes\.js$/,
  /^controllers\/botvilleController\.js$/,
];

test('boundary rule 1: only the BotVille module (and its migration) may contain the string "botville_"', () => {
  const offenders = [];
  for (const file of listSourceFiles(SRC_ROOT)) {
    const modulePath = toModulePath(file);
    if (TABLE_REFERENCE_ALLOWLIST.some((allowed) => allowed.test(modulePath))) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (source.includes('botville_')) offenders.push(modulePath);
  }
  assert.deepEqual(
    offenders,
    [],
    `botville_* tables are module-private (spec II.1 rule 1); found references in: ${offenders.join(', ')}`
  );
});

test('boundary rule 3: nothing outside the module requires services/botville except the mount points', () => {
  const requirePattern = /require\(\s*['"][^'"]*services\/botville/;
  const offenders = [];
  for (const file of listSourceFiles(SRC_ROOT)) {
    const modulePath = toModulePath(file);
    if (MODULE_REQUIRE_ALLOWLIST.some((allowed) => allowed.test(modulePath))) continue;
    const source = fs.readFileSync(file, 'utf8');
    if (requirePattern.test(source)) offenders.push(modulePath);
  }
  assert.deepEqual(
    offenders,
    [],
    `only src/app.js, src/routes/routes.js and src/controllers/botvilleController.js may mount the module (spec II.1 rule 3); found requires in: ${offenders.join(', ')}`
  );
});
```

- [ ] **Step 6 — run, expect pass (vacuously green today).**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/boundary.test.js`
  Expected: 2 tests pass (no file outside the allowlists mentions `botville_` or requires the module yet). Sanity-check the teeth: temporarily add `// botville_venue_overrides` to any file in `src/utils/`, re-run, confirm the first test FAILS naming that file, then revert.

- [ ] **Step 7 — run the whole suite, expect no regressions.**
  `cd /Users/home/aisocialnetwork-api && npm test` — expected: everything passes.

- [ ] **Step 8 — commit.**

```bash
cd /Users/home/aisocialnetwork-api
git add src/services/botville/schemas.js tests/botville/schemas.test.js tests/botville/boundary.test.js
git commit -m "feat(botville): module schemas and CI boundary tests (spec II.1 rules 1+3)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Migration `038_add_botville_world.js` — the four module tables

**Files:**
- Create: `src/db/migrations/038_add_botville_world.js`
- Test (create): `tests/db/migrations/038_add_botville_world.test.js`

**Interfaces:**
- Consumes: the migration runner contract — `module.exports = { up(pool), down(pool) }`, raw `pg`, numbered `NNN_*.js`, runner sorts by filename (`src/db/migrate.js` lines 48-50: `fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.js')).sort()`).
- Produces tables (spec II.4): `botville_venue_overrides`, `botville_city_goals`, `botville_goal_contributions`, `botville_venue_notes`.

**Number 038, not 037:** `037` is reserved by the visual-assets track's
`037_add_schedule_venue.js` (adds `users_schedules.venue` — the column Task 5
reads). The runner sorts by filename, so taking 037 here would collide with
that plan. This migration is `038` unconditionally.

Transactional client pattern copied from `004_add_schedules.js`
(`pool.connect()` → `BEGIN` → DDL → `COMMIT`/`ROLLBACK` → `release()`).
`uuid_generate_v4()` is available: `001_initial_schema.js` runs
`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.

Indexes cover the module's actual query paths:
- overrides: `(user_id, expires_at)` — active-override lookup and delete-then-insert;
- contributions: `(goal_id)` — progress SUM; `(user_id, created_at)` — the effort "spent today" count;
- notes: `(venue_id, created_at DESC)` — recent notes per venue; `(user_id, created_at)` — the effort count.

### Steps

- [ ] **Step 1 — write the failing migration test.** Create `tests/db/migrations/038_add_botville_world.test.js` (DB-free fake-pool pattern established by 030-036's migration tests):

```js
'use strict';

// Migration lint test for src/db/migrations/038_add_botville_world.js
// (BotVille world addendum, spec II.4). DB-free "fake pool records every SQL
// string" pattern per 030-036's migration tests — migrations are only ever
// exercised against a real DB via the explicit human-run rehearsal.
//
// Invariant also pinned here: migrations never fabricate world state — no
// INSERT into any botville_* table.

const test = require('node:test');
const assert = require('node:assert/strict');

const MIGRATION_PATH = '../../../src/db/migrations/038_add_botville_world.js';

const EXPECTED_COLUMNS = {
  botville_venue_overrides: ['id', 'user_id', 'venue_id', 'slot_key', 'expires_at', 'created_at'],
  botville_city_goals: ['id', 'town_id', 'kind', 'title', 'target_amount', 'created_at'],
  botville_goal_contributions: ['id', 'goal_id', 'user_id', 'amount', 'created_at'],
  botville_venue_notes: ['id', 'venue_id', 'user_id', 'body', 'created_at'],
};

const EXPECTED_INDEXES = [
  'idx_botville_venue_overrides_user_expiry',
  'idx_botville_goal_contributions_goal_id',
  'idx_botville_goal_contributions_user_day',
  'idx_botville_venue_notes_venue_recency',
  'idx_botville_venue_notes_user_day',
];

function makeFakePool() {
  const queries = [];
  const record = (sql, params) => {
    queries.push({ sql, params });
    return { rows: [] };
  };
  return {
    queries,
    query: async (sql, params) => record(sql, params),
    connect: async () => ({
      query: async (sql, params) => record(sql, params),
      release: () => {},
    }),
  };
}

test('038 exists and exports up/down', () => {
  const migration = require(MIGRATION_PATH);
  assert.equal(typeof migration.up, 'function');
  assert.equal(typeof migration.down, 'function');
});

test('up() creates the four botville tables with every spec II.4 column', async () => {
  const migration = require(MIGRATION_PATH);
  const pool = makeFakePool();
  await migration.up(pool);
  const allSql = pool.queries.map((q) => q.sql).join('\n');

  for (const [table, columns] of Object.entries(EXPECTED_COLUMNS)) {
    assert.match(allSql, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`), `expected DDL for ${table}`);
    for (const column of columns) {
      assert.match(allSql, new RegExp(`\\b${column}\\b`), `expected column "${column}" for ${table}`);
    }
  }
});

test('up() carries the integrity constraints and query-path indexes', async () => {
  const migration = require(MIGRATION_PATH);
  const pool = makeFakePool();
  await migration.up(pool);
  const allSql = pool.queries.map((q) => q.sql).join('\n');

  assert.match(allSql, /amount INTEGER NOT NULL CHECK \(amount > 0\)/, 'contributions are additive accumulators only');
  assert.match(allSql, /body VARCHAR\(280\) NOT NULL/, 'note body cap is in the DDL, not just app code');
  assert.match(allSql, /REFERENCES botville_city_goals\(id\) ON DELETE CASCADE/);
  assert.match(allSql, /town_id VARCHAR\(64\) NOT NULL DEFAULT 'town-1'/);
  for (const index of EXPECTED_INDEXES) {
    assert.match(allSql, new RegExp(index), `expected index ${index}`);
  }
  assert.match(allSql, /idx_botville_venue_notes_venue_recency ON botville_venue_notes\(venue_id, created_at DESC\)/);
});

test('up() never fabricates world state (no INSERT into any botville_* table)', async () => {
  const migration = require(MIGRATION_PATH);
  const pool = makeFakePool();
  await migration.up(pool);
  const allSql = pool.queries.map((q) => q.sql).join('\n');
  assert.doesNotMatch(allSql, /INSERT INTO botville_/i);
});

test('down() drops all four tables, dependents first', async () => {
  const migration = require(MIGRATION_PATH);
  const pool = makeFakePool();
  await migration.down(pool);
  const allSql = pool.queries.map((q) => q.sql).join('\n');
  const contributionsAt = allSql.indexOf('DROP TABLE IF EXISTS botville_goal_contributions');
  const goalsAt = allSql.indexOf('DROP TABLE IF EXISTS botville_city_goals');
  assert.ok(contributionsAt !== -1 && goalsAt !== -1 && contributionsAt < goalsAt, 'contributions must drop before goals');
  assert.match(allSql, /DROP TABLE IF EXISTS botville_venue_notes/);
  assert.match(allSql, /DROP TABLE IF EXISTS botville_venue_overrides/);
});
```

- [ ] **Step 2 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/db/migrations/038_add_botville_world.test.js`
  Expected failure: `Cannot find module '../../../src/db/migrations/038_add_botville_world.js'`.

- [ ] **Step 3 — implement.** Create `src/db/migrations/038_add_botville_world.js`:

```js
/**
 * Migration: BotVille world module tables (world addendum spec II.4).
 *
 * NOTE ON NUMBERING: 037 is reserved by the visual-assets track's
 * add_schedule_venue migration (users_schedules.venue). This migration is
 * deliberately 038 so the two plans compose in either landing order.
 *
 * All four tables are namespaced botville_* and module-private (spec II.1
 * rule 1, CI-pinned by tests/botville/boundary.test.js). This migration
 * NEVER writes data — goals/notes/overrides/contributions only ever exist
 * as rows written by the module at runtime.
 *
 * venue_id is VARCHAR(64), not a foreign key: venues are registry entries
 * in the shipped config/venues.json vocabulary (spec I.1, D-21), not rows.
 */

async function up(pool) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // One active destination override per user, expiring with the schedule
    // slot it was issued in (spec II.3 go-to-venue).
    await client.query(`
      CREATE TABLE IF NOT EXISTS botville_venue_overrides (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        venue_id VARCHAR(64) NOT NULL,
        slot_key VARCHAR(32) NOT NULL,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      'CREATE INDEX idx_botville_venue_overrides_user_expiry ON botville_venue_overrides(user_id, expires_at)'
    );

    // City goals: additive accumulators only (spec II.3 constraints — no
    // tool can express a joint commitment).
    await client.query(`
      CREATE TABLE IF NOT EXISTS botville_city_goals (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        town_id VARCHAR(64) NOT NULL DEFAULT 'town-1',
        kind VARCHAR(32) NOT NULL,
        title VARCHAR(200) NOT NULL,
        target_amount INTEGER NOT NULL CHECK (target_amount > 0),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS botville_goal_contributions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        goal_id UUID NOT NULL REFERENCES botville_city_goals(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount INTEGER NOT NULL CHECK (amount > 0),
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      'CREATE INDEX idx_botville_goal_contributions_goal_id ON botville_goal_contributions(goal_id)'
    );
    // Effort receipts path: "this user's contribution rows today".
    await client.query(
      'CREATE INDEX idx_botville_goal_contributions_user_day ON botville_goal_contributions(user_id, created_at)'
    );

    // Venue notes (spec II.3 leave-note): the 280 cap lives in the DDL as
    // well as the zod schema — belt and braces at both boundaries.
    await client.query(`
      CREATE TABLE IF NOT EXISTS botville_venue_notes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        venue_id VARCHAR(64) NOT NULL,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        body VARCHAR(280) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      'CREATE INDEX idx_botville_venue_notes_venue_recency ON botville_venue_notes(venue_id, created_at DESC)'
    );
    // Effort receipts path: "this user's note rows today".
    await client.query(
      'CREATE INDEX idx_botville_venue_notes_user_day ON botville_venue_notes(user_id, created_at)'
    );

    await client.query('COMMIT');
    console.log('✓ Created botville_venue_overrides, botville_city_goals, botville_goal_contributions, botville_venue_notes');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function down(pool) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Dependents first: contributions reference goals.
    await client.query('DROP TABLE IF EXISTS botville_goal_contributions');
    await client.query('DROP TABLE IF EXISTS botville_city_goals');
    await client.query('DROP TABLE IF EXISTS botville_venue_notes');
    await client.query('DROP TABLE IF EXISTS botville_venue_overrides');

    await client.query('COMMIT');
    console.log('✓ Dropped the four botville_* tables');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { up, down };
```

- [ ] **Step 4 — run, expect pass.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/db/migrations/038_add_botville_world.test.js` — expected: 5 tests pass.
  Also re-run `node --test tests/botville/boundary.test.js` — expected: still green (038 is allowlisted).

- [ ] **Step 5 — commit.**

```bash
cd /Users/home/aisocialnetwork-api
git add src/db/migrations/038_add_botville_world.js tests/db/migrations/038_add_botville_world.test.js
git commit -m "feat(botville): migration 038 — four namespaced world tables (spec II.4)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Venue registry adapter — the module's schema'd view over the shipped vocabulary (D-21)

**Files:**
- Create: `src/services/botville/venueRegistryService.js`
- Test (create): `tests/botville/venueRegistryService.test.js`

**Interfaces:**
- Consumes: `VenueSchema` from `src/services/botville/schemas.js` (Task 1); `loadVocabulary` from `src/utils/venueVocabulary.js` (the SHIPPED loader over `config/venues.json` — botville → core is the allowed dependency direction, boundary rule 3).
- Produces (`src/services/botville/venueRegistryService.js`):
  - `loadVenues(): Venue[]` — loads the shipped vocabulary through `loadVocabulary()`, validates every entry against the canonical zod `VenueSchema`, caches; throws on any invalid entry.
  - `getVenue(venueId: string): Venue | null`
  - `deriveVenueOpenNow(venue: Venue, hour: number): boolean` — pure; `close` exclusive; wrap-around via split entries.

**The vocabulary is SHIPPED, not created here (D-21).** `config/venues.json`
(18 venues × 8 fields at time of writing — but never pin either number) is
already committed, loaded and structurally checked by
`src/utils/venueVocabulary.js`, and pinned byte-for-byte against BotVille's
published artifact by `tests/venueVocabularySync.test.js`. This task adds only
the module-boundary layer: zod validation **wrapping** that loader — no second
data file, no second loader, no re-declared venue.

**Assignment derivations are NOT built here (D-21).** The schedule writer's own
derivations in `src/utils/scheduleCoverage.js` — `deriveHomeVenue` (roster in
creation order + residence capacities), `deriveWorkplaceVenue` /
`deriveHangoutVenue` (seeded via `agentSeed.pickFrom`, the FNV-1a cross-repo
contract), `deriveVenuesAffording` — are the single assignment authority, so
`get-city-map` (Task 7) consumes them directly and can never disagree with a
stored routine. Re-implementing any of them in the module is a defect.

**Extensibility invariant (D-21, binding on every later task):** adding a venue
to `venues.json` (+ BotVille sync) must flow through this module with **zero
module code changes**. No venue id, role, hour or count may be hardcoded as an
expected value in module code or tests — tests derive expectations from the
registry itself. (A synthetic venue literal used to exercise pure hour
arithmetic is fine; naming a shipped venue as an expected result is not.)

### Steps

- [ ] **Step 1 — write the failing test.** Create `tests/botville/venueRegistryService.test.js` (D-21: every expectation about shipped venues is DERIVED from the vocabulary — no id or count appears as a literal):

```js
'use strict';

// Venue registry adapter (spec I.1, D-21): the module's zod-validated view
// over the SHIPPED vocabulary (config/venues.json via
// src/utils/venueVocabulary.js). Extensibility invariant: adding a venue to
// venues.json changes NOTHING here — no test names a shipped venue id or
// pins a count; expectations derive from the registry itself.

const test = require('node:test');
const assert = require('node:assert/strict');

const { venueIds } = require('../../src/utils/venueVocabulary');
const {
  loadVenues,
  getVenue,
  deriveVenueOpenNow,
} = require('../../src/services/botville/venueRegistryService');

test('loadVenues serves exactly the shipped vocabulary, validated, and caches', () => {
  const venues = loadVenues();
  assert.deepEqual(
    venues.map((venue) => venue.id).sort(),
    [...venueIds()].sort(),
    'no additions, no omissions — the shipped vocabulary is the registry'
  );
  assert.equal(loadVenues(), venues, 'second load must return the cached array');
});

test('every shipped venue survives zod validation with the full 8-field descriptor', () => {
  for (const venue of loadVenues()) {
    for (const field of ['id', 'label', 'indoor', 'capacity', 'archetype', 'roles', 'affords', 'hours']) {
      assert.ok(field in venue, `venue "${venue.id}" must carry "${field}" after validation`);
    }
  }
});

test('getVenue finds by id and returns null for an unknown id', () => {
  const [firstVenue] = loadVenues();
  assert.equal(getVenue(firstVenue.id).id, firstVenue.id);
  assert.equal(getVenue('no-such-venue'), null);
});

test('deriveVenueOpenNow: close is exclusive; wrap-around uses split-at-midnight entries', () => {
  // Synthetic literals, not registry entries: the rule under test is the
  // hour arithmetic, which must not depend on what happens to be shipped.
  const dayVenue = { hours: [{ open: 7, close: 22 }] };
  assert.equal(deriveVenueOpenNow(dayVenue, 7), true);
  assert.equal(deriveVenueOpenNow(dayVenue, 21), true);
  assert.equal(deriveVenueOpenNow(dayVenue, 22), false);
  assert.equal(deriveVenueOpenNow(dayVenue, 3), false);

  const nightVenue = { hours: [{ open: 22, close: 24 }, { open: 0, close: 2 }] };
  assert.equal(deriveVenueOpenNow(nightVenue, 23), true);
  assert.equal(deriveVenueOpenNow(nightVenue, 1), true);
  assert.equal(deriveVenueOpenNow(nightVenue, 3), false);
});

test('every shipped hours entry obeys the split-at-midnight convention', () => {
  for (const venue of loadVenues()) {
    for (const entry of venue.hours) {
      assert.ok(
        entry.open >= 0 && entry.close <= 24 && entry.open < entry.close,
        `venue "${venue.id}" hours must be split-at-midnight entries (open < close, both 0..24)`
      );
    }
  }
});
```

- [ ] **Step 2 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/venueRegistryService.test.js`
  Expected failure: `Cannot find module '../../src/services/botville/venueRegistryService'`.

- [ ] **Step 3 — implement the service.** Create `src/services/botville/venueRegistryService.js`:

```js
'use strict';

/**
 * BotVille venue registry adapter (spec I.1, owner decision D-21).
 *
 * The vocabulary is SHIPPED: config/venues.json, loaded and structurally
 * checked by src/utils/venueVocabulary.js. BotVille's published artifact is
 * the source of truth (I-8: places exist because art exists for them);
 * tests/venueVocabularySync.test.js pins this copy byte-for-byte. This
 * module WRAPS that loader with the canonical zod VenueSchema — the
 * module-boundary validation — and never re-declares venue data.
 *
 * Extensibility invariant (D-21): adding a venue to venues.json (+ BotVille
 * sync) flows through here with ZERO code changes. No venue id, role, hour
 * or count is hardcoded in this module.
 *
 * Venue↔agent assignments are deliberately NOT here: the schedule writer's
 * own derivations (src/utils/scheduleCoverage.js — deriveHomeVenue,
 * deriveWorkplaceVenue, seeded via agentSeed.pickFrom) are the single
 * assignment authority, so get-city-map always agrees with stored routines.
 */

const { loadVocabulary } = require('../../utils/venueVocabulary');
const { VenueSchema } = require('./schemas');

let venuesCache = null;

function loadVenues() {
  if (venuesCache) return venuesCache;

  venuesCache = loadVocabulary().map((entry) => {
    const parsed = VenueSchema.safeParse(entry);
    if (!parsed.success) {
      const entryId = entry && typeof entry === 'object' ? entry.id : String(entry);
      throw new Error(`Invalid venue descriptor in config/venues.json (id: ${entryId}): ${parsed.error.message}`);
    }
    return parsed.data;
  });

  return venuesCache;
}

function getVenue(venueId) {
  return loadVenues().find((venue) => venue.id === venueId) || null;
}

/** Pure — no I/O, no clock reads (the caller passes the hour). `close` is
 *  exclusive; wrap-around is expressed as split-at-midnight entries. */
function deriveVenueOpenNow(venue, hour) {
  return venue.hours.some((entry) => entry.open <= hour && hour < entry.close);
}

module.exports = {
  loadVenues,
  getVenue,
  deriveVenueOpenNow,
};
```

- [ ] **Step 4 — run, expect pass.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/venueRegistryService.test.js` — expected: 5 tests pass against the live `config/venues.json`.

- [ ] **Step 5 — sanity-check the extensibility invariant (no commit).** Temporarily append a synthetic venue (`{"id":"test-annex","label":"Test Annex","indoor":true,"capacity":4,"archetype":"office","roles":["work"],"affords":["work"],"hours":[{"open":9,"close":17}]}`) to `config/venues.json`, re-run the test file, confirm **all 5 tests still pass with zero code changes** (the derived expectations absorb the new venue), then `git checkout -- config/venues.json` to revert. NOTE: `tests/venueVocabularySync.test.js` WILL fail while the synthetic venue is present — that is its job (the copy must match BotVille's artifact); do not run the full suite mid-check, and verify the revert with `git status`.

- [ ] **Step 6 — commit.**

```bash
cd /Users/home/aisocialnetwork-api
git add src/services/botville/venueRegistryService.js tests/botville/venueRegistryService.test.js
git commit -m "feat(botville): venue registry adapter over the shipped vocabulary (spec I.1, D-21)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: World services — effort, overrides, goals, notes

**Files:**
- Create: `src/services/botville/effortService.js`
- Create: `src/services/botville/overridesService.js`
- Create: `src/services/botville/goalsService.js`
- Create: `src/services/botville/notesService.js`
- Test (create): `tests/botville/effortService.test.js`
- Test (create): `tests/botville/overridesService.test.js`
- Test (create): `tests/botville/goalsService.test.js`
- Test (create): `tests/botville/notesService.test.js`

**Interfaces:**
- Consumes: `pool` (`src/config/database.js`), `Schedule.getCurrentSlot(userId, timezone)` (`src/models/Schedule.js`), `User.findById(id)` (`src/models/User.js`), Task 1 schemas, Task 3 `venueRegistryService.getVenue`.
- Produces:
  - `effortService`: `DAILY_EFFORT_BUDGET_POINTS = 3`, `EFFORT_COST_PER_ACTION_POINTS = 1`, `async deriveEffortRemaining(userId: string, timezone: string): number`
  - `overridesService`: `async createOverrideForCurrentSlot(user: {id, timezone}, venueId: string): { id, venueId, slotKey, expiresAt }`, `async listActiveOverrides(): Array<{ userId, venueId, expiresAt }>`
  - `goalsService`: `async listGoals(townId?: string, callerUserId?: string|null): CityGoal[]`, `async contribute(user: {id}, goalId: string, amount: number): CityGoal`, `formatGoal(row): CityGoal`
  - `notesService`: `NOTES_PER_VENUE_LIMIT = 10`, `async listNotesForVenue(venueId: string, limit?: number): VenueNote[]`, `async createNote(user: {id, displayName}, venueId: string, body: string): VenueNote`

**Testing note (checked against the real repo):** no test under `tests/` uses a
live database or a `DATABASE_URL`/`DB_HOST` skip guard — the house pattern is a
fully mocked `pool` (`t.mock.method(pool, 'query', ...)` /
`t.mock.method(pool, 'connect', ...)`, e.g. `tests/services/readMarkerService.test.js`,
`tests/routes/recentContent.route.test.js`). These SQL-bearing services are
therefore tested by capturing and asserting the exact SQL + parameters against
mocked results, exactly like the rest of the suite.

### Steps

- [ ] **Step 1 — write the failing effort test.** Create `tests/botville/effortService.test.js`:

```js
'use strict';

// Effort budget (spec II.4): accrual is computed, spend is rows that already
// exist as receipts — no meter table. One SQL, local-day-bounded via
// AT TIME ZONE.

const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../../src/config/database');
const {
  DAILY_EFFORT_BUDGET_POINTS,
  EFFORT_COST_PER_ACTION_POINTS,
  deriveEffortRemaining,
} = require('../../src/services/botville/effortService');

test('the configuration constants are the spec values', () => {
  assert.equal(DAILY_EFFORT_BUDGET_POINTS, 3);
  assert.equal(EFFORT_COST_PER_ACTION_POINTS, 1);
});

test('deriveEffortRemaining = budget − todays contribution+note receipts, in ONE local-day SQL', async (t) => {
  let captured;
  const queryMock = t.mock.method(pool, 'query', async (sql, params) => {
    captured = { sql, params };
    return { rows: [{ effort_spent_points: 2 }] };
  });

  const remaining = await deriveEffortRemaining('user-1', 'America/New_York');

  assert.equal(remaining, 1);
  assert.equal(queryMock.mock.callCount(), 1, 'spend must be read in exactly one SQL statement');
  assert.deepEqual(captured.params, ['user-1', 'America/New_York']);
  assert.match(captured.sql, /botville_goal_contributions/);
  assert.match(captured.sql, /botville_venue_notes/);
  assert.match(captured.sql, /AT TIME ZONE \$2/, 'today must be the USER-LOCAL day, not the UTC day');
  assert.doesNotMatch(captured.sql, /INSERT|UPDATE|DELETE/i, 'deriving effort never writes');
});

test('deriveEffortRemaining returns the full budget when no receipts exist today', async (t) => {
  t.mock.method(pool, 'query', async () => ({ rows: [{ effort_spent_points: 0 }] }));
  assert.equal(await deriveEffortRemaining('user-1', 'UTC'), 3);
});
```

- [ ] **Step 2 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/effortService.test.js`
  Expected failure: `Cannot find module '../../src/services/botville/effortService'`.

- [ ] **Step 3 — implement effortService.** Create `src/services/botville/effortService.js`:

```js
'use strict';

/**
 * Computed daily effort budget (spec II.4).
 *
 *   deriveEffortRemaining(user, gameDay) =
 *     DAILY_EFFORT_BUDGET_POINTS − sumEffortSpentToday(user, gameDay)
 *
 * No meter is stored anywhere: spend is the count of today's already-stored
 * action receipts (contribution rows + note rows), bounded to the user's
 * LOCAL day, in one SQL statement. Exhaustion handling (the in-fiction
 * refusal) lives at the tool layer, not here.
 */

const pool = require('../../config/database');

const DAILY_EFFORT_BUDGET_POINTS = 3;
const EFFORT_COST_PER_ACTION_POINTS = 1;

async function deriveEffortRemaining(userId, timezone) {
  const query = `
    WITH caller_local_day AS (
      SELECT date_trunc('day', NOW() AT TIME ZONE $2) AS day_start
    )
    SELECT
      (
        SELECT COUNT(*)::int
        FROM botville_goal_contributions, caller_local_day
        WHERE botville_goal_contributions.user_id = $1
          AND botville_goal_contributions.created_at AT TIME ZONE $2 >= caller_local_day.day_start
      )
      +
      (
        SELECT COUNT(*)::int
        FROM botville_venue_notes, caller_local_day
        WHERE botville_venue_notes.user_id = $1
          AND botville_venue_notes.created_at AT TIME ZONE $2 >= caller_local_day.day_start
      ) AS effort_spent_points
  `;

  const result = await pool.query(query, [userId, timezone]);
  const effortSpentPoints = result.rows.length > 0 ? Number(result.rows[0].effort_spent_points) : 0;
  return DAILY_EFFORT_BUDGET_POINTS - effortSpentPoints * EFFORT_COST_PER_ACTION_POINTS;
}

module.exports = {
  DAILY_EFFORT_BUDGET_POINTS,
  EFFORT_COST_PER_ACTION_POINTS,
  deriveEffortRemaining,
};
```

- [ ] **Step 4 — run, expect pass.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/effortService.test.js` — expected: 3 tests pass.

- [ ] **Step 5 — write the failing overrides test.** Create `tests/botville/overridesService.test.js`:

```js
'use strict';

// Destination overrides (spec II.3 go-to-venue): one active override per
// user, scoped to the CURRENT slot, expiring with it. Never rewrites the
// routine — the presence function consumes the override, nothing writes a
// location.

const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../../src/config/database');
const Schedule = require('../../src/models/Schedule');
const overridesService = require('../../src/services/botville/overridesService');

function mockTransactionClient(t, { insertedRow }) {
  const executed = [];
  t.mock.method(pool, 'connect', async () => ({
    query: async (sql, params) => {
      executed.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
      if (/INSERT INTO botville_venue_overrides/.test(sql)) {
        return { rows: [insertedRow] };
      }
      return { rows: [] };
    },
    release: () => {},
  }));
  return executed;
}

test('createOverrideForCurrentSlot: delete-then-insert in one transaction, expiring at slot end in the caller tz', async (t) => {
  t.mock.method(Schedule, 'getCurrentSlot', async () => ({
    dayType: 'weekday', startHour: 9, endHour: 12, activity: 'working', venue: 'office',
  }));
  const executed = mockTransactionClient(t, {
    insertedRow: { id: 'override-1', venue_id: 'cafe', slot_key: 'weekday:9-12', expires_at: new Date('2026-07-29T16:00:00Z') },
  });

  const override = await overridesService.createOverrideForCurrentSlot(
    { id: 'user-1', timezone: 'America/New_York' },
    'cafe'
  );

  const statements = executed.map((entry) => entry.sql);
  assert.ok(statements.includes('BEGIN') && statements.includes('COMMIT'), 'must run inside a transaction');
  const deleteIndex = statements.findIndex((sql) => sql.startsWith('DELETE FROM botville_venue_overrides'));
  const insertIndex = statements.findIndex((sql) => sql.startsWith('INSERT INTO botville_venue_overrides'));
  assert.ok(deleteIndex !== -1 && insertIndex !== -1 && deleteIndex < insertIndex,
    'one active override per user: delete the previous one before inserting');

  const insert = executed[insertIndex];
  assert.deepEqual(insert.params, ['user-1', 'cafe', 'weekday:9-12', 'America/New_York', 12]);
  assert.match(insert.sql, /make_interval\(hours => \$5\)/, 'expiry is computed in SQL from the slot end hour');
  assert.match(insert.sql, /AT TIME ZONE \$4/, 'expiry is anchored to the caller\'s local day');

  assert.deepEqual(override, {
    id: 'override-1', venueId: 'cafe', slotKey: 'weekday:9-12', expiresAt: '2026-07-29T16:00:00.000Z',
  });
});

test('createOverrideForCurrentSlot rejects when there is no current slot', async (t) => {
  t.mock.method(Schedule, 'getCurrentSlot', async () => null);
  const connectMock = t.mock.method(pool, 'connect', async () => {
    throw new Error('must not open a transaction without a slot');
  });
  await assert.rejects(
    () => overridesService.createOverrideForCurrentSlot({ id: 'user-1', timezone: 'UTC' }, 'cafe'),
    /No current schedule slot/
  );
  assert.equal(connectMock.mock.callCount(), 0);
});

test('listActiveOverrides returns only unexpired rows, camelCased', async (t) => {
  let captured;
  t.mock.method(pool, 'query', async (sql, params) => {
    captured = { sql, params };
    return { rows: [{ user_id: 'user-2', venue_id: 'district', expires_at: new Date('2026-07-29T23:00:00Z') }] };
  });
  const overrides = await overridesService.listActiveOverrides();
  assert.match(captured.sql, /expires_at > NOW\(\)/);
  assert.deepEqual(overrides, [{ userId: 'user-2', venueId: 'district', expiresAt: '2026-07-29T23:00:00.000Z' }]);
});
```

- [ ] **Step 6 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/overridesService.test.js`
  Expected failure: `Cannot find module '../../src/services/botville/overridesService'`.

- [ ] **Step 7 — implement overridesService.** Create `src/services/botville/overridesService.js`:

```js
'use strict';

/**
 * Destination overrides (spec II.3 go-to-venue).
 *
 * An override never rewrites the routine: it is one row the presence
 * function consumes ahead of the slot's own venue, and it expires exactly
 * when the current slot ends (computed in the caller's timezone). One
 * active override per user, enforced by delete-then-insert in a single
 * transaction.
 *
 * Boundary rule 2: the schedule is read through Schedule.getCurrentSlot,
 * never raw SQL against users_schedules.
 */

const pool = require('../../config/database');
const Schedule = require('../../models/Schedule');

async function createOverrideForCurrentSlot(user, venueId) {
  const timezone = user.timezone || 'UTC';
  const slot = await Schedule.getCurrentSlot(user.id, timezone);
  if (!slot) {
    throw new Error('No current schedule slot - there is nothing to override right now');
  }

  const slotKey = `${slot.dayType}:${slot.startHour}-${slot.endHour}`;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    await client.query('DELETE FROM botville_venue_overrides WHERE user_id = $1', [user.id]);

    // expires_at = today's slot end hour in the caller's local day, as an
    // absolute instant: local midnight + end_hour, converted back to UTC.
    // end_hour = 24 lands exactly on the next local midnight.
    const inserted = await client.query(
      `INSERT INTO botville_venue_overrides (user_id, venue_id, slot_key, expires_at)
       VALUES (
         $1, $2, $3,
         (date_trunc('day', NOW() AT TIME ZONE $4) + make_interval(hours => $5)) AT TIME ZONE $4
       )
       RETURNING id, venue_id, slot_key, expires_at`,
      [user.id, venueId, slotKey, timezone, slot.endHour]
    );

    await client.query('COMMIT');

    const row = inserted.rows[0];
    return {
      id: row.id,
      venueId: row.venue_id,
      slotKey: row.slot_key,
      expiresAt: new Date(row.expires_at).toISOString(),
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function listActiveOverrides() {
  const result = await pool.query(
    'SELECT user_id, venue_id, expires_at FROM botville_venue_overrides WHERE expires_at > NOW()'
  );
  return result.rows.map((row) => ({
    userId: row.user_id,
    venueId: row.venue_id,
    expiresAt: new Date(row.expires_at).toISOString(),
  }));
}

module.exports = { createOverrideForCurrentSlot, listActiveOverrides };
```

- [ ] **Step 8 — run, expect pass.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/overridesService.test.js` — expected: 3 tests pass.

- [ ] **Step 9 — write the failing goals test.** Create `tests/botville/goalsService.test.js`:

```js
'use strict';

// City goals (spec II.3/II.4): additive accumulators only. Progress and the
// caller's own contribution are aggregated in one query; contributions are
// receipts, never a stored counter.

const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../../src/config/database');
const goalsService = require('../../src/services/botville/goalsService');

const GOAL_ROW = {
  id: 'goal-1',
  town_id: 'town-1',
  kind: 'harvest',
  title: 'Stock the winter granary',
  target_amount: 500,
  created_at: new Date('2026-07-01T00:00:00Z'),
  progress_amount: '120',
  caller_contribution_amount: '30',
};

test('listGoals aggregates progress and the caller contribution in one query', async (t) => {
  let captured;
  const queryMock = t.mock.method(pool, 'query', async (sql, params) => {
    captured = { sql, params };
    return { rows: [GOAL_ROW] };
  });

  const goals = await goalsService.listGoals('town-1', 'user-1');

  assert.equal(queryMock.mock.callCount(), 1);
  assert.deepEqual(captured.params, ['town-1', 'user-1']);
  assert.match(captured.sql, /FILTER \(WHERE botville_goal_contributions\.user_id = \$2\)/);
  assert.deepEqual(goals, [{
    id: 'goal-1',
    townId: 'town-1',
    kind: 'harvest',
    title: 'Stock the winter granary',
    targetAmount: 500,
    progressAmount: 120,
    callerContributionAmount: 30,
    createdAt: '2026-07-01T00:00:00.000Z',
  }]);
});

test('contribute rejects non-positive and non-integer amounts before touching the database', async (t) => {
  const queryMock = t.mock.method(pool, 'query', async () => ({ rows: [] }));
  await assert.rejects(() => goalsService.contribute({ id: 'user-1' }, 'goal-1', 0), /positive integer/);
  await assert.rejects(() => goalsService.contribute({ id: 'user-1' }, 'goal-1', -5), /positive integer/);
  await assert.rejects(() => goalsService.contribute({ id: 'user-1' }, 'goal-1', 1.5), /positive integer/);
  assert.equal(queryMock.mock.callCount(), 0);
});

test('contribute inserts a receipt row for an existing goal and returns updated progress', async (t) => {
  const executed = [];
  t.mock.method(pool, 'query', async (sql, params) => {
    executed.push({ sql: sql.replace(/\s+/g, ' ').trim(), params });
    if (sql.includes('SELECT id, town_id FROM botville_city_goals')) {
      return { rows: [{ id: 'goal-1', town_id: 'town-1' }] };
    }
    if (sql.includes('INSERT INTO botville_goal_contributions')) {
      return { rows: [] };
    }
    return { rows: [{ ...GOAL_ROW, progress_amount: '150', caller_contribution_amount: '60' }] };
  });

  const goal = await goalsService.contribute({ id: 'user-1' }, 'goal-1', 30);

  const insert = executed.find((entry) => entry.sql.startsWith('INSERT INTO botville_goal_contributions'));
  assert.ok(insert, 'a contribution receipt row must be inserted');
  assert.deepEqual(insert.params, ['goal-1', 'user-1', 30]);
  assert.equal(goal.progressAmount, 150);
  assert.equal(goal.callerContributionAmount, 60);
});

test('contribute rejects an unknown goal', async (t) => {
  t.mock.method(pool, 'query', async () => ({ rows: [] }));
  await assert.rejects(() => goalsService.contribute({ id: 'user-1' }, 'goal-x', 10), /City goal not found/);
});
```

- [ ] **Step 10 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/goalsService.test.js`
  Expected failure: `Cannot find module '../../src/services/botville/goalsService'`.

- [ ] **Step 11 — implement goalsService.** Create `src/services/botville/goalsService.js`:

```js
'use strict';

/**
 * City goals (spec II.3/II.4): additive accumulators ONLY. No tool or
 * service call can express a joint commitment (design §22 ban) — the only
 * write is an INSERT of one contribution receipt, and progress is always a
 * SUM over receipts, never a stored counter.
 */

const pool = require('../../config/database');
const { TOWN_ID_DEFAULT } = require('./schemas');

function formatGoal(row) {
  return {
    id: row.id,
    townId: row.town_id,
    kind: row.kind,
    title: row.title,
    targetAmount: row.target_amount,
    progressAmount: Number(row.progress_amount),
    callerContributionAmount: Number(row.caller_contribution_amount),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

async function listGoals(townId = TOWN_ID_DEFAULT, callerUserId = null) {
  const query = `
    SELECT
      botville_city_goals.id,
      botville_city_goals.town_id,
      botville_city_goals.kind,
      botville_city_goals.title,
      botville_city_goals.target_amount,
      botville_city_goals.created_at,
      COALESCE(SUM(botville_goal_contributions.amount), 0)::int AS progress_amount,
      COALESCE(
        SUM(botville_goal_contributions.amount) FILTER (WHERE botville_goal_contributions.user_id = $2),
        0
      )::int AS caller_contribution_amount
    FROM botville_city_goals
    LEFT JOIN botville_goal_contributions
      ON botville_goal_contributions.goal_id = botville_city_goals.id
    WHERE botville_city_goals.town_id = $1
    GROUP BY botville_city_goals.id
    ORDER BY botville_city_goals.created_at
  `;
  const result = await pool.query(query, [townId, callerUserId]);
  return result.rows.map(formatGoal);
}

async function contribute(user, goalId, amount) {
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error('Contribution amount must be a positive integer');
  }

  const goalResult = await pool.query('SELECT id, town_id FROM botville_city_goals WHERE id = $1', [goalId]);
  if (goalResult.rows.length === 0) {
    throw new Error(`City goal not found: ${goalId}`);
  }

  await pool.query(
    'INSERT INTO botville_goal_contributions (goal_id, user_id, amount) VALUES ($1, $2, $3)',
    [goalId, user.id, amount]
  );

  const goals = await listGoals(goalResult.rows[0].town_id, user.id);
  return goals.find((goal) => goal.id === goalId);
}

module.exports = { listGoals, contribute, formatGoal };
```

- [ ] **Step 12 — run, expect pass.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/goalsService.test.js` — expected: 4 tests pass.

- [ ] **Step 13 — write the failing notes test.** Create `tests/botville/notesService.test.js`:

```js
'use strict';

// Venue notes (spec II.3 leave-note): short, content-guarded rows at a
// venue. Author names resolve through the User model interface (boundary
// rule 2 — never a raw JOIN against the core users table).

const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../../src/config/database');
const User = require('../../src/models/User');
const notesService = require('../../src/services/botville/notesService');

test('createNote rejects an empty and an oversized body before touching the database', async (t) => {
  const queryMock = t.mock.method(pool, 'query', async () => ({ rows: [] }));
  await assert.rejects(() => notesService.createNote({ id: 'user-1', displayName: 'Ada' }, 'cafe', ''), /1-280/);
  await assert.rejects(() => notesService.createNote({ id: 'user-1', displayName: 'Ada' }, 'cafe', 'a'.repeat(281)), /1-280/);
  assert.equal(queryMock.mock.callCount(), 0);
});

test('createNote rejects an unknown venue before touching the database', async (t) => {
  const queryMock = t.mock.method(pool, 'query', async () => ({ rows: [] }));
  await assert.rejects(() => notesService.createNote({ id: 'user-1', displayName: 'Ada' }, 'atlantis', 'hello'), /Unknown venue/);
  assert.equal(queryMock.mock.callCount(), 0);
});

test('createNote inserts and returns the wire-shaped note', async (t) => {
  let captured;
  t.mock.method(pool, 'query', async (sql, params) => {
    captured = { sql, params };
    return { rows: [{ id: 'note-1', venue_id: 'cafe', body: 'good coffee today', created_at: new Date('2026-07-29T12:00:00Z') }] };
  });

  const note = await notesService.createNote({ id: 'user-1', displayName: 'Ada' }, 'cafe', 'good coffee today');

  assert.match(captured.sql, /INSERT INTO botville_venue_notes/);
  assert.deepEqual(captured.params, ['cafe', 'user-1', 'good coffee today']);
  assert.deepEqual(note, {
    id: 'note-1',
    venueId: 'cafe',
    authorDisplayName: 'Ada',
    body: 'good coffee today',
    createdAt: '2026-07-29T12:00:00.000Z',
  });
});

test('listNotesForVenue: newest first, limit 10 default, authors via User model (no JOIN on users)', async (t) => {
  let captured;
  t.mock.method(pool, 'query', async (sql, params) => {
    captured = { sql, params };
    return {
      rows: [
        { id: 'note-2', venue_id: 'cafe', user_id: 'user-2', body: 'meet here at 8', created_at: new Date('2026-07-29T13:00:00Z') },
        { id: 'note-1', venue_id: 'cafe', user_id: 'user-1', body: 'good coffee today', created_at: new Date('2026-07-29T12:00:00Z') },
      ],
    };
  });
  t.mock.method(User, 'findById', async (id) => (
    id === 'user-1' ? { id: 'user-1', displayName: 'Ada' } : { id: 'user-2', displayName: 'Sam' }
  ));

  const notes = await notesService.listNotesForVenue('cafe');

  assert.doesNotMatch(captured.sql, /JOIN\s+users/i, 'boundary rule 2: no raw SQL against core tables');
  assert.match(captured.sql, /ORDER BY created_at DESC/);
  assert.deepEqual(captured.params, ['cafe', 10]);
  assert.deepEqual(notes.map((note) => note.authorDisplayName), ['Sam', 'Ada']);
  assert.equal(notes[0].body, 'meet here at 8');
});
```

- [ ] **Step 14 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/notesService.test.js`
  Expected failure: `Cannot find module '../../src/services/botville/notesService'`.

- [ ] **Step 15 — implement notesService.** Create `src/services/botville/notesService.js`:

```js
'use strict';

/**
 * Venue notes (spec II.3 leave-note): short notes pinned at a venue,
 * rendered in the city and readable by agents via get-venue.
 *
 * Content guard: the 1..280 body cap is validated here with the module's
 * canonical schema constant (and again by the DDL's VARCHAR(280)).
 * Boundary rule 2: author display names resolve through User.findById,
 * never a JOIN against the core users table.
 */

const z = require('zod');
const pool = require('../../config/database');
const User = require('../../models/User');
const venueRegistryService = require('./venueRegistryService');
const { NOTE_BODY_MAX_CHARS } = require('./schemas');

const NOTES_PER_VENUE_LIMIT = 10;

const NoteBodySchema = z.string().min(1).max(NOTE_BODY_MAX_CHARS);

async function listNotesForVenue(venueId, limit = NOTES_PER_VENUE_LIMIT) {
  const result = await pool.query(
    `SELECT id, venue_id, user_id, body, created_at
     FROM botville_venue_notes
     WHERE venue_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [venueId, limit]
  );

  const authorIds = [...new Set(result.rows.map((row) => row.user_id))];
  const authors = await Promise.all(authorIds.map((authorId) => User.findById(authorId)));
  const authorsById = new Map(authors.filter(Boolean).map((author) => [author.id, author]));

  return result.rows.map((row) => ({
    id: row.id,
    venueId: row.venue_id,
    authorDisplayName: authorsById.has(row.user_id)
      ? authorsById.get(row.user_id).displayName
      : 'A departed resident',
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

async function createNote(user, venueId, body) {
  const parsedBody = NoteBodySchema.safeParse(body);
  if (!parsedBody.success) {
    throw new Error(`Note body must be 1-${NOTE_BODY_MAX_CHARS} characters`);
  }
  if (!venueRegistryService.getVenue(venueId)) {
    throw new Error(`Unknown venue: ${venueId}`);
  }

  const result = await pool.query(
    `INSERT INTO botville_venue_notes (venue_id, user_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, venue_id, body, created_at`,
    [venueId, user.id, parsedBody.data]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    venueId: row.venue_id,
    authorDisplayName: user.displayName,
    body: row.body,
    createdAt: new Date(row.created_at).toISOString(),
  };
}

module.exports = { NOTES_PER_VENUE_LIMIT, listNotesForVenue, createNote };
```

- [ ] **Step 16 — run all four service tests plus the boundary tests, expect pass.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/` — expected: every test in the directory passes.

- [ ] **Step 17 — commit.**

```bash
cd /Users/home/aisocialnetwork-api
git add src/services/botville/effortService.js src/services/botville/overridesService.js src/services/botville/goalsService.js src/services/botville/notesService.js tests/botville/effortService.test.js tests/botville/overridesService.test.js tests/botville/goalsService.test.js tests/botville/notesService.test.js
git commit -m "feat(botville): effort, overrides, goals and notes services (spec II.3/II.4)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Presence — characterize the merged `getCurrentSlot` + build `presenceService`

> **RE-SCOPED 2026-07-30 (D-22).** The visual-assets set already merged every
> `Schedule.js` edit this task once planned: `getCurrentSlot` selects
> `users_schedules.venue` (src/models/Schedule.js:41), the overlap tie-break is
> pinned as `ORDER BY users_schedules.start LIMIT 1` — **ascending,
> earliest-start-wins** (:50-51) — and `formatScheduleSlot` carries
> `venue: row.venue ?? null` (:172). Per D-22 the merged ASC rule STANDS (the
> deterministic writer guarantees non-overlap — SC-1 — so the tie-break is a
> degenerate-case guard only; any future override layering must be an explicit
> priority mechanism, never an `ORDER BY` accident). This task therefore
> CHARACTERIZES the merged behaviour instead of editing it, then builds the
> presence service on top. **Deploy gate:** run pending migrations (incl. 037)
> in the target environment before deploying — the SELECT fails against an
> unmigrated database. (Tests are unaffected: the suite mocks `pool.query`.)

**Files:**
- Modify: `src/models/User.js` (add `listAll()` — the interface-mediated read model the module is required to use instead of raw SQL, per boundary rule 2)
- Create: `src/services/botville/presenceService.js`
- Test (create): `tests/botville/scheduleCurrentSlotDeterminism.test.js` (characterization — expected green on first run)
- Test (create): `tests/botville/presenceService.test.js`

**Interfaces:**
- Consumes: `User.listAll()`, `Schedule.getCurrentSlot(userId, timezone)`, Task 4 `overridesService.listActiveOverrides()`, Task 3 `venueRegistryService` (`loadVenues`, `deriveVenueOpenNow`), Task 1 `LocationsSnapshotSchema` + `LOCATIONS_SNAPSHOT_SCHEMA_VERSION`.
- Produces (`src/services/botville/presenceService.js`):
  - `BOTVILLE_TOWN_TIMEZONE: string` — `process.env.BOTVILLE_TOWN_TIMEZONE || 'America/New_York'`
  - `deriveGameHour(date: Date, timezone: string): number` — pure, 0..23
  - `async resolvePresence(user: {id, timezone}, activeOverridesByUserId: Map<string, {userId, venueId}>, venuesById: Map<string, Venue>): { venueId: string|null, activity: string|undefined }`
  - `async listLocations(townId: string): LocationsSnapshot` — validated with `LocationsSnapshotSchema.parse` before it crosses the boundary
- Produces (core model additions):
  - `User.listAll(): Promise<FormattedUser[]>` — `SELECT * FROM users ORDER BY created_at`, the same creation order the schedule writer's roster uses (`populateSchedulesDeterministic.js:27`), so Task 7's home derivation agrees with the writer's.
  - (`Schedule.formatScheduleSlot` already carries `venue: string | null` — merged, nothing to add.)

**The presence function is total (spec II.2):** fixed rule on overlap
(earliest-starting slot wins — the merged rule, kept by D-22 as a
degenerate-case guard; the writer guarantees non-overlap per SC-1), `null` on
gaps, override ⊕ routine ⊕ hours; a closed or unrecognised venue falls back to
the `venueId: null` (absent) handling. Note: the merged writer only stores
venues whose hours contain the whole slot span (D-12 containment), so a closed
routine venue at read time can only arise from town-vs-agent timezone skew or
an override — the re-check here is belt and braces, not the primary guard. Out
of scope (recorded, not forgotten): the `CHECK (start < end_hour)` wrap-around
defect named in spec II.2 lives in `users_schedules`' DDL and belongs to the
schedule-venue track's follow-ups, not this module's migration set.

### Steps

- [ ] **Step 1 — write the characterization test.** Create `tests/botville/scheduleCurrentSlotDeterminism.test.js`. This is NOT a failing-first test: the behaviour it pins merged with the visual-assets set (D-22). It is written and run first anyway so the pin is verified green before anything builds on it — if it fails, STOP: the merged contract is not what this plan assumes.

```js
'use strict';

// Characterization (spec II.2 + D-22): the visual-assets set already fixed
// Schedule.getCurrentSlot — it selects users_schedules.venue and pins the
// overlap tie-break as ORDER BY users_schedules.start (ASC): the
// EARLIEST-STARTING slot wins. D-22 keeps that rule: the deterministic
// writer guarantees non-overlap (SC-1), so the tie-break is a
// degenerate-case guard only. Any future override layering must be an
// explicit priority mechanism, never an ORDER BY accident — this test
// exists so a silent change to the rule fails loudly.

const test = require('node:test');
const assert = require('node:assert/strict');

const pool = require('../../src/config/database');
const Schedule = require('../../src/models/Schedule');

test('getCurrentSlot pins the merged overlap rule (earliest start wins) and selects venue', async (t) => {
  let capturedSql = null;
  t.mock.method(pool, 'query', async (sql) => {
    capturedSql = sql;
    return {
      rows: [{
        id: 'slot-1', user_id: 'user-1', day_type: 'weekday', activity: 'deep work',
        venue: 'office', start: 9, end_hour: 12,
        online_probability: '0.80', posting_probability: '0.20',
        current_hour: 10, local_now: new Date('2026-07-29T10:00:00Z'),
      }],
    };
  });

  const slot = await Schedule.getCurrentSlot('user-1', 'UTC');

  assert.match(capturedSql, /ORDER BY users_schedules\.start\s+LIMIT 1/,
    'overlap tie-break must stay pinned in SQL: earliest-starting slot wins (D-22)');
  assert.doesNotMatch(capturedSql, /ORDER BY users_schedules\.start\s+DESC/,
    'D-22: the rule is ASC; a DESC flip is an owner decision, not a drive-by');
  assert.match(capturedSql, /users_schedules\.venue/, 'the slot must carry its venue column');
  assert.equal(slot.venue, 'office');
  assert.equal(slot.activity, 'deep work');
});

test('formatScheduleSlot normalises a missing venue to null', () => {
  const slot = Schedule.formatScheduleSlot({
    id: 'slot-2', user_id: 'user-1', day_type: 'weekend', activity: 'resting',
    venue: null, start: 20, end_hour: 24,
    online_probability: '0.10', posting_probability: '0.05',
  });
  assert.equal(slot.venue, null);
});
```

- [ ] **Step 2 — run it, expect pass (characterization of merged behaviour).**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/scheduleCurrentSlotDeterminism.test.js`
  Expected: 2 tests pass against the merged `src/models/Schedule.js` with no edits. If either fails, stop and re-read `Schedule.js` — the contract this plan builds on has moved.

- [ ] **Step 3 — add `User.listAll()`.** In `src/models/User.js`, after the `findByUsername` method, add:

```js
  /**
   * List all users. This is the interface-mediated read model that world
   * modules (BotVille presence) use instead of raw SQL against the users
   * table (modular-monolith boundary rule 2).
   */
  static async listAll() {
    const query = 'SELECT * FROM users ORDER BY created_at';
    const result = await pool.query(query);
    return result.rows.map(row => this.formatUser(row));
  }
```

- [ ] **Step 4 — write the failing presence test.** Create `tests/botville/presenceService.test.js`. Determinism note: fixtures use only venues that are open at every hour (`district`, `dorm`) so no assertion depends on the wall clock; the closed-venue path is exercised with an explicit never-open venue:

```js
'use strict';

// Presence (spec II.2): the one total presence function,
// routine ⊕ override ⊕ hours → venueId + activity. Computed per request —
// nothing ever stores a location.

const test = require('node:test');
const assert = require('node:assert/strict');

const User = require('../../src/models/User');
const Schedule = require('../../src/models/Schedule');
const overridesService = require('../../src/services/botville/overridesService');
const presenceService = require('../../src/services/botville/presenceService');

function slotFixture(overrides = {}) {
  return {
    id: 'slot-1', userId: 'user-1', dayType: 'weekday', activity: 'resting at home',
    venue: 'dorm', startHour: 20, endHour: 24,
    onlineProbability: 0.2, postingProbability: 0.1,
    ...overrides,
  };
}

test('deriveGameHour converts an instant to the town-local hour', () => {
  const instant = new Date('2026-07-29T04:30:00Z');
  assert.equal(presenceService.deriveGameHour(instant, 'America/New_York'), 0);
  assert.equal(presenceService.deriveGameHour(instant, 'UTC'), 4);
});

test('resolvePresence: override wins over the slot venue; slot venue null → absent; gap → absent, no activity', async (t) => {
  const venuesById = new Map([
    ['dorm', { id: 'dorm', archetype: 'dorm', roles: ['home'], affords: ['sleep', 'rest', 'idle'], hours: [{ open: 0, close: 24 }] }],
    ['district', { id: 'district', archetype: 'district', roles: ['hangout'], affords: ['idle', 'socialize', 'walk'], hours: [{ open: 0, close: 24 }] }],
  ]);

  t.mock.method(Schedule, 'getCurrentSlot', async (userId) => {
    if (userId === 'user-1') return slotFixture();
    if (userId === 'user-2') return slotFixture({ userId: 'user-2', activity: 'wandering', venue: null });
    return null;
  });
  const overrideForUserTwo = new Map([['user-2', { userId: 'user-2', venueId: 'district' }]]);

  assert.deepEqual(
    await presenceService.resolvePresence({ id: 'user-1', timezone: 'UTC' }, new Map(), venuesById),
    { venueId: 'dorm', activity: 'resting at home' }
  );
  assert.deepEqual(
    await presenceService.resolvePresence({ id: 'user-2', timezone: 'UTC' }, overrideForUserTwo, venuesById),
    { venueId: 'district', activity: 'wandering' }
  );
  assert.deepEqual(
    await presenceService.resolvePresence({ id: 'user-3', timezone: 'UTC' }, new Map(), venuesById),
    { venueId: null, activity: undefined }
  );
});

test('resolvePresence: a closed or unrecognised venue falls back to the null (absent) handling', async (t) => {
  t.mock.method(Schedule, 'getCurrentSlot', async () => slotFixture({ activity: 'working', venue: 'vault' }));

  const neverOpen = new Map([
    ['vault', { id: 'vault', archetype: 'vault', roles: [], affords: [], hours: [] }],
  ]);
  assert.deepEqual(
    await presenceService.resolvePresence({ id: 'user-1', timezone: 'UTC' }, new Map(), neverOpen),
    { venueId: null, activity: 'working' }
  );

  assert.deepEqual(
    await presenceService.resolvePresence({ id: 'user-1', timezone: 'UTC' }, new Map(), new Map()),
    { venueId: null, activity: 'working' },
    'a venue id the registry does not know must not be asserted to the client'
  );
});

test('listLocations returns a schemaVersion-2 LocationsSnapshot with spriteSeed = username', async (t) => {
  t.mock.method(User, 'listAll', async () => [
    { id: 'user-1', username: 'ada', displayName: 'Ada', timezone: 'UTC' },
    { id: 'user-2', username: 'sam', displayName: 'Sam', timezone: 'UTC' },
    { id: 'user-3', username: 'kit', displayName: 'Kit', timezone: 'UTC' },
  ]);
  t.mock.method(Schedule, 'getCurrentSlot', async (userId) => {
    if (userId === 'user-1') return slotFixture();
    if (userId === 'user-2') return slotFixture({ userId: 'user-2', activity: 'wandering', venue: null });
    return null;
  });
  t.mock.method(overridesService, 'listActiveOverrides', async () => [
    { userId: 'user-2', venueId: 'district', expiresAt: '2026-07-29T23:00:00.000Z' },
  ]);

  const snapshot = await presenceService.listLocations('town-1');

  assert.equal(snapshot.schemaVersion, 2);
  assert.ok(Number.isInteger(snapshot.gameHour) && snapshot.gameHour >= 0 && snapshot.gameHour <= 23);
  assert.deepEqual(snapshot.locations, [
    { id: 'user-1', displayName: 'Ada', spriteSeed: 'ada', venueId: 'dorm', activity: 'resting at home' },
    { id: 'user-2', displayName: 'Sam', spriteSeed: 'sam', venueId: 'district', activity: 'wandering' },
    { id: 'user-3', displayName: 'Kit', spriteSeed: 'kit', venueId: null },
  ]);
  assert.equal('activity' in snapshot.locations[2], false, 'a gap slot asserts no activity at all');
});
```

- [ ] **Step 5 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/presenceService.test.js`
  Expected failure: `Cannot find module '../../src/services/botville/presenceService'`.

- [ ] **Step 6 — implement presenceService.** Create `src/services/botville/presenceService.js`:

```js
'use strict';

/**
 * Presence (spec II.2): the ONE total presence function.
 *
 *   routine ⊕ override ⊕ hours → venueId + activity
 *
 * - Computed per request from users_schedules (via the Schedule model,
 *   boundary rule 2) plus the module's own active overrides. Nothing ever
 *   writes a location.
 * - Total: fixed overlap rule (earliest-starting slot wins — the merged
 *   rule, kept by D-22 and pinned in Schedule.getCurrentSlot), null on
 *   gaps, closed/unrecognised venue → the null (absent) handling.
 * - The slot lookup runs in the AGENT's own timezone (the platform's
 *   existing schedule semantics); gameHour and venue opening hours run on
 *   the TOWN clock (BOTVILLE_TOWN_TIMEZONE) — venues live in the town.
 * - townId: the snapshot is town-scoped per the contract; v1 has a single
 *   town (TOWN_ID_DEFAULT) and every user belongs to it, so the parameter
 *   does not filter yet.
 */

const User = require('../../models/User');
const Schedule = require('../../models/Schedule');
const overridesService = require('./overridesService');
const venueRegistryService = require('./venueRegistryService');
const { LocationsSnapshotSchema, LOCATIONS_SNAPSHOT_SCHEMA_VERSION } = require('./schemas');

const BOTVILLE_TOWN_TIMEZONE = process.env.BOTVILLE_TOWN_TIMEZONE || 'America/New_York';

function deriveGameHour(date, timezone) {
  const hourText = new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    hourCycle: 'h23',
    timeZone: timezone,
  }).format(date);
  return Number(hourText);
}

async function resolvePresence(user, activeOverridesByUserId, venuesById) {
  const timezone = user.timezone || 'UTC';
  const slot = await Schedule.getCurrentSlot(user.id, timezone);
  const activity = slot ? slot.activity : undefined;

  const override = activeOverridesByUserId.get(user.id) || null;
  const candidateVenueId = override ? override.venueId : (slot && slot.venue ? slot.venue : null);
  if (!candidateVenueId) {
    return { venueId: null, activity };
  }

  const venue = venuesById.get(candidateVenueId);
  const townHour = deriveGameHour(new Date(), BOTVILLE_TOWN_TIMEZONE);
  if (!venue || !venueRegistryService.deriveVenueOpenNow(venue, townHour)) {
    // Closed or unrecognised venue: never assert a venue the town cannot
    // vouch for — fall back to absent (spec I.4 presence states).
    return { venueId: null, activity };
  }

  return { venueId: candidateVenueId, activity };
}

async function listLocations(townId) {
  const venues = venueRegistryService.loadVenues();
  const venuesById = new Map(venues.map((venue) => [venue.id, venue]));

  const [users, activeOverrides] = await Promise.all([
    User.listAll(),
    overridesService.listActiveOverrides(),
  ]);
  const activeOverridesByUserId = new Map(activeOverrides.map((override) => [override.userId, override]));

  const locations = await Promise.all(users.map(async (user) => {
    const presence = await resolvePresence(user, activeOverridesByUserId, venuesById);
    const agentPresence = {
      id: user.id,
      displayName: user.displayName,
      spriteSeed: user.username,
      venueId: presence.venueId,
    };
    if (presence.activity !== undefined) {
      agentPresence.activity = presence.activity;
    }
    return agentPresence;
  }));

  // Schema-first: the snapshot validates against the canonical schema
  // before it crosses any boundary — nothing parses what it can validate.
  return LocationsSnapshotSchema.parse({
    schemaVersion: LOCATIONS_SNAPSHOT_SCHEMA_VERSION,
    gameHour: deriveGameHour(new Date(), BOTVILLE_TOWN_TIMEZONE),
    locations,
  });
}

module.exports = {
  BOTVILLE_TOWN_TIMEZONE,
  deriveGameHour,
  resolvePresence,
  listLocations,
};
```

- [ ] **Step 7 — run, expect pass, and check for regressions.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/presenceService.test.js` — expected: 4 tests pass.
  Then `npm test` — expected: full suite green (the only core edit is the additive `User.listAll`; `Schedule.js` is untouched by this task).

- [ ] **Step 8 — commit.**

```bash
cd /Users/home/aisocialnetwork-api
git add src/models/User.js src/services/botville/presenceService.js tests/botville/scheduleCurrentSlotDeterminism.test.js tests/botville/presenceService.test.js
git commit -m "feat(botville): total presence function; characterize merged getCurrentSlot rule (spec II.2, D-22)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Public HTTP seam — locations + venue notes

**Files:**
- Create: `src/controllers/botvilleController.js`
- Modify: `src/routes/routes.js`
- Test (create): `tests/routes/botvillePublic.route.test.js`

**Interfaces:**
- Consumes: `presenceService.listLocations(townId)`, `notesService.listNotesForVenue(venueId)`, `TOWN_ID_DEFAULT` (schemas.js).
- Produces:
  - `GET /api/public/botville/locations` → the `LocationsSnapshot` **unwrapped** (the body IS the spec I.4 contract shape — no `{success, data}` envelope, matching what BotVille's `api.ts` will parse against `@botville/shared`). This path is canonical per owner decision D-24; spec II.2 was amended 2026-07-30 to match.
  - `GET /api/public/botville/venues/:venueId/notes` → `{ success: true, venueId, notes: VenueNote[] }`
  - Controller exports: `getLocations(req, res)`, `getVenueNotes(req, res)`.

**Where the routes live (checked against the real repo):** the AgentWire public
routes actually live in a dedicated router (`src/routes/agentwirePublicRoutes.js`
mounted in `app.js` at `/api/public/agentwire`), not in `routes.js`. This plan
deliberately wires BotVille's two public GETs into `src/routes/routes.js`
instead, because `routes.js` is one of the module's two CI-pinned mount points
(Task 1 boundary rule 3) — a third router file would widen the allowlist for no
gain. It works because `app.js` mounts `'/api/public'` (line 87) before `'/api'`
(line 93): a request to `/api/public/botville/locations` misses every route in
`publicApiRoutes` and falls through to the `/api` router, where it matches
`'/public/botville/locations'`. No auth middleware is attached, exactly like the
other public routes.

### Steps

- [ ] **Step 1 — write the failing route test.** Create `tests/routes/botvillePublic.route.test.js`:

```js
'use strict';

// The BotVille HTTP seam (spec II.2): GET /api/public/botville/locations
// serves the LocationsSnapshot contract UNWRAPPED (the body is the spec I.4
// shape the client validates against @botville/shared), no auth. Services
// are mocked — supertest talks to an in-process express app only.

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');

const apiRoutes = require('../../src/routes/routes');
const presenceService = require('../../src/services/botville/presenceService');
const notesService = require('../../src/services/botville/notesService');

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api', apiRoutes);
  return app;
}

test('GET /api/public/botville/locations returns the LocationsSnapshot unwrapped, no auth required', async (t) => {
  const snapshot = {
    schemaVersion: 2,
    gameHour: 14,
    locations: [
      { id: 'user-1', displayName: 'Ada', spriteSeed: 'ada', venueId: 'cafe', activity: 'eating lunch' },
      { id: 'user-2', displayName: 'Sam', spriteSeed: 'sam', venueId: null },
    ],
  };
  t.mock.method(presenceService, 'listLocations', async () => snapshot);

  const response = await request(buildApp()).get('/api/public/botville/locations');

  assert.equal(response.status, 200);
  assert.deepEqual(response.body, snapshot);
});

test('GET /api/public/botville/locations: a service failure is a 500 with no internals leaked', async (t) => {
  t.mock.method(presenceService, 'listLocations', async () => {
    throw new Error('db exploded at 04:00 with credentials in the message');
  });
  const response = await request(buildApp()).get('/api/public/botville/locations');
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { success: false, error: 'Failed to compute locations snapshot' });
});

test('GET /api/public/botville/venues/:venueId/notes returns the venue notes', async (t) => {
  const notes = [
    { id: 'note-1', venueId: 'cafe', authorDisplayName: 'Ada', body: 'good coffee today', createdAt: '2026-07-29T12:00:00.000Z' },
  ];
  let requestedVenueId;
  t.mock.method(notesService, 'listNotesForVenue', async (venueId) => {
    requestedVenueId = venueId;
    return notes;
  });

  const response = await request(buildApp()).get('/api/public/botville/venues/cafe/notes');

  assert.equal(response.status, 200);
  assert.equal(requestedVenueId, 'cafe');
  assert.deepEqual(response.body, { success: true, venueId: 'cafe', notes });
});
```

- [ ] **Step 2 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/routes/botvillePublic.route.test.js`
  Expected failure: all 3 tests get a 404 (route not registered; express default not-found body), the `deepEqual`s fail.

- [ ] **Step 3 — implement the controller.** Create `src/controllers/botvilleController.js`:

```js
'use strict';

/**
 * BotVille public HTTP seam (world addendum spec II.2). This controller is
 * one of the module's three CI-pinned mount points (with src/app.js and
 * src/routes/routes.js — tests/botville/boundary.test.js).
 *
 * /locations serves the LocationsSnapshot UNWRAPPED: the response body is
 * the spec I.4 contract shape itself, which BotVille's client validates
 * against @botville/shared. Do not add a {success, data} envelope.
 */

const presenceService = require('../services/botville/presenceService');
const notesService = require('../services/botville/notesService');
const { TOWN_ID_DEFAULT } = require('../services/botville/schemas');

/** @route GET /api/public/botville/locations */
async function getLocations(req, res) {
  try {
    const snapshot = await presenceService.listLocations(TOWN_ID_DEFAULT);
    res.json(snapshot);
  } catch (error) {
    console.error('BotVille getLocations error:', error);
    res.status(500).json({ success: false, error: 'Failed to compute locations snapshot' });
  }
}

/** @route GET /api/public/botville/venues/:venueId/notes */
async function getVenueNotes(req, res) {
  try {
    const { venueId } = req.params;
    const notes = await notesService.listNotesForVenue(venueId);
    res.json({ success: true, venueId, notes });
  } catch (error) {
    console.error('BotVille getVenueNotes error:', error);
    res.status(500).json({ success: false, error: 'Failed to list venue notes' });
  }
}

module.exports = { getLocations, getVenueNotes };
```

- [ ] **Step 4 — wire the routes.** In `src/routes/routes.js`: with the other controller requires at the top of the file, add:

```js
const botvilleController = require('../controllers/botvilleController');
```

  and at the end of the route registrations (before `module.exports = router;`), add:

```js
// ============================================================================
// BotVille Public Routes (world addendum spec II.2)
// ============================================================================
// Reached as /api/public/botville/* : app.js mounts '/api/public' before
// '/api', and these paths match no route in publicApiRoutes, so requests
// fall through to this router. No auth — public read-only world state.

/** @route GET /api/public/botville/locations - LocationsSnapshot (spec I.4) - Public */
router.get('/public/botville/locations', botvilleController.getLocations);

/** @route GET /api/public/botville/venues/:venueId/notes - Recent notes at a venue - Public */
router.get('/public/botville/venues/:venueId/notes', botvilleController.getVenueNotes);
```

- [ ] **Step 5 — run, expect pass.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/routes/botvillePublic.route.test.js` — expected: 3 tests pass.
  Then `node --test tests/botville/boundary.test.js` — expected: still green (`botvilleController.js` and `routes.js` are allowlisted mount points).

- [ ] **Step 6 — commit.**

```bash
cd /Users/home/aisocialnetwork-api
git add src/controllers/botvilleController.js src/routes/routes.js tests/routes/botvillePublic.route.test.js
git commit -m "feat(botville): public locations + venue-notes endpoints (spec II.2 HTTP seam)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: The BotVille MCP server — read tools

**Files:**
- Create: `src/mcp/botville-mcp-server.js` (with the three read tools; Task 8 appends the three action tools to this same file)
- Test (create): `tests/botville/botvilleMcpReadTools.test.js`

**Interfaces:**
- Consumes: `@modelcontextprotocol/sdk` `McpServer`, `User.findByApiKey`/`User.touchLastSeen`/`User.listAll` (Task 5), Task 1 schemas, Task 3 `venueRegistryService`, Task 4 `goalsService`/`notesService`/`effortService`, Task 5 `presenceService`, and — per D-21 — the schedule writer's own assignment derivations `deriveHomeVenue`/`deriveWorkplaceVenue`/`deriveResidenceVenues` from `src/utils/scheduleCoverage.js` (the single assignment authority; botville → core is the allowed direction).
- Produces: `createBotVilleMCPServer(): McpServer` (name `'botville'`, version `'1.0.0'`) registering `get-city-map`, `get-venue`, `get-city-goals`. Each handler returns `{ content: [{ type: 'text', text: JSON.stringify(output, null, 2) }], structuredContent: output }` in both success and error branches, like the model tool (`get-current-schedule`, `src/mcp/mcp-server.js:1600`).

The file copies `src/mcp/agentwire-mcp-server.js`'s shape exactly: its own
`authenticatedServiceCall` copy reading `server._getSession(server._currentSessionId)`
→ `User.findByApiKey(session.authToken)` → background `User.touchLastSeen`,
and a `createBotVilleMCPServer` factory with `server._getSession = null; server._currentSessionId = null;`
placeholders that `registerMcpRoute` populates per request.

### Steps

- [ ] **Step 1 — write the failing test.** Create `tests/botville/botvilleMcpReadTools.test.js` (same harness as `tests/mcp/mcpGetConcerns.test.js`: drive the REAL registered tool callbacks through `server._registeredTools[name].callback`):

```js
'use strict';

// BotVille MCP read tools (spec II.3): get-city-map, get-venue,
// get-city-goals. Same test seam as tests/mcp/mcpGetConcerns.test.js —
// the real registered callbacks, auth and services mocked.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createBotVilleMCPServer } = require('../../src/mcp/botville-mcp-server');
const User = require('../../src/models/User');
const goalsService = require('../../src/services/botville/goalsService');
const notesService = require('../../src/services/botville/notesService');
const effortService = require('../../src/services/botville/effortService');
const presenceService = require('../../src/services/botville/presenceService');
const venueRegistryService = require('../../src/services/botville/venueRegistryService');
const { deriveHomeVenue, deriveWorkplaceVenue, deriveResidenceVenues } = require('../../src/utils/scheduleCoverage');

const USER = { id: 'user-1', username: 'ada', displayName: 'Ada', timezone: 'America/New_York', apiKey: 'token-1' };

// D-21: no shipped venue id appears as a literal — probe venues are DERIVED
// from the live registry so tests survive any vocabulary change unchanged.
const ALL_HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const alwaysOpenVenue = venueRegistryService.loadVenues()
  .find((venue) => ALL_HOURS.every((hour) => venueRegistryService.deriveVenueOpenNow(venue, hour)));
assert.ok(alwaysOpenVenue, 'registry must contain at least one always-open venue for clock-independent tests');

const GOAL = {
  id: 'goal-1', townId: 'town-1', kind: 'harvest', title: 'Stock the winter granary',
  targetAmount: 500, progressAmount: 120, callerContributionAmount: 30,
  createdAt: '2026-07-01T00:00:00.000Z',
};

function buildAuthenticatedServer(t) {
  const server = createBotVilleMCPServer();
  server._getSession = () => ({ authToken: USER.apiKey });
  server._currentSessionId = 'session-1';
  t.mock.method(User, 'findByApiKey', async (apiKey) => (apiKey === USER.apiKey ? USER : null));
  t.mock.method(User, 'touchLastSeen', async () => {});
  return server;
}

test('the three read tools are registered on a server named botville', () => {
  const server = createBotVilleMCPServer();
  for (const toolName of ['get-city-map', 'get-venue', 'get-city-goals']) {
    assert.ok(server._registeredTools[toolName], `${toolName} must be registered`);
  }
});

test('get-city-map: venues with openNow, writer-derived caller home/workplace, active goal ids', async (t) => {
  const server = buildAuthenticatedServer(t);
  t.mock.method(goalsService, 'listGoals', async (townId, callerUserId) => {
    assert.equal(townId, 'town-1');
    assert.equal(callerUserId, USER.id);
    return [GOAL];
  });
  // Roster for the home derivation (creation order, same as the writer's).
  t.mock.method(User, 'listAll', async () => [USER]);

  const result = await server._registeredTools['get-city-map'].callback({});
  const payload = JSON.parse(result.content[0].text);

  assert.equal(payload.success, true);
  assert.equal(payload.townId, 'town-1');
  assert.ok(Number.isInteger(payload.gameHour));

  // D-21: every expectation below is DERIVED from the live registry — no id
  // or count literal, so a vocabulary change never touches this test.
  const venues = venueRegistryService.loadVenues();
  assert.deepEqual(
    payload.venues.map((venue) => venue.id).sort(),
    venues.map((venue) => venue.id).sort(),
    'the map serves exactly the shipped vocabulary'
  );
  for (const wireVenue of payload.venues) {
    const descriptor = venues.find((venue) => venue.id === wireVenue.id);
    assert.equal(
      wireVenue.openNow,
      venueRegistryService.deriveVenueOpenNow(descriptor, payload.gameHour),
      `openNow for "${wireVenue.id}" must derive from its own hours at gameHour`
    );
  }

  // D-21/I.2: assignments come from the schedule writer's own derivations —
  // the map can never disagree with a stored routine.
  const roster = [USER.username];
  assert.equal(payload.callerHomeVenueId, deriveHomeVenue(USER.username, roster, deriveResidenceVenues(venues)));
  assert.equal(payload.callerWorkplaceVenueId, deriveWorkplaceVenue(USER.username, venues));

  assert.deepEqual(payload.activeGoalIds, ['goal-1']);
  assert.deepEqual(result.structuredContent, payload);
});

test('get-venue: computed co-presence at the venue plus recent notes', async (t) => {
  // Probe venue derived from the registry (D-21) and always open, so the
  // openNow assertion is clock-independent.
  const probeVenueId = alwaysOpenVenue.id;
  const server = buildAuthenticatedServer(t);
  t.mock.method(presenceService, 'listLocations', async () => ({
    schemaVersion: 2,
    gameHour: 12,
    locations: [
      { id: 'user-1', displayName: 'Ada', spriteSeed: 'ada', venueId: probeVenueId, activity: 'socializing' },
      { id: 'user-2', displayName: 'Sam', spriteSeed: 'sam', venueId: probeVenueId },
      { id: 'user-3', displayName: 'Kit', spriteSeed: 'kit', venueId: null },
    ],
  }));
  const notes = [
    { id: 'note-1', venueId: probeVenueId, authorDisplayName: 'Sam', body: 'town meeting at dusk', createdAt: '2026-07-29T09:00:00.000Z' },
  ];
  t.mock.method(notesService, 'listNotesForVenue', async () => notes);

  const result = await server._registeredTools['get-venue'].callback({ venueId: probeVenueId });
  const payload = JSON.parse(result.content[0].text);

  assert.equal(payload.success, true);
  assert.equal(payload.venue.id, probeVenueId);
  assert.equal(payload.venue.openNow, true, 'derived probe venue is open at every hour');
  assert.deepEqual(payload.agentsPresent, [
    { id: 'user-1', displayName: 'Ada', activity: 'socializing' },
    { id: 'user-2', displayName: 'Sam' },
  ]);
  assert.deepEqual(payload.notes, notes);
});

test('get-venue: unknown venue is a clean structured failure', async (t) => {
  const server = buildAuthenticatedServer(t);
  const result = await server._registeredTools['get-venue'].callback({ venueId: 'atlantis' });
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.success, false);
  assert.match(payload.error, /Unknown venue: atlantis/);
});

test('get-city-goals: goals with progress + caller contribution + effort remaining', async (t) => {
  const server = buildAuthenticatedServer(t);
  t.mock.method(goalsService, 'listGoals', async () => [GOAL]);
  t.mock.method(effortService, 'deriveEffortRemaining', async (userId, timezone) => {
    assert.equal(userId, USER.id);
    assert.equal(timezone, USER.timezone);
    return 2;
  });

  const result = await server._registeredTools['get-city-goals'].callback({});
  const payload = JSON.parse(result.content[0].text);

  assert.equal(payload.success, true);
  assert.deepEqual(payload.goals, [GOAL]);
  assert.equal(payload.effortRemainingPoints, 2);
});

test('read tools: a service failure surfaces as success:false with the error message (model-tool posture)', async (t) => {
  const server = buildAuthenticatedServer(t);
  t.mock.method(goalsService, 'listGoals', async () => {
    throw new Error('db unavailable');
  });
  const result = await server._registeredTools['get-city-goals'].callback({});
  const payload = JSON.parse(result.content[0].text);
  assert.equal(payload.success, false);
  assert.equal(payload.error, 'db unavailable');
});
```

- [ ] **Step 2 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/botvilleMcpReadTools.test.js`
  Expected failure: `Cannot find module '../../src/mcp/botville-mcp-server'`.

- [ ] **Step 3 — implement.** Create `src/mcp/botville-mcp-server.js`:

```js
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const log = require('../utils/logger')('BotVille MCP Server');

// Module services (spec II.1: everything world lives in services/botville)
const venueRegistryService = require('../services/botville/venueRegistryService');
const presenceService = require('../services/botville/presenceService');
const goalsService = require('../services/botville/goalsService');
const notesService = require('../services/botville/notesService');
const effortService = require('../services/botville/effortService');
const overridesService = require('../services/botville/overridesService');

// D-21: the schedule writer's own assignment derivations are the single
// authority on home/workplace — get-city-map must never disagree with a
// stored routine. botville → core is the allowed dependency direction.
const { deriveHomeVenue, deriveWorkplaceVenue, deriveResidenceVenues } = require('../utils/scheduleCoverage');

const {
  TOWN_ID_DEFAULT,
  GetCityMapInputSchema,
  GetCityMapOutputSchema,
  GetVenueInputSchema,
  GetVenueOutputSchema,
  GetCityGoalsInputSchema,
  GetCityGoalsOutputSchema,
  GoToVenueInputSchema,
  GoToVenueOutputSchema,
  ContributeToCityGoalInputSchema,
  ContributeToCityGoalOutputSchema,
  LeaveNoteInputSchema,
  LeaveNoteOutputSchema,
} = require('../services/botville/schemas');

// Import User model for API key authentication
const User = require('../models/User');

// The friendly in-fiction refusal for an exhausted effort budget (spec II.4).
const EFFORT_EXHAUSTED_OUTPUT = Object.freeze({
  success: false,
  reason: 'exhausted',
  message: 'You are out of energy for today — rest and come back tomorrow.',
});

/**
 * Helper function to authenticate and execute a service call using session context
 */
async function authenticatedServiceCall(server, serviceFunction) {
  const session = server._getSession(server._currentSessionId);
  if (!session || !session.authToken) {
    throw new Error('Session not authenticated');
  }

  const user = await User.findByApiKey(session.authToken);
  if (!user) {
    throw new Error('Invalid API key');
  }

  // Update last_seen in the background
  User.touchLastSeen(user.id).catch((err) => {
    log.warn('Failed to update last_seen:', err.message);
  });

  return await serviceFunction(user);
}

/**
 * Wrap a tool output in the model-tool response shape
 * (get-current-schedule in mcp-server.js): JSON text + structuredContent,
 * identical in success and error branches.
 */
function toToolResult(output) {
  return {
    content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
    structuredContent: output,
  };
}

/**
 * Create and configure the BotVille MCP server
 */
function createBotVilleMCPServer() {
  const server = new McpServer({
    name: 'botville',
    version: '1.0.0',
  });

  // Session management properties (set by registerMcpRoute per request)
  server._getSession = null;
  server._currentSessionId = null;

  // ============================================================================
  // Read Tools (spec II.3)
  // ============================================================================

  server.registerTool(
    'get-city-map',
    {
      title: 'Get City Map',
      description: 'The town at a glance: every venue with its affordances, opening hours and open-now state, your own home and workplace, and the ids of the active city goals.',
      inputSchema: GetCityMapInputSchema,
      outputSchema: GetCityMapOutputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const output = await authenticatedServiceCall(server, async (user) => {
          const venues = venueRegistryService.loadVenues();
          const gameHour = presenceService.deriveGameHour(new Date(), presenceService.BOTVILLE_TOWN_TIMEZONE);
          const goals = await goalsService.listGoals(TOWN_ID_DEFAULT, user.id);
          // D-21/I.2: same derivations, same roster order (created_at) as the
          // schedule writer — the map always agrees with stored routines.
          const roster = (await User.listAll()).map((rosterUser) => rosterUser.username);
          return {
            success: true,
            townId: TOWN_ID_DEFAULT,
            gameHour,
            venues: venues.map((venue) => ({
              ...venue,
              openNow: venueRegistryService.deriveVenueOpenNow(venue, gameHour),
            })),
            callerHomeVenueId: deriveHomeVenue(user.username, roster, deriveResidenceVenues(venues)),
            callerWorkplaceVenueId: deriveWorkplaceVenue(user.username, venues),
            activeGoalIds: goals.map((goal) => goal.id),
          };
        });
        return toToolResult(output);
      } catch (error) {
        log.error('Tool "get-city-map" error:', error.message);
        return toToolResult({ success: false, error: error.message });
      }
    }
  );

  server.registerTool(
    'get-venue',
    {
      title: 'Get Venue',
      description: 'One venue in detail: who is there right now (computed co-presence), the most recent notes left there, and whether it is open.',
      inputSchema: GetVenueInputSchema,
      outputSchema: GetVenueOutputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async ({ venueId }) => {
      try {
        const output = await authenticatedServiceCall(server, async () => {
          const venue = venueRegistryService.getVenue(venueId);
          if (!venue) {
            return { success: false, error: `Unknown venue: ${venueId}` };
          }
          const gameHour = presenceService.deriveGameHour(new Date(), presenceService.BOTVILLE_TOWN_TIMEZONE);
          const snapshot = await presenceService.listLocations(TOWN_ID_DEFAULT);
          const agentsPresent = snapshot.locations
            .filter((presence) => presence.venueId === venueId)
            .map((presence) => {
              const agent = { id: presence.id, displayName: presence.displayName };
              if (presence.activity !== undefined) {
                agent.activity = presence.activity;
              }
              return agent;
            });
          const notes = await notesService.listNotesForVenue(venueId);
          return {
            success: true,
            venue: { ...venue, openNow: venueRegistryService.deriveVenueOpenNow(venue, gameHour) },
            agentsPresent,
            notes,
          };
        });
        return toToolResult(output);
      } catch (error) {
        log.error('Tool "get-venue" error:', error.message);
        return toToolResult({ success: false, error: error.message });
      }
    }
  );

  server.registerTool(
    'get-city-goals',
    {
      title: 'Get City Goals',
      description: 'The active city goals: progress toward each target, your own contributions so far, and how much effort you have left today.',
      inputSchema: GetCityGoalsInputSchema,
      outputSchema: GetCityGoalsOutputSchema,
      annotations: {
        readOnlyHint: true,
      },
    },
    async () => {
      try {
        const output = await authenticatedServiceCall(server, async (user) => {
          const goals = await goalsService.listGoals(TOWN_ID_DEFAULT, user.id);
          const effortRemainingPoints = await effortService.deriveEffortRemaining(user.id, user.timezone || 'UTC');
          return { success: true, goals, effortRemainingPoints };
        });
        return toToolResult(output);
      } catch (error) {
        log.error('Tool "get-city-goals" error:', error.message);
        return toToolResult({ success: false, error: error.message });
      }
    }
  );

  return server;
}

module.exports = { createBotVilleMCPServer };
```

  (The requires for `overridesService`, `GoToVenueInputSchema`,
  `GoToVenueOutputSchema`, `ContributeToCityGoalInputSchema`,
  `ContributeToCityGoalOutputSchema`, `LeaveNoteInputSchema`,
  `LeaveNoteOutputSchema` and `EFFORT_EXHAUSTED_OUTPUT` are consumed by the
  Task 8 action tools registered in this same file.)

- [ ] **Step 4 — run, expect pass.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/botvilleMcpReadTools.test.js` — expected: 6 tests pass.
  Also `node --test tests/botville/boundary.test.js` — still green (`botville-mcp-server.js` is allowlisted).

- [ ] **Step 5 — commit.**

```bash
cd /Users/home/aisocialnetwork-api
git add src/mcp/botville-mcp-server.js tests/botville/botvilleMcpReadTools.test.js
git commit -m "feat(botville): MCP server with get-city-map, get-venue, get-city-goals (spec II.3)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: Action tools — `go-to-venue`, `contribute-to-city-goal`, `leave-note`

**Files:**
- Modify: `src/mcp/botville-mcp-server.js` (register the three action tools before `return server;`)
- Test (create): `tests/botville/botvilleMcpActionTools.test.js`

**Interfaces:**
- Consumes: Task 4 `overridesService.createOverrideForCurrentSlot`, `goalsService.contribute`, `notesService.createNote`, `effortService.deriveEffortRemaining` + `EFFORT_COST_PER_ACTION_POINTS`; Task 3 `getVenue`/`deriveVenueOpenNow`; Task 5 `deriveGameHour`/`BOTVILLE_TOWN_TIMEZONE`; Task 1 tool schemas; Task 7's `EFFORT_EXHAUSTED_OUTPUT`, `toToolResult`, `authenticatedServiceCall`.
- Produces: the tools `go-to-venue`, `contribute-to-city-goal`, `leave-note` registered on `createBotVilleMCPServer()`.

Constraints honoured by construction (spec II.3): no tool writes a location —
`go-to-venue` writes only an override the presence function consumes; goals are
additive accumulators; `leave-note` is content-guarded twice (wire-level
`LeaveNoteInputSchema` body 1..280 + service-level `NoteBodySchema` in
`notesService.createNote`, because the direct-callback seam bypasses SDK input
validation) and rate-limited like every MCP call by `registerMcpRoute`'s
per-principal limiter (`src/middleware/mcpRateLimit.js`, 120/min default). The
two world-changing tools are effort-gated: `deriveEffortRemaining <= 0` returns
`EFFORT_EXHAUSTED_OUTPUT` — the friendly in-fiction refusal — without touching
any service.

### Steps

- [ ] **Step 1 — write the failing test.** Create `tests/botville/botvilleMcpActionTools.test.js`:

```js
'use strict';

// BotVille MCP action tools (spec II.3): go-to-venue,
// contribute-to-city-goal, leave-note. The latter two are effort-gated
// (spec II.4): exhaustion is a friendly in-fiction refusal, and the gated
// service is never called.

const test = require('node:test');
const assert = require('node:assert/strict');

const { createBotVilleMCPServer } = require('../../src/mcp/botville-mcp-server');
const User = require('../../src/models/User');
const overridesService = require('../../src/services/botville/overridesService');
const goalsService = require('../../src/services/botville/goalsService');
const notesService = require('../../src/services/botville/notesService');
const effortService = require('../../src/services/botville/effortService');
const venueRegistryService = require('../../src/services/botville/venueRegistryService');

const USER = { id: 'user-1', username: 'ada', displayName: 'Ada', timezone: 'America/New_York', apiKey: 'token-1' };

const EXHAUSTED_OUTPUT = {
  success: false,
  reason: 'exhausted',
  message: 'You are out of energy for today — rest and come back tomorrow.',
};

// D-21: no shipped venue id as a literal — derive an always-open probe venue
// from the live registry so open-venue assertions are clock-independent.
const ALL_HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const alwaysOpenVenue = venueRegistryService.loadVenues()
  .find((venue) => ALL_HOURS.every((hour) => venueRegistryService.deriveVenueOpenNow(venue, hour)));
assert.ok(alwaysOpenVenue, 'registry must contain at least one always-open venue for clock-independent tests');
const OPEN_VENUE_ID = alwaysOpenVenue.id;

function buildAuthenticatedServer(t) {
  const server = createBotVilleMCPServer();
  server._getSession = () => ({ authToken: USER.apiKey });
  server._currentSessionId = 'session-1';
  t.mock.method(User, 'findByApiKey', async (apiKey) => (apiKey === USER.apiKey ? USER : null));
  t.mock.method(User, 'touchLastSeen', async () => {});
  return server;
}

test('all six BotVille tools are registered (spec II.3: the tool surface is fixed)', () => {
  const server = createBotVilleMCPServer();
  assert.deepEqual(
    Object.keys(server._registeredTools).sort(),
    ['contribute-to-city-goal', 'get-city-goals', 'get-city-map', 'get-venue', 'go-to-venue', 'leave-note']
  );
});

test('go-to-venue: creates the current-slot override for an open venue', async (t) => {
  const server = buildAuthenticatedServer(t);
  let calledWith;
  t.mock.method(overridesService, 'createOverrideForCurrentSlot', async (user, venueId) => {
    calledWith = { userId: user.id, venueId };
    return { id: 'override-1', venueId, slotKey: 'weekday:9-12', expiresAt: '2026-07-29T16:00:00.000Z' };
  });

  // The derived probe venue is open at every hour (D-21) — clock-independent.
  const result = await server._registeredTools['go-to-venue'].callback({ venueId: OPEN_VENUE_ID });
  const payload = JSON.parse(result.content[0].text);

  assert.equal(payload.success, true);
  assert.deepEqual(calledWith, { userId: 'user-1', venueId: OPEN_VENUE_ID });
  assert.equal(payload.venueId, OPEN_VENUE_ID);
  assert.equal(payload.expiresAt, '2026-07-29T16:00:00.000Z');
  assert.ok(payload.message.includes(OPEN_VENUE_ID));
});

test('go-to-venue: unknown venue fails cleanly; closed venue is an in-fiction refusal', async (t) => {
  const server = buildAuthenticatedServer(t);
  const overrideMock = t.mock.method(overridesService, 'createOverrideForCurrentSlot', async () => {
    throw new Error('must not create an override for an invalid destination');
  });

  const unknown = JSON.parse((await server._registeredTools['go-to-venue'].callback({ venueId: 'atlantis' })).content[0].text);
  assert.equal(unknown.success, false);
  assert.match(unknown.error, /Unknown venue: atlantis/);

  t.mock.method(venueRegistryService, 'getVenue', () => ({
    id: 'midnight-club', archetype: 'club', roles: ['hangout'], affords: ['dance'], hours: [],
  }));
  const closed = JSON.parse((await server._registeredTools['go-to-venue'].callback({ venueId: 'midnight-club' })).content[0].text);
  assert.equal(closed.success, false);
  assert.equal(closed.reason, 'closed');
  assert.ok(closed.message.includes('midnight-club'));

  assert.equal(overrideMock.mock.callCount(), 0);
});

test('go-to-venue: no current slot surfaces the overridesService rejection', async (t) => {
  const server = buildAuthenticatedServer(t);
  t.mock.method(overridesService, 'createOverrideForCurrentSlot', async () => {
    throw new Error('No current schedule slot - there is nothing to override right now');
  });
  const payload = JSON.parse((await server._registeredTools['go-to-venue'].callback({ venueId: OPEN_VENUE_ID })).content[0].text);
  assert.equal(payload.success, false);
  assert.match(payload.error, /No current schedule slot/);
});

test('contribute-to-city-goal: exhausted effort returns the in-fiction refusal and never contributes', async (t) => {
  const server = buildAuthenticatedServer(t);
  t.mock.method(effortService, 'deriveEffortRemaining', async () => 0);
  const contributeMock = t.mock.method(goalsService, 'contribute', async () => {
    throw new Error('must not contribute when exhausted');
  });

  const result = await server._registeredTools['contribute-to-city-goal'].callback({ goalId: 'goal-1', amount: 10 });
  const payload = JSON.parse(result.content[0].text);

  assert.deepEqual(payload, EXHAUSTED_OUTPUT);
  assert.deepEqual(result.structuredContent, EXHAUSTED_OUTPUT);
  assert.equal(contributeMock.mock.callCount(), 0);
});

test('contribute-to-city-goal: with effort remaining, contributes and reports the decremented budget', async (t) => {
  const server = buildAuthenticatedServer(t);
  t.mock.method(effortService, 'deriveEffortRemaining', async () => 3);
  t.mock.method(goalsService, 'contribute', async (user, goalId, amount) => ({
    id: goalId, townId: 'town-1', kind: 'harvest', title: 'Stock the winter granary',
    targetAmount: 500, progressAmount: 130, callerContributionAmount: 40,
    createdAt: '2026-07-01T00:00:00.000Z',
  }));

  const result = await server._registeredTools['contribute-to-city-goal'].callback({ goalId: 'goal-1', amount: 10 });
  const payload = JSON.parse(result.content[0].text);

  assert.equal(payload.success, true);
  assert.equal(payload.goalId, 'goal-1');
  assert.equal(payload.amount, 10);
  assert.equal(payload.progressAmount, 130);
  assert.equal(payload.targetAmount, 500);
  assert.equal(payload.effortRemainingPoints, 2);
});

test('leave-note: exhausted effort returns the in-fiction refusal and never writes', async (t) => {
  const server = buildAuthenticatedServer(t);
  t.mock.method(effortService, 'deriveEffortRemaining', async () => 0);
  const createNoteMock = t.mock.method(notesService, 'createNote', async () => {
    throw new Error('must not write a note when exhausted');
  });

  const payload = JSON.parse((await server._registeredTools['leave-note'].callback({ venueId: OPEN_VENUE_ID, body: 'hello' })).content[0].text);
  assert.deepEqual(payload, EXHAUSTED_OUTPUT);
  assert.equal(createNoteMock.mock.callCount(), 0);
});

test('leave-note: with effort remaining, creates the note; an oversized body is rejected by the service guard', async (t) => {
  const server = buildAuthenticatedServer(t);
  t.mock.method(effortService, 'deriveEffortRemaining', async () => 1);
  const note = {
    id: 'note-1', venueId: OPEN_VENUE_ID, authorDisplayName: 'Ada',
    body: 'town meeting at dusk', createdAt: '2026-07-29T09:00:00.000Z',
  };
  t.mock.method(notesService, 'createNote', async (user, venueId, body) => {
    if (body.length > 280) throw new Error('Note body must be 1-280 characters');
    return note;
  });

  const ok = JSON.parse((await server._registeredTools['leave-note'].callback({ venueId: OPEN_VENUE_ID, body: 'town meeting at dusk' })).content[0].text);
  assert.equal(ok.success, true);
  assert.deepEqual(ok.note, note);
  assert.equal(ok.effortRemainingPoints, 0);

  // The direct-callback seam bypasses SDK input validation, so the
  // service-level 280 guard must hold on its own.
  const oversized = JSON.parse((await server._registeredTools['leave-note'].callback({ venueId: OPEN_VENUE_ID, body: 'a'.repeat(281) })).content[0].text);
  assert.equal(oversized.success, false);
  assert.match(oversized.error, /1-280/);
});
```

- [ ] **Step 2 — run it, expect failure.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/botvilleMcpActionTools.test.js`
  Expected failure: the first test fails — `Object.keys(server._registeredTools).sort()` is only the three read tools.

- [ ] **Step 3 — implement.** In `src/mcp/botville-mcp-server.js`, insert the following three registrations after the `get-city-goals` block and before `return server;`:

```js
  // ============================================================================
  // Action Tools (spec II.3) — effort-gated where they change the world.
  // No tool writes a location: go-to-venue writes an override the presence
  // function consumes; goals are additive accumulators only.
  // ============================================================================

  server.registerTool(
    'go-to-venue',
    {
      title: 'Go To Venue',
      description: 'Head to a venue for the rest of your current schedule slot. This never rewrites your routine — the detour lapses when the slot ends. The venue must exist and be open.',
      inputSchema: GoToVenueInputSchema,
      outputSchema: GoToVenueOutputSchema,
    },
    async ({ venueId }) => {
      try {
        const output = await authenticatedServiceCall(server, async (user) => {
          const venue = venueRegistryService.getVenue(venueId);
          if (!venue) {
            return { success: false, error: `Unknown venue: ${venueId}` };
          }
          const gameHour = presenceService.deriveGameHour(new Date(), presenceService.BOTVILLE_TOWN_TIMEZONE);
          if (!venueRegistryService.deriveVenueOpenNow(venue, gameHour)) {
            return {
              success: false,
              reason: 'closed',
              message: `${venue.id} is closed right now — come back during its opening hours.`,
            };
          }
          const override = await overridesService.createOverrideForCurrentSlot(user, venueId);
          return {
            success: true,
            venueId: override.venueId,
            expiresAt: override.expiresAt,
            message: `You are heading to ${venue.id} for the rest of your current slot.`,
          };
        });
        return toToolResult(output);
      } catch (error) {
        log.error('Tool "go-to-venue" error:', error.message);
        return toToolResult({ success: false, error: error.message });
      }
    }
  );

  server.registerTool(
    'contribute-to-city-goal',
    {
      title: 'Contribute To City Goal',
      description: 'Put some of your effort toward one of the town\'s active goals. Contributions are additive and permanent. Costs one effort point from your daily budget.',
      inputSchema: ContributeToCityGoalInputSchema,
      outputSchema: ContributeToCityGoalOutputSchema,
    },
    async ({ goalId, amount }) => {
      try {
        const output = await authenticatedServiceCall(server, async (user) => {
          const effortRemainingPoints = await effortService.deriveEffortRemaining(user.id, user.timezone || 'UTC');
          if (effortRemainingPoints <= 0) {
            return { ...EFFORT_EXHAUSTED_OUTPUT };
          }
          const goal = await goalsService.contribute(user, goalId, amount);
          return {
            success: true,
            goalId: goal.id,
            amount,
            progressAmount: goal.progressAmount,
            targetAmount: goal.targetAmount,
            effortRemainingPoints: effortRemainingPoints - effortService.EFFORT_COST_PER_ACTION_POINTS,
            message: `You contributed ${amount} to "${goal.title}".`,
          };
        });
        return toToolResult(output);
      } catch (error) {
        log.error('Tool "contribute-to-city-goal" error:', error.message);
        return toToolResult({ success: false, error: error.message });
      }
    }
  );

  server.registerTool(
    'leave-note',
    {
      title: 'Leave Note',
      description: 'Pin a short note (1-280 characters) at a venue. Notes are rendered in the city and readable by other agents via get-venue. Costs one effort point from your daily budget.',
      inputSchema: LeaveNoteInputSchema,
      outputSchema: LeaveNoteOutputSchema,
    },
    async ({ venueId, body }) => {
      try {
        const output = await authenticatedServiceCall(server, async (user) => {
          const effortRemainingPoints = await effortService.deriveEffortRemaining(user.id, user.timezone || 'UTC');
          if (effortRemainingPoints <= 0) {
            return { ...EFFORT_EXHAUSTED_OUTPUT };
          }
          const note = await notesService.createNote(user, venueId, body);
          return {
            success: true,
            note,
            effortRemainingPoints: effortRemainingPoints - effortService.EFFORT_COST_PER_ACTION_POINTS,
            message: `You left a note at ${note.venueId}.`,
          };
        });
        return toToolResult(output);
      } catch (error) {
        log.error('Tool "leave-note" error:', error.message);
        return toToolResult({ success: false, error: error.message });
      }
    }
  );
```

- [ ] **Step 4 — run, expect pass.**
  `cd /Users/home/aisocialnetwork-api && node --test tests/botville/botvilleMcpActionTools.test.js` — expected: 8 tests pass.
  Then `node --test tests/botville/` — the whole module directory green.

- [ ] **Step 5 — commit.**

```bash
cd /Users/home/aisocialnetwork-api
git add src/mcp/botville-mcp-server.js tests/botville/botvilleMcpActionTools.test.js
git commit -m "feat(botville): action tools go-to-venue, contribute-to-city-goal, leave-note with effort gate (spec II.3/II.4)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 9: Mount + advertise + end-to-end verification

**Files:**
- Modify: `src/app.js`
- Test: the full existing suite (no new test file; the mount is verified end-to-end below)

**Interfaces:**
- Consumes: `createBotVilleMCPServer` (Task 7/8), `registerMcpRoute` (`src/mcp/mcpHttpRoute.js`).
- Produces: `POST /botville/mcp` (stateless MCP-over-HTTP, Bearer-auth, per-principal rate limit — all inherited from `registerMcpRoute`), advertised in `/health` and the startup banner.

### Steps

- [ ] **Step 1 — require the factory.** In `src/app.js`, the import block at lines 27-30 currently reads:

```js
// Import MCP server
const { createMCPServer } = require('./mcp/mcp-server');
const { createAgentWireMCPServer } = require('./mcp/agentwire-mcp-server');
const { registerMcpRoute } = require('./mcp/mcpHttpRoute');
```

  Change it to:

```js
// Import MCP server
const { createMCPServer } = require('./mcp/mcp-server');
const { createAgentWireMCPServer } = require('./mcp/agentwire-mcp-server');
const { createBotVilleMCPServer } = require('./mcp/botville-mcp-server');
const { registerMcpRoute } = require('./mcp/mcpHttpRoute');
```

- [ ] **Step 2 — register the route.** Immediately after the existing AgentWire `registerMcpRoute` call (lines 127-132), add:

```js
registerMcpRoute(app, {
  path: '/botville/mcp',
  createServer: createBotVilleMCPServer,
  logLabel: 'BotVille MCP Server',
  missingAuthMessage: 'Authentication required. Please provide a Bearer token in the Authorization header.'
});
```

  (`missingAuthMessage` is byte-identical to the `/mcp` and `/agentwire/mcp` registrations.)

- [ ] **Step 3 — advertise.** In the `/health` handler, the `endpoints` object currently ends with `agentwireMcp: '/agentwire/mcp'`; change it to:

```js
    endpoints: {
      rest: '/api',
      mcp: '/mcp',
      agentwire: '/api/agentwire',
      agentwirePublic: '/api/public/agentwire',
      agentwireMcp: '/agentwire/mcp',
      botvilleMcp: '/botville/mcp'
    },
```

  And in the startup banner, after the `AW MCP:` line, add:

```js
║     BV MCP:       http://localhost:${PORT}/botville/mcp  ║
```

- [ ] **Step 4 — run the full suite.**
  `cd /Users/home/aisocialnetwork-api && npm test`
  Expected: every test passes, including `tests/botville/boundary.test.js` (app.js is an allowlisted mount point) and the pre-existing `tests/mcp/*` suites.

- [ ] **Step 5 — live smoke (requires a dev DB with migrations 037 AND 038 run).**

```bash
cd /Users/home/aisocialnetwork-api
npm run migrate            # expect: "Executing migration: 038_add_botville_world.js ... ✓"
npm start                  # leave running in this terminal
```

  In a second terminal:

```bash
# 1. Advertisement
curl -s http://localhost:9321/health | grep botvilleMcp
# expect: "botvilleMcp":"/botville/mcp"

# 2. The public seam (no auth)
curl -s http://localhost:9321/api/public/botville/locations
# expect: {"schemaVersion":2,"gameHour":<0-23>,"locations":[...]}

# 3. MCP auth posture: no token → 401 with the JSON-RPC error body
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:9321/botville/mcp \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# expect: 401

# 4. tools/list with a real key (any users.api_key value from the dev DB)
curl -s -X POST http://localhost:9321/botville/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'Authorization: Bearer <users.api_key value>' \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# expect: six tools — get-city-map, get-venue, get-city-goals,
#         go-to-venue, contribute-to-city-goal, leave-note
```

- [ ] **Step 6 — MCP Inspector smoke.**

```bash
npx @modelcontextprotocol/inspector --url http://localhost:9321/botville/mcp
```

  In the Inspector UI: transport "Streamable HTTP", URL as above, and set an
  `Authorization: Bearer <users.api_key value>` header. Verify: connect
  succeeds; List Tools shows all six; call `get-city-map` and confirm
  `structuredContent.venues` mirrors `config/venues.json` (every shipped
  venue, 8 fields each — do not pin a count); call `go-to-venue` with
  `{"venueId":"district"}` and confirm `success: true` with an
  `expiresAt`; call it with `{"venueId":"atlantis"}` and confirm the clean
  `Unknown venue` failure.

- [ ] **Step 7 — commit.**

```bash
cd /Users/home/aisocialnetwork-api
git add src/app.js
git commit -m "feat(botville): mount /botville/mcp and advertise it (spec II.1 mount points)" -m "Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Coverage map (spec Part II → tasks)

| Spec item | Where |
|---|---|
| II.1 module isolation + five boundary rules | Task 1 (CI tests), honored throughout |
| II.2 locations endpoint, total presence function, `getCurrentSlot` determinism | Tasks 5, 6 — the ORDER BY fix merged with the visual-assets set; Task 5 characterizes it (earliest-start-wins, D-22); `CHECK (start < end_hour)` recorded as schedule-track territory in Task 5 |
| II.3 six tools, auth pattern, refusal/constraints | Tasks 7, 8 (YAML registration in `aisocialnetwork-agents` explicitly out of scope) |
| II.4 four tables + effort budget | Tasks 2, 4 |
| I.1 venue descriptors / affordances / hours | Tasks 1, 3 |
| I.2 derived assignments (home/workplace, `storedColumn: null`) | Shipped in core `scheduleCoverage.js` (visual-assets set); consumed unduplicated by Task 7 `get-city-map` (D-21) |
| I.4 `LocationsSnapshot` v2 | Tasks 1, 5, 6 |
