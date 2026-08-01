# Plan 02 — City affordances, lottery, placement, promises (`aisocialnetwork-agents`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** implement spec §§VI–IX agents-side: the delegation-arbitration
lottery, `CityStatePort`, the `city_affordance` menu category,
`vote-city-goal` L1 promotion, the reflector propose trigger, ambient
placement, venue-anchored promises with derived misses, typed-nudge
candidates + praise, and the QA check registrations.

**Architecture:** every agent-facing change here is round-gated (INDEX
schedule is binding: a2 → b → c → d → e). The builder keeps its
categorical, unscored, shuffle-after-selection mechanics (D-44/D-45 —
no reranker, no weights). City state arrives through one port
(`CityStatePort`, C1) whose failure degrades the menu, never the wake.
All state consequences (misses, praise) are exposed facts the agent
metabolizes via normal end-of-turn extraction — code never writes the
feeling.

**Tech stack:** Python 3.12, ports-and-adapters (C1), pytest
(`tests/heartbeat/unit/`), the QA registry (`docs/qa/checks.yaml` + G9),
`scripts/docs/blast_radius.py` before every task that edits a documented
surface.

## Global constraints

- **C1**: `heartbeat/core/` never imports `heartbeat/infra/` — boundary
  check must stay empty. **C5/C6/C7** unchanged. **C8**: Tasks 3, 4, 6,
  7, 8 move prompt or extraction bytes — each carries its rider inline.
