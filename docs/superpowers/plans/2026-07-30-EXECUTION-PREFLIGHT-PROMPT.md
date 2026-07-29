# Next session — pre-flight, baseline code review, then execute the plans

Paste into a fresh session at the repo root. Assumes no prior context.
Supersedes `2026-07-27-botville-visual-assets/NEXT-SESSION-PROMPT.md` (fully
executed 2026-07-29 — all three tracks closed).

---

## Where things stand

- **The six visual-assets plans are revised, review-verified, and executable.**
  All review findings applied (batches A1–A6, cuts C-1/C-2/C-4); Track C
  (affordances, sleep-at-home residences, footprint-aware slots, LimeZu credit)
  incorporated. Branch `docs/botville-visual-assets-plans`, through commit
  `9846027`.
- **The world addendum spec is owner-approved:**
  `docs/superpowers/specs/2026-07-29-botville-world-addendum-design.md` —
  binding Conventions, assignment registry, modular-monolith boundary rules,
  platform-MCP design (Part II).
- **A second plan set exists for the platform MCP** (executes *after* the
  visual set): `docs/superpowers/plans/2026-07-29-botville-platform-mcp/`.
- **Plan 1 Tasks 1–2 are already executed, verified and committed** in the
  worktree `.claude/worktrees/agent-a7145ab20862a3868` (branch
  `worktree-agent-a7145ab20862a3868`, commits `a904c32`, `55e8b7f`): 13 tests
  pass, `tsc --noEmit` clean, `vite build` resolves the shared subpath. Its
  SDD ledger is at `<worktree>/.superpowers/sdd/01-foundations/progress.md`.
- Machine ran Node 22.22 at last check; plans target ≥24 (everything so far
  verified working on 22).

**Execution method (locked):** superpowers:subagent-driven-development, one
plan at a time, in the worktree above. Recommended keep-alive: `/goal` scoped
per plan ("Plan N tasks complete in the SDD ledger or BLOCKED").

**Do not start Plan 1 Task 4 until Phases 0–3 below are done.** They exist
because five different agents edited the plans in one session, because the
substrate codebase has never been reviewed, and because three owner decisions
are still open.

---

## Phase 0 — environment prep (mechanical, ~15 min)

- [ ] **Rebase the execution worktree onto current `main` first.** Commit
  `31ba644` translated all Russian comments/log strings to English across
  code, scripts and the plan docs — in lockstep. The worktree branch
  (`worktree-agent-a7145ab20862a3868`) is based on the pre-translation
  initial commit, so the plans' quoted English anchors (e.g.
  `sync-assets: copied 90/90`) will NOT match its Russian files until it is
  rebased: `git rebase main` in the worktree (expect at most comment-level
  conflicts in the files Tasks 1–2 touched), then re-run `npm test` —
  13 pass / 2 skips is the green baseline.
- [ ] Install Node 24 (`nvm install 24 && nvm use 24`) — required before
  Plan 6; everything earlier runs on 22.
- [ ] Decide the main checkout's dirty `package-lock.json` (modified,
  uncommitted since before 2026-07-29): commit or discard.
- [ ] `ln -s /Users/home/aisocialnetwork-BotVille/assets-src <worktree>/assets-src`
  (gitignored; needed from Plan 6; harmless earlier). Note: Plan 6 Task 3b
  deletes the QA symlinks *inside* the real `assets-src/` — intentional; it
  breaks the main checkout's legacy pipeline by design.
- [ ] Create a feature branch in `/Users/home/aisocialnetwork-api`
  (e.g. `feat/botville-venue-seam`) — Plan 5 edits that repo and the plans
  never say to branch it.
- [ ] Every implementer dispatch gets `BOTVILLE_REPOS_ROOT=/Users/home` (the
  cross-repo tests skip loudly without it; from a worktree the sibling
  fallback resolves wrong).
- [ ] `npm run dev` in the main checkout and **look at the city** — still the
  single best calibration for every judgement below, and still not done.

## Phase 1 — plan verification sweep (subagents, parallel, ~30 min)

