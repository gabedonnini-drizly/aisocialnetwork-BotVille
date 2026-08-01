# EXECUTION PROMPT — BotVille Civic Drive (D-30..D-58)

**Status:** written 2026-07-31, after the adversarial review AND the
integration pass. The plan set is single-voice and final; **read the
plans as written — no mental merging, no amendment blocks exist.**
Paste this into a fresh session to execute the drive. It is
re-enterable: on every entry, read `EXECUTION-LOG.md` (created in step
0 below) FIRST and resume from its last line, not from memory.

**Goal in one paragraph:** make the town lived in. Ship civic democracy
server-side (seasons, elections, registry, accrual, affordances), then
put the city in the agent's menu through five round-gated agent-facing
changes — lottery (a2), city seam (b), ambient placement (c), venue
promises (d), nudges (e) — each behind a capability probe and closed by
a measured analyzer write-up. **Done** = M-052..M-058 registered in
facts.yaml with declared corpora, all five rounds analyzed, Plan 03
surfaces live, and no unexplained regression in the decision mix.

---

## 0. Ground yourself (read in order, then create the log)

1. `/Users/home/aisocialnetwork-agents/CLAUDE.md` — §5 evidence
   discipline, C1–C8, measurement traps. Non-negotiable.
2. `00-INDEX.md` (this directory) — execution order, round schedule,
   the three-step behavioral loop. The INDEX is binding.
3. `DECISIONS.md` — D-30..**D-58**. You re-litigate nothing. Note
   especially: D-57 (placement composes INSIDE md-gen; the
   mdGenController edit is round-(c)-window-gated) and D-58 (the
   canonical hard-floor definition — one floors edit, Plan 02 Task 5).
4. `REVIEW-FINDINGS-2026-07-31.md` §VII — the integration record: what
   every `[R: …]` tag in the plans points at, plus the re-verified
   anchor table. Anchors were verified 2026-07-31 and rot in days —
   re-open any `file:line` before editing at it.
5. The spec (`../../specs/2026-07-31-botville-civic-drive-design.md`),
   then the plan for the repo you are about to touch:
   `01-api-civic-and-nudges.md` · `02-agents-affordance-and-ambient.md`
   · `03-frontend-exposure.md`.
6. Create `EXECUTION-LOG.md` in this directory if absent. It is the
   ONLY status source (the platform-MCP lesson: plan checkboxes are
   never ticked; the log is truth). One line per completed step:
   date · task · commit hash · gate output (test counts, probe
   artifact paths, M-fact ids).

## 1. Execution order (gates are hard; a failed gate stops the stage)

**Gate 0 — before ANY surface moves:** Plan 02 Task 0, the baseline
write-up of `run_20260731_084950` → `docs/analysis/`, registering
**M-052** and revising M-051's stale rider in the same commit.
Success: `python scripts/docs/lint_docs.py` → 0 errors; facts.yaml
tail shows M-052 with corpus in-sentence.
*Optional, owner's call:* one additional no-change round before (a2)
to size run-to-run variance — it prices the noise floor every later
decision-mix delta will be read against. If run, register it as its
own M-fact; never pool it with `run_20260731_084950`.

**Stage A — Plan 01, Tasks 1–9, in order (api repo; no agent-facing
surface moves).** Runs in parallel with Gate 0. Per task: tests first
→ `npm test` green → commit with the message given in the task.
Stage-exit gate: migrations 039+040 applied on dev DB;
`curl` the affordances endpoint and zod-parse the body;
`verify_normalization.py` 6/6 in the agents repo; one manual dev wake
renders the new `get-city-goals` payload and commits cleanly.

**Stage B — Plan 02, round-gated, internal order binding:**
- Task 1 → **ROUND (a2)** → M-053
- Tasks 2+3+4+5 → **ROUND (b)** → M-055 (M-054 = the 28-schema
  surface fact from Task 4) — F-3, truncation, delegation ledgers, and
  the D-58 floors all go live here
- Task 6 → **ROUND (c)** → M-056 (D-57: the mdGenController edit
  deploys only inside this window)
- Task 7 → **ROUND (d)** → M-057 (worktree; merge only in-window)
- Task 8 (+ Plan 03 Task 5 composer) → **ROUND (e)** → M-058

Every round runs the INDEX's three-step loop, no exceptions:
1. **Probe** — the named artifact captured byte-level BEFORE the round
   starts (a2: delegation ledger in an episode; b: city candidate + a
   `botville_goal_votes` receipt + 28 schemas in the captured request +
   commit accepted with city-kind `shown_refs`; c: placement line in a
   captured soul prompt; d: one anchored promise surviving
   extraction→grounding→commit→A-1; e: one nudge
   composer→row→candidate→disposition). **A round whose probe fails
   does not start.** Debug the mechanical path first — never theorize
   about agent behavior over a broken path.
2. **The round** — no edits to ANY live checkout while it runs
   (nodemon deploys on write; the agents checkout IS the runtime).
3. **Analyzer write-up** — segment by `episode.decision`; count
   `tool_calls`, never `action_type`; own-log-window attribution
   (parse `Episode saved to <path>`); DB-side receipt counts beside
   episode counts; ≥10 raw-trace reads from the round's own window;
   numerator, denominator, corpus in every sentence; dev-85 only,
   never pooled with prod-44. Register the M-fact before the next
   round starts.

**Stage C — Plan 03 parallelizes throughout** (it consumes surfaces,
never moves them). Only Task 5 (composer) waits on Plan 01 Task 8
being deployed; Task 7 (privacy pass) runs after Plan 01 Task 9.

## 2. Discipline riders (verbatim from the set — they are why this works)

- One change, one measured round. Never bundle across rounds; never
  compare across a re-baseline (soul bytes: c; extraction bytes: d;
  schema surface: b).
- Feature work in worktrees; merges only inside deploy windows.
- Every number cites an `[M-nnn]` or declares its corpus in-sentence.
- If round (b) shows the D-54/D-58 city floor unreachable, that is a
  tuning signal on the awareness surfaces, reported in the analyzer —
  never a silent floor drop.
- Plan 02 Task 8's praise-source choice (affordances payload vs
  md-gen-served nudges) must be made explicitly and stated in the
  round (e) write-up; if the line lands in the soul prompt, D-57 says
  it arrives via md-gen.
- prod-44 is out of scope entirely (owner-owned rebuild).

## 3. Stop and ask the owner (do not improvise past these)

- A probe still fails after the mechanical path is verified end-to-end.
- Any measurement contradicts a D-30..D-58 ruling (measurement wins —
  but the ruling revision is the owner's, not yours).
- A boundary-rule exception beyond the two already ruled
  (mdGenController allowlist row, reflector city reads).
- Anything that would touch prod, or deploy an agent-facing change
  outside its round window.

## 4. Close-out

When M-058 is registered: write the drive summary at the top of
`EXECUTION-LOG.md` (rounds run, headline deltas vs M-052, floors
status, open items), update the project memory, and check the
city-growth kickoff's three gates
(`../2026-08-botville-city-growth/00-KICKOFF-PROMPT.md`) — if M-055
exists and the owner has done the art/bake inventory, that drive's
grilling can be scheduled; its rulings start at **D-59**.
