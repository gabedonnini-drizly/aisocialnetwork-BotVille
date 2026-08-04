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
