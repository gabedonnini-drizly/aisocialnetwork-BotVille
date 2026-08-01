# Round runbook — exact resumption commands (written 2026-08-01)

Companion to `EXECUTION-LOG.md` (status truth) and `EXECUTION-PROMPT.md`
(the drive contract). Everything below is staged and green; nothing here
re-derives plan content — it pins the mechanical commands so any session
(or the owner) can resume without re-reading the build history.

**Current blocker:** the harness permission classifier denies writes to
the nodemon-live api checkout. Owner: either grant the Bash permission
for `/Users/home/aisocialnetwork-api` git/npm commands, or run Step 1
by hand.

## Trees and branches (all committed, suites green at commit time)

| Tree | Branch @ commit | Suite |
|---|---|---|
| `/Users/home/aisocialnetwork-api-civic-drive` | `feat/civic-drive` @ `d68130e` | 952 pass |
| `/Users/home/aisocialnetwork-api-placement` | `feat/civic-placement` @ `791fd74` (round c only) | 963 pass |
| `/Users/home/aisocialnetwork-api-praise` | `feat/civic-praise` @ `fd4994a` (round e only) | 960 pass |
| `/Users/home/aisocialnetwork-agents-drive` | `feat/botville-drive` @ `ab8121a` | 3034 pass |
| frontend `main` @ `73b82d7`, BotVille `main` @ `e03a3e3` | — | build/tsc clean; root suite green |

**Agents partial-merge points (CORRECTED 2026-08-01 after a caught
near-miss)**: the branch commit ORDER is Task 7 (`f5e148f`) BEFORE Task
6-agents (`a563b5a`), so merging `a563b5a` drags the round-(d)
extraction change into round (c). Actual deploy map: round (a2) merged
`d8de8ab`; round (b) merged `716c46c`; round (c) merges `392840a`
(branch `round-c-placement` = cherry-pick of a563b5a onto 716c46c,
derived_facts stripped); round (d) merges `f5e148f` + resolves against
the cherry-pick (restore the derived_facts param + the co-occurrence
test; diff-check the result against `a563b5a` for convergence); round
(e) merges `ab8121a`. Merge into the LIVE agents checkout only inside
each round's window; no wakes during merges.

## Step 1 — Stage A deploy + exit gate (blocked on owner)

```bash
cd /Users/home/aisocialnetwork-api && git merge --ff-only feat/civic-drive && npm run migrate
# nodemon restarts itself. Then:
curl -s http://localhost:9321/api/public/botville/agent-affordances/<dev-agent> | head -c 2000
# zod-parse: node -e over AgentAffordancesSchema.parse(body) from the live checkout
cd /Users/home/aisocialnetwork-BotVille && npm test          # civic-registry sync skip → now must PASS
cd /Users/home/aisocialnetwork-agents && source .venv/bin/activate
PYTHONPATH=. python scripts/data_quality/verify_normalization.py   # 6/6
python -m heartbeat --user-id <dev-agent> --verbose --env dev      # manual wake: get-city-goals renders v2, commit clean
# Log the gate in EXECUTION-LOG.md. Frontend TODO(stage-A-verify) markers: curl each endpoint, paste responses.
```

## Step 2 — ROUND (a2): lottery (M-053)

```bash
cd /Users/home/aisocialnetwork-agents && git merge d8de8ab            # lottery ONLY
# PROBE (INDEX loop step 1): one dev wake; episode JSON must carry the
# "delegation" ledger {fired, won, chosen}; capture the composed request.
# Probe fails → debug mechanical path; round does not start.
./scripts/run_all_agents.sh --dev                                      # ~2.5h, 85 agents
# ANALYZER (write docs/analysis/2026-08-0X-lottery-round.md):
#   own-log-window attribution; decision mix by episode.decision;
#   fired/won/chosen per trigger vs M-052's 3-offered/0-chosen;
#   delegation share vs 12/85; ≥10 raw-trace reads; corpus in every
#   sentence. Register M-053 (facts.yaml slot reserved), lint 0 errors.
```

## Step 3 — ROUND (b): city seam (M-055; M-054 already registered)

```bash
cd /Users/home/aisocialnetwork-agents && git merge 716c46c
# PROBE: one dev wake → city candidate shown; one vote-city-goal receipt
# row in botville_goal_votes; captured request shows 28 schemas; commit
# ACCEPTED with city-kind refs in shown_refs. ALSO verify the adapter hit
# the DEV api (watch item: city.endpoint default is prod-shaped).
./scripts/run_all_agents.sh --dev
# ANALYZER: offered (manifests) / truncated / chosen; DB receipt counts
# beside episode counts; trigger ledger; decision mix vs M-053; ≥10 raw
# traces. Register M-055. Re-derive D-40 coefficients from measured
# participation; record. D-54 floor unreachable ⇒ tuning signal on
# awareness surfaces, reported — never a silent floor drop.
```

## Step 4 — ROUND (c): placement (M-056) — soul bytes move, re-baseline

```bash
cd /Users/home/aisocialnetwork-api && git merge feat/civic-placement   # INSIDE window only
cd /Users/home/aisocialnetwork-agents && git merge a563b5a
# PROBE: placement line present in one captured dev soul prompt (byte-level).
./scripts/run_all_agents.sh --dev
# ANALYZER: placement-degradation counts (QA-L16); soul-prompt char/token
# delta (M-036 lineage, new median with corpus); decision mix vs M-055;
# ≥10 raw traces. Register M-056. prompt_version does NOT shift (derived,
# observability.py:148-152); soul_prompt_hash + render_hash DO.
```

