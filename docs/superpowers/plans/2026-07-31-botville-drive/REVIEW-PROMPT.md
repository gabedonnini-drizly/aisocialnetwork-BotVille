# REVIEW PROMPT — adversarial review of the BotVille Drive plan set

**Status:** written 2026-07-31, immediately after the plan set was
produced, by the session that produced it — which is exactly why you
should trust nothing in it. Paste this into a fresh session. Your job is
to BREAK the plan set before execution starts, then land the fixes as
plan amendments + `DECISIONS.md` continuations (D-53+). You are the
adversary; the deliverable is a findings document plus the amended
files, not reassurance.

**Review posture:** this repo's history says reviewer confidence is the
enemy. On 2026-07-26 an audit found **8 of 8 blast-radius assumptions
wrong**. Four cited anchors rotted in a single session. A flag
(`ZERO_EXPECTED_OUTPUT_SLICE`) sat True-and-inert for seven days because
nobody asserted on the rendered surface. 2,659 passing tests hid 4 of 5
real defects. Assume this plan set contains the same class of errors —
the author had full context and still cannot see them.

---

## 0. What you are reviewing

All in `aisocialnetwork-BotVille/docs/superpowers/`:

1. `plans/2026-07-31-botville-drive/DECISIONS.md` — D-30..D-52, the
   binding rulings (owner rationale verbatim). These are settled — you
   review the *documents against them*, never re-litigate them.
2. `specs/2026-07-31-botville-civic-drive-design.md` — the design.
3. `plans/2026-07-31-botville-drive/00-INDEX.md`, `01-api-civic-and-nudges.md`,
   `02-agents-affordance-and-ambient.md`, `03-frontend-exposure.md`.
4. `plans/2026-07-31-botville-drive/00-KICKOFF-PROMPT.md` — context +
   the resolution banner.

## 1. Ground yourself first (same order as the kickoff, abbreviated)

1. `/Users/home/aisocialnetwork-agents/CLAUDE.md` — §5 evidence
   discipline (MEASURED/DERIVED/ASSERTED/RETRACTED), C1–C8, the
   Measurement Traps table. Non-negotiable.
2. `/Users/home/aisocialnetwork-BotVille/CONTEXT.md` — the glossary the
   documents claim to follow.
3. `/Users/home/aisocialnetwork-agents/.claude/skills/qa/SKILL.md` — run
   its **planning mode** against Plan 02 for real (step 2: `PYTHONPATH=.
   python scripts/qa/run_checks.py --paths <the files Plan 02 names>`
   and `python scripts/docs/blast_radius.py <same>`). The plans' QA
   sections were written BY HAND by the author — diff them against the
   tools' actual output; every divergence is a finding.
4. The prior set for house conventions:
   `plans/2026-07-29-botville-platform-mcp/` (`00-INDEX.md`,
   `DECISIONS.md`, `EXECUTION-2026-07-31.md`).
5. `docs/facts.yaml` M-036/M-037/M-048/M-051 — the fact lineage the
   plans cite.

## 2. Known findings — seeded by the author, fix them first

These were caught AFTER the set was written; they are proof the class
exists. Start here, then hunt siblings:

- **F-1 `CONTEXT.md` contradicts D-41.** The Goal Proposal entry still
  says "Carries its source — system, human, or agent." D-41 removed
  `human`. Amend CONTEXT.md (it is the vocabulary authority — a fork
  here propagates).
- **F-2 Kickoff §2.9 contradicts D-50.** §2.9 says praise is "signed
  feedback into disposition"; D-50 ruled there is NO disposition
  variable — praise is an exposed observation, persistence only via the
  agent's own end-of-turn. The banner covers §2.2 and §3 but not this.
  Extend the banner or annotate §2.9.
- **F-3 (open flag) Placement transport needs D-53.** Settled §2.8 says
  "built into the md-gen process"; literal md-gen transport = core
  querying the botville module = II.1 rule-3 violation. Plan 02 Task 6
  encodes `CityStatePort` → `prompt_compiler` instead and flags it.
  Owner must ratify (or choose the mount-point exception). Record D-53.
- **F-4 (open flag) Praise consumption path unverified** — which call
  marks a praise nudge consumed after its single exposure? Plan 02
  Task 8 defers it; verify against `startupController.getNudges` /
  `mdGenController.js:467` and pin the answer in the plan.
- **F-5 (open flag) `active_population` source table asserted, not
  derived** — Plan 01 Task 3 points at agent-runs (migration 023) with
  a verify-at-implementation note. Open migration 023 and the analyzer
  code; pin table+column, or the whole D-40 economy sits on sand.

## 3. The adversarial sweeps (do all seven; report per sweep)