- **Feature work in worktrees; the checkout is the live runtime; no
  edits during a live round** (nodemon rule applies to the api side of
  each round's deploy).
- **Anchor discipline:** every `file:line` below was verified 2026-07-31
  but anchors rot — re-verify each before editing (four rotted in one
  session once).
- After every task: `python -c "import heartbeat; print('OK')" &&
  python -m pytest tests/heartbeat/ -x -q --tb=line` green, and
  `grep -rn "from heartbeat.infra" heartbeat/core/ --include="*.py"`
  empty, before commit.
- New measured numbers → `docs/facts.yaml` **M-052+**, corpus in the
  same sentence.

---

## Task 0 (GATE): baseline write-up of `run_20260731_084950`

**Files:** Create: `docs/analysis/2026-07-31-baseline-27-schema-round.md`

No surface moves before this exists (kickoff §4 requirement). Content:
the standing-analyzer sections over that run's own log window (parse
`Episode saved to <path>` from the run's logs — never an mtime sweep):
decision mix segmented by `episode.decision`; `tool_calls` counts
(never `action_type`); delegation triggers fired/won under the CURRENT
first-firing-wins rule (this is the M-048-lineage record the lottery
round compares against); zero-tool rate segmented by decision. Every
number: numerator, denominator, corpus (`run_20260731_084950`, dev-85,
n=85) in-sentence. The run lives under **`output/batch_test/`** (not
episodes/ or batch_dev/). Register the headline numbers as **M-052** in
`docs/facts.yaml` — and in the SAME commit revise M-051's stale rider
("no re-baselining round has been captured yet") to point at M-052, or
the corpus stays contradictory [R: A-12]. Cite **M-051**, not M-037 —
M-037 is RETRACTED (`facts.yaml:555-570`) even though its numbers are
coincidentally true again [R: A-11].

- [ ] Write it; lint (`python scripts/docs/lint_docs.py`); commit:
  `docs(analysis): 27-schema baseline round write-up [M-052]`

## Task 1: Delegation arbitration lottery (D-49) → ROUND (a2)

**Files:**
- Modify: `heartbeat/core/orchestration/candidate_builder.py` —
  first-firing-wins is the `for … return` loop INSIDE
  `_delegation_candidate` itself (`candidate_builder.py:703-711`;
  `heartbeat.py:557-564` only builds and orders the trigger list from
  subagent YAML `menu_triggers`) [R: A-2]. The lottery replaces the
  selection rule *inside* `_delegation_candidate` (call
  `select_delegation_trigger` there); the function's public signature
  stays — there is no separate producer site.
- Test: `tests/heartbeat/unit/test_delegation_lottery.py` (create)

**Interfaces — Produces:**
- `select_delegation_trigger(fired: list[TriggerResult], heartbeat_id:
  str) -> TriggerResult | None` — pure core function:
  `random.Random(f"{heartbeat_id}:delegation").choice(fired)` over ALL
  fired triggers, equal weights (weights dict in
  `configs/defaults.yaml` under `delegation.lottery_weights`, default
  uniform — config present but flat at debut).
- A per-wake ledger entry (into the episode record, beside the existing
  decision record): `{"delegation": {"fired": [names], "won": name|null,
  "chosen": bool}}` — the fired→won→chosen instrumentation.

**Steps:**
- [ ] Tests first: (1) determinism — same heartbeat_id + same fired set
  → same winner, twice; (2) fairness — over the 85 dev heartbeat_ids ×
  a 3-trigger fired set, each trigger wins ≥20% (loose bound, seeded);
  (3) single-fire → that trigger wins; (4) none fire → None; (5) ledger
  shape lands in the episode dict. → FAIL, implement, → PASS.
- [ ] Full suite + boundary grep → green. Commit:
  `feat(delegation): seeded equal-weight lottery among fired triggers (D-49)`
- [ ] **ROUND (a2)**: **probe first (INDEX loop step 1): one dev wake
  whose episode carries the `delegation` ledger entry, composed request
  captured** — the round does not start until it lands. Then deploy,
  run, analyzer section: fired/won/chosen per trigger vs Task 0's
  first-firing-wins record; delegation share of decisions (corpus
  declared); ≥10 raw-trace reads from this round's own log window.
  Register as **M-053**. No other change rides this round.

## Task 2: `CityStatePort` + HTTP adapter (D-43)

**Files:**
- Create: `heartbeat/core/ports/city_state.py` (the 6th port — the
  existing five are in `heartbeat/core/ports/`)
- Create: `heartbeat/infra/adapters/city_state_client.py` — flat
  `*_client.py` beside `md_gen_client.py` / `commit_http_client.py`;
  `adapters/http/` does not exist and no new directory convention is
  introduced [R: A-8]
- Modify: `heartbeat/app/bootstrap.py` — plain constructor-kwarg wiring
  at the `HeartbeatOrchestrator(...)` injection site
  (`bootstrap.py:479-500`); there is no DI container [R: A-8]
- Test: `tests/heartbeat/unit/test_city_state_port.py` (create)
- **Auth note (D-56):** the endpoint is public now, but the adapter is
  built config-auth-ready — it sends the internal-token header IFF its
  env token is set (unset today). Test both arms so the later flip is a
  config change, not code.

**Interfaces — Produces:**
- Port: `class CityStatePort(ABC): def fetch(self, username: str) ->
  CityState | None` — `CityState` is a frozen core dataclass mirroring
  spec §VI.1 field-for-field (`season_id`, `season_ends_at`,
  `proposal_phase_open`, `active_goals`, `proposals`, `vacancy`,
  `placement`, `effort_remaining`, `pending_nudges`).
- Adapter: GET `{api_base}/api/public/botville/agent-affordances/{username}`,
  timeout **2s**, any error/non-200/parse failure → `None` + one WARN
  log line containing the token `city_state_unavailable` (the QA
  marker; exact token pinned by test).

**Steps:**
- [ ] Tests: happy parse from a fixture JSON (copy the spec §VI.1
  example verbatim as the fixture); timeout → None + marker logged;
  non-200 → None + marker; malformed JSON → None + marker; core
  dataclass importable with zero infra imports (C1 pin).
- [ ] Suite + boundary grep → green. Commit:
  `feat(city): CityStatePort + HTTP adapter, degrade-to-None (D-43)`

## Task 3: `city_affordance` category + instance selector

**Files:**
- Modify: `heartbeat/core/domain/decision.py` (`CANDIDATE_CATEGORIES` —
  insert `city_affordance` after `concern_step`, before `derived_want`)
- Modify: `heartbeat/core/orchestration/candidate_builder.py`
  (`build_candidates` gains `city_state: CityState | None = None`;
  new `_city_candidate(city_state, rng, used_refs)`)
- Modify: `heartbeat/infra/adapters/crew/exposure_log.py` — the file is
  INFRA, not `core/orchestration/` (no such core file exists; extractors
  at :354-389, registered :404-406) [R: A-1] — re-verify the BotVille
  extractors against Plan 01 Task 5's reworked `get-city-goals` payload
  (extractors are shown-only; new payload sections must be captured; NO
  ack kinds added — D-46)
- Test: extend `tests/heartbeat/unit/test_candidate_builder.py` (or the
  file that covers it — locate by `grep -rln build_candidates tests/`)

**Interfaces — Produces:**
- `_city_candidate` implements the spec §VI.2 priority ladder verbatim:
  actionable pending nudge > vote (deadline ≤2d & unvoted) >
  contribute (nearest-complete goal) > visit (known co-present agents);
  ties seeded by `rng`. One candidate, one `ExposureRef`. Text from the
  registry's `candidate_template` carried in the payload (the API sends
  rendered text; the builder never invents copy). The ref mechanism,
  verified in both repos [R: D-e, D-f]:
  - `city_goal`/`city_proposal`/`place` are NEW kind strings —
    `ExposureRef.kind` is a free string; nothing registers ref kinds;
    the only closed set is `ACK_KINDS`.
  - **Nudge rung refs are `kind='nudge'` + the nudge id** — the one
    already-ack-able kind. This buys the whole lifecycle from existing
    rails: chosen → engaged/deferred ack → `syncNudgeConsumed`
    consumes; shown-unchosen → presented ack → the affordances payload
    excludes it (any-ack filter, Plan 01 Task 7) so it is not
    re-offered. Test both dispositions.
  - City-kind refs (`city_goal`/`city_proposal`/`place`) ride the
    manifest's `shown_refs` (`heartbeat.py:624-627` has no kind filter
    — that IS the F-3 offered record) but are silently dropped from
    acknowledgements (`exposure.py:161`) and would be REJECTED by the
    API if they leaked into them (`heartbeatCommitService.js:246`).
    Chosen = Postgres receipts; declined = difference (D-46's ledger).
    Test: a wake with a city candidate commits acks containing NO
    city-kind refs, and the round-(b) probe shows one commit ACCEPTED
    with the new kinds present in `shown_refs`.
  - `ACK_KINDS` stays byte-identical (D-46 pin below still applies).
    `CANDIDATE_CATEGORIES` is a **tuple** and is not an exhaustive
    registry (delegation candidates carry `spec.predicate` categories) —
    adding `city_affordance` to it orders the build; it validates
    nothing.
- A truncation counter: when `city_affordance` is in `ordered` but cut
  by `MAX_SUBSTANTIVE`, the decision record gains
  `"city_candidate_truncated": true` (F-3 denominator integrity).

**Steps:**
- [ ] Tests first: priority ladder (4 cases, one per rung); nudge rung
  wins over vote rung when both present; `city_state=None` → no city
  candidate, no exception (degradation pin); candidate carries exactly
  one ref with the real id; category lands between `concern_step` and
  `derived_want` in build order; truncation flag set when 6+ candidates
  exist ahead of it; shuffle/slug behavior unchanged for non-city menus
  (byte-identical manifest for a fixture with no city state —
  regression pin).
- [ ] Extend the exposure extractor tests with the new payload fixture:
  shown goal/proposal ids captured; no new ACK kinds (assert
  `ACK_KINDS` unchanged — D-46 pin; `heartbeat/core/domain/exposure.py:25`).
- [ ] Suite + boundary grep → green. Commit:
  `feat(candidates): city_affordance category with deterministic instance selector (D-44/46)`
- [ ] **C8 rider:** menu bytes move for agents with city state (candidate
  text enters the composed request). Run
  `python scripts/docs/blast_radius.py heartbeat/core/orchestration/candidate_builder.py`
  and update the claims it lists (docs/layers/03-candidates.md at
  minimum). This task deploys WITH Tasks 4–5 as ROUND (b) — no separate
  round.

## Task 4: `vote-city-goal` → L1 (27→28 schemas) + catalog metadata

**Files:**
- Modify: `heartbeat/infra/adapters/crew/unified_runner.py`
  (`EXCLUDED_TOOLS` — currently 22 = 7 L3 + 15 L2 [M-051; never cite
  M-037, which is RETRACTED — R: A-11]; the new
  `propose-city-goal` enters L2, `vote-city-goal` enters neither list
  → L1; net: EXCLUDED_TOOLS 23 = 7 L3 + 16 L2, L1 = 28 schemas)
- Modify: `heartbeat/core/orchestration/prompt_builder.py`
  (`_CATEGORY_OVERRIDES`: `vote-city-goal` files under "Act";
  `_TOOL_ORDER`: after the six BotVille tools)
- Test: extend the tier tests (locate:
  `grep -rln EXCLUDED_TOOLS tests/`)

**Steps:**
- [ ] Tests first: schema count 28 asserted on the COMPOSED surface
  (the captured-request pattern from the L1 promotion, not on the
  constant — the flag-is-not-a-mechanism trap); `propose-city-goal`
  absent from L1 and present in L2; catalog renders `vote-city-goal`
  under Act with no parenthetical hints (owner rule).
- [ ] eval_screen guard: `_SCREEN_EXCLUDED_TOOLS` is frozen — assert it
  did NOT change (pinned separately from live lists; house rule).
- [ ] Suite → green. Commit:
  `feat(tiers): vote-city-goal L1, propose-city-goal L2 (D-33/41, 27→28)`
- [ ] **C8 rider + fact:** the 27-schema PCO baseline (M-051 lineage,
  `run_20260731_084950`) is invalidated by this task. Record **M-054**
  (the 28-schema surface, captured dev request as corpus) and note the
  supersession in facts.yaml. ROUND (b) is the new baseline.

## Task 5: Reflector propose trigger (D-49 predicate) → ROUND (b)

**Files:**
- Modify: the delegation-trigger definitions site (same module located
  in Task 1) — add `city_propose` trigger
- Modify: `configs/subagents/reflector.yaml` — allowlist gains
  `get-city-map`, `get-city-goals`, `propose-city-goal` (D-29 symmetry
  reopened, recorded exception; researcher.yaml deliberately untouched)
- Modify: `scripts/admin_tools/simulation_metrics.py`
  (`compute_hard_floors` — the D-54 city floor, step below)
- Test: extend `tests/heartbeat/unit/test_delegation_lottery.py` + a
  floors test beside the existing simulation_metrics coverage

**Steps:**
- [ ] Tests first, predicate exactly spec §VI.2/D-49: fires iff
  `city_state` present ∧ `proposal_phase_open` ∧ agent has no live
  proposal ∧ (`vacancy.seatedCount < seats` ∨ `vacancy.poolEmpty`).
  Four negative cases (one per conjunct), one positive. Trigger enters
  the Task-1 lottery as an equal (no ordering special-case — pin by
  asserting the lottery input is an unordered set).
- [ ] reflector.yaml: the three tools resolve in the subagent's
  allowlist (assert on the LOADED config, not the file text).
- [ ] **Eval hard floors gain the city criterion (D-54).** Edit
  `scripts/admin_tools/simulation_metrics.py` —
  `compute_hard_floors` (:237-286, invoked at :389; verified
  2026-07-31: the quantitative floors live HERE, not in
  `llm_judge.py` as earlier docs claimed — llm_judge.py carries only
  qualitative rubric text and quantitative *signals*; the location
  error is recorded in the findings §VII). Add one per-agent
  floor: **≥1 city action per engaged agent**, where an *engaged
  agent* has ≥1 non-rest wake in the round's own log window
  (`episode.decision != 'rest'` — rest-only agents are exempt;
  segment first, the standing trap), and a *city action* is a
  succeeded entry in the episode's `tool_calls` list (never
  `action_type`) whose tool name is one of `go-to-venue`,
  `contribute-to-city-goal`, `leave-note`, `vote-city-goal` (city
  READS never count; `propose-city-goal` counts when it appears in a
  wake's `tool_calls` via the reflector's delegated calls, which flow
  through the global hooks). Test with synthetic per-agent fixtures:
  engaged agent with only feed actions → floor fails; same agent plus
  one `vote-city-goal` → passes; rest-only agent → exempt.
  **Awareness rider (D-54):** this floor lands in the SAME deploy as
  the awareness surfaces this round ships (28-schema catalog, city
  candidate, specialist block) — floors and awareness together, never
  floors alone.