## Step 5 — ROUND (d): promises (M-057) — extraction bytes move, re-baseline

PRE-ROUND DECISIONS (flagged in the log, decide before the probe):
1. Attendance-history surface: without an api additive (candidate:
   `attendance` receipts on the affordances payload), every elapsed
   window derives MISSED — the kept arm is implemented but starved.
   Either ship the additive (small gated api commit) or accept
   missed-only for this round and record it in the write-up.
2. Slot tz = town clock (documented deviation; per-agent tz has no
   agents-side surface).

```bash
cd /Users/home/aisocialnetwork-agents && git merge f5e148f             # INSIDE window only [D-b]
# PROBE: one anchored promise survives extraction→grounding→commit→
# next-wake A-1, captured end-to-end.
./scripts/run_all_agents.sh --dev
# ANALYZER: anchored rate, strip rate (promise_anchors_stripped), miss
# rate, A-1 fill rate vs prior rounds; extraction-prompt token count
# (~71 est.) recorded; ≥10 raw traces. Register M-057.
```

## Step 6 — ROUND (e): nudges end-to-end (M-058)

```bash
cd /Users/home/aisocialnetwork-api && git merge feat/civic-praise      # INSIDE window only
cd /Users/home/aisocialnetwork-agents && git merge ab8121a
# Compose one nudge per verb via the composer (frontend live) or curl POST /api/nudges.
# PROBE: one nudge travels composer→row→candidate→disposition, captured.
./scripts/run_all_agents.sh --dev
# ANALYZER: F-3 per verb (QA-L14); crowding-out organic delta vs rounds
# b–d (QA-L15); budget exhaustion; DB nudge/ack counts beside episodes;
# ≥10 raw traces. Register M-058. State the praise-source decision
# (md-gen arm — already ruled in the log 2026-08-01) in the write-up.
```

## Step 7 — Plan 03 close + drive close-out

- Plan 03 Task 5 manual passes (composer round-trips, budget 429,
  non-owner hidden) + Task 7 privacy pass (curl assertions + greps; any
  failure fixes Plan 01 Task 9 server-side, never a client filter).
- Browser passes deferred from Tasks 2/3/4/6 (iframe CSP +/-, follow
  deep-link, presence poll cadence).
- Close-out per EXECUTION-PROMPT §4: drive summary atop EXECUTION-LOG.md
  (rounds run, headline deltas vs M-052, floors status, open items);
  update project memory; check the city-growth kickoff gates (M-055 +
  owner art/bake inventory; its rulings start at D-59) — AND the
  action-self-awareness kickoff (owner-elevated 2026-08-01, agents repo
  docs/superpowers/plans/2026-08-01-action-self-awareness-kickoff.md):
  it is the NEXT core cognition pass after this drive, gate 1 is this
  drive's close-out, and its grilling should be scheduled first.

## Open items ledger (carried, not dropped)

- **City candidate copy — the vote rung is bare-title (owner-flagged via
  raw trace, 2026-08-01).** A round-(d)-window DECIDE trace (olivia_grant
  wake) shows the agent unable to parse "Tend the Café" as a votable
  proposal: "might be a routine or trivial? … feed the coffee machine."
  Root cause: `candidateText` (api a3cabf9) covers activeGoals ONLY;
  proposals render title-verbatim in the §VI.2 vote rung. Contrast in
  the SAME trace: the city_propose delegation copy ("The city is quiet —
  a proposal window is open and nothing of yours is on the table…")
  converted, chosen for identity-matched reasons ("we want to stretch
  thinking") — good copy converts, bare titles don't. Fix shape (post-
  drive or a small round-(e)-window additive if owner wants it sooner):
  api proposals[].candidateText rendered registry-side with act +
  stakes ("'{title}' is up for next season's vote — back it if you want
  it built"), agents-side preference already generalizes. D-39
  information-physics compliant; zero agents-repo prompt bytes.

- **ELEVATED → its own gated kickoff** (agents repo,
  docs/superpowers/plans/2026-08-01-action-self-awareness-kickoff.md —
  owner ruled this core work, first after the drive): create-post
  over-indexing / retry loop. Measured: create-post attempts per round
  a2→b→c = 35→88→105 while succeeded = 20/20/31 (success rate 57%→23%→30%);
  corpus runs 20260801_012120/031541/053854, dev-85, per-episode
  tool_calls. Lead hypotheses, in order: (1) in-ACT retry-after-refusal
  loop — the agent re-attempts after "posted too recently", often as a
  near-duplicate (matches QA-W03's near-dup pairs); (2) back-to-back
  drive-round cadence colliding with the platform rate-limit window
  (environmental — prod's daily cadence wouldn't); (3) menu-composition
  drift toward create. Anti-hypothesis to kill first: time-of-day mix.
  Action diversity / ToM-connectivity improvements explicitly deferred
  as later work per owner. Not a drive blocker.

- send-to-venue chips limited to payload-carried venues (no public
  venue-list route) — Plan 01 additive candidate.
- Frontend glass-box surface for F-3 chosen/declined (afterlife strip
  renders the pending arm only).
- Typed nudges still visible in agent-facing `get-nudges` MCP read
  (legacy); round-(e) mdGen filter covers Startup.md only — check
  whether get-nudges needs the same verb filter before round (e).
- `operations.md` tool tables never gained the six promoted BotVille
  tools (pre-existing, flagged by the Task-4 worker).
- Venue labels client-side are humanized ids (no public label surface).
