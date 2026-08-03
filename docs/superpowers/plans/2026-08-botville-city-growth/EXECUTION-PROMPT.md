# EXECUTION PROMPT — BotVille City Growth (D-59..D-78)

**Status:** written 2026-08-01, after the adversarial review
(`REVIEW-FINDINGS-2026-08-01.md`) **and the integration pass that folded it in**
(findings §VII). Paste this into a fresh session to execute the drive. It is
**re-enterable**: on every entry, read `EXECUTION-LOG.md` (created in step 0)
FIRST and resume from its last line, never from memory.

**The plan set is single-voice: read the plans as written — no mental merging,
no amendment blocks exist.** Review provenance survives only as inline
`[R: <id>]` tags pointing at `REVIEW-FINDINGS-2026-08-01.md`; the findings doc
holds the history, the plan holds only the instruction. The one class of marker
that *is* live is **⛔ O-n** — six open owner calls, which are gates, not
patches. Do not resolve one yourself.

**Goal in one paragraph:** give the town a body that can change. Land the
archetype/generator pattern and declare the housing ladder + construction
states + six civic archetypes into the bake; land migration 041 (plots,
structures, claims, stored home assignments, effort transactions) with the
home-assignment seam across the II.1 boundary; ship a `builder` specialist that
is permitted to act and measure whether it converts; then make an agent's own
housing condition legible and measure whether a personally-felt world condition
produces civic action where an offered candidate did not.

**Done** = Plans `04-` (Tasks 1–8 **including Task 7 and the `home`-role
follow-up commit**), `01-` (Tasks 1–9) and `03-` complete and green; round (f)
run with M-060 registered; round (g) run with its fact registered; round (h) run
or explicitly declined on (g)'s evidence; all six owner calls ruled and recorded
as **D-79+**; no unexplained regression in the decision mix.

**Done is not self-declarable.** Six owner calls gate it and none is yours to
rule, so a loop reaches *"nothing unblocked remains"* and stops there — that is
the correct terminal state, not a failure. Say so plainly in the log rather than
inventing a ruling to get past it.

---

## 0. Ground yourself (read in order, then create the log)

1. `/Users/home/aisocialnetwork-agents/CLAUDE.md` — §5 evidence discipline,
   C1–C8, measurement traps. Non-negotiable.
2. `REVIEW-FINDINGS-2026-08-01.md` — **provenance only; the plans are the
   instruction.** Read §V (the six owner calls) and §VII (the integration
   record: which finding lives where, and what was NOT run). Consult a `[R: id]`
   tag's entry when you want to know *why* a plan says what it says; never
   execute from this document. Anchors were verified 2026-08-01 and **this
   set's own history proves they rot within a single day** — re-open any
   `file:line` before editing at it, and log any drift you find.
3. `00-INDEX.md` — execution order, Gate 0, the round schedule, the kill
   criterion. The INDEX is binding.
4. `DECISIONS.md` — D-59..D-78 plus the `⛔ O-1` entry. You re-litigate nothing
   that is ruled. The rulings all stand; several had their *justifying evidence*
   corrected in place, most consequentially D-68's root cause, D-69's ToM seam,
   D-72's cascade guarantee and D-64's seating key.
5. The spec (`../../specs/2026-08-01-botville-city-growth-design.md`), then the
   plan for the repo you are about to touch: `04-archetypes-and-bake.md` ·
   `01-api-plots-and-housing.md` · `02-agents-builder-and-condition.md` ·
   `03-client-plots-and-districts.md`.
6. Create `EXECUTION-LOG.md` in this directory if absent. It is the **ONLY**
   status source — plan checkboxes are never ticked; the log is truth. One line
   per completed step: date · task · commit hash · gate output (test counts,
   probe artifact paths, M-fact ids). **Also log every parked owner call and
   every anchor you find rotted.**
7. Once trees and branches exist, create `ROUND-RUNBOOK.md` beside the log —
   the civic drive's companion pattern: exact resumption commands, the
   tree/branch/commit/suite table, and any merge-order hazards. It re-derives
   no plan content; it pins the mechanical commands so any session or the owner
   can resume without re-reading the build history.