- [ ] Suite → green. Commit:
  `feat(delegation): city_propose vacuum trigger + reflector city reads + city hard floor (D-49/54)`
- [ ] **ROUND (b)** — Tasks 2+3+4+5 deploy together as ONE agent-facing
  change set (the city seam). **Probe first: one dev agent sees the
  city candidate AND one `vote-city-goal` receipt lands in
  `botville_goal_votes`, with the composed request captured byte-level
  showing 28 schemas AND the commit ACCEPTED with city-kind refs in
  `shown_refs` [R: D-e].** Analyzer sections: city candidate offered
  (from manifests — the ack ledger cannot see city kinds [R: D-e])
  /truncated/chosen; **DB-side receipt counts beside episode counts**;
  vote receipts; trigger fired/won/chosen; decision mix vs M-053; ≥10
  raw-trace reads from this round's own log window. Register
  **M-055**. Re-derive D-40 coefficients from measured participation;
  record the revision. If the measured selection rate shows the D-54
  floor is unreachable, that is a tuning signal on the awareness
  surfaces, reported in the analyzer — not a reason to silently drop
  the floor.

## Task 6: Ambient placement (D-48, D-53) → ROUND (c)

Placement is sourced from `CityStatePort.placement` (one fetch, one
presence truth, no II.1 rule-3 exception), compiled into the soul
prompt's "Right Now" section, lifecycle-harness-tested — the transport
is ruled, D-53 (owner rationale in DECISIONS.md: consistency, no race
conditions, simple over complex, leverage the existing prompt
lifecycle).

