# ROUND RUNBOOK — BotVille City Growth

Companion to `EXECUTION-LOG.md` (the log is truth; this file pins mechanical
commands only — it re-derives no plan content). Any session or the owner can
resume from here without re-reading the build history.

## Trees / branches / suites

| tree | branch | base | purpose | suite command | last known state (2026-08-03 EOD) |
|---|---|---|---|---|---|
| `/Users/home/aisocialnetwork-BotVille` | `main` @ `fb6f068` | — | canonical + docs/log; **do not develop here** | `npm test` | clean, green (Gate −1) |
| `/Users/home/botville-wt-04-bake` | `plan-04-archetypes-bake` @ `a3d0214` | `fb6f068` | Plan `04-` T1–6, 8 + B′ home-role commit + hardenings | `BOTVILLE_AISOCIALNETWORK_API_REPO=/Users/home/api-wt-01-plots npm test && npm run test:bake` | **COMPLETE** — 314/314 + bake 42/42, exit 0 |
| `/Users/home/botville-wt-03-client` | `plan-03-client` @ `ac3f9da` | `3828f7c` | Plan `03-` Task 1 (multi-district) | `npm test` (node ≥24) | **COMPLETE** — 325/325 + 22 vitest, exit 0 |
| `/Users/home/api-wt-01-plots` | `plan-01-plots-housing` @ `53d4ff1` | api `d5b11c1` | Plan `01-` unblocked scope; migrations **042 + 043** (both applied to dev DB) | `BOTVILLE_REPO=/Users/home/botville-wt-04-bake npm test` | **COMPLETE** — 1256/1256, exit 0 |
| `/Users/home/api-wt-04-sync` | `plan-04-sync-tests` @ `8480935` | api `d5b11c1` | api half of `04-` Task 6 sync tests | `node --test tests/venueVocabularySync.test.js` | **COMPLETE** — exit 0; merge FIRST, then plan-01 rebased |
| `/Users/home/aisocialnetwork-agents` | `main` @ `cfb23e1` | — | **LIVE RUNTIME** (nodemon); awareness program at owner-deferred checkpoint | `python -m pytest tests/heartbeat/` | untouched by this drive |

## Live runtimes — do not edit in place

- `/Users/home/aisocialnetwork-api` runs `nodemon src/app.js` (pid seen
  2026-08-03). Every api change goes through a worktree; merge only in a
  deploy window.
- `/Users/home/aisocialnetwork-agents` is the live agents checkout. Rounds
  gate any edit there. No round is in flight as of 2026-08-03.

## Resumption commands

```bash
# status of everything
cd /Users/home/aisocialnetwork-BotVille && git worktree list && git -C /Users/home/aisocialnetwork-api worktree list
tail -40 docs/superpowers/plans/2026-08-botville-city-growth/EXECUTION-LOG.md

# BotVille bake branch
cd /Users/home/botville-wt-04-bake && git log --oneline main..HEAD && npm test && npm run test:bake

# api plots branch
cd /Users/home/api-wt-01-plots && git log --oneline main..HEAD && npm test
```

## Merge-order hazards

1. **Two api branches are in flight** (`plan-01-plots-housing`,
   `plan-04-sync-tests`). Merge `plan-04-sync-tests` first (test-only, small),
   then `plan-01-plots-housing` rebased on it — or cherry-pick; both touch
   `tests/venueVocabularySync.test.js` potentially.
2. **The `home`-role follow-up commit** (Stage B′) must land ONLY after Plan
   `01-` Task 3 step 3's backfill has run against the dev DB (proof: the
   empty-home-diff test). It edits BotVille (`dorm` + ladder `roles`) and
   re-bakes — order is F-7's whole point.
3. **Stage C (client, `DistrictScene.ts`) conflicts with `04-` Task 6's farm
   filter edits** — Stage C branches only after `plan-04-archetypes-bake`
   merges.
4. The Gate −1 stash `stash@{0}` on BotVille main holds the CONTEXT.md §9
   vocab draft (close-out lands it) and the limezu bake residue (regenerable;
   drop or re-bake deliberately — never commit blindly).
5. Migration numbering: this drive took **042 and 043** (`041` is the
   awareness program's; next free is **044**). Facts start at **M-071**.
6. **Until the branches merge, neither main checkout is a valid sync
   target** — the cross-repo sync tests need the env vars in the table
   above (the branch copies lead their siblings' mains). Merging both
   branches restores default resolution.
7. **Merging `plan-01-plots-housing` into the live api is a deploy-window
   event**: it moves `get-city-map`'s MCP schema (limit/offset) and the
   dorm's role reaches the served vocabulary — re-baseline per C8 before
   any subsequent measured round.