---

## 1. Execution order (gates are hard; a failed gate stops that stage, not the session)

### Gate −1 — clean the tree (mechanical, do this first)

The BotVille working tree carries 20+ uncommitted modifications including every
tilemap and `assets.generated.ts` (review R-12). Plan `04-` Task 1's
byte-identical gate is meaningless without a clean baseline.

```
cd /Users/home/aisocialnetwork-BotVille && git status --short
# commit or stash, then record the baseline and confirm the suite:
shasum -a 256 packages/client/public/assets/venues.json
npm test          # expect exit 0, 22 tests, 3 files
```

**The root suite currently FAILS on the dirty tree** —
`test/asset-index.test.ts:36` asserts pack `'fixture'` and gets `'limezu'`
because `assets.generated.ts` and the 18 tilemaps are modified in place. On a
clean tree it is green (verified 2026-08-01: exit 0, 22 tests). If you see that
failure, the tree is not clean yet — it is not a real regression, and it is not
something to "fix" in the test.

Log the sha256 and the suite result. Success: `git status --short` is empty,
`npm test` exits 0, and both are in the log.

### Gate 0 — the awareness micro-round must be closed out

`2026-07-31-botville-drive/EXECUTION-LOG.md:75` records a **POST-DRIVE
AWARENESS MICRO-ROUND STARTED** that moved `configs/prompts/act.md` bytes
(visible at `act.md:15-16` on `main`), passed its probe, and has **no analyzer
write-up and no registered fact**. It tests hypothesis-0 against M-058 on the
same surface Plan `02-` Task 1 edits.

**No agent-facing surface in this set moves until that micro-round is analyzed
and its fact registered.** Plans `04-`, `01-` Tasks 1–8 and `03-` are unaffected
and proceed in parallel.

*(The gate the plans originally named — "rounds (d) and (e) have not run" — is
retired. Both ran 2026-08-01; M-057/M-058 are spent; the civic drive is closed
out. See R-1.)*

### Stage A — Plan `04-` Tasks 1–6, `home` role WITHHELD

Bake work, no runtime behaviour, no owner call. Per task: tests first → the
task's own gate green → commit.

**The `home`-role split is the whole point of this stage:** Task 2 declares the housing-ladder
archetypes **without** `roles: [home]`, and the `dorm` role edit does **not**
ship in this stage. Adding any `home`-role venue before Plan `01-` Task 3's
backfill re-homes **73 of 85** agents and breaks
`venueRegistryService.js:17-20`'s live invariant.

Stage-exit gate: `npm run bake:world` green; `venues.json` **byte-identical**
after Task 1 (a diff there is a defect, not a detail); both sync tests extended
and green with their fire-proofs demonstrated; the three `farm` filter sites
(`DistrictScene.ts:417`, `:434`, `:449` — R-9) resolved in whichever direction
Task 6 ruled, with the ruling logged; `venueRegistry.published()` still
byte-for-byte with the committed `venues.json`.

### Stage B — Plan `01-` Tasks 1–8 (api; no agent-facing surface)

Runs in parallel with Stage A once **Plan `04-` Task 1** has landed. Per task:
tests first → `npm test` green → commit.

**Ordering constraint, non-negotiable (F-7):** Task 3's steps run **in the
numbered order**. Step 3 backfills one stored home assignment per agent against
the pre-role vocabulary; **only then** step 4 lands the `dorm` role edit held
back from Stage A. **The proof is an empty diff** — after the role edit, no
agent's resolved home changed. If that diff is non-empty, stop; the ordering
broke.

Stage-exit gate: migration 041 applied on dev DB with its manifest test
(including the explicit no-cascade assertion); the boundary grep test green
(core reads no `botville_*` table); all three integrity checks
(unlock/home/plot) **demonstrated failing** before they are trusted; the
empty-home-diff test green; `get-city-map`'s page-1 byte budget asserted
against today's size.

### Stage B′ — the two pieces of Plan `04-` that are NOT in Stage A

A loop that stops at "Plan `04-` Tasks 1–6 green" will silently never do these.
**They have different unblock conditions — do not bundle them:**