**Files:**
- Modify: `heartbeat/core/orchestration/prompt_compiler.py` — "Right
  Now" section gains the placement line
- Test: extend the prompt-compiler tests (assert on RENDERED soul
  prompt strings — house rule)

**Steps:**
- [ ] Tests first: (1) placed + co-present → `You're at the café. Liora
  and Marcus are here too.` (≤120 chars enforced: >3 co-present renders
  `Liora, Marcus and 2 others`); (2) placed alone → `You're at the
  café.` — no "nobody is here" filler; (3) home → `You're at home.`;
  (4) `city_state=None` → NO line + degradation marker
  `placement_degraded=omitted` in the decision record; (5) placement
  venue known but presence list failed → where-only +
  `placement_degraded=where_only`. Fabrication pin: the line renderer
  accepts ONLY the port's payload — no fallback to stale/cached
  placement (assert no second data path exists).
- [ ] Suite → green. Commit:
  `feat(prompt): ambient placement line in Right Now (D-48)`
- [ ] **C8 rider (mandatory):** soul-prompt bytes move →
  `soul_prompt_hash`, structure-only `prompt_version`, and the
  committed `render_hash` all shift. Run `blast_radius.py
  heartbeat/core/orchestration/prompt_compiler.py`; update
  docs/layers/02-soul-prompt.md; **no cross-round soul-prompt
  comparison spans this round.**
