# EXECUTION LOG — BotVille City Growth (D-59..D-78)

This file is the ONLY status source. Plan checkboxes are never ticked; the log
is truth. One line per completed step: date · task · commit hash · gate output.
Parked owner calls and rotted anchors are also logged here.

---

## Entries

- 2026-08-03 · **Gate −1 (clean tree)** · commit `fb6f068` (plan set docs landed
  on BotVille `main`) · Tracked residue stashed as `stash@{0}` "gate-minus-1:
  limezu bake residue (18 tilemaps + assets.generated.ts) + CONTEXT.md §9 vocab
  draft (land at close-out)" — the tilemap/assets modifications were a
  `world-bake.mjs` re-run against pack `limezu` over the committed `fixture`
  baseline (R-12 residue, regenerable); the CONTEXT.md diff was the §9
  vocabulary additions (Plot, Claim, Tier, Charter, Builder), which the
  close-out lands after round (g) — preserved in the stash, NOT committed.
  Baseline: `sha256(packages/client/public/assets/venues.json) =
  c552703455773d665f1cac81ad8772132726aef84f443efd424edeb9f17607fc`.
  `git status --short` empty. Root `npm test` exit 0 (root node --test suite
  incl. `test/asset-index.test.ts` + golden:names + turbo: client 22 tests /
  3 files, all green; re-verified with `turbo run test --force` to rule out a
  cached green). **Gate −1 PASSED.**

- 2026-08-03 · **Gate 0 — SATISFIED (world moved past the prompt).** The
  "unanalyzed" post-drive awareness micro-round (`2026-07-31-botville-drive/
  EXECUTION-LOG.md:76`, agents `8133966` + api `7e1054a`) WAS analyzed and
  registered as **M-060** (`facts.yaml:1088`, corpus `run_20260801_150159`,
  write-up `docs/analysis/2026-08-01-awareness-microround.md`): hypothesis-0
  CONFIRMED — city-candidate conversion 1/285 (0.35%) → 4/63 (6.3%), first
  four organic chose→read→vote chains. Gate 0 no longer blocks Stage D.
- 2026-08-03 · **DRIFT (major, logged per §0.2):** the action-self-awareness
  kickoff executed S1/S2/A1+/A2/B1/B2/B3/SP rounds on 08-02/03 and registered
  **M-061..M-070**. Consequences for this set: (1) **facts now start at
  M-071**, not M-060; (2) **Plan `02-` Task 1 is substantially pre-empted** —
  `configs/subagents/builder.yaml` exists on agents `main` (city-write tools,
  act-shaped `city_propose` moved off the reflector, plus a new `historian`),
  measured in **M-070** (run_20260803_075157: 9/9 chosen city delegations
  routed to builder, 7/9 made real MCP calls, 5/21 propose attempts succeeded
  into live season-2 rows) — D-77's "does a specialist that can act convert"
  question has a measured answer; (3) the **28-schema main surface held in
  85/85 wakes** while the builder carries `contribute-to-city-goal` — O-2's
  option (b) shape is de facto live; (4) api `7e1054a` shipped the vote-rung
  candidateText act+stakes copy — **O-5's gap appears closed and its fix
  measured** (M-060 conversion). Still the builder has **no `city` context
  section** (O-3 open; `context_sections: [identity, soul, rules, time]`) and
  **no `unhoused_self` trigger** (D-70 — needs migration 041's unhoused
  signal). What remains of Plan `02-` is the delta, not the plan as written;
  rulings on how M-060/M-070 re-shape rounds (f)/(g) are the owner's.

- 2026-08-03 · **F-6 re-diagnosis DONE (read-only; Stage D prerequisite).**
  Corpus: `output/batch_test/run_20260801_031541/logs/` (85 logs), episodes
  harvested via `Episode saved to` lines; reflector census across rounds
  (b)/(c)/(e). Findings: round (b) spawned **3** reflectors (4 choosers; 1,
  `the_founder_post_exit`, chose but never called delegate-tasks); all 3 held
  `tools=15` at spawn (count-match vs `reflector.yaml` + zero
  `tools not found in MCP` warnings); **zero** schema/permission/timeout/
  truncation/serialized-call-in-content failures; outputs were clean prose ×2
  + one verbatim refusal. Pooled reflector MCP-call rate **5/16 ≈ 31%**
  (b 0/3, c 1/5, e 4/8) → P(zero in 3 draws) ≈ 0.33: **round (b)'s zero is
  base-rate sampling noise (temp 0.7, no seed), not a mechanism.** Two
  premise corrections, measured: round (c)'s `get-city-goals` was the MAIN
  agent (28-tool surface), not the reflector —
  `docs/analysis/2026-08-01-placement-round.md`'s "read the city through the
  delegated allowlist" is wrong on that point; and round (e)'s Archivist
  reflector called `get-city-map` on the MOST brainstorm-shaped task text, so
  trigger-framing does not distinguish outcomes at this n.
  `propose-city-goal` was called 0/16 across b+c+e; city reads 1/16. **Any
  builder-intervention claim should be judged against 5/16 overall / 1/16
  city — and M-070's builder (7/9 with real MCP calls, 21 propose attempts)
  already clears that bar decisively.** Gap noted for a future schema fix:
  episodes record NO subagent tool calls; the evidence survives only in
  verbose free-text logs.

- 2026-08-03 · **Plan `04-` Task 1 DONE** · commit `f1b4fe0` on branch
  `plan-04-archetypes-bake` (worktree `/Users/home/botville-wt-04-bake`) ·
  `deriveInstances(archetype, count, opts)` extracted to
  `scripts/lib/archetypes.mjs`; `deriveResidenceInstances` now a thin caller;
  `venues/_archetypes/README.md` added; 10 new tests (8 archetypes + 2
  collision), fire-proofed (module-not-found watched failing; collision test
  mutation-tested against a disabled duplicate-check throw). Gates:
  `npm test` 282/282 exit 0 (was 274/274); `test:bake` 40 pass/3 skip exit 0;
  `bake:world` exit 0 with `venues.json` sha256 = baseline
  `c552703…607fc` AND `git status --short` empty post-bake (all bake outputs
  byte-identical); `test:all` exit 0. `world-bake.mjs` untouched;
  `test/residences.test.mjs` + `test/bake/world-bake.test.mjs` pass
  UNCHANGED (behaviour-preservation proof). No archetype declared, no
  `roles: [home]` anywhere.

- 2026-08-03 · **Adversarial review of `f1b4fe0` (Task 1): extraction HOLDS.**
  No old-vs-new divergence constructible (character-level equivalence on id/
  label/clone/order); new guards unreachable from the only production caller;
  README.md in `_archetypes/` breaks no scanner (all filter `_`-prefix at
  `venues/` level). Findings to fold into the Task 2–6 pass, all doc/test
  hardening: (1) README three-file rule overstates the archetype path — no
  archetype discovery exists, `world-bake.mjs:57` stamps only `house.json`;
  say "plus a generator that gives it a count" (else Task-2-shaped work
  silently instantiates nothing); (2) `opts.labelPrefix` doc implies it
  re-namespaces ids — it changes label only; fix doc; (3) cheap test
  hardenings: spread-order mutant (template carrying `id`/`label` would
  survive — assert stamp from a template WITH id/label), strip-guarantee on
  the opts path, pin `r.venues === authored + deriveResidenceCount(town)` in
  collision test. Review also confirmed the README dropped the "minus
  id/label" half of the archetype definition (accurate phrasing in
  2026-07-27 plan `02-world-bake.md:1045`).

- 2026-08-03 · **Plan `04-` Tasks 2–6 + Task 8 DONE** · commits `f223d32`
  (T2 ladder + generator registry), `92e840b` (T3 construction states +
  `plot_states.json`), `99b0de1` (T4 six civic archetypes — Museum SHIPPED
  from `5_Floor_Modular_Building` generic families), `a45cb2f` (T5 variant
  pools), `8309eda` (T6 farm-drift close + sync tests), `e35db37` (T8, 141
  rect pins) on `plan-04-archetypes-bake`; api half `2c584aa` on
  `plan-04-sync-tests` (tests/ only). Gates all exit 0: bake, npm test,
  test:bake 40/3skip, typecheck, validate-contract vs real limezu pack, api
  sync test. Counts: district props 32→173, limezu rects 136→277 (all
  pinned), archetypes 1→10, **venues.json 18→18 byte-identical
  (sha256 `c552703…607fc`)**. Seven fire-proofs demonstrated + restored.
  **Task 6 RULING: remove the client `farm` filter, not barn promotion** —
  branches were provably unreachable (`presenceService.js:39-58` only emits
  published venueIds), promotion would move candidate ordering (forbidden by
  T8), art doesn't support a cheap interior, farm is already district
  geography. FOUR filter sites removed (plan anchored three; 4th at
  `navigation.ts:31`).
  **Measured deviation (plan text vs measurement, logged per §5):** "bake
  dormant" cannot mean *published* — schema (`venues.schema.json`) has no
  inert-venue shape, and publishing one civic venue (`museum_1`,
  roles:[hangout]) was measured moving **31/85 agents'** derived hangout +
  the socialize pool. Shipped as **declared-not-instantiated** (D-76's condo
  mechanism, generator-registry absence); instantiation is Plan `01-`/O-1
  business. Tent is art-only pending O-1 (no archetype file). Garden cannot
  instantiate until an open-ground generator exists (cityGrid hard-requires
  the farm pen) — test fires if anyone registers an outdoor generator.
  Also found, not fixed (measurement event): `schemas.js:122` MCP prose
  carries venue-id example `"cafe"` — split check lands instead (no id in
  executable code; example ids must exist). api full suite NOT run in
  `api-wt-04-sync` (no node_modules) — must run before merge.

