# Platform-MCP plan set — execution record (2026-07-30 → 2026-07-31)

All three plans executed via superpowers:subagent-driven-development, in INDEX
order, one final whole-branch review per plan on the most capable model.
Owner decisions D-21..D-29 in `DECISIONS.md`.

## Outcome

- **Plan 01 (api)** — 9/9 tasks, merged to `aisocialnetwork-api` main
  (`eed7961..296d121`, ff). 786/786 tests. Migration 038 run on the dev DB.
  Notable review-driven strengthenings: `VenueSchema` pinned to
  `venueVocabulary.REQUIRED_FIELDS` by coupling test (D-21); `UNIQUE(user_id)`
  on `botville_venue_overrides` (D-22 rationale); dedicated
  `botvillePublicRoutes` mounted at `/api/public/botville` (D-24);
  presence-gated `leave-note` (D-26); `CONTRIBUTION_AMOUNT_MAX_POINTS = 10`
  (D-27). **api main is local-only — push + Docker deploy (D-20) is part of
  the owner's planned full redeployment (prod is currently OFF).**
- **Plan 02 (agents)** — 5/5 tasks INCLUDING the owner-gated Task 5, merged to
  `aisocialnetwork-agents` main and pushed (`e4041b7..d4951c2`). Full gate
  3019 green. The six BotVille tools are **L1** (D-29): 48 live tools,
  22 excluded (7 L3 / 15 L2), 26 L1 MCP + delegate-tasks = 27 schemas.
  Fact chain: M-037 → M-049 → M-051. **PCO re-baseline pending** (old
  `run_20260728_103940` invalidated by owner authorization).
  Exposure extractors for the three reads: shown-content only, no receipts.
- **Plan 03 (BotVille)** — 5/5 tasks on `mcp-botville-plan03`, merged to
  BotVille main after a clean final review + one-line fix. Fixture mode
  byte-identical (verified by full-diff walk); integrated mode opt-in (D-28);
  activity labels + seed-derived platform appearances (D-25); venue-notes
  overlay; Railway fallback retired (D-20).

## Live verification (dev, 2026-07-31)

- Heartbeat wakes fetch 48 schemas from 3 sources; wakes commit cleanly.
- Post-promotion round: 27 tools on the live ACT call, wake committed.
- `GET /api/public/botville/locations`: schemaVersion 2, real presence.
- `get-city-map` via MCP as a real agent: 18 venues, derived home/workplace
  agreeing with the stored routine by construction.

## Carried forward (next session)

1. **PCO re-baseline** after the promotion (owner: "optimize in a new session").
2. **Full redeployment**: push api main, Docker deploy, then agents prod —
   in that order (a registered-but-unreachable source breaks every wake).
3. researcher.yaml read re-add is revisitable (currently L1-only, symmetric).
4. Agents have no organic reason to touch city tools yet — affordance/candidate
   work is the next-phase scope that gives them one.
5. Pre-existing, unrelated: dev `/api/auth/signup` 500 (users table lacks
   `interests`/`personality_traits` columns `User.create` inserts); spec II.3's
   "attached goal state" for `get-venue` needs a spec amendment (no goal↔venue
   attachment exists in the DDL).

## Operational lessons (recorded in controller memory)

- The `aisocialnetwork-agents` checkout IS the live platform runtime: ambient
  autonomous rounds run from — and commit/FF-merge/push — whatever is checked
  out there. Feature work belongs in git worktrees.
- `configs/api_keys.dev.tsv` is CRLF — strip `\r` when extracting keys in
  shell, or Node's HTTP parser rejects the header with a bare 400.
