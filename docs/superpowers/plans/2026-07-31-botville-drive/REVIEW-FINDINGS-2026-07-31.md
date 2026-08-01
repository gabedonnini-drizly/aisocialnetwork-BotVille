# REVIEW FINDINGS — adversarial review of the BotVille Drive plan set (2026-07-31)

**Reviewer session:** fresh session, 2026-07-31, per `REVIEW-PROMPT.md`.
**Evidence discipline:** every finding below states what was opened or run,
in-sentence. Verification tools actually executed this session:
`run_checks.py --paths` over Plan 02's eight named files (report captured;
QA-L08 confirms `EXCLUDED_TOOLS` = 22 = 7 L3 + 15 L2 at the working tree),
`blast_radius.py` over the same files, `pytest tests/heartbeat/` (**2857
passed, 7 skipped**, working tree `80ea342`), api `npm test` (exit 0),
`lint_docs.py` (0 errors, 472 warnings), `verify_normalization.py` (6/6
PASS). Three parallel anchor sweeps opened every cited file in
`aisocialnetwork-agents`, `aisocialnetwork-api`,
`aisocialnetwork-frontend`, `aisocialnetwork-BotVille`; each claim below
carries its own `file:line`.

**Verdict (one paragraph, details in §V):** the plan set is executable
**as amended** — the civic algebra, round-gating, and behavioral-method
scaffolding are sound, and no finding invalidates a D-30..D-52 ruling.
But it contained the predicted class of errors: two wrong file paths that
would have failed on first edit, one auth-middleware conflation, one
verifiably false consumption pin, one cross-plan contradiction
(praise in/out of `pendingNudges`), an unpinned vote-stamp semantics that
breaks D-30's determinism claim, an unbounded agent-facing payload, and a
Radiant dedup guard that is unimplementable against the 039 schema as
written. All ≤MUST-FIX findings are landed as amendments (marked
`⚠ AMENDED (review 2026-07-31)` in the plan files), and the four owner
calls were asked and RULED same-session as **D-53..D-56** (§IV,
DECISIONS.md). **Start tomorrow with Plan 02 Task 0 (the baseline
write-up gate) in parallel with Plan 01 Task 1** — Task 0 blocks every
agent-facing change and needs no code.

Severity: **BLOCKER** (execution would fail/corrupt) · **MUST-FIX**
(wrong before execution; amendment landed) · **SHOULD** (fix during
execution; noted in plan) · **NOTE** (recorded, no plan change).

---

## §0. Seeded findings F-1..F-5 — resolutions

| id | resolution |
|---|---|
| F-1 | **Fixed.** `CONTEXT.md` Goal Proposal entry amended to `system or agent` with a D-41 pointer. Evidence: `CONTEXT.md:34-35` (before edit) contradicted `DECISIONS.md` D-41. |
| F-2 | **Fixed.** Kickoff §3-resolution banner extended to name §2.9's praise clause as amended by D-50 (no disposition variable). Evidence: `00-KICKOFF-PROMPT.md:118-119` said "signed feedback into disposition". |
| F-3 | **Open — needs D-53.** Plan 02 Task 6's `CityStatePort`-sourced placement honors delivery-not-transport; literal md-gen transport would violate addendum II.1 rule 3. Drafted ruling in §IV; owner must ratify. |
| F-4 | **Resolved by measurement — and the plan's pin was FALSE.** Reads are non-destructive: `mdGenController.js:467-468` comments "Nudges are only consumed by the explicit POST /nudges/ack"; `GET /api/nudges` (`startupController.js:39`) and MCP `get-nudges` (`mcp-server.js:2413-2446`) all call the SELECT-only `startupService.getNudges`. The only consumers are `POST /api/nudges/ack` → `startupService.ackNudges` (`startupService.js:113-119`) and the commit transaction's `exposureAckService.syncNudgeConsumed` (`exposureAckService.js:143-146`) on `engaged|deferred` acks — **the ack row IS the consumption record.** Plan 02 Task 8's "praise is marked consumed by the existing GET /api/nudges consumption flow" named a flow that does not exist. Amended (finding A2-10); mechanism choice queued as D-55. Stale doc: `routes.js:209` still claims the GET marks consumed — fix folded into Plan 01 Task 8. |
| F-5 | **Pinned.** `src/db/migrations/023_add_agent_runs.js:10-21` creates `agent_runs` with `user_id UUID NOT NULL` and indexed `created_at TIMESTAMP DEFAULT NOW()`; `started_at` is NULLable (pending rows) — use `created_at`. Amended into Plan 01 Task 3. Care note: `agent_runs` timestamps are naked `TIMESTAMP` while all `botville_*` tables use `TIMESTAMPTZ` — the trailing-7d window must compare consistently. |