- 2026-08-03 · **Review hardenings folded in** · commit `0a5bbe8` on
  `plan-04-archetypes-bake` · README three-file rule now states the fourth
  requirement (generator entry; absence-is-zero = D-76 dormant mechanism) and
  restores "VenueDescriptor minus id/label"; `opts.labelPrefix` JSDoc fixed
  (label-only, collision trap spelled out; param kept — it is part of Task
  1's behaviour-proof test); 4 test hardenings each shown killing its mutant
  (spread-order, registry-count equality `authored + deriveResidenceCount`,
  id-namespace pin, strip-on-opts-path). `npm test` + `test:bake` exit 0;
  venues.json still 18 entries / baseline sha. Only non-test production edit
  is a JSDoc comment.

- 2026-08-03 · **Plan `01-` unblocked scope DONE (Tasks 1–8 minus owner-gated
  parts)** · branch `plan-01-plots-housing` (`/Users/home/api-wt-01-plots`),
  commits `2a643a8` (T1 migration **042_add_botville_land_and_housing** —
  claims/structures/home_assignments/effort_transactions, plot_id as non-FK
  VARCHAR under either O-1 option, `botville_plots` NOT created, all FKs
  `confdeltype = n` proven from pg_constraint, 038/039 untouched), `f0ed3cc`
  (T2 state machine + claim path; revoke arc in the transition table, no
  revoking function, pinned by test — O-4), `7095550` (T3 steps 1/2/3/6:
  stored-home seam, dev-DB backfill 85/85 rows idempotent + SQL-proven,
  stored-sleep-vs-home disagreement = 0), `827c6dc` (T4 world effects +
  charter kind), `a696074` (T5 founding goal keyed on plots-non-empty,
  `plotsTableMissing` distinguished from empty, fixture-tested across 4
  instants × 3 seasons), `417655c` (T6 paging — **byte** cap
  `CITY_MAP_PAGE_1_BYTE_BUDGET = 6583` measured today, 18-venue payload;
  page-1 trims to 17 venues at 2×/7× vocabulary), `7062f7d` (T7 access
  seam), `c6c048c` (T8 integrity checks + /health). Suite 1032→1207 pass,
  exit 0 every step. Six fire-proofs demonstrated incl. cascade-flip and the
  73-of-85 reproduction. **Empty-home-diff test READY AND GREEN in general
  form** (`tests/scheduleCoverageHomeRegistry.test.js`). Pre-change
  distributions captured for T3 step 5 (first-visit ledger + slot counts, in
  agent report). Task 9 untouched — `git diff main..HEAD --
  mdGenController.js` empty. Live checkout never written.
- 2026-08-03 · **Stage B follow-ups this drive must carry:** (1)
  `config/civic-registry.json` (api) now leads
  BotVille `contract/civic-registry.json` — BotVille copy needs
  build/demolition/charter + `town-needs-homes` template BEFORE the api
  branch merges, else `test/civic-registry-sync.test.mjs` goes red
  (merge-order hazard added to runbook); (2) **charter cannot be seated** —
  038's `target_amount INTEGER NOT NULL CHECK (>0)` has no shape for a
  targetless kind; charter proposals are refused at the proposal boundary
  for now. D-66 rules "a charter has no target", so a follow-up migration
  043 relaxing the constraint for kind='charter' delivers the ruled design
  (not one of the six owner calls; scheduled as drive work); (3) merging
  `plan-01-plots-housing` into the live api moves the `get-city-map` MCP
  schema (limit/offset/rationale) — a composed-surface byte change; merge
  only in a deploy window and re-baseline per C8 if a round follows.

- 2026-08-03 · **Adversarial review of `04-` Tasks 2–6: two CRITICAL findings
  — Task 6's ruling is re-ruled on measurement.** The "farm branches are
  unreachable" claim is true of the api and FALSE of the client's own fixture
  server (default dev runtime, D-28): `agentLife.ts:37/38/100` schedules
  `farm` (every animal nightly, ~1/6 human day moves), `presence.ts:18-25`
  passes it through, so post-`8309eda` animals VANISH from the map at night
  (`removeSprite`), the night-behaviour subsystem loses its subjects, and a
  HUD "At the farm" click black-screens the client
  (`navigation.ts:36` → `scene.start('VenueScene:farm')`, unregistered key;
  camera stays faded, sync retries 30× and stops). Integrated mode
  unaffected (api never emits `farm`). **Re-ruling: `farm` is client-internal
  district geography** — restore the `:425` presence handling and the
  `navigation.ts` mapping, remove only the genuinely dead sites, and
  allowlist `farm` as a documented client-internal location in the new sync
  check. Also from review: sync check blind to `.tsx` files and
  const-extracted literals; api-side plot check permanently vacuous
  (`v.plots` can never exist under the 8-field projection +
  `additionalProperties:false` schema) and reads `sizeTiles` off a
  projection that lacks it; BotVille plot-check call site discards `count`
  (self-erasing filter); GENERATORS keys not reverse-checked against
  archetype files (S-6 trap survives for Plan `01-`); ladder archetypes'
  `roles: []` contradicts `venues.schema.json` `minItems: 1` the moment a
  generator is registered — resolve as a tripwire (generator ⇒ schema-valid
  roles), consistent with D-76 and the withheld home role. Review also
  confirms: venues.json unmoved BY CONSTRUCTION (single generator key),
  house count bit-for-bit old path, no home-role leak, plot_states/
  variant_pools reach nobody outside BotVille. OUTSTANDING: 141 limezu rect
  pins never resolved against the real pack in the worktree (`assets-src/`
  absent there) — Task 8's contact-sheet verification must run with the
  real pack before merge. Fix pass dispatched to the implementing agent.

- 2026-08-03 · **Adversarial review of Plan `01-` branch: 6 critical +
  6 important findings; fix pass dispatched.** Verified myself: suite is
  green in-worktree (1207/1207 exit 0) — the reviewer's predicted red test
  passes only because its mocked payload undershoots the budget; the code's
  own comment records the production-shaped measurement (18 venues +
  unhousedCount = 6606 bytes vs 6583 budget), so **today's no-args
  get-city-map trims a venue** — D-78's "growth costs nothing on the call
  the agent already makes" is violated by this drive's own field (C2), and
  the guarding test asserts the trimming function's postcondition, i.e. is
  tautological (C4). Other criticals: `listGoals` never projects `venue_id`
  so the active-build relevance rank is dead and the goal's venue can be the
  venue trimmed (C1); a charter row reaching `runElection` crashes boundary
  resolution town-wide, permanently, retried on every read — and a
  DATA-ONLY registry template addition can create one via
  `evaluateRadiantTriggers` which bypasses `createProposal` (C5); `/health`
  prints a hardcoded copy of the integrity-check names and nothing ever runs
  `gatherAndRun` — a green light with no bulb (C6). Importants: founding
  goal + access seam + growthService are unwired (the door does not consult
  the predicate; the "fires with no code change" docstring is false) (I1);
  arrival is unwired so every post-backfill signup re-opens the F-7 window
  (I2); `assignHome` has no schedule-rewrite hook — the one operation D-59
  introduces would breach the map/routine invariant (I3); the
  `town-needs-homes` Radiant template fires at 100% unhoused in the window
  between migration and backfill, and if it ever seats,
  `deriveBuildGoalEverRecorded` (kind-only) permanently blocks the founding
  goal (I4); `home-integrity` is red by construction in the town's designed
  state (unhoused-at-start is world state, not an invariant breach) (I5);
  `deriveHomeOccupancy` counts `user_id IS NULL` ghosts as housed (I6).
  Survived the attack: the stored??derived registry (reader/writer same
  function, same port), migration 042 (partial unique index on live rows,
  idempotent backfill, clean down), boundary discipline, charter refusal
  shape at the proposal boundary, founding-goal idempotency, and the
  73-of-85 empty-diff proof ("best-constructed test in the drive").

- 2026-08-03 · **Review fix pass DONE (Stage A)** · BotVille `3828f7c` + api
  `8480935` · farm regressions fixed: presence filter + navigation mapping
  restored, dead door sites stay removed, single authority
  `CLIENT_INTERNAL_LOCATIONS` + `sceneForLocation` in `venueRegistry.ts`
  consumed by navigation, presence AND the sync test (which now walks
  `.tsx`, resolves single-assignment consts, and checks the
  `AGENT_LOCATIONS` + i18n `LOCATION_KEYS` closed lists). GENERATORS reverse
  check + generator⇒schema-valid-roles tripwire added. api plot check reads
  BotVille SOURCE (declared archetypes, 10 files); four outcomes distinct;
  vacuity announced, wrong shape hard-fails both repos. **Task 8 art
  verification closed**: `assets-src` symlinked (gitignore anticipates it),
  `validate-contract limezu` exit 0, pins 277/277 match (141 new),
  contact-sheet 173/173 district props rendered, and the symlink un-skipped
  two golden-baseline tests — both pass. Fixture-mode night behaviour
  verified: 3/3 animals reach the pen. All gates exit 0; venues.json still
  18 @ baseline sha. **Stage A COMPLETE** (Tasks 1–6, 8; Task 7 = O-1).

- 2026-08-03 · **Plan `03-` Task 1 DONE** · commits `a882a79` (golden
  baseline: `test/golden/district-render.json` via
  `scripts/capture-district-baseline.mjs` — geometry, scene resolution for
  all 18 venues + 6 locations, map objects w/ depths, door registry,
  Pathfinder grid sha + 4 A* routes, per-agent draw decisions for a
  12-agent all-branch tick; `syncAgents` decision first extracted verbatim
  to pure `districtPresence.ts` so the baseline describes pre-change code)
  and `799979f` (de-hardcode) on `plan-03-client` (worktree
  `/Users/home/botville-wt-03-client`, branched from `3828f7c`). Gates:
  npm test 323/323 + client 22/22, typecheck, build, test:bake all exit 0
  (node v24 required — shell default v22 cannot run the repo); venues.json
  sha unchanged; tree clean. Only 4 explained baseline diffs (door keys
  re-keyed scene-key→venue-id — one shared scene key for N districts).
  Hardcodings removed: presence filter → `drawnByDistrict` via
  `resolveDistrict`; `sceneKeyFor` → descriptor `indoor === false`;
  `config.ts` geometry from descriptor; scene boots via
  `startingDistrict()`; `CLIENT_INTERNAL_LOCATIONS` → location→owning-
  district map. Synthetic second district drives the real resolver +
  planSync (capability proven, `outdoor().length === 1` pins content does
  not ship — D-62). Two mutants demonstrated killed. Rotted anchors: all
  DistrictScene line cites shifted post-8309eda/3828f7c (logged in agent
  report); plan's golden-baseline pointer names an asset-bake script that
  cannot see a scene.

- 2026-08-03 · **Stage B review fix pass DONE** · api commits `7529c06` (C1
  venue_id projected + double-layer pin; C2 budget recalibrated to **6697**
  bytes on the shipped shape via `tests/support/cityMapCalibration.js` —
  today's 18 ship whole, trimmed=0, growth pages at 36/125; C3 service-
  boundary mocks restored; C4 trimmed===0 assertion replaces the tautology),
  `aa8d124` (C5 both doors shut: runElection quarantines no-target/
  unregistered kinds + registry loader refuses charter-instantiating
  templates at boot, both fire-proofed; I4 template gated on
  `unhoused > spareBeds` — deliberately NOT `housed > 0`, which would mute
  D-64's founding state — and `deriveBuildGoalEverRecorded` provenance-
  scoped to `source='system' AND proposal_id IS NULL`), `7a2e7d8` (I1 seams
  wired: founding goal into `resolveSeasonIfDue`, door consults
  `deriveMayEnter` + `recordEntry`, beneficiaries reach `get-city-goals`;
  I2 arrival wired in both signup paths BEFORE schedule write; I3
  `assignHome` moves the routine in the same transaction via
  `Schedule.setSleepVenue`; I6 ghost beds excluded, boundary-exact
  fire-proof), `dbcada4` (C6 `npm run qa:integrity` exits 1 on fail / 2 on
  cannot-run, `/health` imports CHECK_NAMES and says `not-run-by-this-
  endpoint`; I5 unhoused demoted to metric — founding town reports ok with
  `unhoused: 85`). Suite **1243/1243 exit 0** (rate-limit flake documented,
  clean on rerun). mdGenController diff vs main still empty; 038/039
  untouched; no revoke export; no botville_plots.
- 2026-08-03 · **Stage B′ DISPATCHED** (cross-repo home-role follow-up):
  backfill re-verified → dorm/ladder `home` roles + re-bake (BotVille) →
  api vocabulary sync → empty-home-diff proof → Task 3 step 5 executor
  ruling (dorm leaves daytime pools; C-1 deferred to Task 9) → migration
  043 (charter seatable per Task 4's own text; C5 guards narrowed to
  unregistered/malformed kinds).

- 2026-08-03 · **Adversarial review of Plan `03-` Task 1: NO criticals;
  extraction verified decision-by-decision; Phaser same-key restart audited
  (all instance state cleared or reassigned; listeners balanced); Pathfinder
  change neutral (ES2022 useDefineForClassFields, no subclass); boot path
  byte-identical.** I verified the golden diff `a882a79..799979f` is exactly
  the four `doors[].key` lines, venues.json at baseline sha, tree clean.
  Three importants sent back as a fix pass: `drawnIds: Iterable` consumed
  twice (single-use-iterator landmine under Tasks 2–4 — materialise once);
  golden header's "captured before refactor" provenance now misleading after
  the doors-block regeneration (+ dead duplicate `key` field); baseline
  helper hand-copies the scene's door keying/offsets/depth rule without
  coupling — exactly Task 3's blast radius — must be a declared coverage
  caveat. **Noted PRE-EXISTING (not this drive's):** pending-focus silently
  dropped if a poll lands in the ~300ms fade window (`navigation.ts` guards
  on `currentSceneKey`); an outdoor venue whose `.tmj` fails to load renders
  a silent blank field (was literal-guarded before, now bake-data-
  parameterised) — both are Tasks 2–4 considerations. **Plan-doc hazard for
  future executors:** `03-…md:41-44` still instructs "grep 'farm' → zero
  hits" — superseded by the four-site re-ruling in this log; following it
  literally re-introduces the animal-vanishing regression.

- 2026-08-03 · **Plan `03-` Task 1 hardening DONE** · commit `ac3f9da` on
  `plan-03-client` · `planSync` materialises `drawnIds` once (kept
  `Iterable` — the natural call IS `agentSprites.keys()`, so honour the
  promise); generator-input pin test shown failing (exit 1) on the reverted
  implementation; golden files carry a PROVENANCE block (captured `a882a79`,
  re-baselined `799979f` four key lines, re-baselined `ac3f9da` dead-field
  removal); transcription-vs-coupling caveat + hover-pairing and init-throw
  gaps declared in the coverage docstring. Gates: 325/325 + 22 vitest,
  typecheck, build, test:bake exit 0; venues.json baseline sha; tree clean.
  **Stage C Task 1 COMPLETE (implemented, adversarially reviewed, hardened).**

- 2026-08-03 · **Stage B′ DONE (the F-7 split closed)** · BotVille `b191d5f`
  (dorm `roles:[hangout,home]` + `affords:[+sleep]`; ladder tiers
  `roles:["home"]` — dormant, nothing publishes; venues.json diff is EXACTLY
  the dorm's two blocks; lock + generated.ts regenerated; civic-registry
  synced byte-identical) · api `a45cfee` (vocabulary copies synced;
  **empty-home-diff proof: 0 of 85 moved, with the 73-of-85 no-stored-rows
  counterfactual reproduced**; stored-sleep-vs-map disagreements 0; byte
  budget re-measured 6730; `house_13` distinguished as headroom, not dead
  vocabulary — capacity 97 vs roster 85) · api `53d4ff1` (migration **043**:
  `target_amount` nullable with kind-aware CHECK — first draft ACCEPTED a
  NULL-target build goal via the `TRUE AND NULL` three-valued-logic trap,
  caught by probing the real DB, re-applied with explicit `IS NOT NULL`,
  all five cases probed; charters seat with NULL target, stand instead of
  completing, quarantine narrowed to unregistered kinds; **unseating is a
  named TODO** — spec §5.3 defines no mechanism, and inventing one is not
  the executor's call). **Task 3 step 5 RULING (executor, per plan):** the
  dorm leaves the daytime candidate pools as the home role's natural
  consequence — zero new code, no pool empties, pre-change distributions
  captured; C-1 shelter placement branch deferred to Task 9 (round-gated).
  Ordering gate re-verified before anything moved (backfill: written 0,
  already assigned 85). Final: api 1256/1256, BotVille 314/314 + test:bake
  42/42, qa:integrity exit 0 (2 skips on O-1), placement line + 038/039
  diffs vs main empty, live checkouts untouched.
- 2026-08-03 · **Sibling-repo silent-wrong-repo hazard FIXED** · BotVille
  `a3d0214` · the sync tests' skip messages (and the helper's own example)
  said `BOTVILLE_API_REPO`; the helper actually derives
  `BOTVILLE_AISOCIALNETWORK_API_REPO`, so the documented var resolved
  nothing and the check silently fell through to the (stale) side-by-side
  live checkout — a green against the wrong tree, found when Stage B′'s
  first "314/314" baseline turned out meaningless. Messages now render
  `envKey(name)`. **Cross-repo staging until merge:** api suite needs
  `BOTVILLE_REPO=/Users/home/botville-wt-04-bake`; BotVille suite needs
  `BOTVILLE_AISOCIALNETWORK_API_REPO=/Users/home/api-wt-01-plots`; both
  resolve themselves when the branches merge.

- 2026-08-03 · **Task 7 geometry measurement REFUTES the plan's ceiling
  (owner ruled D-88/D-89 in response).** The plan's "~25–30 practical plots"
  subtracted roads/pen (813) but not the five existing buildings (718 of
  the 1,395 "free" tiles) — actual greedy packing with 1-tile margin: **6
  housing plots vs the floor of 13**, and ZERO declared house exteriors
  (9×13..18×16) fit the assumed 6×5 parcel. `scarcity_ratio` had no valid
  value. Owner ruled **D-88** (grow the district AND multi-district later;
  all growth controls config-driven, residents may zone in later releases;
  plots sized to real exteriors) and **D-89** (vacant plots publish as the
  tent camp — roles home / affords sleep, the only derivation-stable shape,
  measured: shapes A/B/D move 31+ agents' daytime pools; home protected by
  stored rows, 0/85 move, append-only order verified). Task 7 re-dispatched
  under D-88/D-89.
- 2026-08-03 · **api: 044 + revocation + claim cost DONE** · `9d081f9`
  (migration 044: 038/039 FKs → SET NULL, verified confdeltype n; anchor
  correction: the table is `botville_goal_votes`, not
  `botville_proposal_votes` — schema followed, not prose; NOT NULL dropped
  where SET NULL would error; **NULL-contributor difficulty preserved** —
  anonymised rows count one-per-row, direction chosen against the griefing
  case, fire-proofed vs a real rolled-back DELETE; quorum filter fixed for
  NULL≠NULL self-vote false-positive) · `d2e784b` (revocation IS the
  demolition path — one kind, target decided by what stands on the plot;
  release-not-delete, idempotent across boots; exemptions + floor apply by
  construction; /revoke/i pin replaced with no-revoke-TOOL assertion) ·
  `e8c7c11` (claim cost per D-82: size-classed 1/2/3 vs 3-point day, config
  knobs, signed ledger rows, budget reads the ledger, named in-fiction
  refusal on exhaustion; live fire-proofs with probe rows cleaned). Suite
  **1291/1291 exit 0**. Found: a pre-existing DB trigger already blocks
  deleting users WITH episode history — the D-72 ops exposure is narrower
  than assumed (logged, ruling unaffected).
- 2026-08-03 · **agents: Plan `02-` delta + D-87 DONE** · branch
  `growth-builder-delta` @ `5e46c78` (worktree `agents-wt-growth`), five
  commits: city section admitted via md-gen verbatim (D-57 pin UNBENT,
  renders into subagent backstory only — soul_prompt_hash/render_hash do
  not move, pinned); builder gains `city` + craft instructions (D-80
  verified in code: contribute-to-city-goal on L1 AND builder, catalog
  bytes untouched — no re-pin needed); `unhoused_self` end-to-end
  (frozen-set + evaluator + CityState.unhoused, fail-closed; follow-on
  triggers stay comments, pinned); episode attribution (D-87 premise HALF
  WRONG, measured: subagent calls were always recorded — `extra='ignore'`
  dropped the hooks' `source` stamp; one additive field fixes it; QA-L17
  registered with live positive: 355/5331 episodes carry delegate-tasks,
  0/355 attributed, 19,660 calls unstamped; Langfuse `specialist_id`
  dead-read fixed). **Seam contract documented** at
  `docs/superpowers/specs/2026-08-03-city-section-seam-contract.md`
  (Startup.md `## City` ≤600 chars whole-heading interpolation;
  `unhoused` boolean on agent-affordances, fail-closed). Suite 3069→3095
  exit 0; act.md diff 0 lines. **Builder's missing verb named: a claim-plot
  MCP tool (D-82-priced) — api-side, lands with 045.**

- 2026-08-03 · **Plan `04-` Task 7 DONE (under D-79/D-88/D-89)** · commit
  `828b2a8` on `plan-04-archetypes-bake` · District **92×92** — derived: the
  smallest square packing the band's TOP (1.4 → 19 housing) plus all six
  civic archetypes at REAL exteriors with 1-tile margin; sizing to the top
  is what lets `scarcityRatio` move in 1.2–1.4 without a map re-size.
  Growth verified non-destructive empirically: buildings/doors/spawns/
  props/glows/night byte-identical, ground/road nonzero masks identical
  over the original 48×46 region (only grass/asphalt flavour + scatter
  re-pick — cityGrid PRNG order is part of its contract, honestly
  declared). **23 plots: 17 housing + 6 civic**, size classes S 6×6 / M
  10×15 / L 18×16 / XL 24×23 derived from declared art;
  `allowedArchetypes` COMPUTED by footprint fit (D-66 stands);
  `scarcity_ratio` 1.3 as config. File shape ruling:
  `venues/district/plots.json`, derived-then-committed because plot ids are
  venue ids and venue ids are append-only (a re-derived layout would
  renumber parcels and silently rehome the town). venues.json **18 → 41**
  (11,391 bytes — api page-1 budget must re-size). Derivation proof re-run
  structural + pinned: all daytime pools UNMOVED, residence list
  append-only 14→37, 0/85 derived homes move (capacity 97 > 85 pre-plots).
  `sceneForLocation` routes any outdoor venue to DistrictScene (pre-empts
  the plot_N black-screen variant of the farm bug). Golden TMJ handled via
  new `known-tmj-diffs.json` (declared reason + `preserves` layers verified
  placement-by-placement — surfaced a PRE-EXISTING villa trim divergence,
  Tier-1-owned). Four fire-proofs restored. Gates all exit 0 except the
  predicted cross-repo venues-copy red (api must sync — not weakened).

- 2026-08-03 · **Adversarial review of the agents delta: deep claims HELD**
  (D-57 pin unbent with every leak path enumerated — `_section_builders`
  has exactly one caller and it is the subagent path; catalog renderers
  consume only catalog_order/name/use_when/goal/limitation, so the new
  bytes move nothing; unhoused_self fail-closed on every garbage path;
  episode `source` back-compatible; EXCLUDED_TOOLS hand-counted 23).
  **Four findings, fix pass dispatched:** QA-L17 would fire forever on the
  355 pre-schema episodes with a misattributed cause (skip no-source
  episodes as `pre_schema`); QA-L17 id collides with the live
  action-diversity spec's reservation (→ QA-L19); no live-run artifact can
  prove the city section rendered — the ZERO_EXPECTED_OUTPUT_SLICE shape —
  (→ spawn log + rendered-sections stamp on the record so (f)'s analyzer
  can segment); seam-contract sentence falsely clears builder instructions
  that promise "claim a plot" with no claim tool (phrase removed until the
  D-82 tool ships; ledgered I-4 cited). **Two owner-line flags carried
  toward round (f): `vote-city-goal` sits on the builder allowlist
  (SP-round inheritance) in tension with D-68's "you cast your own vote";
  and unhoused_self's ~85/85 lottery dilution must be declared in (f)'s
  write-up.**

- 2026-08-03 · **Adversarial review of Task 7 (`828b2a8`): core held, six
  findings, one cross-repo critical.** Held: append-only ordering verified
  structurally (correction: the roster>97 overflow fallback is `plot_23`,
  not `plot_17` — numeric collation; documented nowhere, now logged);
  original-region growth confirmed structural (all cityGrid predicates
  absolute in (x,y)); all 23 rectangles, allowlists and schema conformance
  hand-verified; scene routing correct. Findings → fix passes dispatched:
  **F-6 packer ignored collision-carrying props** (trees/bench inside
  plot_1, the only school-sized parcel) → ONE-TIME re-derivation authorized
  now, before anything references plot ids; api told to HOLD 045 hydration;
  **F-3 camp beds counted as housing api-side** (capacity 97→189, spareBeds
  +92, camp sleepers read housed, housing template self-suppresses,
  arrivals would get camps as housed:true) → semantics split ROOFED vs CAMP
  per D-60/D-64: a tent is visible unhoused-ness, place ≠ condition;
  F-5 M-class sized against art the config doesn't name (7/17 housing
  plots admit no `house`; assertion added: every housing plot admits ≥1
  home-role archetype); F-4 the mask-preservation claim exists nowhere as
  code and the declared-TMJ branch skips tile data forever (→ cell-by-cell
  original-region mask comparison; golden suite's assets-src gate
  re-verified to RUN); F-7 doorAnchor reachability unchecked (plot_23
  anchor 30 tiles from a sidewalk; grown region has no roads); F-8 cityGrid
  road centres hardcoded vs D-88's config-driven promise; F-9 --check has
  no fire-proof + a self-erasing import.meta.url guard. **F-1/F-2 are
  client-stream scope:** the plan-04 branch's client still pins 48×46
  camera/Pathfinder (Stage C's descriptor-driven geometry resolves it at
  merge — must be VERIFIED at 92×92) and the preloader 404s on 23 plot
  tilemaps. Nobody owned F-1 until now — assigned to Stage C Tasks 2–3.

- 2026-08-03 · **Task 7 fix pass DONE** · `067e45d` on
  `plan-04-archetypes-bake` · F-6: `occupancy()` now reads the bake's OWN
  collision layer from district.tmj (structural — the packer can never know
  less than the baker) and refuses a size-mismatched tilemap; plots
  re-derived ONCE (23 moved, 11 resized, ids stable, classes unchanged,
  0 obstacle overlaps asserted); `plots.json` carries an `appendOnlyFrom`
  header recording the last permissible renumbering. F-5: M resized to
  12×15 so `house` fits; two new assertions (every housing plot admits ≥1
  DWELLING read from config tiers; M clears whatever `house` builds). F-4:
  declared-TMJ branch now compares original-region nonzero masks
  cell-by-cell — the vRoad-move mutant now fails with a named 258-cell
  diff; golden suite RUN (3 pass / 1 skip), symlink intact. F-7: packer
  candidates ordered nearest-street-first (mean anchor distance 13 tiles,
  max 51 documented), anchors asserted outside all collision boxes;
  road-extension follow-up named in growth.json. F-8: road centre lines
  derived from params (district.tmj byte-identical — correct by
  construction now, not coincidence). F-9: resolved-path entry guards +
  --check fire-proof (exit 1 on hand-edit, named file). **venues.json
  UNCHANGED (41 @ `4bc3822…`)** — plot geometry is outside the published
  projection, so the api copy stands and **plot ids are FINAL**; api hold
  lifted. All gates exit 0, cross-repo green, tree clean.

- 2026-08-03 · **Agents fix pass DONE** · `growth-builder-delta` @ `d1e4a44`
  (8 commits) · QA check renumbered **QA-L19** (L17/L18 reserved by the
  live action-diversity spec; a reserved-id collision test added and
  fire-proofed with the exact collision nearly shipped); the probe now
  classifies three ways — source-stamped / pre-D-87 (4148 excluded, 355
  delegating) / zero-call indeterminate (1183) — reconciling to the full
  5331-episode pool, `fired=False` on the real pool, 11 fixtures incl. the
  exclusion-is-not-amnesty case; **city-section render proof** landed both
  halves: spawn log (rendered/empty sections + WARNING on configured-but-
  empty) and `episode.subagent_spawns` entries with
  `city_section_present` — recorded BEFORE kickoff so a timeout still
  leaves the proof; the four wrong-heading cases each pin a distinct
  rendered set; the api's acceptance signal is documented (deploy composer,
  one delegating dev wake, read `city_section_present`). "claim a plot"
  removed from builder `system_instructions` (renderers verified unmoved,
  no re-pin; a conditional guard test retires itself when the api ships
  the claim verb). Spec gains "(f)'s write-up must declare": lottery
  dilution (segment by `delegation.fired` before comparing) and the
  `vote-city-goal`-on-builder owner line. Self-caught: a stray `.py.tmp`
  from a staged rename, removed. Gates: heartbeat 3109/11skip, qa 146,
  docs 99, lint 0 errors, catalog+28-schema+D-57 pins 42, all exit 0;
  act.md diff 0 lines across the branch.