### Sweep A — anchor verification (the rot sweep)
Every `file:line`, symbol, table, config key, and count cited anywhere
in the set: open it. Specifically verify in-tree TODAY:
`EXCLUDED_TOOLS` has 22 entries (M-037 says 7 L3 + 15 L2);
`candidate_builder.py` `_own_intention` ≈ line 401 and
`_delegation_candidate` ≈ 698; `exposure_log.py:341-406` extractors;
`exposure.py:25` ACK_KINDS; `effortService.js` budget = 3;
`cronWorker.js` TASKS registry shape; `users_nudges` columns (the
wishlist's "migration 021" anchor was already wrong once — the table
lives in `021_add_soul_startup_tables.js`); `VenueSwitcher.tsx` venues
array; `PRESENCE_MODE` in `packages/client/src/lib/api.ts`. Every miss
= a plan amendment.

### Sweep B — decision fidelity (documents vs D-30..D-52)
For each of the 23 rulings, point at the exact plan/spec text that
implements it, or file the gap. Hunt especially for: quorum implemented
as "≥1 vote" anywhere (must be ≥1 NON-PROPOSER vote — D-33); any stored
progress/scheduler/rotation state (D-30/34/44 all forbid — grep the DDL
and service interfaces for counters); any numeric vote count reaching
an agent-facing or public live-season surface (D-39/D-52 — check the
`get-city-goals` payload spec AND the affordances endpoint's consumers:
the affordances payload carries raw tallies BY DESIGN for the builder;
verify no frontend page consumes it except the owner-gated composer);
any code-authored emotion (D-47/D-50 — the words "mood", "disposition",
"relationship" appearing on a WRITE path in any plan is a finding).

### Sweep C — concurrency and algebra (the D-30 stress test)
Trace the resolver as written in Plan 01 Task 3 against: two
simultaneous first-reads at the boundary (does the loser actually SEE
the winner's committed election, or read pre-commit state? — isolation
level matters and no plan names it); a vote written in the same
millisecond as the boundary (season-stamp at write vs resolver's
filter); `season_id INTEGER` arithmetic at the epoch and at DST
boundaries (the effort service uses agent-LOCAL days; seasons use UTC —
is the mismatch a problem anywhere they meet, e.g. nudge budget vs
season deadline copy?); the partial unique index
`(proposer_id, season_id) WHERE status='live'` when `proposer_id IS
NULL` — Postgres treats NULLs as distinct, so system proposals are
UNBOUNDED per season by schema; the only guard is Task 3's
per-template dedup. Decide whether that guard is strong enough or the
index needs `COALESCE`.

### Sweep D — the C8 sweep (agents repo)
Run `python scripts/docs/blast_radius.py` on every file Plan 02 names.
Compare against the plan's claimed couplings (promises→A-1, soul
bytes→render_hash, digest untouched). The history says assumptions here
run 0-for-8 — treat every coupling the plan does NOT mention as the
likely bug. Check specifically: does the `city_affordance` category
change the manifest for agents WITHOUT city state (the plan pins
byte-identical — is the pin test actually sufficient given slug
assignment happens post-shuffle?); does A-1 eligibility filtering
change behavior for agents whose FIRST promise is unwindowed (must be
zero delta); do the new decision-record keys (`delegation`,
`city_candidate_truncated`, `placement_degraded`) collide with any
existing episode-schema consumer (grep the analyzers).

### Sweep E — measurement integrity (§5 sweep)
Every number in the spec and plans: classify MEASURED / DERIVED /
ASSERTED. The config seeds (coefficients 0.12/0.25, bands [1,4], 2s
timeout, slot hours 06/12/18) are legitimately arbitrary — but they
must be LABELED as seeds, never cited later as findings. Check the
analyzer sections in INDEX/Plan 02 obey the traps: `tool_calls` never
`action_type`; segmented by `episode.decision`; episodes attributed by
the run's own log window; dev-85 never pooled with prod-44; CrewAI
token figures halved. Check M-052..M-058 reservations don't collide
with facts.yaml's current tail.

### Sweep F — small-model reality (the 20B sweep)
The `get-city-goals` payload (spec §V) grew substantially and prompt
length degrades performance (recorded finding). Estimate the payload's
token cost at dev-85 realistic state (3 goals, 5 proposals) and flag if
the growth is unbounded (proposals are capped only by
one-live-per-agent × 85 agents — is there a payload cap? There is not.
That is likely a finding: propose a cap + "and N more" tail). Same for
the candidate text templates and the extraction-prompt additions in
Plan 02 Task 7 (three new optional fields × few-shot examples — count
the added tokens; every one must earn its place).

### Sweep G — executability (the fresh-engineer sweep)
Pick the two highest-risk tasks — Plan 01 Task 3 (resolver) and Plan 02
Task 7 (promises) — and walk them as an implementer with zero context:
are the interfaces complete (no type referenced that no task defines)?
Do the test fixtures described actually pin the behavior claimed? Is
anything "locate via grep" where the plan should just state the answer
(acceptable only where the plan explains WHY it defers — anchor rot)?
Verify the commands run: `npm test` in the api repo, `python -m pytest
tests/heartbeat/ -x -q --tb=line`, `python scripts/docs/lint_docs.py`,
`PYTHONPATH=. python scripts/data_quality/verify_normalization.py`.

