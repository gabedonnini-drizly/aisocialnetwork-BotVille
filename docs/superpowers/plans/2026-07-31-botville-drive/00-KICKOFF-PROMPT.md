# KICKOFF — BotVille Drive: civic democracy, motive, nudges, frontend exposure

**Status:** session kickoff prompt, written 2026-07-31 at the close of the
grilling session that produced the decision record in §2. Paste this into a
fresh session to (a) brainstorm and grill the open questions in §3, then
(b) produce the multi-stage plan set specified in §4, mirroring
`2026-07-29-botville-platform-mcp/`.

> ⚠ **§3 IS RESOLVED (2026-07-31, second grilling session).** Every open
> question below was grilled one-at-a-time and ruled by the owner; the
> rulings are **D-30..D-52 in [DECISIONS.md](DECISIONS.md)** — do not
> re-ask them. Three amendments to THIS file's text: D-41 removes `human`
> from §2.2's proposal source enum (humans influence only via nudges);
> D-52 corrects §3's draft "votes public" split (secret ballot during the
> season, full record published at the boundary); D-50 supersedes §2.9's
> "praise/encourage (signed feedback into disposition)" — there is NO
> disposition variable: praise is an exposed, owner-attributed observation
> whose persistence flows only through the agent's own end-of-turn. DECISIONS.md also
> carries the amended round sequence (an arbitration-lottery round lands
> before the city trigger), the QA-check roster, and the named deferred
> items. Next step: write the §4 plan set against those decisions.

---

## 0. Your task in one paragraph

The BotVille platform-MCP plan set (19/19 tasks) shipped: six city tools are
L1 (D-29), the heartbeat talks to three MCP servers, the renderer has
integrated mode, and the PCO re-baseline is captured
(`run_20260731_084950`, 85/85 PASS, 0 FAIL, trees agents `80ea342` / API
`8d778679` — the first baseline on the 27-schema surface). What does NOT
exist is a reason for any agent to touch the city: `botville_city_goals` is
empty with no insert path, nothing emits city candidates into the menu, and
the frontend has zero BotVille code. Your job: turn the §2 decision record
into a spec + per-repo plan set that makes the town *lived in* — civic
democracy, menu affordances, emergent meetings, typed nudges, and bottown
exposure — executed in dev, one measured round per agent-facing change.

## 1. Ground yourself first (read in this order)

1. `/Users/home/aisocialnetwork-agents/CLAUDE.md` — §5 evidence discipline,
   C1–C8, measurement traps. Non-negotiable.
2. `/Users/home/aisocialnetwork-agents/docs/product/2026-07-25-how-it-all-works.md`
   then `2026-07-25-product-vision.md` — the vision; note §9.14 (menu = the
   convergence channel) and §3's derived place/source taxonomy (BotVille is
   a **place** now; the doc's "neither, today" row is stale).
3. `/Users/home/aisocialnetwork-BotVille/CONTEXT.md` — the settled city
   glossary (Season, Proposal, Vote, Election, Meeting, Nudge verb…). Use
   these words exactly.
4. `/Users/home/aisocialnetwork-BotVille/docs/superpowers/plans/2026-07-29-botville-platform-mcp/`
   — `00-INDEX.md`, `DECISIONS.md` (D-21..D-29), `EXECUTION-2026-07-31.md`.
   This is the structural template AND the ground truth for what shipped.
   ⚠ The three plan files' checkboxes were never ticked; EXECUTION is the
   status source. ⚠ EXECUTION line 17 is stale: api main IS pushed; only
   the Docker deploy remains.
5. `/Users/home/aisocialnetwork-BotVille/docs/superpowers/specs/2026-07-29-botville-world-addendum-design.md`
   — Part II.5 (the deferred affordance seam) is what you are now building.
6. `/Users/home/aisocialnetwork-BotVille/docs/superpowers/2026-07-31-botville-next-features.md`
   — the wishlist this plan absorbs (items 1–6, 8 done, 7, 13–17 triage).
7. `/Users/home/aisocialnetwork-agents/docs/facts.yaml` M-041..M-051 —
   the delegation/promises/registry lineage; M-051 is the L1 promotion.
8. `/Users/home/aisocialnetwork-agents/.claude/skills/qa/SKILL.md` +
   `docs/superpowers/specs/2026-07-31-action-stream-qa-design.md` — every
   plan gets a planning-mode QA section; action-stream adapters already
   cover `botville_venue_notes` / `botville_goal_contributions`.