- 2026-08-03 · **api final batch DONE** · `9a7edcd` (vocab sync 18→41;
  budget FROZEN at 6730 — growth pages rather than growing the call: page 1
  at 41 venues = 6396 bytes / 17 relevance-ordered venues; D-78 floor
  verified WITH a plot as the caller's home; 0/85 resolved or derived homes
  moved; map-vs-routine disagreements 0) · `dae291d`+`47cf3fe` (migration
  045: hydration is runtime INSERT-if-absent ordered BEFORE the
  founding-goal trigger in the same resolveSeasonIfDue; geometry drift
  REPORTED never rewritten; authoritative geometry = `config/plots.json`
  with a 5-check sync incl. the appendOnlyFrom freeze; **founding goal
  SEATED on dev**: "Raise the first homes", plot_18 6×6, target 62,
  season 1, system-source, idempotent across ticks) · `ae5ce89`
  (plotsService completed; allowedArchetypes enforced at createStructure) ·
  `7125e21` (## City composer + `unhoused` + claim-plot tool, ALL behind
  `BOTVILLE_GROWTH_SURFACES=on` default-off; flag-off proofs: no heading,
  key ABSENT not false, runtime catalog exactly eight; child-process
  fire-proof with flag on) · `64c6a46` (**F-3 semantics: roofed is what
  housing means; camps are where the unhoused are PLACED** — keyed on
  published `archetype:"plot"`, pinned; camp dweller counted unhoused while
  visibly placed; arrival with roofs full lands `housed:false,
  sheltered:true` replacing the no-vacancy refusal; template fires at
  97-roofed/23-camped, silent today). Four measured catches: SMALLINT
  rejected half-tile door anchors (NUMERIC(6,2)); founding goal first
  seated on the XL CIVIC parcel at target 939 — candidates now order by
  housing-fit→smallest→id (ordering, not filter: a civic-only town still
  seats); claim-cost thresholds were degenerate against real parcels (all
  priced 3) — re-keyed to the bake's own S/M/L/XL = 1/2/3/3 with a
  costs-vary test; the 8-tool assertion grepped SOURCE and would have
  reported a flag-gated tool that doesn't exist at runtime — now reads the
  real catalog. Suite **1355/1355 exit 0**; `qa:integrity` **3 ok / 0
  failed / 0 skipped** (unlock- and plot-integrity ran for the first
  time); placement region byte-identical to main (3161 = 3161). Seam
  contract wording amendment owed agents-side: `unhoused` = no live
  ROOFED row (camp dwellers are unhoused — matches D-60 and fires
  unhoused_self for them).

