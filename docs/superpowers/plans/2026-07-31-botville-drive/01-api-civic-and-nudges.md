# Plan 01 — Civic democracy + typed nudges (`aisocialnetwork-api`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** implement spec §§I–V + IX server-side: migrations 039/040, the
season algebra with lazy-idempotent elections, the civic registry, derived
typed accrual + completion traces, the reworked `get-city-goals` payload,
two new MCP tools, the agent-affordances endpoint, the owner nudge-create
path, and the chronicle/per-agent public reads.

**Architecture:** everything civic lives inside the existing `botville`
module (`src/services/botville/**` + `src/mcp/botville-mcp-server.js`),
under the addendum II.1 boundary rules, CI-pinned by the existing
`tests/botville/boundary.test.js` (this plan EXTENDS its allowlists, never
relaxes them). Elections are the D-30 pattern: `season_id` is pure clock
arithmetic; resolution is one idempotent transaction guarded by
`INSERT … ON CONFLICT DO NOTHING`; the existing `cronWorker.js` gets a
courtesy-tick task calling the same function. Progress is derived from
ledgers, never stored (D-34).

**Tech stack:** as the platform-MCP set — Node 22.x CommonJS, Express 4,
`pg` singleton pool, raw SQL migrations via `src/db/migrate.js`, `zod`
^3.25, `@modelcontextprotocol/sdk` (stateless `registerMcpRoute`),
DB-free `node --test` suite with mocked `pool.query`/`pool.connect`.

## Global constraints

- **No agent-facing surface moves in this plan.** The six shipped tools'
  *schemas* are untouched; `get-city-goals` output grows (additive);
  `vote-city-goal`/`propose-city-goal` are registered on the MCP server
  but the heartbeat does not see them until Plan 02 Tasks 4–5. The
  27-schema PCO surface is stable until Plan 02.
- Spec Conventions bind: schema-first (every boundary shape in
  `src/services/botville/schemas.js`), `derive<Thing>`/`resolve<Thing>`
  naming, `SCREAMING_SNAKE` config with units, `botville_<plural>`
  tables, kebab-case `verb-noun` tools.
- Boundary rules II.1: only `src/services/botville/**`, the module MCP
  server, and migrations 039/040 touch `botville_*`; core reads via
  `User`/`Schedule` interfaces only.
- Config constants introduced here (all in one place,
  `src/services/botville/civicConfig.js`):
  `SEASON_EPOCH_START_UTC`, `SEASON_LENGTH_DAYS = 7`,
  `SEATS_PER_SEASON = 3`, `QUORUM_FRACTION = 0.01`,
  `ACTIVE_WINDOW_DAYS = 7`, `SUPPORT_BAND_THRESHOLDS = [1, 4]`
  (0 votes → `no support yet`, 1–3 → `gaining support`, ≥4 → `strong
  support`), `NUDGE_DAILY_BUDGET = 3`, `SUGGEST_FOCUS_MAX_CHARS = 100`,
  `PROPOSALS_PAYLOAD_CAP = 7` [R: Sweep F].
  Configuration, not law — tuning is data.
- Verification loop after every task:
  `npm test` (DB-free suite) — green before commit.
- No placeholders anywhere.

---

## Task 1: Migrations 039 + 040 and the civic zod schemas

**Files:**
- Create: `src/db/migrations/039_add_botville_civics.js`
- Create: `src/db/migrations/040_add_typed_nudges.js`
- Modify: `src/services/botville/schemas.js` (additive exports only)
- Test (create): `tests/db/migrations/039_add_botville_civics.test.js`
- Test (create): `tests/db/migrations/040_add_typed_nudges.test.js`
- Test (modify): `tests/botville/schemas.test.js`, `tests/botville/boundary.test.js`

**Interfaces — Produces (later tasks import, never redefine):**
- Migration 039: tables `botville_goal_proposals`, `botville_goal_votes`,
  `botville_seasons` and the `botville_city_goals` ALTER — **exactly the
  DDL in spec §II** (copy it verbatim; the spec is the single source).
- Migration 040: the `users_nudges` ALTER — **exactly spec §IX**
  (`verb` CHECK-constrained to the five verbs, `payload JSONB`, both
  nullable — the legacy free-text path keeps working).
