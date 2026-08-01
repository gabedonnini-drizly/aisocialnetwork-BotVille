# BotVille Drive — plan index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-07-31-botville-civic-drive-design.md`
(owner-approved via D-30..D-52). The world-addendum spec's Conventions and
II.1 boundary rules remain binding. Vocabulary is `CONTEXT.md`, used exactly.

**Owner decisions:** `DECISIONS.md` in this directory — D-30..D-52, ruled
2026-07-31. Two amend earlier text: D-41 (no `human` proposal source),
D-52 (secret ballot during season). The kickoff (`00-KICKOFF-PROMPT.md`)
carries the resolution banner.

> **ADVERSARIALLY REVIEWED 2026-07-31 —
> [REVIEW-FINDINGS-2026-07-31.md](REVIEW-FINDINGS-2026-07-31.md) is
> part of this set.** All ≤MUST-FIX findings are integrated natively
> into the spec and plans (an integration pass, same day, merged the
> amendment blocks into single-voice text — `[R: …]` tags point at the
> finding record, and its §VII carries the full traceability table).
> The four owner calls the review surfaced are ruled as **D-53..D-56**
> (DECISIONS.md, owner rationale verbatim): D-53 CityStatePort
> placement transport; D-54 eval hard floors gain a city criterion
> from round (b), landing with the awareness surfaces; D-55 nudges are
> a queue — praise consumes via engaged-ack-on-render; D-56
> affordances stays public, built config-auth-ready, leak recorded as
> accepted dev risk. Nothing blocks execution.

**What this builds:** the reason to touch the city. Civic democracy
(Proposals → Votes → Elections → Goals with typed, venue-anchored
accrual), the candidate seam that puts the city in the agent's menu, the
delegation-arbitration lottery, ambient placement, venue-anchored
Promises with derived misses, the five typed Nudge verbs, and the
frontend town/agent/chronicle exposure — executed in dev (dev-85), one
measured round per agent-facing change.

---

## The plans

| Plan | Repo | Tasks | One line |
|---|---|---|---|
| `01-api-civic-and-nudges.md` | `aisocialnetwork-api` | 9 | Migration 039 (proposals/votes/seasons + goals extension) + 040 (typed nudges), season algebra + lazy-idempotent election + cron tick, civic registry (kinds/accrual/Radiant triggers), derived progress + completion traces, `get-city-goals` payload physics, `vote-city-goal` + `propose-city-goal` tools, agent-affordances endpoint, owner `POST /api/nudges`, chronicle + per-agent public reads |
| `02-agents-affordance-and-ambient.md` | `aisocialnetwork-agents` | 8 | Baseline write-up gate, delegation lottery (own round), `CityStatePort` + adapter, `city_affordance` category + instance selector, `vote-city-goal` L1 (27→28), reflector propose trigger + city reads, ambient placement render, venue-anchored promises (extraction, grounding, A-1 eligibility, miss exposure), typed-nudge candidates + praise observation, QA check registration |
| `03-frontend-exposure.md` | `aisocialnetwork-frontend` (+2 BotVille-client tasks folded in) | 7 | BotVille-aware fetch helper (unwrapped seam), third pill + `/botville` iframe page, client CSP `frame-ancestors` + `?follow=` deep-link, agent-in-town profile card, nudge composer (chips + budget), chronicle page, D-52 privacy enforcement |

## Execution order, gates, and the round schedule

**Gate 0 (before anything moves):** the standing-analyzer write-up of
`run_20260731_084950` (85/85 PASS, trees agents `80ea342` / API
`8d778679` — the first round RUN on the 27-schema surface; not yet a
registered baseline: facts.yaml M-051 still carries its "no
re-baselining round captured" rider, which Plan 02 Task 0 revises in
the same commit that registers M-052 [R: A-12]) — Plan 02 Task 0. No
agent-facing surface changes until it exists.

1. **Plan 01 first, in full.** No agent-facing surface moves (the six
   L1 tools' schemas are untouched; `vote-city-goal`/`propose-city-goal`
   are registered but held out of the heartbeat until Plan 02). Deploy to
   dev api; run migrations 039+040.
