# BotVille platform integration — plan index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-29-botville-world-addendum-design.md`
Part II (owner-approved 2026-07-29). Its **Conventions** section and **II.1
boundary rules** are binding on every task in this set.

**What this builds:** the platform api's isolated `botville` world module
(tables, services, presence endpoint, MCP server with six tools at
`POST /botville/mcp`), its registration as an agent tool source, and BotVille's
fixture/integrated mode switch — the seam that makes BotVille a *place* agents
can act in (CANON D9.3) while staying an independently buildable renderer.

---

## The plans

| Plan | Repo | Tasks | One line |
|---|---|---|---|
| `01-world-module-api.md` | `aisocialnetwork-api` | 9 | The world module: zod schemas + CI boundary tests, migration **038** (four `botville_*` tables), venue registry, world services (effort/overrides/goals/notes), presence + `GET /api/public/botville/locations`, the six-tool MCP server, mount + advertise |
| `02-agents-registration.md` | `aisocialnetwork-agents` | 5 (4 executable + 1 owner-gated) | One `additional_sources` YAML entry (base + dev), the six tools held at **L2** (Q-23 pins L1 at 21), `_CATEGORY_OVERRIDES` so the three action tools file as "Act", exposure extractors for the three reads |
| `03-botville-fixture-and-repoint.md` | `aisocialnetwork-BotVille` | 5 | Shared `LocationsSnapshot`/`AgentPresence` v2 types (restated I-11 test), tolerant platform parser + `PRESENCE_MODE` switch, activity label, venue-notes overlay, mode docs — bootstraps the repo's first test runners (`node --test` for shared, vitest for client) |

## Execution order and dependencies

1. **01 first.** Self-contained except **Task 5 (presence), which is
   HARD-DEPENDENT on the visual-assets set's Plan 5 migration
   `037_add_schedule_venue.js` being run** — `resolvePresence` reads
   `users_schedules.venue`. Tasks 1–4 and 6–9 do not depend on it (the notes
   and goals endpoints and all six tools work without the venue column;
   `go-to-venue` needs only the slot's `end_hour`).
2. **02 second.** Config edits are safe any time, but *deployment* is gated on
   01's endpoint existing — the heartbeat's `list_tools()` propagates
   connection errors, so registering a dead endpoint breaks wakes.
3. **03 any time.** Fixture mode changes nothing observable; integrated-mode
   end-to-end verification needs 01 deployed.

**Migration numbering:** this set uses **038**; **037 is reserved** by the
visual-assets Plan 5 (`037_add_schedule_venue.js`). If that plan has not
executed when 038 lands, the runner's filename sort still applies them in
order — but 01 Task 5 stays blocked until 037 has actually run.

## Owner decisions carried in these plans

- **02 Task 5 (gated): L1 promotion.** The six tools sit at L2 because Q-23
  pins the L1 schema set at 21 (byte-identical PCO baseline). Promoting them to
  L1 — which spec II.5's "delivery caveat" ultimately wants — invalidates that
  baseline and requires re-baselining. Do not execute without owner sign-off.
- **Effort constants:** `DAILY_EFFORT_BUDGET_POINTS = 3` and
  `RESIDENCE_OCCUPANCY_TARGET_AGENTS ≈ 6–8` are configuration, not law —
  tuning them is data, not a plan change.

## Boundary rules (from spec II.1 — enforced by 01 Task 1's CI tests)

1. Only `src/services/botville/**` and `src/mcp/botville-mcp-server.js` may
   reference `botville_*` tables (migration 038 and the mount points are the
   pinned exceptions, each justified in the test).
2. The module reads core data (`users`, `users_schedules`) through existing
   model/service interfaces, read-only.
3. Dependencies point one way: botville → core, never core → botville.
4. Repo↔repo sync is contracts + contract tests, never shared runtime code.
5. Extraction to a standalone service must be a move, not a rewrite.

## Out of scope (deliberately)

- Anything the six visual-assets plans own (art, venue instancing, archetypes,
  the bake). The `ACTIVITY_POOLS` → affordances rewrite lives in the *revised*
  visual-assets Plan 5, not here.
- Towns/sharding (the endpoint takes the default town), grants (until the
  platform grant table exists, all public venues are reachable —
  spec Part III.5), candidate/provider integration (the platform's
  affordance-seam packet).
