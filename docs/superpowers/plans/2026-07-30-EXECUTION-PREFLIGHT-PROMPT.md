# Next session — pre-flight, then execute the visual-assets plans

Paste into a fresh session at the repo root. Assumes no prior context.
Supersedes `2026-07-27-botville-visual-assets/NEXT-SESSION-PROMPT.md` (fully
executed 2026-07-29).

## State

- Six visual-assets plans: revised, review-verified, executable
  (`docs/superpowers/plans/2026-07-27-botville-visual-assets/`, on `main`).
- Approved spec addendum: `docs/superpowers/specs/2026-07-29-botville-world-addendum-design.md`.
- MCP plan set (executes AFTER the visual set): `docs/superpowers/plans/2026-07-29-botville-platform-mcp/`.
- Execution worktree `.claude/worktrees/agent-a7145ab20862a3868`: Plan 1
  Tasks 1–2 done and verified (13 tests pass); SDD ledger at
  `<worktree>/.superpowers/sdd/01-foundations/progress.md`.
- Method (locked): superpowers:subagent-driven-development, Plans 1→6 in
  order, in that worktree. `/goal` scoped per plan as keep-alive.

## Gate — do these two things before anything else

1. **Main checkout must be clean.** On 2026-07-29 another session had
   uncommitted edits across the plans and client UI (English-only pass).
   If `git status` is not clean, that work is unfinished — get it committed
   (or the owner's call) first. Never run plan verification against a dirty
   tree, and never have two sessions editing the plans at once.
2. **Rebase the worktree onto `main`.** Commit `31ba644` translated all
   Russian comments/strings to English, code and plan anchors in lockstep;
   the worktree predates it, so plan-quoted anchors (e.g.
   `sync-assets: copied 90/90`) won't match its files until rebased.
   `git rebase main` in the worktree, then `npm test` — green baseline is
   13 pass / 2 skips.

## Pre-flight — three checks, run as parallel subagents (~30 min)

1. **Plan coherence pass.** One fresh-eyes agent reads all six plans
   end-to-end as revised (five different agents edited them; nobody has read
   the whole). Check: task numbering and Files-blocks vs steps; the seven
   Global Constraints copies identical; cross-plan references; orphaned
   references to cut machinery; `schemas/venues.schema.json` defines a
   closed enum of affordance tokens (not free strings); the addendum's
   `hours` example matches the plans (list of windows — fix the addendum if
   not); the base spec carries the D-10 restated I-12.
2. **Pixel + licence check.** One script over `assets-src/`: body sheets
   927×656 vs 896×656 with real art in cols 896–926 (every composer edit
   rests on this unre-measured claim); sit/sleep-row alpha coverage for hair
   and accessory layers (the known LimeZu defect class) — and confirm Plan 4
   actually contains the Task 27 Step 0 coverage check. Read
   `Modern_Exteriors_License.pdf` (the one licence never read).
3. **Substrate code review.** The plans build on code nobody has reviewed.
   Scope IN: `packages/client/src/game/**`, `src/{store,hooks,lib}`,
   `packages/shared`, build setup. Scope OUT (already sentenced by product
   docs): `agentLife.ts`, key vault, model picker, most of
   `packages/server`, legacy build scripts. Deliverable: verdict on "sound
   platform to build on?" with findings triaged blocks-plans /
   fold-into-task / fix-later.

## Owner decisions — one batched question

1. **Doorless residences in v1?** Track C ships residence interiors
   jump-reachable only; district doors are a follow-up. Night district =
   empty streets.
2. **Variant curation:** pack has 200 hairstyles / 132 outfits; the
   appearance axes pick 12 / 8. Who chooses which — owner from contact
   sheets (after Plan 1 Task 9a), or first-N provisional?
3. Anything the three checks surfaced as blocking.

## Execute

Resume SDD at **Plan 1 Task 4** (ledger marks 1–2 complete — do not
re-dispatch). Standing rules:

- `BOTVILLE_REPOS_ROOT=/Users/home` in every implementer dispatch.
- Before Plan 5: create a feature branch in `/Users/home/aisocialnetwork-api`.
- Before Plan 6: Node 24 installed; symlink `assets-src/` from the main
  checkout into the worktree. (Task 3b then deletes the QA symlinks inside
  the real `assets-src/` — intentional.)
- Human-eye steps (localhost render checks, curation review, hero render)
  and real Vercel/Railway deploys go to the owner — agents never
  self-certify them.
- The filesystem wins over any doc, including this one.