- **Task 7 — plot authoring. Needs only ⛔ O-1**, not Stage B. Run it the moment
  O-1 is ruled, in parallel with Stage B. Derive the plot count rather than
  picking it: floor `ceil(85/7) = 13`, practical ceiling ~25–30,
  `scarcity_ratio` recorded as the knob. Assert
  `housing_plots ≥ ceil(population / capacity)` in the sync tests.
- **The `home`-role follow-up commit. Needs Stage B Task 3 step 3's backfill,
  and nothing else** — not O-1. Add `roles: [home]` to the ladder archetypes and
  the `dorm`, re-bake, re-run the empty-diff test. **This is the other half of
  the F-7 split**: Stage A withheld the role precisely so this commit could land
  after the backfill.

Stage-exit gate: bake green; the empty-home-diff test still green after the role
edit; plot coverage green in both sync tests.

### Stage C — Plan `03-`, parallelises throughout

Consumes surfaces, never moves them; never consumes a round. Only Task 5
(chronicle) waits on Plan `01-` being deployed. Tasks 2–3 are gated on **O-1**.
Golden-baseline capture before Task 1; an unexplained pixel diff afterwards is
a defect.

### Stage D — Plan `02-`, round-gated (internal order binding)

**Before writing Task 1 (F-6):** read round (b)'s raw traces
(`run_20260801_031541`) and determine why the reflector made zero write calls —
tool list at spawn, schema error, permission error, timeout, truncation. Log
the finding. The set's stated root cause is falsified by the same contracts
producing real MCP calls in rounds (c) and (e); do not spend a round on an
undiagnosed mechanism.

- **Task 1 → ROUND (f) → M-060.** D-77's optimising round. Ships alone.
  Gated on **O-2** and **O-3**.
- **Plan `01-` Task 9 + Plan `02-` Tasks 3–4 → ROUND (g).** Gated on **O-5**.
  Task 4 should ship ahead of the round (F-14) so (g) carries two strings, not
  three layers.
- **Task 5 → ROUND (h)**, only if (g) earns it.

**Every round runs the INDEX's three-step loop, no exceptions:**

1. **Probe.** For round (f) the probe has **three assertions and the first one
   is new**: (a) `discover_catalog(Path("configs/subagents"))` returns **four**
   entries and `"builder"` is one of them; (b) one delegation to `builder`
   lands and the builder makes **≥1 real MCP call**; (c) the composed request
   is captured byte-level with the builder's catalog line present and its order
   recorded. **Assertion (a) exists because the original `builder.yaml` could
   not load and `discover_catalog` swallows the error** — without it, a round
   that measures nothing looks exactly like a clean 85/85 result. **A round
   whose probe fails does not start.** Debug the mechanical path first; never
   theorise about agent behaviour over a broken one.
   For round (g): the placement line carries housing state in the captured soul
   prompt **and the projected full/where-only split is reported against
   M-056's 42/43** (F-13); one plot claim → build goal → completion → dawn flip
   → the structure present in `venues.json` at boot.
2. **The round** — no edits to ANY live checkout while it runs (nodemon deploys
   on write; the agents checkout IS the runtime). **Create a worktree first —
   `/Users/home/aisocialnetwork-agents-drive` no longer exists** (R-3); the
   civic close-out removed it.
3. **Analyzer write-up** — segment by `episode.decision`; count `tool_calls`,
   never `action_type`; **builder MCP calls made** is the number round (f)
   exists for; delegation fired/won/chosen per trigger; DB-side receipt counts
   beside episode counts; ≥10 raw-trace reads from the round's own log window;
   numerator, denominator and corpus in every sentence; dev-85 only, never
   pooled with prod-44. Register the M-fact **before** the next round starts.

---

## 2. Discipline riders (verbatim from the set — they are why this works)

- **One change, one measured round.** Never bundle across rounds; never compare
  across a re-baseline.
- **The plans are the instruction; the findings doc is history.** A `[R: id]`
  tag tells you where to look up *why*, never what to do instead.
- Feature work in worktrees; merges only inside deploy windows.
- Every number cites an `[M-nnn]` or declares its corpus in-sentence.
- **Facts start at M-060.** M-053..M-059 are all spent; nothing is reserved.
  Migrations start at **041**.