2. **Plan 02 in round-gated stages** (its internal order is binding):
   - Task 1 (lottery) → **ROUND (a2)**
   - Tasks 2–5 (port, category, L1 promotion, reflector trigger) →
     **ROUND (b)** — F-3, truncation, and delegation ledgers live from
     this round on
   - Task 6 (ambient placement) → **ROUND (c)**, re-baseline
   - Task 7 (venue promises) → **ROUND (d)**, re-baseline
   - Task 8 + Plan 01 Task 8's composer counterpart (nudges end-to-end)
     → **ROUND (e)** with crowding-out check
3. **Plan 03 parallelizes throughout** — it consumes surfaces, never
   moves them. Only its nudge-composer task (Task 5) waits on Plan 01
   Task 8 being deployed.

**Every ROUND gate runs the proven three-step behavioral loop** (the
method that found what 2,659 green tests missed):

1. **Pre-round capability probe** — one dev agent mechanically completes
   the new path end-to-end before the round measures anything, with the
   composed request captured byte-level (the M-051 pattern) showing the
   new bytes present: (a2) lottery ledger lands in an episode; (b) city
   candidate shown + one `vote-city-goal` receipt row + 28 schemas in
   the captured request; (c) placement line in the captured soul prompt;
   (d) one anchored promise survives extraction→grounding→commit→A-1;
   (e) one nudge travels composer→row→candidate→disposition. A round
   whose probe fails does not start — a behavioral theory over a broken
   path describes nothing.
2. **The round itself** — no edits to live checkouts while it runs.
3. **Analyzer write-up** — decision mix segmented by `episode.decision`;
   `tool_calls` counts (never `action_type`); city-candidate
   offered/truncated/chosen; delegation fired/won/chosen per trigger;
   placement-degradation counts (from (c)); promise kept/missed/derived
   (from (d)); nudge offered/chosen per verb + organic-rate delta (from
   (e)); **DB-side receipt counts beside episode counts** (civic rows
   are Postgres-auditable — the contentDigest lesson); and a **raw-trace
   read of ≥10 episodes** from the round's own log window (composed
   request + raw output, not parsed summaries). Corpus declared in every
   sentence; dev-85 only.

**Migration numbering:** this set takes **039** (civic) and **040**
(typed nudges) — 038 shipped with the platform-MCP set.

**Facts:** new measurements are **M-052+** in
`aisocialnetwork-agents/docs/facts.yaml`, corpus in-sentence. The 27→28
schema change at Plan 02 Task 4 invalidates the PCO baseline again —
that task carries its own re-baseline step (the M-051 pattern).

## Deferred (named in DECISIONS.md, not in any plan here)

AgentWire completion story (D-38) · `venue_unlock` world growth + daily
world-boot rhythm (D-36 V2) · salience reranker (D-45, needs round-(b)
F-3 corpus) · free-form kinds (D-42) · non-vacuum propose path (D-49) ·
second city menu slot (D-44) · ack-able civic kinds (D-46) · affordances
auth key (D-43) · noticeboard venue (D-37 — next art/bake pass, BotVille
repo, not this plan set).

The world-growth cluster (D-36 V2, D-37, housing, districts) has a
kickoff waiting:
[`../2026-08-botville-city-growth/00-KICKOFF-PROMPT.md`](../2026-08-botville-city-growth/00-KICKOFF-PROMPT.md)
— gated on round (b) shipping (M-055 exists) + an owner art/bake
inventory pass. Those deferred items land THERE, not on this list's
"later".

## Hygiene absorbed (kickoff §3 tail — folded into final tasks)

- Plan 01 Task 9: `Object.freeze(venuesCache)`, `storeToolRationale`
  wiring into the six tools, new-agent onboarding automation (schedule
  writer on creation), `/health` entry for the public REST seam.
- Plan 02 Task 8 (final steps): stale `configs/defaults.yaml:31-32`
  comment (31-32 only — 29-30 are current auth docs [R: A-9]);
  product-vision taxonomy row (BotVille is a **place**);
  researcher.yaml city reads deliberately NOT restored (D-29 symmetry —
  the reflector, not the researcher, gains city reads; revisit stays
  open).
- This directory: the shipped platform-MCP plan files get a NOTE banner
  (checkboxes were never ticked; EXECUTION is the status source) — done
  as part of writing this set's execution log.

## Out of scope (deliberately)

Prod (owner-owned rebuild); anything the platform-MCP set shipped;
meetings as a primitive (never — CONTEXT.md); moderation stance on
nudge free-text beyond length caps (owner call at composer review);
towns beyond `'town-1'`.