9. Code anchors (verify before citing — anchors rot):
   - API: `src/services/botville/*.js`, `src/mcp/botville-mcp-server.js`,
     migration `038_add_botville_world.js`, `src/utils/venueVocabulary.js`,
     nudges: migration 021, `mdGenController.js:467`.
   - Agents: `heartbeat/core/orchestration/prompt_builder.py`
     (`_CATEGORY_OVERRIDES`, `_TOOL_ORDER`), `unified_runner.py`
     (`EXCLUDED_TOOLS`, 22 = 7 L3 + 15 L2), `exposure_log.py:341-406`
     (BotVille extractors, shown-only, NO ack refs),
     `heartbeat/core/domain/exposure.py:25` (`ACK_KINDS` closed allowlist),
     the candidate builder (promises→A-1 coupling, C8), end-of-turn
     extraction (`heartbeat/infra/adapters/crew/end_of_turn.py`).
   - Frontend: `src/components/layout/TopHeader/VenueSwitcher.tsx` (the
     third-pill insertion point; "venue" there means product section —
     rename when touched), `src/lib/server-api.ts` + `api-client.ts` (both
     hard-require `{success,data}`; `/api/public/botville/locations` is
     deliberately UNWRAPPED — a BotVille-aware fetch path is required),
     no polling/live-update infra exists anywhere.
   - BotVille client: `packages/client/src/lib/api.ts` (PRESENCE_MODE),
     `useGameSync.ts`, `packages/shared/src/types/Assets.ts`.

## 2. Settled decisions — binding, do not re-ask (owner, 2026-07-31)

1. **Scope**: research + plan, then execute in dev (dev-85). Prod is a
   separate owner-owned full rebuild.
2. **One pool, one mechanism**: every goal begins as a Proposal with
   `source: system|human|agent`; identical lifecycle for all sources.
3. **Seasons model**: during season E, contribute to E's active goals and
   propose/vote for E+1; at the boundary E's goals resolve, top-K seat,
   pool clears, votes reset. Season length is config (start weekly, tune
   toward monthly). Boundaries derived from the clock — no stored
   scheduler state. Grounding: Radiant-style templates (system proposals
   instantiated from world state, registry-driven per D-21), Godus
   communal works (additive accumulators — §22 stays intact), EVE CSM
   (long-epoch persistent-electorate democracy).
4. **Tool surface**: `vote-city-goal` is L1 (27→28 schemas, own measured
   round). `propose-city-goal` is L2 via the reflector (a goal-aware
   deterministic trigger). Consequence accepted: the reflector allowlist
   gains the city reads, reopening D-29's revisitable
   L1-not-also-delegable symmetry. Proposals ride in the `get-city-goals`
   payload — no new read tool.
5. **Free but bounded democracy**: votes cost no effort (one per proposal
   per agent per season, DB unique constraint); one live proposal per
   agent per season; contributions/notes keep costing effort.
6. **V1 candidate kinds** (per-agent scored + rotated — §9.14 binding):
   contribute-to-goal, vote-on-proposal, co-presence-aware visit-venue.
   Leave-note is an organic follow-on, not a candidate.
7. **Meetings are emergent, never a primitive**: promises gain venue +
   time-window references; the existing promise→candidate path surfaces
   them on wakes inside the window. No invite/accept tools, no meetings
   table, no platform enforcement. §22 unamended.
8. **Ambient placement**: one line of where-am-I / who-is-here in every
   wake, built into the md-gen process the same way as the soul documents,
   tested through the lifecycle harness, shipped as its own round.
9. **Nudges are a typed interaction menu with a budget** (Sims/B&W, not a
   chat box): five verbs — send-to-venue, point-at-goal/proposal,
   suggest-focus (≤100-char bounded text), praise/encourage (signed
   feedback into disposition, not an action candidate),
   point-at-relationship (seeds connection/promise candidates). Chips
   templated from live world data with real ids (code owns identity).
   Budget 3/day/agent (config). Structural guards only in dev; every
   nudge lands as a declinable candidate; F-3 offered-vs-chosen
   instrumentation from day one. Composer lives on the agent profile.
10. **Frontend**: town view = BotVille's Vite client as its own static
    nginx/Docker deploy in integrated mode, embedded via full-viewport
    iframe behind a third VenueSwitcher pill at `/botville`. Agent-in-town
    view = native React profile extension (presence card, city activity,
    nudge composer) beside SoulPanel/ActivityTimeline. Fixture art is
    public-safe; real LimeZu art only on owner-baked deploys.
11. **Sequencing**: rounds gate every agent-facing surface change —
    (a) API civic infra + Radiant seeds [no agent surface] → (b) candidate
    provider + vote L1 + reflector propose → ROUND → (c) ambient
    placement → ROUND → (d) venue-anchored promises → ROUND → (e) nudges
    end-to-end → ROUND with F-3. Frontend parallelizes throughout.

## 3. Open questions — grill these BEFORE writing plans (one at a time,
recommended answer per question; add every ruling to DECISIONS.md as D-30+)

**Civic mechanics**
- Season-boundary execution: nothing stores scheduler state, so is
  resolution *lazy-idempotent* (first read after the boundary resolves E
  and seats E+1, any surface, deterministic) or a sweep job? (Recommend
  lazy — it is P-1's derive-don't-store applied to elections.)
- Empty/thin pools: fewer proposals than K slots — do system templates
  backfill at the boundary so the town is never goalless?
- Quorum: can a 0-vote proposal seat? Tie-break beyond oldest-first?
- Goal economy math: target sizing from supply (85 agents × 3 effort/day ×
  season length) — a worked model, not a guess. Radiant template
  parameters and the template registry format.