- **The kill criterion's baseline is 1/285, not 0/141** (S-8), and the one
  organic conversion followed through with `create-post` rather than
  `vote-city-goal`. A zero in round (g) has a cheaper competing explanation —
  the vote-rung copy gap — unless O-5 closes it first.
- **`deriveResidenceVenues`'s ordering is load-bearing.** Adding any
  `home`-role venue is a home-reassignment event unless every agent already
  holds a stored row. This is why `tent` is the next instance of the same bug.
- **D-66 ships at four of its six requirements** (externality is deferred).
  No write-up may claim emergent zoning "shipped and did not happen."
- prod-44 is out of scope entirely (owner-owned rebuild).

---

## 3. Stop and ask the owner (do not improvise past these)

**The six owner calls are hard stops. Each one has options stated in
`DECISIONS.md` and a recommendation where the review has one. Choosing one
yourself is the failure mode the review exists to prevent — O-1 option (c)
silently repeals D-66, and O-2 option (a) burns a PCO re-baseline mid-drive.**

| call | blocks | one line |
|---|---|---|
| **O-1** | `04-` T7, `01-` T1, `03-` T2/T3 | How does a plot become a venue? Pre-stamp 50–125 entries, decouple identity from archetype, or constrain at authoring (= D-66 repealed). |
| **O-2** | `02-` T1 / round (f) | Does `contribute-to-city-goal` leave L1 (28→27 + PCO re-baseline), or stay and also sit on the builder (2nd D-29 exception)? |
| **O-3** | `02-` T1 / round (f) | May the compiler acquire a city section, or does it route via md-gen / `manager_context`? A passing test currently forbids the first. |
| **O-4** | `01-` T2 | Non-civic backstop for claim hoarding, given D-31/D-32 forbid timers and civic action is 1/285? |
| **O-5** | round (g) | Close the ledgered vote-rung copy gap first, or accept that (g)'s result is unattributable? |
| **O-6** | `01-` T1 rollback | Deliver D-72 with a non-additive migration, or downgrade it to documented intent? |

**In a loop, do not halt the session on an owner call.** Write the question and
your recommendation to `EXECUTION-LOG.md` under `## PARKED — OWNER CALLS`, then
**continue with every unblocked task**. Halt only when nothing unblocked
remains, and say in the log that that is why you stopped.

**Unblocked today, precisely:** Gate −1; Stage A in full (Plan `04-` Tasks 1–6);
Stage B Tasks 1 (four of five tables — **not** `botville_plots`, which O-1
shapes), 3, 4, 5, 6, 7, 8; Stage C Task 1.
**Partially blocked:** Stage B Task 2 may build the state machine and the claim
path but **not** the revocation path (O-4).
**Blocked outright:** Plan `04-` Task 7 and Stage C Tasks 2–3 (O-1); all of
Stage D (Gate 0, plus O-2/O-3/O-5).
**Not blocked by an owner call, only by sequence:** the `home`-role follow-up
commit — it waits on Stage B Task 3 step 3 and on nothing else.

**A failed stage-exit gate stops that stage, not the session.** Log the failure
with its output, then move to the next unblocked stage. Do not retry a gate more
than once without changing something, and never edit a test to make a gate pass
— a red gate is information.

**Also stop and ask when:**
- A probe still fails after the mechanical path is verified end-to-end.
- Any measurement contradicts a D-59..D-78 ruling (measurement wins — but the
  ruling revision is the owner's, not yours).
- An anchor you re-open has rotted in a way that changes a task's shape, not
  just its line number.
- Anything would touch prod, or deploy an agent-facing change outside its round
  window.

---

## 4. Close-out

When round (g)'s fact is registered: write the drive summary at the top of
`EXECUTION-LOG.md` (stages completed, rounds run, headline deltas vs M-058,
which owner calls were ruled and as what D-numbers, open items), land the §9
vocabulary additions in `CONTEXT.md` in the same style, update project memory,
and record every anchor that rotted during execution — that list is the input
to the next drive's review.