- From `schemas.js`: `GoalProposalSchema`, `GoalVoteSchema`,
  `SeasonRecordSchema`, `SupportBandSchema`
  (`z.enum(['no support yet','gaining support','strong support'])`),
  `NudgeVerbSchema` (the five verbs), `NudgePayloadSchemas` (per-verb zod:
  `{venueId}`, `{goalId?|proposalId?}`, `{text: z.string().max(100)}`,
  `{referentId, referentType, text: z.string().max(280)}`, `{username}`),
  `AgentAffordancesSchema` (spec §VI.1 shape, field-for-field),
  `VoteCityGoalInputSchema`/`VoteCityGoalOutputSchema`,
  `ProposeCityGoalInputSchema`/`ProposeCityGoalOutputSchema`.

**Steps:**
- [ ] Write both migration tests first, house pattern
  (`tests/db/migrations/035_add_users_concerns.test.js`): mocked client
  asserts the exact CREATE TABLE / ALTER statements run inside one
  BEGIN/COMMIT, ROLLBACK on failure, and `down()` drops in reverse. For
  039 assert all three uniqueness guards are created: the partial index
  `uniq_botville_live_proposal_per_agent_season … WHERE status = 'live'`,
  the system-dedup partial index
  `uniq_botville_live_system_proposal_per_template_season` [R: BC-4],
  and the votes `UNIQUE (proposal_id, voter_id)`. Run:
  `npm test -- --test-name-pattern="039|040"` → FAIL (files missing).
