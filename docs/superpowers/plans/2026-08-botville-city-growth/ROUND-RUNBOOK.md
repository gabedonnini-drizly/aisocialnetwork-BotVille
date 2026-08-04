# ROUND RUNBOOK — BotVille City Growth

Companion to `EXECUTION-LOG.md` (the log is truth; this file pins mechanical
commands only — it re-derives no plan content). Any session or the owner can
resume from here without re-reading the build history.

## Trees / branches / suites

| tree | branch | base | purpose | suite command | last known state (2026-08-03, post D-79..D-89 execution) |
|---|---|---|---|---|---|
| `/Users/home/aisocialnetwork-BotVille` | `main` @ `6a8ddd5` | — | canonical + docs/log (D-79..D-89 committed); **do not develop here** | `npm test` | clean, green |
| `/Users/home/botville-wt-04-bake` | `plan-04-archetypes-bake` @ `067e45d` | `fb6f068` | Plan `04-` COMPLETE incl. Task 7 (92×92 district, 23 plots, D-88/D-89) | `BOTVILLE_AISOCIALNETWORK_API_REPO=/Users/home/api-wt-01-plots npm test && npm run test:bake` | **COMPLETE + reviewed + hardened** |
| `/Users/home/botville-wt-03-client` | `plan-03-client` @ `5dad79b` | merged `067e45d` | Plan `03-` Tasks 1–3 COMPLETE (multi-district, plot states, generated doors) | same env; `npm test` (node ≥24) | **COMPLETE + reviewed + hardened** — 403/403 + 25 |
| `/Users/home/api-wt-01-plots` | `plan-01-plots-housing` @ `f0407f2` | api `d5b11c1` | Plan `01-` COMPLETE; migrations **042–046** applied to dev DB; merge-frozen behind `BOTVILLE_GROWTH_SURFACES` | `BOTVILLE_REPO=/Users/home/botville-wt-04-bake npm test` | **COMPLETE + reviewed + hardened** — 1371+/exit 0 |
| `/Users/home/api-wt-04-sync` | `plan-04-sync-tests` @ `8480935` | api `d5b11c1` | api half of `04-` Task 6 sync tests | `node --test tests/venueVocabularySync.test.js` | **COMPLETE** — merge FIRST, then plan-01 rebased |
| `/Users/home/agents-wt-growth` | `growth-builder-delta` @ `8df5783` | agents `cfb23e1` | Plan `02-` delta (city section, builder craft, unhoused_self, episode attribution QA-L19) | venv `pytest tests/heartbeat/ -q` | **COMPLETE + reviewed + hardened** — 3109/11skip |
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
7. **Merging `plan-01-plots-housing` into the live api is now
   flag-frozen** (post `ed6b884`/`c7b2a46`): with `BOTVILLE_GROWTH_SURFACES`
   unset, every agent-visible surface is byte-identical to main EXCEPT 15
   raw JSON bytes — the dorm's deliberate D-60 `home`/`sleep` vocabulary
   edit (empty-home-diff proven, pinned in a test as the named merge
   delta). The schema params, unhousedCount, 41-venue map, founding goal,
   growth-kind proposals, ## City, `unhoused`, and claim-plot ALL wake
   together when the flag flips — which is round (f)'s one change.
   Deploy sequence: merge branches → run migrations 042–046 on the target
   DB → nodemon restarts flag-off (inert) → round (f) window: flip flag,
   probe, round, analyze, register M-071.