- [ ] **Coherence pass over the six visual-assets plans.** One fresh-eyes
  review agent reads all six end-to-end *as revised*: task numbering and
  Files-blocks vs steps, the seven Global Constraints copies byte-identical,
  cross-plan references, "Expected: N tests" counts, orphaned references to
  cut machinery. Five agents edited these files; nobody has read the result
  whole.
- [ ] **Re-measure the body sheets.** Script over
  `assets-src/interiors/2_Characters/Character_Generator/`: confirm bodies
  927×656 vs 896×656 elsewhere, and opaque pixels in cols 896–926. Every
  composer edit rests on ART-PACK-QA's unre-verified word.
- [ ] **Sit/sleep row alpha-check for hair + accessory layers** (the known
  LimeZu defect class), and **confirm Plan 4 actually contains the Task 27
  Step 0 coverage check** — it was recommended; no agent confirmed adding it.
- [ ] **Read `Modern_Exteriors_License.pdf`** — the one licence never read.
- [ ] **Affordance vocabulary:** confirm `schemas/venues.schema.json` (Plan 2)
  defines a closed enum of affordance tokens, not free strings — free strings
  across two repos is the free-text→venue bug reborn one level up.
- [ ] **Reconcile `hours`:** plans use a list of windows; the addendum's I.1
  example shows a single object. Fix the addendum to match (list).
- [ ] **Confirm D-10/I-12 restatement** landed in the base spec and no plan
  still enforces "no art in any image."

## Phase 2 — baseline code review of the substrate (the new work)

The plans transform BotVille's asset pipeline; **nothing has ever reviewed the
code being kept.** Run a code review (e.g. `/code-review`, or review agents by
dimension) scoped to:

- **In scope — the kept substrate:** `packages/client/src/game/**` (2,440
  lines the vision calls "the asset"), `packages/client/src/{store,hooks,lib}`,
  `packages/shared`, the Vite/turbo/tsconfig build setup, and the client's
  runtime behaviour (memory leaks in scene transitions, poll handling, error
  paths).
- **Out of scope — already sentenced by the product docs, don't waste review
  effort:** `packages/server/src/world/agentLife.ts` (deleted by MCP Plan 03
  era), key vault / model picker UI (unwanted per D8), most of
  `packages/server` (replaced by the platform), the legacy build scripts
  (retired by Plan 2).

Deliverable: an explicit verdict on **"is BotVille a sound platform to build
on?"** with findings ranked by whether they (a) block the plans, (b) should be
folded into a plan task, (c) are fix-later. Anything in category (a) goes to
the owner before execution starts. The explanatory comments in
`packages/client` are English and load-bearing (verified crop coordinates) — a
reviewer flagging them as noise is wrong.

## Phase 3 — owner decisions (batch, one AskUserQuestion)

- [ ] **Doorless residences in v1:** Track C ships residence interiors
  jump-reachable only; district doors are a marked follow-up. Night district
  = empty streets. Accept for v1?
- [ ] **The variant-curation gap:** the pack has 200 hairstyles / 132 outfits;
  `AppearanceRecord` picks from 12 / 8. *Someone* must choose which 12 and 8
  — decide who/when (owner curates from contact sheets after Plan 1 Task 9a,
  or implementer picks first-N provisionally, owner swaps later).
- [ ] Anything Phase 1 or Phase 2 surfaced.

## Phase 4 — execute

Resume subagent-driven development at **Plan 1 Task 4** in the worktree (the
ledger already marks Tasks 1–2 complete — do not re-dispatch them). Plans
1→6 in index order. Batch the human-eye checkpoints (localhost render checks,
Plan 6 curation review, hero render) instead of letting agents self-certify;
actual Vercel/Railway deploys are owner actions. The MCP plan set
(`2026-07-29-botville-platform-mcp/`) follows the visual set — see its
`00-INDEX.md` for the three coupling points.

## How to work

- Subagents for everything; the controller session only coordinates.
- The filesystem wins over any doc, including this one — verify anchors.
- Report each phase's results to the owner before starting Phase 4.