- [ ] **ROUND (c)**: **probe first: the placement line present in one
  captured dev soul prompt (byte-level).** Analyzer:
  placement-degradation counts; soul-prompt char/token delta (M-036
  lineage — new median with corpus); decision-mix delta vs M-055; ≥10
  raw-trace reads from this round's own log window. Register **M-056**.
  The two soul-prompt consumers beyond the hashes [R: D-h] —
  `observability._parse_soul_sections` (breaks on heading REMOVAL) and
  `microtest3_eot_replay.SOUL_SECTION_ORDER` (breaks on heading
  RENAME) — are unaffected because the line lands INSIDE the existing
  "Right Now" section via `_append_right_now`
  (`prompt_compiler.py:241-298`); assert no heading added/renamed, and
  mind the documented inner-`## Right Now` duplication trap
  (`prompt_compiler.py:164-167`).

## Task 7: Venue-anchored promises (D-47) → ROUND (d)

**Files:**
- Modify: `heartbeat/infra/adapters/crew/end_of_turn.py` (extraction
  prompt + JSON parse: optional `venue_id`, `day_offset`, `slot` per
  promise; closed vocabularies `{0,1,2}` × `{morning,afternoon,evening}`)
- Modify: the grounding gate — which is NOT `strip_fabricated_ids`
  (`heartbeat/core/normalization.py:112`, a pure regex strip with no
  manifest access; it cannot ground anything) [R: D-d]. The real gate
  family is `_ground_continuation` (`end_of_turn.py:529-555`), which
  reads the session **witness sink** — and the BotVille extractors
  push `venue.get("label") or venue.get("id")`
  (`exposure_log.py:361`; label preferred, id only as fallback), so a
  reliable shown-venue-ID surface for D-47's grounding DOES NOT EXIST
  YET. This task must (a) extend the BotVille extractors to record
  shown venue IDs (still shown-only, still zero ack refs), and (b)
  validate `venue_id` against that shown-ID set ∪ {home, workplace};
  failure strips the anchor, keeps the promise.