- Completion feedback: does a finished goal leave a visible trace (in-city
  render, a venue note, an AgentWire story?) so agents *see* civic wins?
- Vote-tally visibility: do agents see current counts (information-cascade
  /herding risk — game-design question), and do they see proposer
  identity? What exactly does the `get-city-goals` payload carry?
- Schema: new tables (`botville_goal_proposals`, `botville_goal_votes`,
  migration 039) vs status column on `botville_city_goals`; boundary rules
  (only `src/services/botville/**` touches `botville_*`) apply; town_id
  stays `'town-1'` single-town for now?

**Agents repo**
- Candidate-provider data path: how does the candidate builder read city
  state — infra-side MCP reads, the public REST, or a new md-gen doc?
  (C1 ports, C6 no-composite, and the failure mode "unreachable source
  breaks every wake" all constrain this.)
- Rotation + identity scoring concretely: what seed, what memory of
  recent offers, what identity inputs score a venue/goal candidate?
- ACK_KINDS: candidates referencing proposals/goals — do new ack-able
  kinds enter the §1.6 closed allowlist, or are receipts (tool success)
  sufficient? (Exposure spec §11.2 made place/co_presence non-ack-able;
  decide deliberately, it is a kernel edit.)
- Venue-anchored promises: the end-of-turn extraction JSON changes (C8 —
  trace promises→A-1 first), time-window format, and the grounding gate
  (fabricated venue ids must strip; extend `strip_fabricated_ids`?).
- Ambient placement mechanics: which md-gen doc/section, exact line
  format, byte budget, absent-agent behavior ("asleep at home" vs no
  line), and the C8 rider — which hashes move, what re-baselines.
- Reflector propose trigger: the deterministic predicate (what world/agent
  state fires it), and its interaction with the single
  first-firing-wins delegation slot (M-048's shadowing finding).
- New QA checks (registry + proof-they-can-fire): election-integrity,
  vote-burst (needs an action-stream adapter for the votes table),
  no-source-starved for the BotVille provider, F-3 nudge selection rate.

**Nudges**
- Verb payload schemas; where praise lands mechanically (mood extraction?
  relationship-with-owner? memory?) — it touches end-of-turn, so C8.
- Owner auth path (NextAuth session → owners API, like agent CRUD) and
  whether the agent's ack/disposition surfaces back in the glass box.

**Frontend / client**
- Iframe mechanics: nginx `frame-ancestors`/CSP, CLIENT_ORIGIN allowlist
  (never `*`), local-dev port composition (8321/9321/5173/8080), and a
  `?follow=<username>` deep-link param in the client.
- Per-agent city endpoints: shape and privacy split (notes/contributions/
  votes public; promises are private state — owner-only glass box).
- Presence card data source: whole-town snapshot vs per-agent endpoint;
  polling cadence parity with `LOCATION_POLL_MS`.

**Hygiene to fold in** (small tasks, not questions): stale
`configs/defaults.yaml:29-32` comment; product-vision taxonomy row
(BotVille is a place); checkbox back-fill or a NOTE banner on the shipped
plan files; new-agent onboarding automation (schedule writer on creation);
`storeToolRationale` wiring; `Object.freeze(venuesCache)`; researcher.yaml
city reads (revisit per D-29).

## 4. Deliverable — the plan set

Create under `docs/superpowers/plans/2026-07-31-botville-drive/` (this
directory), mirroring the platform-MCP set:

- `00-INDEX.md` — structure, execution order, deployment gates, the round
  schedule with analyzer sections per round.
- A design spec (or addendum to the world-addendum spec) covering: the
  civic schema + season algebra, the candidate provider contract, the
  promise venue/time extension, ambient placement, the nudge verb
  vocabulary, and the frontend seams. Terms from `CONTEXT.md`.
- `01-api-civic-and-nudges.md` — target `aisocialnetwork-api`.
- `02-agents-affordance-and-ambient.md` — target `aisocialnetwork-agents`.
- `03-frontend-exposure.md` — target `aisocialnetwork-frontend` (+ any
  small BotVille-client tasks: deep-link, CSP; else a `04-` plan).
- `DECISIONS.md` — continue D-30+; every §3 ruling lands here with owner
  rationale verbatim.
- Every plan: per-task verification commands, a planning-mode QA section
  (blast radius via `scripts/docs/blast_radius.py`, checks bracketing each
  rollout, new checks with how each proves it can fire), and the C8 rider
  wherever prompt bytes or extraction surfaces move.
- Facts: new measurements get M-052+ in `docs/facts.yaml` with corpus
  declared in-sentence; the baseline round `run_20260731_084950` gets its
  standing-analyzer analysis written up before any surface moves.

**Discipline reminders**: one change, one measured round; segment by
`episode.decision`, count `tool_calls`; prompt-length degradation is a
recorded finding — every added token needs to earn its place; dev-85 and
prod-44 never pool; no edits to the agents/API checkouts during a live
round (nodemon deploys on file-write); the agents checkout IS the live
runtime — feature work in worktrees; `api_keys.dev.tsv` is CRLF; verify
every anchor in this document before relying on it — anchors rot, and
four rotted in a single session once.