## §I. Sweep A — anchor verification

Verified correct (no action): `EXCLUDED_TOOLS` 22 = 7 L3 + 15 L2
(`unified_runner.py:211-263`, single flat list, comment-delimited);
`_own_intention` at `candidate_builder.py:401` and `_delegation_candidate`
at `:698` (both exact); `MAX_SUBSTANTIVE = 5` at `:67`; shuffle+post-shuffle
slugs `:851-865`; `ACK_KINDS` at `exposure.py:25` (4 kinds);
`CANDIDATE_CATEGORIES` with `concern_step`/`derived_want` adjacent
(`decision.py:29-38` — a **tuple**, not a list); `effortService.js:17-18`
budget 3 / cost 1, derived; `cronWorker.js:23-54` TASKS = `{name,
schedule, run}` array; `users_nudges` in
`021_add_soul_startup_tables.js:86-96` (with a `consumed` boolean);
migrations 039/040 free (highest is 038); `botville_city_goals` has none
of the six ALTER columns (no conflict); `VenueSwitcher.tsx` venues array
(2 entries, sole importer `TopHeader/index.tsx:5`); frontend has **no
test runner** (Plan 03's assumption verified); `PRESENCE_MODE` at
`packages/client/src/lib/api.ts:146-156`; `_SCREEN_EXCLUDED_TOOLS` frozen
at `scripts/eval_screen/run_screen.py:66-73` (13 entries, deliberately
divergent); `run_20260731_084950` exists under `output/batch_test/`;
M-052..M-058 free (facts.yaml tail is M-051).

Misses (every one amended):

| id | sev | finding | evidence |
|---|---|---|---|
| A-1 | MUST-FIX | Plan 02 names `heartbeat/core/orchestration/exposure_log.py`; the file is `heartbeat/infra/adapters/crew/exposure_log.py` (extractors :354-389, registered :404-406). A core-path edit would also read as a C1 violation. | `find` over the repo: exactly one `exposure_log.py`, under infra |
| A-2 | MUST-FIX | Plan 02 Task 1 mislocates first-firing-wins: the winner-take-all loop is INSIDE `_delegation_candidate` (`candidate_builder.py:703-711`); `heartbeat.py:558-563` only builds+orders the trigger list. "The builder's consumer keeps its signature" is the wrong model — the lottery replaces that loop's selection rule. | both files opened |
| A-3 | MUST-FIX | Plan 01 Tasks 7/9 say "Modify: src/routes/routes.js" — `routes.js` has zero botville references BY DESIGN and the CI boundary test sweeps every non-allowlisted file for the `botville_` marker. BotVille public routes live in `src/routes/botvillePublicRoutes.js` (mounted `app.js:115`); a new controller must join boundary rule-3's allowlist (`tests/botville/boundary.test.js:50-56`). | boundary.test.js:43-56 opened |
| A-4 | MUST-FIX | Plan 01 Task 8's `authenticate` middleware is agent-API-key auth with NO ownership concept (`middleware/auth.js:7-43`). Owner flows use `authenticateOwner` (`middleware/ownerAuth.js`, Bearer `ownerId:sessionToken` or X-API-Key) + a controller-level `owner_id = $N` check (`ownerAgentsController.js:333-334`). | both middlewares opened |
| A-5 | MUST-FIX | `storeToolRationale` is a private function inside `src/mcp/mcp-server.js:125`, not exported; the six BotVille tools ignore their `rationale` arg entirely. Task 9's "wire it" needs an extraction step first. | grep: zero hits in botville-mcp-server.js |
| A-6 | MUST-FIX | Plan 03 Task 1: `NEXT_PUBLIC_API_BASE` has zero hits in the frontend; the var is `NEXT_PUBLIC_API_URL` (`.env.local:1`, 14 use sites). And there are no proxy routes and no cookie-authed writes — the house write pattern is a direct fetch with `Authorization: Bearer ${sessionToken}` (`edit/page.tsx:84-91`). | grep + file opened |
| A-7 | MUST-FIX | Plan 01 Task 2's BotVille-side sync test `test/civicRegistrySync.test.js` would NEVER RUN: the root test glob matches only `test/*.test.mjs` and `test/*.test.ts` (root `package.json`). House name: `test/civic-registry-sync.test.mjs`. The api-side pattern anchor is `tests/venueVocabularySync.test.js`, and the BotVille-side precedent is `test/vocabulary-sync.test.mjs`. | package.json test script opened |
| A-8 | SHOULD | `heartbeat/infra/adapters/http/` does not exist; the three existing HTTP adapters are flat `*_client.py` modules at `adapters/` root. Convention: `heartbeat/infra/adapters/city_state_client.py`. `CityStatePort` would be the 6th port in `core/ports/` — fine, but wire it in `app/bootstrap.py` constructor-kwarg style (`:479-490`), there is no DI container. | adapters/ listing |
| A-9 | SHOULD | `configs/defaults.yaml` stale comment is at lines **31-32** (dangling ref to a deleted `"L2: BotVille"` section), not 29-32; lines 29-30 are current auth documentation and must not be touched. | file opened |
| A-10 | SHOULD | Plan 03 Task 3's camera anchor: the follow seam is `packages/client/src/game/navigation.ts` (`agent:goto` → `agent:focus` / `pendingFocusId` + `consumePendingFocus`) with pans in `DistrictScene.ts:180-186` and `InteriorScene.ts:174-179`; `useGameSync.ts` has no camera code. | files opened |
| A-11 | NOTE | Plans and kickoff cite **[M-037], which is RETRACTED** in facts.yaml (`:555-570`; its numbers are coincidentally true again post-M-051). The live citation is **M-051** (itself `derived`, not measured — it has an anchor, no corpus). | facts.yaml opened |
| A-12 | MUST-FIX | Kickoff §0 and INDEX Gate 0 assert `run_20260731_084950` is "the captured 27-schema baseline"; facts.yaml M-051 says "**no re-baselining round has been captured yet**" and zero facts cite the run. Both cannot stand. Task 0 amended: registering M-052 must also revise M-051's stale rider in the same commit. | facts.yaml:817-839 vs INDEX |

## §II. Sweeps B+C — decision fidelity, concurrency, algebra

| id | sev | finding | evidence |
|---|---|---|---|
| BC-1 | **BLOCKER** | **Vote season-stamp semantics are unpinned and break D-30's "deterministic, replayable" election.** Spec §II stamps proposals with the season they compete FOR (E+1) but votes "at write" (= `deriveSeasonId(now)` = E per Plan 01 Task 4). The resolver spec (§I.2) counts "E+1's Proposals to quorum" without saying WHICH votes count. Because resolution is lazy, votes can land on still-`live` E+1 proposals AFTER the boundary; if the resolver counts all votes on the proposal, the election result depends on when resolution happens to run — non-replayable. Amended pin: resolver counts only votes with `vote.season_id == proposal.season_id - 1`; `castVote` calls `resolveSeasonIfDue` first (post-resolution the proposal is no longer `live`, so the window closes cleanly); test added for the boundary-straddling vote. | spec §I.2/§II + Plan 01 Tasks 3/4 |
| BC-2 | MUST-FIX | **Multi-boundary catch-up unspecified.** Spec §I.2 step 1 detects "a row for every boundary < expected" but step 2 resolves ONE boundary. After ≥2 quiet weeks (dev idles), the resolver must iterate missing boundaries oldest-first, one idempotent transaction each (skipped seasons resolve goalless — legitimate under D-31). Amended into Plan 01 Task 3. | spec §I.2 |
| BC-3 | MUST-FIX | **Isolation level / blocking behavior never named.** Under default READ COMMITTED the design is correct: the loser's `INSERT … ON CONFLICT DO NOTHING` blocks on the winner's in-flight speculative insertion until commit/abort, then its post-conflict reads (new snapshot per statement) see the committed election; under REPEATABLE READ the loser could read pre-commit state. Amended: pin READ COMMITTED explicitly in Task 3, with the two-concurrent-callers test asserting the loser observes the winner's committed row. | D-30, Plan 01 Task 3 |
| BC-4 | MUST-FIX | **The Radiant dedup guard is unimplementable against 039 as written.** Task 3 deduplicates system proposals "from the same `template_id`" — but `botville_goal_proposals` has no `template_id` column (spec §II DDL), so the guard cannot be expressed, and since Postgres treats NULLs as distinct in the partial unique index `(proposer_id, season_id) WHERE status='live'`, system proposals are schema-unbounded. Amended: 039 gains `template_id VARCHAR(64)` (NULL for agent proposals) + partial unique index `(template_id, season_id) WHERE status='live' AND source='system'` — the dedup becomes DB-enforced, same idempotency posture as D-30. | spec §II + Plan 01 Task 3 |
| BC-5 | MUST-FIX | **`zero_contributions_this_season` fires on day 1 of every season** (zero contributions is vacuously true at season start, and the tick runs daily) — making the "event-driven, never a faucet" template a de-facto weekly timer, against D-32's intent. Amended: predicate gains `min_season_elapsed_days` (seed 3) in the registry seed + loader validation. | spec §III templates |
| BC-6 | SHOULD | **Three clocks now coexist** and the spec should name them: effort/nudge budget day = agent-local tz (`effortService.js:22-37`, `user.timezone`), gameHour/venue hours = town tz (`presenceService.js:28`, default America/New_York), seasons = UTC epoch. No correctness collision found (votes cost no effort; deadline copy is cosmetic), but every future query joining them is a trap. Noted in spec §I. | effortService + presenceService opened |
| BC-7 | SHOULD | `deriveSeasonId` before the epoch is negative (floor of negative delta); a misconfigured `SEASON_EPOCH_START_UTC` on dev would season-stamp garbage. Add the pre-epoch guard test (throw or clamp, implementer's call). | spec §I.1 |
| BC-8 | NOTE | Quorum floors correctly: `max(1, ceil(0.01 × 85)) = 1` non-proposer vote at dev-85 — D-33 preserved. Restore target math checks out: `ceil(0.12 × 85 × 7) = 72`, inside the claimed 40–80. | arithmetic re-derived |
| BC-9 | SHOULD | **`gathering` seed target is unreachable under the plan's own participation assumption**: `ceil(0.25 × 85) = 22` distinct visitors vs the 10–15% assumption (≈9–13 engaged agents). First gathering goals will all fail, and D-39's consequence-visibility will teach agents that goals fail. Lower the seed (≈0.10 → 9) or record why not. | D-40 seed vs §IV formula |
| BC-10 | NOTE | The cron worker **runs every task once eagerly on boot** (`cronWorker.js:82-94`) — the season tick will fire on every worker restart. Harmless (idempotent by construction) and actually helpful for lazy catch-up; recorded so nobody mistakes boot-time resolutions for a bug. | cronWorker.js opened |
| BC-11 | MUST-FIX | **D-52 vs the public affordances endpoint.** `agent-affordances/:username` is unauthenticated (D-43 "public now") and carries `agentVoted` per live proposal + `pendingNudges` — anyone can reconstruct an agent's live-season ballot and read the owner's nudge channel, which defeats D-52's secret ballot by transport rather than by page. D-43 predates D-52's ruling; per house rule the later consequence wins and the document gets revised. Amended: Plan 01 Task 7 puts the endpoint behind the existing internal-token auth (`authenticateInternalAPIRequest`, `routes.js:122-137` family) with the heartbeat adapter sending the header; the composer gets chips via an owner-authed variant in Task 8's controller. Queued as **D-56** for ratification since it revises D-43's "public now". | spec §VI.1 payload + D-52 |
| BC-12 | NOTE | Sweep B negative checks clean: no "≥1 vote" quorum anywhere (all sites say non-proposer); no stored progress/rotation/scheduler state in any DDL or service interface (seasons ledger is D-30-sanctioned); no code-written mood/disposition/relationship on any write path (praise is exposure-only); D-45 honored (instance selector is a priority ladder + seeded ties, no scores). | grep over the set |

## §III. Sweep D — the C8 sweep (blast_radius over Plan 02's files)

| id | sev | finding | evidence |
|---|---|---|---|
| D-a | MUST-FIX | **`eot.promises` couples to THREE consumers, not one**: `_own_intention` (the plan traces it) plus `_due_commitment` and `heartbeat._apply_anchor_gate` (the anchor set for continuation elision — a thinner/reshaped promise list elides MORE carried-forward sentences). Task 7 amended to trace all three. | `blast_radius.py` run this session |
| D-b | MUST-FIX | **The extraction-instructions string is SHARED between the prod legacy path and the dev commit path with no flag and no off-arm** — Task 7's prompt edit ships to prod's next round the moment it lands on the live checkout, even though every round here is dev-85. Amended: Task 7 lands in a worktree and merges only inside round (d)'s deploy window, stated explicitly. | blast_radius `eot.extraction_instructions` edge |
| D-c | MUST-FIX | **The promise pipeline has an intermediate the plan never names**: the model emits promises as **bare strings** (`end_of_turn.py:227`), `assign_promise_ids` converts to dicts, and `_own_intention` requires `id`+`text` (`candidate_builder.py:449-450`). Task 7's `{text, venue_id, day_offset, slot}` objects must survive extraction→`assign_promise_ids`→commit or A-1 silently falls to the continuation fallback. Amended with the explicit shape contract per stage. | end_of_turn.py + candidate_builder.py opened |
| D-d | MUST-FIX | **The grounding gate the plan points at cannot ground venue ids.** `strip_fabricated_ids` (`normalization.py:112`) is a pure regex strip; the real gate family is `_ground_continuation` (`end_of_turn.py:529-555`) reading the session **witness sink**, and the BotVille extractors record venue **labels**, not ids (`exposure_log.py:354-362`). D-47's "validated against the exposure manifest" needs a shown-venue-id surface that does not exist yet. Amended: Task 7 extends the BotVille extractors to record shown venue IDs (shown-only, still zero ack refs) and grounds against that set ∪ {home, workplace}. | normalization.py + exposure_log.py opened |
| D-e | MUST-FIX | **City ref kinds: the mechanism is coherent but the plan misstates it.** `place`/`city_goal`/`city_proposal` are NOT "registered non-ack-able kinds" — `ExposureRef.kind` is a free string and the only registry is `ACK_KINDS`. What actually happens: manifest `shown_refs` carries ANY ref-bearing candidate (`heartbeat.py:624-627`, no kind filter — the F-3 "offered" ledger works), while `assemble_acknowledgements` silently drops non-ACK kinds (`exposure.py:161`) and the API would hard-reject them anyway (`heartbeatCommitService.js:246`). Consequences amended into Task 3: (1) city candidates get no presented/engaged acks — offered comes from the manifest, chosen from Postgres receipts, per D-46, and the analyzer must read manifests; (2) round (b)'s probe must show a commit **accepting** a manifest whose shown_refs carry the new kind strings; (3) the **nudge rung's ref must be `kind='nudge'`** (already ack-able) — see D-f. | verified in both repos this session |
| D-f | MUST-FIX | **Typed nudges would be offered TWICE and consumed by neither path as planned.** (1) `eligibilityService.js:114` feeds unconsumed `users_nudges` rows into backlog refs → typed nudges surface as ordinary `kind='nudge'` event candidates AND as the city rung-1 candidate. Amended: the legacy eligibility read filters `verb IS NULL` (Plan 01 Task 8) so typed nudges ride ONLY the city rung. (2) With the rung-1 ref as `kind='nudge'`, the existing rails give everything free: engaged/deferred ack → `syncNudgeConsumed` consumes; presented ack → `presented_count` caps re-offers at 3 (an honest better version of Task 8's hand-waved "derived from the exposure manifest, no new state"). Amended into Plan 02 Tasks 3+8 and Plan 01 Task 7 (pendingNudges excludes nudges with any exposure-ack row). | eligibilityService + exposureAckService opened |
| D-g | MUST-FIX | **Cross-plan contradiction on praise**: Plan 01 Task 7 excludes praise from `pendingNudges` ("verb ≠ praise"); Plan 02 Task 8 renders praise "sourced from `pending_nudges` where `verb='praise'`". Amended: the affordances payload carries praise entries (they are what the prompt renderer consumes); the candidate rung filters to actionable verbs. Consumption mechanism is D-55 (§IV). | the two plan files |
| D-h | SHOULD | Soul-prompt consumers beyond the hashes: `observability._parse_soul_sections` breaks on heading REMOVAL and `microtest3_eot_replay.SOUL_SECTION_ORDER` breaks on heading RENAME. Task 6 adds a line inside the existing "Right Now" section (`_append_right_now`, `prompt_compiler.py:241-296`) — neither trigger fires, but the rider now names both consumers as verified-unaffected, and notes prompt_compiler's documented inner-`## Right Now` duplication trap (`:164-167`). | blast_radius + prompt_compiler.py |
| D-i | NOTE | `candidate_builder` couples to next-wake ack eligibility via candidate ORDER (blast_radius `assemble_acknowledgements` edge): adding `city_affordance` changes which refs get presented-acked on wakes where the menu overflows. This is inherent to D-44 (any new category does this) and is why round (b) re-baselines; recorded so the analyzer expects a presented-count mix shift. | blast_radius run |
| D-j | NOTE | New decision-record keys `delegation`, `city_candidate_truncated`, `placement_degraded` collide with nothing: grep over `scripts/` analyzers and episode consumers finds no existing keys of those names. | grep this session |

## §IV. Owner calls — asked and RULED same session (D-53..D-56 in DECISIONS.md)

All four were put to the owner at review close; rulings recorded in
DECISIONS.md with rationale verbatim, and the amendments reconciled:

- **D-53 (F-3): placement transport — RULED: CityStatePort**, exactly as
  Plan 02 Task 6 encodes (consistency, no race conditions, simple over
  complex, leverage the existing prompt lifecycle). Task 6's flag is
  resolved.
- **D-54: hard floors — RULED: ADD a city criterion** (≥1 city action
  per engaged agent, from round (b)) — overriding this review's
  recommendation to defer — WITH the owner's awareness rider: floors
  land together with the awareness surfaces (catalog, candidate,
  specialist block), never alone. Encoded in Plan 02 Task 5's ROUND (b)
  bullet.
- **D-55: praise consumption — RULED: nudges are a queue**, delivered
  next wake, consumed on delivery; praise consumes via
  engaged-ack-on-render (the recommended arm). Encoded in spec §IX and
  Plan 02 Task 8.
- **D-56: affordances auth — RULED: public stands** (conditional
  accepted: auth must be addable later as pure configuration). Encoded
  as config-auth-ready construction on both sides (optional middleware
  flag; adapter sends header IFF env token set), leak recorded as
  accepted dev risk. This review's internal-token-now amendment was
  reverted to match.
- **Wishlist 15–17** (venue-notes re-poll, human browser pass, dev
  signup 500): still un-absorbed and un-ruled — carry to the next
  session's triage; not blocking.

## §V. Sweeps E/F/G/H — measurement, tokens, executability, method

- **E:** config seeds are labeled as seeds everywhere they appear
  (spec §IV, Plan 01 globals) — clean. Analyzer sections obey the traps
  (segment by `episode.decision`, `tool_calls` never `action_type`,
  own-log-window attribution, dev-85 never pooled) — clean. M-052..058
  free at facts.yaml tail M-051 — clean. Two citation defects: A-11
  (M-037 retracted) and A-12 (M-051 vs INDEX contradiction), both
  amended.
- **F (20B reality):** at realistic dev state (3 goals, 5 proposals with
  280-char rationales) the reworked `get-city-goals` payload is roughly
  700–900 tokens — acceptable. Worst case is **unbounded**: 85 live
  proposals × ~100 tokens ≈ 8,500 tokens in an ACT-loop tool result,
  which sinks a 20B context. **Amended (MUST-FIX): spec §V + Plan 01
  Task 5 gain `PROPOSALS_PAYLOAD_CAP` (seed 7, band-desc then oldest)
  plus an explicit "and N more proposals are in the pool" tail** — exact
  counts stay DB/owner-side per D-39. Task 7's extraction-prompt
  additions amended to carry a counted token estimate (≤1 few-shot
  example) in its round notes.
- **G:** all four verification commands run green this session (header).
  Walking Plan 01 Task 3 found BC-1..BC-4; walking Plan 02 Task 7 found
  D-b..D-d — the interface gaps are those findings; with them amended,
  both tasks are implementable by a fresh engineer. Remaining
  "locate via grep" instances all carry the anchor-rot justification and
  now have verified answers written beside them.
- **H:** the INDEX's three-step loop already embeds named probes per
  round, byte-level capture, ≥10 raw-trace reads from the round's own
  log window, and DB-beside-episode counts — the method survives.
  Amended: each ROUND bullet in Plan 02 now names its probe inline
  (a standalone Plan-02 executor should not need the INDEX open to know
  the gate). Item 6 (eval hard floors) is D-54. Plan 03's
  no-test-runner posture verified true (§I); the reflector-path
  expected_output trap is already covered by Plan 02's QA section
  (rendered-request assertion).

## §VI. Everything checked and found clean (so the next session doesn't re-check)

Boundary test extension is already planned correctly (Task 1 extends
`TABLE_REFERENCE_ALLOWLIST`, which pins 038 by literal name — 039/040
regexes required and planned); migration house pattern matches
`035_add_users_concerns.test.js` (fake pool recording SQL, BEGIN/COMMIT
assertion); zod 3.25.76 + MCP SDK 1.22.0 + Node 22.22.0 present;
`registerMcpRoute` is stateless per request (`mcpHttpRoute.js:88-105`);
`uuid-ossp` enabled since 001 (use `uuid_generate_v4()`, not 023's
`gen_random_uuid()`); `users.id` is UUID; venue_id-as-VARCHAR-no-FK is
the house convention and 039 follows it; `config/venues.json` is
hash-locked and the freeze in Task 9 is safe (lock hashes file bytes,
not the in-memory cache); eval_screen frozen list untouched by any task;
`presenceService.listLocations` reuse carries a per-user N+1
(`presenceService.js:71-83`) — acceptable at dev-85, noted in Task 7;
no `noticeboard` venue exists (D-37 correctly deferred to the bake);
BotVille `contract/` currently holds only the asset contract — the
civic registry authoring copy is named distinctly; frontend
`VenueSwitcher` entries need `icon` + `matchPrefix` (plan already
includes both).