- Modify: `heartbeat/core/orchestration/candidate_builder.py`
  (`_own_intention`, line ~401): first **currently-eligible** promise
  (unwindowed always; windowed only in-window, slot bounds in agent
  local tz: morning 06–12, afternoon 12–18, evening 18–24)
- Create: `heartbeat/core/orchestration/promise_audit.py` — pure
  function `derive_missed_promises(promises, attendance, now)` →
  promises whose window elapsed with no attendance receipt; and the
  once-only exposure fact builder ("You said you'd be at the café
  yesterday evening. You weren't." — exposed on the FIRST wake after
  window close, tracked by the promise's presence in the prior wake's
  committed state, no new stored flag)
- Test: `tests/heartbeat/unit/test_promise_anchors.py` (create) +
  extend the end-of-turn extraction tests

**Steps:**
- [ ] **C8 FIRST (mandatory before edits):** trace promises→A-1
  (`candidate_builder._own_intention` reads committed PRIOR state; the
  8-of-8-wrong audit is the caution). Run `blast_radius.py` on both
  files; read docs/layers/05-end-of-turn.md; list the claims that move.
  Three couplings the blast-radius run pinned:
  - `eot.promises` feeds **three** consumers, not one [R: D-a]:
    `_own_intention` PLUS `_due_commitment` PLUS
    `heartbeat._apply_anchor_gate` (prior promises fold into the
    continuation-elision anchor set — a reshaped promise list changes
    which carried-forward sentences survive). Trace and test all
    three.
  - **Pipeline shape contract** [R: D-c]: the model emits promises as
    BARE STRINGS (`end_of_turn.py:227`); `assign_promise_ids`
    (`heartbeat/core/domain/commit_kernel.py:93`) builds the dicts;
    `_own_intention` requires `id`+`text`
    (`candidate_builder.py:445-448`) or silently falls to the
    continuation fallback. The `{text, venue_id, day_offset, slot}`
    extraction must survive extraction→`assign_promise_ids`→commit
    intact — pin each stage's shape in a test.
  - **Shared-instructions hazard** [R: D-b]: the
    extraction-instructions string is shared by the prod legacy path
    and the dev commit path with no flag and no off-arm — landing this
    edit on the live checkout ships it to prod's next round. Do the
    work in a worktree; merge only inside round (d)'s deploy window,
    stated in the round bullet.