### Sweep H — behavioral-method compliance (the sweep that has actually
found the real bugs in this repo)

The static sweeps above catch document defects. The defects that COST
DAYS here were behavioral, and were found by a specific proven loop —
verify the plans embed it at every ROUND gate, and amend them where
they don't:

1. **Capability probe BEFORE each round measures anything.** For every
   new agent-facing surface, one dev agent must mechanically complete
   the path end-to-end before the round starts: round (b) — one agent
   sees the city candidate AND one successful `vote-city-goal` receipt
   lands in `botville_goal_votes`; round (d) — one anchored promise
   survives extraction→grounding→commit→next-wake A-1; round (e) — one
   nudge travels composer→row→candidate→decline-or-act. A behavioral
   theory built over a broken path describes nothing (the 96%
   serialized-tool-call incident: agents "looked disengaged" for a WEEK
   while the mechanical path was broken). A probe is cheap and kills
   whole hypothesis families. **If a plan's ROUND bullet lacks a named
   probe, that is a MUST-FIX amendment.**
2. **Capture the composed request, byte-level, at every surface
   change.** The composed ACT request is ONE user message built from
   five spans, three of which come from crewai defaults no repo file
   mentions — grepping configs shows you one span in five. For Plan 02
   Tasks 3/4/6/7/8: the verification step must capture the literal
   HTTP body of a dev wake (the M-051 pattern did exactly this for the
   L1 promotion) and show the new bytes present (28 schemas, the
   placement line, the anchored-promise extraction prompt). A test
   asserting on constructor args or YAML is NOT evidence — assert on
   the rendered request (`ZERO_EXPECTED_OUTPUT_SLICE` sat inert for
   seven days because nobody did).
3. **Raw-trace reading is a scheduled step, not a vibe.** Each round's
   analyzer section must include reading N raw episodes' actual
   message content (composed request + raw model output + tool-call
   serialization), N≥10, sampled from that round's own log window —
   green parsing proves output parses, never that the agent was told
   the truth. Check the plans' analyzer bullets; add the trace-read
   line where missing.
4. **Capture before ablate.** If any round's analysis proposes "X
   caused the behavior change," the follow-up must capture the literal
   request body, prove it reproduces, then vary ONE span — never
   compare reconstructions (a confounded low p only says the bodies
   differed).
5. **DB-side audit for effects invisible to episodes.** Civic receipts
   (votes, contributions, proposals, nudge rows) are Postgres-auditable
   — unlike contentDigest, which taught us episode-file metrics can
   read 0 by construction. Each round's analyzer must include the DB
   counts beside the episode counts, same corpus sentence.
6. **The behavioral eval harness.** `scripts/ralph/ralph_eval.sh` +
   `llm_judge.py` (8 dimensions, quantitative hard floors) is the
   standing behavior instrument. Decide deliberately (owner call,
   record it): do the hard floors gain city criteria (e.g. ≥1 city
   action per engaged agent) in this drive, or is that premature
   before round (b) data? Either answer is fine; silence is not.

## 4. Also weigh (lower priority, real)

- Wishlist items 15–17 were consciously NOT absorbed (venue-notes
  re-poll, human browser pass, misc smalls incl. the dev signup 500) —
  confirm with the owner or fold them in.
- Plan 03 assumes no frontend test runner exists — verify
  `package.json` before accepting the manual-pass posture.
- The reflector propose path adds task text to a subagent — the
  expected_output-slice trap (Harmony `final` channel, p=0.0003) says
  assert on the RENDERED subagent request, not the YAML.
- eval_screen's frozen `_SCREEN_EXCLUDED_TOOLS` must NOT change at Plan
  02 Task 4 (the plan pins it — verify the pin is a test, not a
  sentence).
- `nodemon` deploy-on-write: Plan 01's dev deploy steps must not edit
  the live api checkout mid-round (the INDEX says it; check the task
  steps don't quietly violate it).

## 5. Deliverables of the review

1. `REVIEW-FINDINGS-<date>.md` in this directory: one finding per row —
   severity (BLOCKER / MUST-FIX / SHOULD / NOTE), the document+line,
   the evidence (what you opened/ran, per §5 discipline: corpus
   in-sentence), the proposed fix.
2. The fixes THEMSELVES for everything ≤ MUST-FIX, landed as edits to
   the spec/plans/CONTEXT.md, with D-53+ rulings recorded in
   DECISIONS.md for anything that needed an owner call (ask; don't
   guess).
3. A one-paragraph verdict: is the set executable as amended, and which
   plan/task should start first tomorrow.

**Discipline riders:** read-only against the live world (QA skill rule
— no DB writes, no agent-state writes; a live round may be running);
verify before citing — including everything THIS prompt asserts; where
a document and a measured fact disagree, the measurement wins and the
document is what gets revised.