- 2026-08-03 · **Adversarial review of the api final batch: flag mechanics /
  roofed-core / migrations / claim-cost HELD, but the merge is NOT
  byte-frozen and the world-effect layer is dead code. Final fix pass
  dispatched.** CRITICAL: get-city-map serves + pages the 41-venue
  vocabulary unflagged (page 1's id-ordered rank-3 block lets 11 other
  agents' houses displace a reachable public venue); founding-goal seating
  runs unflagged inside resolveSeasonIfDue's seven entry points (first
  read after merge seats a goal + a candidate into every agent's lottery);
  plus mine on top: build/demolition become PROPOSABLE through the live
  tool once the registry syncs, flag notwithstanding. IMPORTANT:
  `growthService` has ZERO production callers — a completed build goal
  produces no structure, no state flip, no dawn appearance (D-71 unwired;
  unlock/plot-integrity are bulbless); `botville_plots.state` has no
  writer (two sources of truth); elected build goals ignore plot size
  (D-73 delivered only for the founding goal — two pricings for one
  kind); `listUnhousedDisplayNames` not converted to roofed semantics
  (beneficiaries never named in exactly the founding state §6.4.3 exists
  for); founding goal dies permanently if its first season ends
  `unfinished` (status-blind probe over-fires); placement's camp branch
  (F-8 fourth branch) still missing — LATENT until any camp assignment
  exists, pinned as a Task 9 tripwire, placement line untouched;
  cityMapPaging comment describes a guard that was removed (self-erasing
  comment). The fix pass's deliverable is the **"what merges with flags
  off" table** — the deploy decision document.

- 2026-08-03 · **api merge-freeze fix pass DONE — the branch is
  deploy-decision-ready** · `ed6b884` (C1: the world/shown split —
  `loadVenues()` is the WORLD (41, camps included: presence/housing/
  schedule writer), `loadPublishedVenues()` is what an agent is SHOWN (18
  flag-off); every reader enumerated and ruled; rank-3 fixed: home-role
  venues rank below every public venue, floor test added — every open
  public venue survives page 1 at 41; `unhousedCount` + `limit`/`offset`
  gated AT THE SCHEMA so the catalog doesn't move) · `c7b2a46` (C2 seating
  flagged, hydration deliberately not — the round's flip becomes a config
  change; C3 CONFIRMED: growth kinds were proposable through the live tool
  flag-off — now refused with a repairable message; both fire-proofed in
  child processes against the real dev DB, both directions) · I1 roofed
  beneficiary names · I2 world-effect layer WIRED (completes →
  under_construction; dawn → structure + built; failures logged, never
  rolling back an election; unlock/plot-integrity get their bulb) · I3
  ruled: the plot row IS the authority (deriving cannot express
  under_construction), every writer sets state+linkage in one transaction,
  plot-integrity checks agreement · I4 one pricing function both
  provenances (D-73 delivered for elected goals) · I5 F-8 camp-placement
  tripwire pinned, line untouched · I6 `unfinished` no longer blocks
  re-seating + **migration 046** partial unique index sharing one clause
  list with the service predicate, pinned · I7 comments/calibration
  honest. Suite **1371/1371 exit 0**. **"What merges with flags off":
  byte-identical to main on every enumerated surface except 15 raw JSON
  bytes — the dorm's deliberate D-60 home/sleep edit, empty-diff-proven,
  pinned in a test AS the named merge delta.** Agent's own lesson,
  logged verbatim: "a test asserting new behaviour is only as good as the
  question of whether that behaviour should be reachable yet."

- 2026-08-03 · **Plan `03-` Tasks 2–3 DONE** · `plan-03-client` @
  `4610e98` (merge `02b29e2`, F-1 `0a1b7ca`, F-2 `c65e5c9`, T2 `e242453`,
  T3 `4610e98`) · Merge: one conflict; the real work was what neither
  branch could see — **a parcel is not a district**: `plotRegistry.ts` +
  `DRAWN_BY_DISTRICT` (farm AND all parcels drawn by the district's map),
  `districts()` = outdoor minus parcels; pre-empted `plot_7`-as-district
  loading a tilemap the bake never wrote. F-1 verified per site — and
  found `cam.centerOn` encoding map-centre=town-centre (one tile off at
  48×46, the far corner at 92×92; now spawn-centroid); geometry-IS-the-
  tilemap assertion added + fire-proofed; car lanes hand-checked
  unchanged, written down. F-2: `withTilemap()` loader, both-direction
  set-equality pin (404s AND orphan maps), deliberately not written as
  "parcels excluded" so a future built-plot interior forces a decision.
  T2: three states render data-driven from plot_states.json (vacant =
  fenced lot + gate + per-agent tents via mirrored `pickFrom` pinned by a
  336-case vector file PRODUCED BY the api's own helper + live-sibling
  comparison; under_construction = distinct hoarding; built = archetype
  exterior from the same file derive-plots reads); fourth-state
  data-change proof; plot state is on NO client wire (measured) — default
  vacant (true), fixture server serves the authoring file. T3: generated
  doors provenance-blind (identical planSync decisions through authored
  vs generated door, in and back out); all 23 anchors reachable from
  spawn (34–121 steps); built parcels drawn-by-district minus. Golden:
  added camera+plots, zero moved, zero deleted; hypotheticals labelled.
  Gates: **385/385**, typecheck, build, test:bake exit 0; venues.json
  byte-unchanged. Named for other streams: plot-state wire shape the
  client accepts; built-plot interiors need a bake pass; road-extension
  now measurable; plot boundaries deliberately non-colliding.

- 2026-08-03 · **Adversarial review of client Tasks 2–3: seams HELD** (merge
  intent preserved incl. farm re-ruling + night behaviour; `districts()`
  membership-keyed; zero phantom campers, leak paths enumerated; `pickFrom`
  mirror character-equivalent; fractional anchors verified on real data;
  door-key collision impossible via the bake's duplicate rejection).
  **Five importants → fix pass dispatched:** plotRegistry's comments name a
  nonexistent test + two nonexistent guards (write the real ones); the
  per-district seam is three hardcoded single-district points — the bake
  never scans `venues/*/plots.json`, so a second district's parcels would
  publish zero venues while every guard passes vacuously; plot props add
  no walkability (deliberate deferral, undocumented, test messages
  oversell); published `plot_states.json` has no equality pin AND a stale
  copy + one wire row is a BOOT CRASH where stated policy says
  drop-and-warn; built-plot clicks dead-end silently on two paths (hand
  cursor promises navigation; HUD click on a housed agent inert). Five
  minors (side-blind door zone, HUD camp label fallback, camp-slot modulo
  stacking, golden state-blind note, boundaryAlternate dead data).
  Reviewer had no shell — gates + golden-diff-across-SHAs + pickFrom
  mutant + sibling-branch execution owed and assigned to the fix pass.

- 2026-08-03 · **Client fix pass DONE — all streams complete** · `5dad79b`
  on `plan-03-client` · Real guards written (6 registry tests incl.
  both-direction completeness + doorAnchor-vs-spawns[0] + three-way
  client/bake/fixture agreement); the bake now WALKS `venues/*` for
  plots.json (output proven byte-identical via temp-dir bake comparison;
  synthetic second district publishes; reverting to the hardcoded path
  reddens 2 tests); no-collision ruling documented with its three reasons;
  published `plot_states.json` equality-pinned + unknown-state now
  skip-and-warn (boot-crash path closed, both fire-proofed);
  `opensASceneFrom` — one predicate for cursor AND click, HUD focus warns
  by name; all five minors incl. side-derived door zones (the fixed size
  stuck into the street on 14 doors), `loc.camp` label ("Camping on a
  vacant lot" — the fallback had labelled all 23 camps "On the street",
  hiding exactly what D-89 exists to show), camp fan-out past 4,
  boundaryAlternate consumed (12/11 split). **Executed verification:**
  403/403 + 25 vitest exit 0, typecheck/build/test:bake exit 0; golden
  chain confirmed key-by-key across all seven commits (zero unexplained
  movement anywhere); walkability re-measured (0 differing cells in the
  48×46 region, 870/870, +2 named); pickFrom mutant correctly attributed
  to the mirror; sibling comparison ran the LIVE branch (0 skips).
  venues.json sha unchanged. api HEAD moved to `f0407f2` mid-run — the
  api agent's own I2/I3 world-effect commit, verified, not a foreign
  writer.

- 2026-08-04 · **DEPLOY AUTHORIZED by the owner** ("you can deploy
  everything, let's proceed to testing and other layers"). **D-90 RULED**
  (recorded, `5efd845`): the vote is the agent's own — `vote-city-goal`
  leaves the builder (labour only: propose/contribute/claim); main agent
  keeps the vote on L1; a civics specialist (deliberates, never votes) is
  accepted in principle as its OWN measured change after (f). Deploy window
  opened: api + BotVille merge running (flag-off verification item by
  item); agents merges after the D-90 strip lands.

- 2026-08-04 · **D-90 strip DONE** · agents `6359d8a` · builder allowlist
  7→6 (`vote-city-goal` out; tools now map/goals/propose/contribute/
  go-to-venue/leave-note); catalog byte-stability MEASURED (both renderer
  shas identical before/after); asymmetric re-pin deliberate — the
  seven-tool `CITY_TOOLS` set survives as "the city surface" so
  `test_reflector_city_route_is_removed` keeps its teeth, builder list
  derived from it (cannot drift); L1 verified unchanged (vote absent from
  EXCLUDED_TOOLS, 28-schema pins pass — the principal casts its own vote);
  seam contract's owner-line paragraph REPLACED with the ruling + the (f)
  comparability declaration (M-070's builder could vote, this one cannot —
  never compare write mixes without declaring it) + explicit "the civics
  specialist does not exist". Gates: 3110 pass/11 skip, tool-exclusion 12,
  qa+docs 245, lint 0 errors, all exit 0. **Branch merge-ready.**

- 2026-08-04 · **DEPLOY STOPPED AT THE MERGE GATE — correctly.** Pre-flight
  passed (flag verified OFF in the live process env via a proven-non-vacuous
  ps check; suites green; migrations 0-pending; pre-merge get-city-map
  captured: 8 tools / 18 venues / 3193 bytes) — but pre-flight step 2
  itself MUTATED THE LIVE WORLD: `growthSurfacesFlag.test.js`'s C2
  fire-proof runs child processes against the real dev DB, DELETEs world
  rows, runs its flag-ON leg LAST, and never cleans up — every `npm test`
  leaves a REAL seated founding goal (observed: `62405a82…`, "Raise the
  first homes", plot_18, 10:05 today), agent-visible via activeGoals
  (pointing at a venue the deployed map doesn't publish), and PRE-EMPTING
  round (f) via the once-ever guard. Post-merge it would also mean `npm
  test` on the live checkout deletes world rows. Fix pass dispatched:
  hygienic fire-proofs (scratch DB preferred), full-branch audit of
  real-pool tests (the bar: after npm test, the world the agents
  experience is byte-identical), verified deletion of the stray goal (only
  if zero contributions/votes reference it), double-run byte-identity
  proof. The "concurrent session" dirtying BotVille main was THIS
  session's own uncommitted log edits — committed as `9123c5a`. Deploy
  re-launches on the fix report.

- 2026-08-04 · **Test-hygiene fix DONE — deploy unblocked** · api `d65d4d3`
  · Fix shape: NO database at all — `childWithFlag.js` pre-seeds
  require.cache with an in-memory pool + points DB_NAME at a nonexistent
  DB before any service loads ("nothing connects, so there is nothing to
  clean up" — survives whatever the next person edits in); the property
  itself asserted (helper must replace the pool; no deletes against module
  tables; no dotenv load). **Audit by blocking hook** (every real
  pool.query THROWS under NODE_OPTIONS): zero category-(c) remaining, two
  read-only leaks of its own found and mocked, one deliberate read-only
  canary documented; the suite passes with ALL real DB access blocked.
  Stray goal `62405a82…` DELETED after verification (contributions 0,
  proposal_id null, completion traces 0). Clean baseline: 23 plots / 85
  live assignments / 0 system build goals / activeGoals carries no build
  goal. **Double-run byte-identity proof**: full snapshot (15 table counts
  + full row contents of goals/plots/assignments) identical
  before/between/after two consecutive full-suite runs. Suite 1372/1372
  exit 0. Agent's own post-mortem logged: the child process "felt like a
  different kind of thing" — it was the same live pool behind execFileSync;
  the blocking audit hook is now the tool for that class. Noted: plot rows'
  created_at continuity restarted today (deleted/recreated by the bad
  test before the fix).

- 2026-08-04 · **DEPLOY WINDOW EXECUTED (api + BotVille).** api main:
  ff to `8480935` (sync tests) then merge `7a1065b`
  (plan-01-plots-housing @ `d65d4d3`), zero conflicts; nodemon restarted
  (pid 58436), /health 200, flag confirmed absent from the restarted
  process env. **Flag-off verification ALL PASS**: 8-tool catalog, 18
  venues (the filter demonstrably working — registry loads 41, emits 18),
  key sets identical, no unhousedCount/moreVenues/unhoused/## City; one
  real tick via natural traffic: 23 plots (fingerprint unchanged), 0
  system build goals. **Byte delta exactly 15** (3193→3208): the dorm's
  home/sleep, as pinned. BotVille main: merges `b6e0e8b` + `7111f7d`,
  zero conflicts; suites re-run with `--force` after catching a turbo
  cache replay masquerading as proof — genuinely green (403/403 + 25;
  bake exit 0 after this session's log edit was committed). Fix
  re-verified by its finder: plots fingerprint md5 identical
  before/after a full suite run — provably not deleted-and-recreated.
- 2026-08-04 · **Emergent D-21 red on merged main FIXED** · api `f2b0b37`
  (live checkout, single surgical commit) · `hydratePlotsFromRegistry`
  takes NO district argument: district set derived structurally from the
  vocabulary (outdoor ∧ not-parcel — deliberately NOT keyed on the
  district archetype name, which is the same hardcode in a different
  hat); attribution ladder (registry attribution wins → sole district
  resolves → ambiguous skips-and-reports); loader carries district
  attribution through the day the bake aggregates `venues/*/plots.json`
  (it does not yet — measured, not assumed). Six regression tests; suite
  **1382/1382 exit 0**; hydration fingerprint identical before/after/
  after-tick; world byte-identity holds. Sharp edge logged: the D-21
  scanner is line-based and does not skip comments — a comment naming a
  venue id reds the suite. **Push to origin blocked by the session's
  permission classifier (twice, self-described transient)** — api main
  is 31 ahead / 0 behind, clean fast-forward; owner can push or add a
  permission rule; NOT load-bearing (the live api runs from this
  checkout).

## SESSION TERMINAL STATE — 2026-08-03

**Halting because nothing unblocked remains** (EXECUTION-PROMPT §3: that is
the correct terminal state, not a failure). Everything the six owner calls
do not gate is implemented, adversarially reviewed (Opus), hardened, and
green on its branch:

- **Stage A COMPLETE** — `plan-04-archetypes-bake` @ `a3d0214` (Tasks 1–6,
  8 + B′ role commit + review hardenings). Task 7 blocked on **O-1**.
- **Stage B COMPLETE** (unblocked scope) — `plan-01-plots-housing` @
  `53d4ff1` (migrations 042+043 applied to dev DB; Tasks 1–8 minus
  `botville_plots` (O-1) and the revocation path (O-4); Task 9 round-gated).
- **Stage B′ COMPLETE** — the F-7 ordering held end-to-end.
- **Stage C Task 1 COMPLETE** — `plan-03-client` @ `ac3f9da`. Tasks 2–3
  blocked on **O-1**; Task 5 waits on Plan `01-` deploy.
- **Gate 0 satisfied** (M-060); **F-6 re-diagnosed** (base-rate, no
  mechanism); facts start at **M-071**; migrations at **044**.
- **All of Stage D (rounds f/g/h) remains blocked** on O-2/O-3/O-5 — though
  the world has partially pre-empted it: the builder exists and converts
  (M-070), and O-2's option-(b) shape + O-5's copy-gap fix are already live
  and measured. The remaining Plan `02-` delta: `city` context section
  (O-3), `unhoused_self` trigger (needs O-1's plots + our 042 unhoused
  signal), round protocol per INDEX.
- **Nothing merged to any main; nothing deployed.** Merge order and staging
  env vars pinned in `ROUND-RUNBOOK.md`. The owner rules O-1..O-6 (as
  D-79+), then: `04-` T7 + `03-` T2/T3 (O-1), `01-` T2 revocation (O-4),
  merges in a deploy window, then Stage D's rounds.

## PARKED — OWNER CALLS — **ALL RULED 2026-08-03 as D-79..D-84** (plus
## D-85..D-87 for the round re-specifications and episode schema).
## See `DECISIONS.md` § *Owner rulings D-79..D-87*. The entries below are
## retained as the evidence record the rulings were made against.

- 2026-08-03 · **RULINGS RECEIVED, in-session:** D-79 (O-1: plots
  predetermined from map geometry, physics-derived viable building types,
  plot IS the venue, tent = plot state), D-80 (O-2: stays L1 + builder,
  second D-29 exception), D-81 (O-3: md-gen city section + builder craft in
  the builder's contract), D-82 (O-4: accept-and-declare AND claiming gains
  an effort-denominated platform cost scaled by claim size — amends D-73),
  D-83 (O-5: satisfied by measurement, M-060), D-84 (O-6: migration 044
  flips the 038/039 cascades to SET NULL), D-85 (round (f) re-scoped to the
  write-layer last-inch round carrying the Plan 02 delta, judged vs M-070),
  D-86 (round (g) judged as delta vs the M-060 world; zero = regression),
  D-87 (episode-schema subagent attribution lands before the next measured
  round). **Newly unblocked: `04-` T7, migrations 044+045, `01-` T2
  revocation + claim cost, `03-` T2/T3, the Plan `02-` delta.**

- **O-1 — How does a plot become a venue?** Blocks `04-` T7, `01-` T1, `03-`
  T2/T3. Options: (a) pre-stamp 50–125 (plot × archetype) venue entries;
  (b) decouple venue identity from archetype (`plot_7` is the venue id, baked
  once; archetype selects interior TMJ + exterior sprite; I-8 re-stated as
  "every *asset* is baked first"); (c) `allowedArchetypes` per plot at
  authoring — which silently repeals D-66. **Recommendation: (b)** — the
  review's own recommendation (§V): state-dependence is a cost the design
  already has (a vacant plot that becomes a school must change what it
  affords); (a) pays that cost by multiplying vocabulary entries 3–7× against
  the artifact D-78 exists to cap; (c) repeals a ruled decision.
- **O-2 — Does `contribute-to-city-goal` leave L1?** Blocks `02-` T1 / round
  (f). (a) leave: 28→27 schemas + PCO re-baseline mid-drive, M-054 superseded;
  (b) stay L1 AND sit on the builder's `tools:` list — second recorded D-29
  exception, same shape as the reflector's `get-city-map`/`get-city-goals`
  exception. **Recommendation: (b)** — no PCO re-baseline mid-drive, existing
  precedent; record the exception explicitly.
- **O-3 — May the compiler acquire a `city` section?** Blocks `02-` T1 / round
  (f). (a) retire the D-57 fabrication pin for the subagent-backstory path
  only; (b) route the city section through md-gen like Placement/Praise —
  api composes, compiler admits verbatim, pin never bends; (c) pass as
  `manager_context` at spawn (weakest ToM guarantee, shippable today).
  **Recommendation: (b)** — zero architectural debt, uses D-57's already-ruled
  seam; cost is one api surface.
- **O-4 — Non-civic backstop for claim hoarding?** Blocks `01-` T2 revocation
  path. Options, none free: per-agent soft cap (partially repeals D-73);
  expiring claims (forbidden by D-31/D-32); accept and declare a known
  confound in every round write-up. **Recommendation: accept + declare** —
  the other two bend ruled invariants; hoarding-with-tents-on-it is itself
  the condition D-73's politics argument needs, and the confound is honest
  while civic action measures 1/285 [M-058].
- **O-5 — Close the vote-rung copy gap before round (g)?** Blocks round (g).
  **Recommendation: yes, close it first** (commit `2b85919` holds the gap and
  a fix shape) — otherwise a zero in (g) is attributable to the copy gap and
  the round cannot test D-63's hypothesis; the drive's one conversion failed
  at the verb, not the motivation [M-058].
- **O-6 — Deliver D-72 or downgrade it?** Blocks `01-` T1's rollback claim.
  (a) non-additive migration: `ALTER` the 038/039 FKs
  (`botville_goal_contributions.user_id`, `botville_goal_proposals.proposer_id`,
  `botville_proposal_votes.voter_id`) to `ON DELETE SET NULL`; (b) downgrade
  D-72 to documented intent until a departure mechanic ships.
  **Recommendation: (a)** — no code path deletes users today, so the change is
  safe now and the town's history (and D-67's demolition difficulty, which
  derives from those rows) stops being deletable by a dev-roster reset; ship
  it as its own migration so 041 itself stays additive.

## ROTTED ANCHORS FOUND DURING EXECUTION

- 2026-08-03 · **"Migrations start at 041" (INDEX §Numbering, DECISIONS, all
  of Plan `01-`) — ROTTED.** api `main` now holds
  `src/db/migrations/041_add_botville_venue_visits.js` (awareness program).
  This drive's migration is **042**; every plan reference to "migration 041"
  reads as 042, semantics unchanged.
- 2026-08-03 · **"Facts start at M-060" (INDEX §Numbering, EXECUTION-PROMPT
  §2) — ROTTED.** M-060..M-070 registered by the awareness program
  (2026-08-01..03). Next free id is **M-071**.
- 2026-08-03 · **Gate 0's premise ("no analyzer write-up, no registered
  fact") — ROTTED in the satisfying direction.** See Gate 0 entry above.
- 2026-08-03 · **Plan `04-` anchor `residences.mjs:21-28`
  (`deriveResidenceCount`) — ROTTED (minor).** Pre-change actual `:19-25`
  (`RESIDENCE_OCCUPANCY_TARGET_AGENTS = 7` at `:16`); post-Task-1 refactor
  `:22-28`. Task 7's floor calculation cites the same lines — same
  correction applies. Line drift only; task shape unchanged.
- 2026-08-03 · **Plan `04-` art anchors — ROTTED (Tasks 2/4):**
  `Mobile_House_*` lives under `Modern_Exteriors_Complete_Singles_16x16`,
  not `11_Camping_Singles_16x16`; `4_Generic_Building` has no whole-building
  `Condo_1..9` (1–5, 7 are modular kits — declared 6, 8, 9 + Condo_7 tower).
- 2026-08-03 · **Plan `01-` anchor `deriveWorkplaceVenue` at
  `scheduleCoverage.js:238` — ROTTED**, actual `:256`. Only Plan `01-` drift
  found; all other cited anchors verified intact.
- 2026-08-03 · **`farm` filter sites: FOUR, not three** — plan/review
  anchored `DistrictScene.ts:417/:434/:449`; a fourth live site at
  `navigation.ts:31` was caught by the new location-string sync check.

- 2026-08-04 · **AGENTS MERGE DONE — deploy window fully closed** · agents
  main `c522d00` (merge, zero conflicts, 24 files +1522/−20) + `e2e4c28`
  (seam-contract position claim corrected against shipped code — Schedule
  leads, City lands before What's New; non-normative but a live spec must
  not carry a false claim). Suite on merged main 3114/7skip exit 0 (count
  delta from worktree CHASED not accepted: four corpus-dependent tests now
  RUN on the live checkout — more coverage, zero failures); catalog/28-
  schema/D-57 pins 43; discover_catalog 5 specialists, builder = the six
  D-90 tools; `git diff cfb23e1..HEAD -- configs/prompts/` ENTIRELY empty.
  Fail-closed verified as a labelled REPRODUCTION (the api-side flag-off
  code paths) + an empirical leg: 400/400 recent compiled prompts carry no
  City heading, 0 subagent_spawns (nothing woke since merge — honest
  state). Tenth commit on the branch identified as the orchestrator's own
  seam amendment `8df5783`, inspected before merging. Agents main 12
  ahead of origin, UNPUSHED (conservative — correct; push is the owner's
  or an explicit instruction). api "no node process" in that report was a
  FALSE NEGATIVE — verified from the orchestrator: nodemon 67875 + child
  64677 up, /health 200.
- 2026-08-04 · **ROUND (f) WINDOW OPENED** — runner dispatched: flag flip
  (the one change) → post-flip verification incl. the founding goal
  seating for real → five-assertion probe (discover_catalog=5 w/ builder;
  builder ≥1 attributed real MCP call; composed-request byte capture;
  city_section_present=true; claim-plot mechanical probe with cleaned-up
  writes) → 85-wake round → analyzer write-up (write-layer success vs
  M-070's 5/21; segmented by city_section_present; the seam contract's two
  declarations + unhoused_self 0/85 expected — all 85 agents are ROOFED,
  D-64's tent image applies to a fresh town) → M-071. Flag stays ON after
  the round: the growth world is now the world.

- 2026-08-04 · **ROUND (f) HALTED AT THE PROBE — the round did not start.**
  Flag flipped and LEFT ON (`BOTVILLE_GROWTH_SURFACES=on` in the live api
  `.env`, nodemon restarted 11:03Z, api main `f2b0b37`); agents main
  `e2e4c28` untouched. **Step A all five PASS**: catalog 8→9 with
  `claim-plot`; get-city-map 18 venues/3425 B → 41 paged 17+18+6 with
  `moreVenues` and every open public venue + the caller's home/workplace on
  page 1; `## City` at `## ` depth between Goal Recency and What's New, 120
  chars of 600; `unhoused: false` for a roofed caller; founding goal SEATED
  (`7774593b…`, build/system, plot_18, target 62 from
  `{floor:10, active_pop:85, area_tiles:36, coefficient:0.02}`, 11:05:25Z).
  **Probe assertions 1/3/5 pass, 4 passes out of band, 2 FAILS.**
  ⛔ **BLOCKER — the flip closed the civic vacuum.** `SEATS_PER_SEASON`=3
  and `vacancy.seatedCount` counts every active goal in the season
  (`botvilleAffordancesController.js:160`), so the founding goal took the
  third and last season-1 seat (2→3). `_pred_city_propose` needs
  `seated_count < seats ∨ pool_empty`; the pool holds 5 live proposals, so
  both disjuncts are false town-wide. MEASURED, dev-85, all 85 agents
  polled 11:17Z through the shipped predicates against their own live
  affordances payloads: **`city_propose` fires 0/85, `unhoused_self` fires
  0/85** — both builder triggers dark, so no wake can produce a builder
  delegation and D-85's write-layer question would be measured on n=0.
  Confirmed on 2/2 real probe wakes (ben_carter, sara_kim), ledger
  `{"fired":["own_thread_activity"],"won":"own_thread_activity",
  "chosen":false}`. Same caller's captured bytes either side of the flip:
  pre `seated_count=2` → fires True, post `seated_count=3` → fires False.
  Not transient (season 1 runs to 08-10) and **not undone by reverting the
  flag** — seating is flag-gated (`seasonService.js:622`) but the seated
  row and `activeGoals`/`seatedCount` are not, and
  `uniq_botville_founding_goal` makes the seating once-ever.
  `unhoused_self` at 0/85 was expected and declared (85/85 ROOFED); it
  therefore diluted nothing, so the seam contract's lottery-dilution
  declaration does not apply to this round.
  ⚠ **Second finding — the claim verb landed on L1, not on the builder.**
  `claim-plot` is in no agents-side allowlist: absent from
  `configs/subagents/builder.yaml` `tools:` (6 entries) AND absent from
  `EXCLUDED_TOOLS` (23) — so the principal got it. Main ACT surface grew
  27→28 MCP schemas (28→29 with `delegate-tasks`), measured against
  M-070's probe log. Inverts D-90 / the seam contract's declaration 2 and
  moves M-054's baseline without a measured round (C8).
  Probe artifacts + full result:
  `aisocialnetwork-agents/output/probes/round_f/` (see
  `round_f_PROBE-RESULT.txt`). `claim-plot` proved mechanically sound
  (claim row + `-3 plot-claim` effort-ledger row + plot state) and its
  writes were CLEANED UP and re-verified; the two probe wakes' own writes
  (1 rest, 1 create-post) are declared, not cleanable. D-87 attribution
  confirmed live (`ToolCallRecord.source` populated). No round ran, no
  analyzer write-up, **M-071 not registered — still the next free id.**
  **Owner call:** reopen the vacuum (raise seats / exclude system founding
  goals from `seatedCount` / delete the founding goal as the 08-04 stray
  incident did), and rule where `claim-plot` belongs — then (f) restarts.

- 2026-08-04 · **Round (f) unblock pair DONE, both pushed.** api `8725ed5`
  (D-91: seatedCount excludes source='system' AND proposal_id IS NULL —
  provenance-correct: an ELECTED system-Radiant goal still takes a seat;
  the enabler fixed too — listActiveGoals never projected source/
  proposal_id, same dead-projection class as C1; runElection checked,
  unchanged, PINNED against a future goals-table read; live sweep:
  vacancy 2/3, city_propose eligible 12/12 with the honest caveat that
  eligibility ≠ lottery selection; suite 1391/1391) · agents `996764a`
  (claim-plot → EXCLUDED_TOOLS L2 beside propose-city-goal + builder
  tools 6→7; ROOT CAUSE: the tool was unfilterable AND unobservable via
  ONE omission — the bridge filters by exclusion and the pin tests build
  universes from the same constants; `GROWTH_TOOLS` list added with the
  failure mode documented; the self-retiring guard FIRED as designed and
  was replaced by a bidirectional pairing pin; L1 verified = 28 against
  the api's own 51 registrations, not our constants; **M-071 REGISTERED**
  superseding M-054's split arm per QA-L08's own protocol — silently
  bumping the literal would be C8's wrong-number loop). **Round (f)'s
  fact is therefore M-072.** api posture-dependent tests (9 red with the
  live flag on — env inheritance via dotenv) being fixed as its own
  commit: the suite must pass in BOTH postures.

- 2026-08-04 · **Deploy-topology note (flagged, not actioned):** no
  cronWorker process runs — D-30's courtesy tick is dark; season
  resolution currently reaches the world only through read paths
  (get-city-goals / castVote / affordances). Harmless during rounds
  (idempotent + plenty of reads); between rounds a quiet town resolves no
  boundaries until someone reads. Also verified for round (f): the
  require-order confound is ABSENT (cronWorker.js:12 loads dotenv first,
  and the process isn't running) — the round's civic numbers are clean of
  it. The dotenv-by-construction production fix is approved and QUEUED
  behind M-072 (no live-checkout edits mid-round).

- 2026-08-04 · **ROUND (f) PROBE PASSED (all five), ROUND RUNNING** ·
  Blockers re-verified independently: D-91 live (vacancy 2/3;
  city_propose eligible **80/85**, the 5 ineligible being exactly the
  live-proposal holders — the predicate working as designed); claim-plot
  re-tiered (builder 7 tools, L1 measured 28 = M-054 shape); M-071 taken →
  registering **M-072**. Probe: builder delegation LANDED on attempt 2/12
  (attempt 1 the honest negative — fired, won, not chosen: stochastic
  selection, not a broken path); **four subagent:builder-attributed MCP
  calls** (propose fail, fail, get-city-map ok, **propose SUCCESS — the
  first build-kind proposal ever accepted**); `city_section_present:
  true` on a real spawn (backstory 4057, sections_empty=[]); claim-plot
  probe clean (plot_2, cost 3, ledger row). Probe contamination handled
  incl. the subtle catch: the probe's live proposal would have silently
  removed ben_carter's own eligibility — deleted after zero-reference
  verification, baseline re-verified identical. Four probe wakes on the
  exclusion list. **run_20260804_081750** started 12:17:50Z, ~169 min
  expected, monitor armed, no live-checkout edits during. Noted: api tree
  carries 5 modified test files + 2 untracked from another session
  (tests only; server unaffected) — verify provenance before the next
  api commit.

- 2026-08-04 · **ROUND (f) COMPLETE — M-072 REGISTERED** · agents main
  `d045e1d` (write-up + fact + generated block, docs-only) ·
  `run_20260804_081750`, 85/85 own-log-window, wall 173m25s, 85/85
  committed (83 PASS / 2 DEGRADED, both `extraction_failed` with the
  commit landed, neither a builder wake). **Headline: the builder's
  `propose-city-goal` converts 7/17 (41%) across 10 builder wakes / 11
  spawns, against M-070's 5/21 (24%) from 7** — 7/7 joining proposals
  created inside the round's own window, which holds exactly 7. Per
  delegation the last inch is 7/10 vs M-070's 5/9.
  **The residual failure is fully explained and is NOT a write-path
  defect:** all 10 failures are an invented `kind` outside the closed
  vocabulary (6/10 — `incentive`, `infrastructure`×2, `research`,
  `simplify`, `experiment`, `proposal`) or a `rationale` over the
  280-char schema cap (4/10). Both refuse legibly and the builder
  recovered **within the same wake in 5 of the 6** vocabulary misses.
  Nothing in the builder's context states the vocabulary or the cap —
  a contract gap, and the highest-leverage fix this round found.
  **The headline the round did NOT get:** `contribute-to-city-goal` 0
  calls and `claim-plot` 0 calls by anyone, despite claim-plot sitting
  on the builder's allowlist in 11/11 spawns; the founding goal ended
  **0 of 62 points from 0 authors** in the first round it was ever
  visible; plots 23/23 vacant, structures 0. (f) optimised the cheapest
  civic verb and left the growth engine's own verbs untouched.
  Funnel: `city_propose` fired 80/85 → won 58/80 → chosen 8/58 (M-070:
  85/85 → 59/85 → 9/59; offer→choice did NOT move). 8/8 chosen rows
  routed to the builder, **plus 2 wakes (`Archivist`,
  `the_skeptical_optimist`) that delegated to the builder with
  `chosen: false` — the first measured unprompted builder delegations.**
  DB receipts in-window: 7 proposals (**charter 3, build 2** — 5/7 growth
  kinds the flag unlocked, the town's first — gathering 1, restore 1),
  1 vote (the principal's own, by construction under D-90), 0
  contributions / 0 claims / 0 effort rows.
  `delegate-tasks` succeeded 20/20 while `the_auditor`'s builder made
  **zero** MCP calls and its principal committed *"The proposal has been
  posted."* — M-070's outer/inner mismatch now visibly entering agent
  belief (C8).
  **D-87 delivered:** 63/63 specialist calls carry `source` in the saved
  record (M-070: 0/61). Delegation covered 3/5 roles.
  **Declarations carried:** `unhoused_self` 0/85 (predicted by a
  pre-round 85/85 sweep — all roofed; it entered zero draws so **no
  lottery dilution occurred**, and the seam contract's dilution
  declaration does not apply); builder cannot vote (D-90) so write
  *mixes* are not comparable to M-070; `city_section_present` **true in
  11/11 spawns with no absent arm**, so that segmentation proves arrival
  and supports NO effect claim; **D-91 + the claim-plot L2 re-tier landed
  inside the round's own window**, so nothing is attributable to the flag
  alone. Four probe wakes excluded, their DB writes reverted and
  re-verified before the round.
  **Process failures logged, both self-caught:** (1) the first analyzer
  pass double-counted `jamie_liu`'s two-spawn wake and read 8/20 (40%) —
  fixed to per-episode attribution with an assertion pinning the tally
  against the independent `source` count (32==32); the corrected figure
  is 7/17. (2) **The completion monitor failed silently — the round
  finished 11:11:15 EDT and was noticed ~6h late by external check.** The
  loop worked and wrote its terminal line at 11:11:20; *delivery* failed
  — progress events had been re-invoking the session, and the terminal
  event had nothing left to wake, so idle read as running. Next round:
  poll `summary.txt` for `Pass rate:` every turn; never treat absence of
  a completion event as evidence of progress.
  **Flag stays ON.** Next free fact id: **M-073**.

- 2026-08-04 · **dotenv-by-construction DONE — the drive's queued work is
  complete** · api `fa18d04` pushed · `src/config/env.js` owns env loading;
  cached-env modules require the seam (civicConfig, presenceService,
  mcpRateLimit fixed; workers/scripts exempt-by-ownership; per-call gates
  safe); bare-require proof (child with no prior dotenv reads .env);
  ELEVEN entry points verified identical posture by replaying each require
  prefix; precedence (real env beats .env) asserted separately. The fix
  exposed FIVE more require-order-luck tests — all now construct their
  posture in a child and assert both sides; one had been asserting the
  D-78 bug as correct (`hasPlots` on page 1 — camps paging rather than
  displacing public venues IS the design; corrected). Standing guard:
  cached-at-load without the seam fails, fire-proofed against per-call
  false positives. Both postures 1403/1403 exit 0; world byte-identity
  holds. **The "unknown session" files were the agent's own stale
  snapshot — nothing foreign, tree clean.** Two self-corrections logged
  (the env test measuring the runner instead of the file; a commit-message
  typo caught pre-push).

- 2026-08-04 · **BASELINE ROUND (f2) AUTHORIZED AND LAUNCHED** — zero
  changes, the R0-a/R0-b same-code envelope pattern (M-062 precedent):
  a second sample of (f)'s world so M-072 gains a variance envelope
  before the last-inch intervention is judged against it. Same-code
  verification required (post-(f) commits are tests + env-seam only —
  runner must confirm no runtime path moved); live-world delta declared
  ((f)'s 7 proposals + 1 vote are part of the world now); probe is
  re-verification only; monitor lesson applied (poll summary.txt, silence
  is UNKNOWN). Expected fact: M-073.