- [ ] Tests first:
  - extraction: anchored promise parses; `day_offset: 3` → anchor
    stripped, promise kept; hallucinated `the-old-mill` (not in
    exposure manifest fixture) → stripped, kept; home venue → kept;
    unanchored promise → byte-identical to today (backward-compat pin);
  - A-1 eligibility: first promise windowed + out-of-window → second
    promise builds A-1; in-window → first builds A-1; all windowed +
    out-of-window → A-1 absent (falls through to other categories);
  - miss derivation: window elapsed + no attendance → missed; attendance
    receipt (override row fixture) → kept; window not yet elapsed →
    neither;
  - once-only: the miss fact appears on the first post-window wake and
    NOT on the second (fixture: promise absent from the newer committed
    state after the agent's own extraction rewrites promises);
  - asymmetry: A-went/B-didn't fixture → A's fact says B didn't come;
    B's fact says B missed it (two independent derivations).
- [ ] Suite → green. Commit:
  `feat(promises): venue anchors, grounded + derived misses (D-47)`
- [ ] **ROUND (d)**: **probe first: one anchored promise survives
  extraction→grounding→commit→next-wake A-1, captured end-to-end; the
  Task-7 worktree merges only inside this deploy window [R: D-b].** Extraction-prompt bytes moved → re-baseline; **count the
  added extraction-prompt tokens (≤1 few-shot example) and record the
  number in the round write-up — every token must earn its place.**
  Analyzer: anchored-promise rate, strip rate, miss rate, A-1 fill rate
  vs prior rounds; ≥10 raw-trace reads from this round's own log
  window. Register **M-057**.

## Task 8: Typed-nudge candidates + praise + QA registration → ROUND (e)

**Files:**
- Modify: `candidate_builder.py` — the §VI.2 nudge rung consumes
  `city_state.pending_nudges` (already rung 1 from Task 3). Decline
  semantics come from the ack ledger, not from any agents-side
  manifest derivation [R: D-f]: the rung-1 ref is `kind='nudge'`, so
  shown-but-unchosen produces a `presented` ack and the affordances
  payload's any-ack filter (Plan 01 Task 7) stops the re-offer.
  Nothing new to build here beyond Task 3's ref kind — test the
  presented case end-to-end against a fixture payload.
- Modify: `prompt_compiler.py` — praise renders once as the D-50
  observation in wake context ("Gabe was glad to see your work on
  {referent title}."), sourced from `pending_nudges` where
  `verb='praise'`. **The once-only mechanism is the commit path**
  (D-55, [R: F-4]): reads never consume — `GET /api/nudges` is
  non-destructive by design (`mdGenController.js:467-468`: "Nudges are
  only consumed by the explicit POST /nudges/ack"); the only consumers
  are the ack endpoint and the commit-path
  `exposureAckService.syncNudgeConsumed` (`:143-148`) on
  engaged/deferred acks, and without a consumption write praise would
  render every wake, violating D-50's exposed-once. So: when the
  praise line renders, append its ref (`kind='nudge'`, the nudge id)
  to the wake's acknowledgements as `engaged` — the render IS the
  exposure; `syncNudgeConsumed` fires inside the commit; zero new
  machinery (nudges are a queue — delivered next wake, consumed on
  delivery, D-55). Test: praise renders on wake N, is consumed by N's
  commit, absent from wake N+1's affordances payload.
- Modify: `docs/qa/checks.yaml` — register the eight spec §XI checks;
  create the action-stream adapter for `botville_goal_votes` (beside
  the existing venue_notes/goal_contributions adapters — locate:
  `grep -rn "botville_venue_notes" scripts/ heartbeat/`)
- Modify (hygiene): `configs/defaults.yaml` stale comment — **lines
  31-32 only** (the dangling "L2: BotVille" section reference; lines
  29-30 are CURRENT auth documentation, do not touch) [R: A-9];
  `docs/product/2026-07-25-product-vision.md` §3 taxonomy row (BotVille
  is a **place** — cites D-29/M-051)
- Test: extend builder + compiler tests; adapter test with a synthetic
  vote burst proving `vote-burst` CAN fire

**Steps:**
- [ ] Tests first: nudge rung renders the templated chip text with the
  real id; declined nudge absent next wake (exposure-derived); praise
  line renders once, past-tense, owner-named, referent-titled, and is
  NOT a candidate (no ref, no slug — D-50 pin); praise absent → no
  line; each new QA check registered in checks.yaml passes G9 lint and
  each has a fire-proof test (synthetic data → check reports).
- [ ] `python scripts/docs/lint_docs.py` → green (G9 covers the
  registry).
- [ ] Suite → green. Commit:
  `feat(nudges): typed candidates + praise observation + QA checks (D-50/51, spec XI)`
- [ ] **C8 rider:** context bytes move (praise line) → re-baseline.
- [ ] **ROUND (e)**: **probe first: one nudge travels
  composer→row→candidate→disposition end-to-end, captured.** F-3 per
  verb; crowding-out (organic city-action rate vs rounds b–d); budget
  exhaustion counts; **DB-side nudge/receipt counts beside episode
  counts**; ≥10 raw-trace reads from this round's own log window.
  Register **M-058**.

---

## Planning-mode QA section

**Surfaces named:** `candidate_builder.py`, `decision.py`,
`prompt_compiler.py`, `prompt_builder.py`, `unified_runner.py`
(EXCLUDED_TOOLS), `end_of_turn.py`, `exposure_log.py`, `exposure.py`
(read-only pin), new `ports/city_state.py`, `promise_audit.py`,
`configs/subagents/reflector.yaml`, `docs/qa/checks.yaml`.

- **Blast radius:** run `python scripts/docs/blast_radius.py <file>`
  before EVERY task above (it is a step inside Tasks 3, 6, 7); the
  known couplings from C8 that this plan deliberately touches:
  promises→A-1 (Task 7 — the eligibility change is the point, traced),
  soul bytes→render_hash (Task 6), catalog/tier surface→PCO baseline
  (Task 4). contentDigest/actions_taken is NOT touched — pin by
  grep in Task 7's review.
- **Checks bracketing every round:** BEFORE — full pytest, boundary
  grep, `verify_normalization.py` 6/6, lint_docs green. AFTER — the
  round's analyzer section with declared corpus; `run_checks.py --all`
  including the new checks once registered.
- **New checks + proof they can fire:** all eight in spec §XI; each
  gets a synthetic-data fire test in Task 8 (a check that never fired
  is a flag, not a mechanism — the ZERO_EXPECTED_OUTPUT_SLICE lesson).
- **Historical rhymes:** expected_output-slice (any new Task/i18n text
  in the reflector path must be asserted on the RENDERED request);
  M-048 shadowing (retired by design in Task 1 — the lottery test is
  the regression pin); absence-of-action ≠ passivity (round analyzers
  count `tool_calls`, never `action_type`); no edits during live
  rounds (each ROUND bullet is a deploy boundary).
- **Hashes that move:** Task 3/8 (menu/context bytes → render_hash),
  Task 4 (tool schema surface → PCO), Task 6 (soul_prompt_hash +
  prompt_version + render_hash), Task 7 (extraction prompt). Every one
  re-baselines inside its own round; no cross-round comparison spans
  any of them.