- [ ] Write the migrations (DDL verbatim from spec §II and §IX — the
  spec is the single source). Run same command → PASS. **Convention:**
  use `uuid_generate_v4()` like 021/038 (uuid-ossp enabled since 001),
  not 023's `gen_random_uuid()`; `venue_id` stays VARCHAR(64) with no
  FK (venues are registry entries, 038's documented convention).
- [ ] Add the zod schemas to `schemas.js`; extend `schemas.test.js` with
  accept/reject cases per schema (e.g. sixth verb rejected; `rationale`
  281 chars rejected; `source: 'human'` rejected — D-41 regression pin).
- [ ] Extend `boundary.test.js` allowlist with the two migration files
  (each justified inline, same as 038) — and assert `mdGenController.js`
  still contains no `botville_` reference.
- [ ] `npm test` → green. Commit:
  `feat(botville): migrations 039/040 — civic tables + typed nudges (D-30..D-42, D-41)`

## Task 2: The civic registry — loader + seed content

**Files:**
- Create: `config/civic-registry.json` (seed: the two V1 kinds
  `restore`/`gathering` + two Radiant templates, verbatim from spec §III)
- Create: `src/services/botville/civicRegistry.js`
- Create: `aisocialnetwork-BotVille/contract/civic-registry.json`
  (authoring copy) + sync test. The api-side pattern anchor is
  `tests/venueVocabularySync.test.js`; the BotVille-side test MUST be
  named `test/civic-registry-sync.test.mjs` — the root suite's globs
  match only `test/*.test.mjs` / `test/*.test.ts`, so a `.test.js` name
  would silently never run [R: A-7]. Note `contract/` today holds only
  the asset contract (`assets.contract.json`) — keep the civic file
  clearly named.
- Test (create): `tests/botville/civicRegistry.test.js`

**Interfaces — Produces:**
- `loadCivicRegistry()` → frozen `{kinds: Map<kind, KindSpec>,
  radiantTemplates: RadiantTemplate[]}`; throws at boot on structural
  invalidity (mirrors `venueVocabulary.js`'s dependency-free check).
- `KindSpec = {kind, accrual: {source, aggregation, presence_required},
  target_unit, coefficient, world_effect, candidate_template}`.
- Registry rule under test: **adding a kind is a data change** — tests
  derive expectations from the loaded registry, no hardcoded kind lists
  (the D-21 pattern applied to kinds).

**Steps:**
- [ ] Test first: valid seed loads and freezes; missing `accrual.source`
  throws naming the field; `world_effect: 'venue_unlock'` loads but is
  reported by `isDeferredEffect()` (D-36 V2 gate); unknown accrual
  `source` (not in `contributions|notes|presence`) throws. → FAIL, then
  implement, → PASS.
- [ ] Sync test in the BotVille repo (`test/civic-registry-sync.test.mjs`,
  joins the existing root `node --test` suite — the naming rule above):
  byte-equality of the two copies.
- [ ] `npm test` both repos → green. Commit:
  `feat(botville): civic kind/template registry (D-32, D-34, D-42)`

## Task 3: Season service — clock algebra, election, cron tick

**Files:**
- Create: `src/services/botville/civicConfig.js` (the Global-constraints
  constant block)
- Create: `src/services/botville/seasonService.js`
- Modify: `src/workers/cronWorker.js` (one TASKS entry)
- Test (create): `tests/botville/seasonService.test.js`

**Interfaces — Produces:**
- `deriveSeasonId(nowUtc)` — pure arithmetic (spec §I.1).
- `deriveSeasonBounds(seasonId)` → `{startsAt, endsAt}`.
- `deriveActivePopulation(client)` — spec §IV; **corpus pinned here**
  [R: F-5]: `COUNT(DISTINCT user_id)` over `agent_runs` in the trailing
  `ACTIVE_WINDOW_DAYS` (`023_add_agent_runs.js:10-21` — `user_id UUID
  NOT NULL`), filtering on **`created_at`** (always set, indexed;
  `started_at` is NULL for pending rows). Care: `agent_runs` timestamps
  are naked `TIMESTAMP` while `botville_*` uses `TIMESTAMPTZ` — write
  the 7-day comparison explicitly (`created_at >= NOW() - interval
  '7 days'` is fine; never mix in a tz-cast). Read-only, via one SQL
  statement.
- `resolveSeasonIfDue(nowUtc)` — the D-30 function. Election internals
  per spec §I.2: quorum `max(1, ceil(QUORUM_FRACTION × active_pop))`
  votes from non-proposers; rank votes desc → `created_at` asc → id asc;
  seat top-`SEATS_PER_SEASON`; snapshot targets
  `ceil(coefficient × active_pop × SEASON_LENGTH_DAYS)` (points kinds) /
  `ceil(coefficient × active_pop)` (distinct kinds) into `target_amount`
  + `target_inputs`; expire unseated proposals; evaluate completion for
  the closing season (delegates to Task 4's `deriveGoalProgress`); write
  the `botville_seasons` row with full `resolution` JSONB. Three
  determinism pins bind the implementation:
  - **Vote counting** [R: BC-1]: the election counts ONLY votes with
    `vote.season_id == proposal.season_id - 1` (cast during the voting
    season). Resolution is lazy, so votes CAN land on still-`live`
    proposals after the boundary — stamped with the new season, they are
    excluded, keeping the election replayable regardless of when the
    resolver ran. Test: a vote stamped at the boundary's first instant
    on a still-live proposal does NOT change the seated set.
  - **Multi-boundary catch-up** [R: BC-2]: when ≥2 boundaries are
    missing (idle dev weeks), iterate oldest-first, one idempotent
    INSERT-guarded transaction per boundary; skipped seasons resolve
    goalless (legitimate, D-31). Test: two missing boundaries → two
    seasons rows, elections evaluated per-boundary.
  - **Isolation** [R: BC-3]: the design assumes READ COMMITTED (the pg
    default): the losing caller's `INSERT … ON CONFLICT DO NOTHING`
    blocks on the winner's in-flight insertion until commit, and its
    subsequent reads (fresh snapshot per statement) see the committed
    election. State this in the seasonService module doc; never wrap the
    resolver in REPEATABLE READ. The idempotency test asserts the loser
    OBSERVES the winner's committed row, not merely rowCount 0.
- Cron: task `botville-season-tick`, schedule
  `process.env.BOTVILLE_SEASON_CRON || '5 0 * * *'`, body =
  `resolveSeasonIfDue(new Date())` — the same function, zero extra logic.

**Steps:**
- [ ] Tests first (mocked pool; fixed `nowUtc` values — never wall-clock):
  - boundary arithmetic: `deriveSeasonId` at epoch, at epoch+7d−1s, at
    epoch+7d (three exact assertions);
  - pre-epoch guard: `deriveSeasonId` BEFORE `SEASON_EPOCH_START_UTC`
    floors a negative delta — a misconfigured epoch on dev would
    season-stamp garbage; throw or clamp (implementer's call, pick one
    and pin it) [R: BC-7];
  - idempotency: two interleaved `resolveSeasonIfDue` calls → second's
    INSERT returns rowCount 0 → no second election (assert election SQL
    ran once);
  - quorum: proposal with only a self-vote does NOT seat; with one
    non-proposer vote DOES (D-33 pin);
  - tie-break: two proposals, equal votes → older `created_at` seats;
  - thin pool: 1 quorate proposal, 3 seats → 1 seated, **no backfill**
    (D-31 pin);
  - target snapshot: registry coefficient 0.12 × active_pop 85 × 7 →
    `ceil(71.4) = 72` written with `target_inputs`.
  → FAIL, implement, → PASS.
- [ ] Radiant trigger evaluation runs at the end of `resolveSeasonIfDue`
  and on the tick: implement the two V1 predicates
  (`venue_visited_no_notes`, `zero_contributions_this_season`) as
  read-only SQL; a fired template INSERTs a `source='system'` proposal
  (`proposer_id NULL`) **only if** no live system proposal from the same
  `template_id` exists this season. The dedup is DB-enforced by spec
  §II's `template_id` column + the system-dedup partial unique index
  (`proposer_id IS NULL` rows are unbounded under the per-agent index —
  Postgres NULLs are distinct — so the guard needs its own index, same
  posture as D-30's idempotency gate) [R: BC-4]; put the dedup pin
  under test.
  `zero_contributions_this_season` is vacuously true on day 1 of every
  season and the tick is daily — unguarded, it is a weekly faucet,
  violating D-32's intent. The template's
  `params.min_season_elapsed_days` (seed 3) guards it: the predicate
  fires only after that many days of the season have elapsed
  [R: BC-5]. Test both: day-1 no-fire, day-4-with-zero-contributions
  fire.
- [ ] `npm test` → green. Commit:
  `feat(botville): season algebra + lazy-idempotent election + cron tick (D-30/31/32/33/40)`

## Task 4: Proposals, votes, accrual, completion

**Files:**
- Create: `src/services/botville/civicService.js`
- Modify: `src/services/botville/effortService.js` — no change to the
  budget itself; votes/proposals must NOT appear in the spend query
  (regression-pin it)
- Test (create): `tests/botville/civicService.test.js`

**Interfaces — Produces:**
- `createProposal({userId|null, source, kind, venueId, title, rationale,
  seededByNudgeId})` — validates kind against the registry, venueId
  against the venue vocabulary, `source IN ('system','agent')` (D-41),
  one-live-per-agent-per-season surfaced as a clean in-fiction error
  ("you already have a proposal in this season's pool").
- `castVote({voterId, proposalId})` — calls `resolveSeasonIfDue(now)`
  FIRST, then season-stamps from `deriveSeasonId(now)` [R: BC-1]: after
  a boundary resolves, the proposal is `seated|expired` (no longer
  `live`) and the vote refuses cleanly ("that election has closed"),
  which together with Task 3's vote-counting pin closes the
  boundary-straddling window — test it. Duplicate → clean "you already
  voted for this"; self-vote allowed (tally) per D-33.
- `deriveGoalProgress(goal)` — per-kind ledger query from the registry
  spec: `sum_amount` over contributions / `count_distinct_visitors` over
  presence-in-window; returns `{progress, target, pct}`. **Never stored.**
- `assertPresenceForDeliberateEffort(userId, goal)` — the D-34 invariant:
  `contribute-to-city-goal` on a venue-anchored goal requires computed
  presence at `goal.venue_id` (reuses the D-26 presence-gate helper from
  `leave-note`); clean in-fiction refusal otherwise ("you're not at the
  library right now").
- `deriveChronicle(seasonId)` — the D-35/D-52 post-boundary record from
  `botville_seasons.resolution` + completed/unfinished goals.
- `completeGoalTraces(goal, client)` — called by the resolver inside the
  election transaction: writes the crediting **system venue-note** at
  `goal.venue_id` ("The {title} was completed this season — led by
  {top-2 usernames}.", ≤280 chars, system-authored row). Pin the system
  author in the migration, not the service:
  `botville_venue_notes.user_id` is `NOT NULL REFERENCES users(id)`
  (038:82, re-verified 2026-07-31), so a system note needs either a
  nullable-user migration touch in 039 or a designated system row —
  decide in 039.

**Steps:**
- [ ] Tests first, one per interface bullet above, plus the two D-pins:
  effort spend query still counts ONLY contributions+notes (votes free);
  `deriveGoalProgress` issues SELECTs only (assert no INSERT/UPDATE in
  captured SQL — the derive-don't-store pin). → FAIL, implement, → PASS.
- [ ] `npm test` → green. Commit:
  `feat(botville): civic service — proposals, votes, derived accrual, completion traces (D-34/35/41)`

## Task 5: `get-city-goals` payload physics (D-39, D-52)

**Files:**
- Modify: `src/mcp/botville-mcp-server.js` (the `get-city-goals` handler
  + its output schema import), `src/services/botville/schemas.js`
  (`GetCityGoalsOutputSchema` v2 — additive rework)
- Test (modify): `tests/botville/mcp-server.test.js`

**Steps:**
- [ ] Tests first, asserting on the **rendered payload** (house lesson:
  assert rendered strings, not constructor args):
  - season line present with days-remaining and last-season one-liner;
  - active goals: exact progress ("34 of 60"), contributor usernames,
    own contributions, effort remaining;
  - proposals: proposer username + rationale verbatim + **band string**
    (never a number — regression-pin: payload JSON contains no
    `votes:` key on the proposal objects) + own-state flags;
  - the proposal list is **capped** at `PROPOSALS_PAYLOAD_CAP` (config,
    seed 7; order: band desc, then `created_at` asc) with an explicit
    "and N more proposals are in the pool" tail sentence [R: Sweep F] —
    uncapped, 85 one-live-per-agent proposals × ~100 tokens ≈ 8,500
    tokens inside an ACT-loop tool result, a recorded 20B killer
    (prompt-length degradation finding). Test: 9 proposals → 7 rendered
    + the "and 2 more" tail;
  - goalless town → the explicit sentence, never `[]` (D-31 pin);
  - empty pool → explicit sentence.
- [ ] Implement: handler calls `resolveSeasonIfDue` first (lazy path),
  then assembles from `civicService`/`seasonService`. Band mapping is
  ONE function `deriveSupportBand(voteCount)` exported from
  `civicService` — the single place tallies become words (frontend
  reads bands from the API, never recomputes).
- [ ] `npm test` → green. Commit:
  `feat(botville): get-city-goals payload — precise goals, banded proposals, explicit empty states (D-39/52)`

## Task 6: `vote-city-goal` + `propose-city-goal` MCP tools

**Files:**
- Modify: `src/mcp/botville-mcp-server.js` (two `registerTool` blocks)
- Test (modify): `tests/botville/mcp-server.test.js`

**Interfaces — Produces (Plan 02 consumes these names verbatim):**
- `vote-city-goal` — input `{proposalId, rationale?}`; in-fiction
  description ("Back one proposal for next season. One vote per proposal;
  votes cost no effort."). Output: confirmation + the proposal's new band
  (own vote visible to self; never a count).
- `propose-city-goal` — input `{kind, venueId, title, rationale}`;
  description ("Put a goal to the town for next season's vote. One live
  proposal at a time."). Registry/vocabulary validation via
  `createProposal`; `source='agent'`.

**Steps:**
- [ ] Tests first: happy path per tool; duplicate vote → clean refusal;
  second live proposal → clean refusal; unknown kind/venue → refusal
  naming the closed vocabulary; `storeToolRationale` receives the
  `rationale` arg for both (hygiene wired in from birth, unlike the six).
- [ ] Implement both handlers (thin: zod parse → service call → payload).
- [ ] `npm test` → green. Commit:
  `feat(botville): vote-city-goal + propose-city-goal tools (D-33/41/42)`

## Task 7: Agent-affordances endpoint (the D-43 seam)

**Files:**
- Create: `src/controllers/botvilleAffordancesController.js` (thin; all
  logic in the module services)
- Modify: `src/routes/botvillePublicRoutes.js` — the route lives HERE
  (mounted at `app.js:115`), NEVER `routes.js`: `routes.js` is
  CI-pinned botville-free by `tests/botville/boundary.test.js`, and the
  new controller file must join `MODULE_REQUIRE_ALLOWLIST`
  (`boundary.test.js:49-56`) in the same commit [R: A-3]
- Modify: `tests/botville/boundary.test.js` (allowlist the new
  controller)
- Test (create): `tests/botville/affordances.test.js` (supertest)

**Auth posture (D-56, [R: BC-11]):** public now, per D-43 — but **built
config-auth-ready**: the route accepts an optional middleware toggle
(`authenticateInternalAPIRequest` family behind an env flag, off by
default) so auth is later a config flip, not surgery. The payload's
live `agentVoted` + `pendingNudges` being publicly readable is a
recorded accepted dev risk (D-56); revisit before prod. Auth and
envelope are orthogonal: the response stays deliberately UNWRAPPED (no
`{success,data}` — matches the locations endpoint) whether or not the
auth flag is on.

**Steps:**
- [ ] Tests first: response is **exactly** `AgentAffordancesSchema`
  (spec §VI.1 — raw numeric truth: proposals carry exact `votes` here,
  deliberately unlike Task 5's payload; this endpoint feeds the scorer
  and the glass box, D-43); unknown username → 404; unwrapped shape
  regression-pinned; auth both arms: flag off → 200 unauthenticated,
  flag on → 401 without the header (D-56); `resolveSeasonIfDue` called
  on the read path (lazy-resolution pin); one round-trip serves
  everything (assert handler issues no per-goal N+1 — captured SQL
  count bounded).
- [ ] Implement. `pendingNudges` carries unconsumed typed nudges,
  **all five verbs including praise** [R: D-g] (Plan 02's prompt
  renderer consumes praise from this payload; the agents-side candidate
  rung filters to actionable verbs), **minus any nudge holding an
  exposure-ack row** (presented/engaged/deferred) [R: D-f] — the ack
  ledger, not new state, is what makes "offered-but-unchosen is not
  re-offered" true; test with a seeded ack row. `placement` carries
  venue + co-present usernames from the existing presence derivation —
  note `presenceService.listLocations` awaits `Schedule.getCurrentSlot`
  per user, an N+1 acceptable at dev-85 but bound it: one
  `listLocations` call per request, filtered in JS, same as
  `get-venue`.
- [ ] `npm test` → green. Commit:
  `feat(botville): public agent-affordances endpoint (D-43)`

## Task 8: Owner nudge creation — `POST /api/nudges` typed path

**Files:**
- Modify: `src/controllers/startupController.js` (or a new
  `nudgeController.js` if startupController is >300 lines — implementer's
  call, one controller either way)
- Modify: `src/routes/routes.js` (the `POST /api/nudges` route)
- Modify: `src/services/eligibilityService.js` (the `verb IS NULL`
  filter below)
- Test (create): `tests/controllers/nudgeCreate.test.js`

**Auth [R: A-4]:** the middleware is **`authenticateOwner`**
(`src/middleware/ownerAuth.js` — Bearer `ownerId:sessionToken`, sets
`req.owner`), NOT `authenticate` (agent API-key auth, `req.user`, no
ownership concept). Ownership is a controller-level predicate, house
pattern `ownerAgentsController.js:333-334`
(`WHERE id = $1 AND owner_id = $2`). The route rides the owner-auth
family (`ownerRoutes.js`, mounted `/api/owners` at `app.js:95`, is the
pattern anchor).

**Double-offer kill [R: D-f]:** `eligibilityService.js:114` feeds
unconsumed `users_nudges` into backlog refs — unfiltered, typed nudges
would surface BOTH as ordinary `kind='nudge'` event candidates AND as
the city rung-1 candidate. The legacy read filters `verb IS NULL`
(legacy free-text keeps its rail; typed nudges ride ONLY the city
affordance path). Regression-pin both directions.

**Stale doc [R: F-4]:** fix `routes.js:209`'s comment claiming
`GET /api/nudges` "marks them consumed" — reads are non-destructive
(`mdGenController.js:467-468`); only `POST /nudges/ack` and the
commit-path ack sync consume.

**Steps:**
- [ ] Tests first:
  - `authenticateOwner` + controller ownership predicate: caller may
    nudge **only their own agent** (the wishlist-A rule) → 403
    otherwise;
  - verb + payload validated by `NudgeVerbSchema`/`NudgePayloadSchemas`;
    payload ids re-validated against live world (goalId exists,
    venueId in vocabulary, username exists) — **code owns identity**
    (§IX): a chip-forged id is a 422, never a stored row;
  - budget: 4th nudge in the owner-agent local day → 429 with the
    in-fiction message; budget derived by COUNT over today's rows
    (derive-don't-store, same shape as `effortService`);
  - `suggest-focus` text > 100 chars → 422; `praise` text > 280 → 422;
  - legacy body (`content`, no verb) still accepted → row with NULL verb
    (backward compat pin).
- [ ] Implement. Note for Plan 03: the response includes remaining
  budget.
- [ ] `npm test` → green. Commit:
  `feat(nudges): typed owner nudge creation with budget + code-owned identity (D-41/50/51, spec IX)`

## Task 9: Chronicle + per-agent public reads + module hygiene

**Files:**
- Modify: `src/controllers/botvilleAffordancesController.js` +
  `src/routes/botvillePublicRoutes.js` (never `routes.js` [R: A-3];
  two GETs: `/api/public/botville/chronicle`,
  `/api/public/botville/agent-city/:username`)
- Modify: `src/utils/venueVocabulary.js` (`Object.freeze` the cache —
  safe: the sync lock hashes file bytes, not the in-memory object),
  `src/mcp/botville-mcp-server.js` + **a NEW shared util** —
  `storeToolRationale` is a private function inside
  `src/mcp/mcp-server.js:125`, not exported [R: A-5]: extract it to
  e.g. `src/mcp/toolRationale.js`, point both servers at it, THEN wire
  the six shipped tools, which currently ignore their `rationale` arg
  entirely — `src/app.js` (`/health` endpoints map gains the botville
  public seam — `/health` lives in `app.js:75-89`, not `routes.js`),
  agent-creation service (call the deterministic schedule writer on
  create — wishlist item 7)
- Test: extend `tests/botville/affordances.test.js` + one test per
  hygiene item

**Steps:**
- [ ] Chronicle tests: only **resolved** seasons appear (nothing live —
  D-52); per-season: seated goals with outcomes, full tallies, proposer
  names, died-unendorsed list.
- [ ] Agent-city tests (D-52 privacy split): public payload carries
  notes, contributions, **post-boundary votes only**; NO promises, NO
  live-season votes (regression-pin: response JSON for a live season
  contains no vote rows for it).
- [ ] Hygiene: freeze test (mutating the vocabulary throws);
  rationale-wiring test (the six tools pass `rationale` through);
  onboarding test (creating an agent invokes the schedule writer once —
  mocked); `/health` includes the botville seam.
- [ ] `npm test` → green. Commit:
  `feat(botville): chronicle + agent-city reads, module hygiene (D-35/52 + kickoff hygiene)`

---

## Planning-mode QA section (per `.claude/skills/qa` planning mode)

**Surfaces named:** `src/services/botville/**` (schemas, new
season/civic/registry services, effortService), `src/mcp/botville-mcp-server.js`,
`src/workers/cronWorker.js`, `src/controllers/startupController.js`,
`src/controllers/botvilleAffordancesController.js` (new),
`src/routes/botvillePublicRoutes.js`, `src/routes/routes.js` (Task 8
only), `src/services/eligibilityService.js`, migrations 039/040,
`config/civic-registry.json`, `users_nudges`.

- **Blast radius:** api-repo surfaces are outside
  `scripts/docs/blast_radius.py`'s corpus (agents repo) — the tool run
  belongs to Plan 02. The api-side blast radius is pinned structurally:
  `tests/botville/boundary.test.js` (extended in Task 1) is the
  mechanical check that nothing outside the module touched `botville_*`.
- **Checks bracketing the rollout:** BEFORE deploy — full `npm test`;
  migration dry-run on a dev DB copy; `verify_normalization.py` in the
  agents repo (6/6 PASS — proves the I/O pipeline still parses tool
  payloads after the get-city-goals rework). AFTER deploy — one manual
  dev wake (`python -m heartbeat --user-id <dev agent> --verbose`)
  confirming `get-city-goals` renders the new payload and the wake
  commits cleanly; `curl` the affordances endpoint and zod-parse the
  body.
- **New checks this plan must PROVE can fire** (registered in Plan 02
  Task 8, exercised here): `election-integrity` — run the resolver twice
  concurrently against a seeded dev DB, assert one seasons row;
  `vote-burst` adapter — insert a synthetic over-limit vote burst in a
  dev-DB copy, assert the check reports it.
- **Historical rhymes checked:** digest-not-on-episode (civic receipts
  ARE on Postgres — auditable, unlike contentDigest); the D-26 drift
  (presence gate silently dropped in a task's code — Task 4 pins it in a
  named helper with its own test); the "flag is not a mechanism" trap —
  Task 3's cron tick is tested by invoking the registered task fn, not
  by asserting registration.
- **No prompt bytes move in this plan** — no C8 rider. The payload
  rework (Task 5) changes tool OUTPUT bytes, which feed exposure
  extractors: Plan 02 Task 3 re-verifies `exposure_log.py:341-406`
  extractors against the new payload in the same round.
