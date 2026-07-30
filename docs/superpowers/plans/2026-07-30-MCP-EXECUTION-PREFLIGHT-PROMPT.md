# Next session — pre-flight, then execute the platform-MCP plans

Paste into a fresh session at the repo root. Assumes no prior context.
Follows the pattern of `2026-07-30-EXECUTION-PREFLIGHT-PROMPT.md` (visual
set — fully executed and merged 2026-07-30).

## State

- Visual-assets Plans 1–6: executed, merged and pushed. BotVille `main` at
  `a4f691b`+, api `main` at `eed7961`+. Golden gate green, hero approved,
  D-20 self-host shipped. Full record: `PREFLIGHT-2026-07-29.md`,
  `DECISIONS.md` (D-15..D-20) in `2026-07-27-botville-visual-assets/`.
- MCP plan set (this session's work):
  `docs/superpowers/plans/2026-07-29-botville-platform-mcp/` — three plans:
  `01-world-module-api.md` (api, 9 tasks), `02-agents-registration.md`
  (BotTown platform side, 5 tasks — **Task 5 is OWNER-GATED**),
  `03-botville-fixture-and-repoint.md` (BotVille client, 5 tasks).
  Order per its `00-INDEX.md`: **01 first**; 01 Task 5 hard-depends on
  migration `037_add_schedule_venue` — ALREADY RUN and live in api `main`
  (visual Plan 5 shipped the migration + the deterministic schedule
  writer; `users_schedules.venue` is populated for all 85 agents).
- Carries INTO this set (recorded in the visual set's DECISIONS/plans):
  F-5 identity bundle is NOT this set's scope (03 renders platform agents
  as seed-derived premade humans; baked appearances come after); the LLM
  schedule generator must NOT be reactivated without `isOpenForSpan`
  gating (hard condition, visual Plan 5 final review); `@vercel/analytics`
  dropped; deployment is self-hosted Docker (D-20) — nothing in these
  plans may reintroduce Vercel/Railway.
- Method (locked): superpowers:subagent-driven-development, plans in INDEX
  order, one final whole-branch review per plan on the most capable model.

## Gate — before anything else

1. **Both mains clean and synced.** `git status` clean in
   `/Users/home/aisocialnetwork-BotVille` and `/Users/home/aisocialnetwork-api`;
   both `git pull` to origin. Never run plan verification on a dirty tree.
2. **Workspaces.** BotVille work (plan 03): fresh worktree branched from
   `main`. Api + BotTown work (plans 01–02): feature branch in
   `/Users/home/aisocialnetwork-api` from its `main`. The old visual-set
   worktree (`.claude/worktrees/agent-a7145ab20862a3868`, fully merged)
   can be removed if still present.
3. **Green baselines.** BotVille (Node 24 required:
   `export PATH=/Users/home/.nvm/versions/node/v24.18.0/bin:$PATH; export
   BOTVILLE_REPOS_ROOT=/Users/home`): `npm run test:all` → 270 fast +
   40/41 bake (1 designed skip), porcelain-clean. Api: `npm test` → all
   pass (+1 clean skip without `BOTVILLE_REPO` set).

## Pre-flight — three checks, run as parallel subagents (~30 min)

1. **Staleness pass (the big one).** The MCP plans were written 2026-07-29,
   BEFORE the visual execution ran — every quoted anchor may have moved.
   One fresh-eyes agent reads all three plans end-to-end against merged
   reality: plan 03's client anchors (`useGameSync`, `applyLocations`,
   `PresenceModel` — all substantially rewritten by the F-3 addendum;
   `normalizeLocation` no longer exists), the shipped `AgentPresence`
   (four required fields + optional additions, addendum I.4 — plan 03
   Task 1's "restated I-11" test must match `packages/shared` as merged),
   `AppearanceRecord`'s D-19 field renames (`hairVariant`/`outfitVariant`)
   anywhere the plans name appearance fields, the shipped `venues.json`
   (8 fields × 18 venues, café night window), the schedule writer's real
   API (`splitAtOpenings`, containment gating) vs plan 01 Task 5's
   `getCurrentSlot` text, `pickFrom` export (exists), and any
   Vercel/Railway/deploy remnants (D-20). Deliverable: per-plan list of
   stale anchors with severity; plan-text fixes to apply before execution.
2. **Api/BotTown substrate check.** Verify the seams plans 01–02 build on
   still match their quoted anchors post-merge: `registerTool` pattern,
   `configs/defaults.yaml`, `EXCLUDED_TOOLS`, `_CATEGORY_OVERRIDES`,
   migration 036/037 conventions and the 037 column as shipped,
   `Schedule.getCurrentSlot` current shape, zod usage. Also confirm the
   BotTown frontend/api hosting assumptions in plan 02 match the real
   deployment (self-hosted, D-20).
3. **Shipped-behaviour smoke.** Run the api suite + BotVille `test:all`;
   spot-run `presence`-relevant pieces the plans consume: the schedule
   writer sweep (SC-1/crowding/night-owls all green on the dev DB), and
   the client's fixture-mode path (`agentLife.ts` untouched — plan 03
   promises byte-identical fixture behaviour; capture its current
   `GET /api/agents/locations` shape as the baseline the tolerant parser
   must coexist with).

## Owner decisions — batch what surfaces

1. Plan 02 **Task 5 (L1 promotion of the six BotVille tools) is gated** —
   do not implement without explicit owner sign-off recorded in-session;
   ask when Plan 02 reaches it, not before.
2. `PRESENCE_MODE` default after plan 03 Task 2 lands (fixture vs
   integrated for local dev) — ask with a recommendation when the switch
   exists.
3. Anything the staleness pass surfaces as blocking.

## Execute

Resume SDD at **Plan 01 Task 1** (fresh ledger per plan under
`.superpowers/sdd/`). Standing rules:

- `BOTVILLE_REPOS_ROOT=/Users/home` and the Node-24 PATH export in every
  BotVille dispatch; api-repo conventions (CommonJS, its Node, its test
  layout) bind inside the api repo — BotVille Global Constraints do not.
- Local-dev quirks (verified this session): turbo strict-env strips
  undeclared vars — run `dev:server`/`dev:client` directly with env
  exported; `packages/server/.env` (gitignored throwaway secrets) must
  exist; the local roster is per-session-user — seed `agents` rows for
  every `users.id` when a browser needs to see agents.
- A real-art bake rewrites 18 tracked `.tmj` — `git restore
  packages/client/public/assets/tilemaps packages/client/src/game/assets.generated.ts`
  before any gated suite; the fixture-geometry guard fails loudly otherwise.
- Owner-gated steps and anything touching the live BotTown platform
  config stop at the line — prepare, verify locally, ask.
- The filesystem wins over any doc, including this one.
