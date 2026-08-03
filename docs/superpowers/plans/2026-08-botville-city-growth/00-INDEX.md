# BotVille City Growth — plan index

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement these plans task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/superpowers/specs/2026-08-01-botville-city-growth-design.md`
(owner-approved via D-59..D-78). The world-addendum spec's Conventions and II.1
boundary rules remain binding, as does I-8. Vocabulary is `CONTEXT.md`, used
exactly, plus this spec's §9 additions.

**Owner decisions:** `DECISIONS.md` in this directory — D-59..D-78, ruled
2026-08-01, owner rationale verbatim. Three amend earlier text:

- **D-66 amends D-62** — plots carry size, never zone. There is no baked zone
  taxonomy.
- **D-67 overturns the kickoff's §3 monotonic-growth recommendation** —
  demolition is a civic act, and it is load-bearing for D-66 rather than a
  nicety.
- **D-74 amends D-64's rider** — the **founding goal** is a one-time event, not
  a standing auto-seat, and it is keyed on world state rather than on a season
  index `[R: F-9, F-10]`. An empty board is legitimate.

**Reviewed 2026-08-01.** `REVIEW-FINDINGS-2026-08-01.md` is the provenance
record: 12 MUST-FIX, 11 SHOULD-FIX, 5 CONSIDER, 13 rotted anchors, 6 owner
calls. Findings are integrated as native text throughout this set and tagged
`[R: <id>]` at the sentence that carries them. The six owner calls are open and
marked **⛔ O-n** at every task they gate; they need a ruling, not a fix.

**What this builds:** the city's body. Plots as the growth substrate, the
housing ladder from tent to villa, visible construction, demolition as a civic
act, a `builder` specialist that is permitted to act, and the strings that make
an agent's own condition the reason it engages with its town.

---

## Read this before anything else: four corrected premises

The kickoff's §0 was verified in-tree on 2026-08-01 and four of its premises
are wrong. Every plan below is written to the correction, not the premise.
`DECISIONS.md` § *Kickoff corrections* carries the evidence.

1. Housing has a **shipped mechanic** (`deriveHomeVenue`) and **no art**.
2. The city **already grows**, silently, by population at bake time —
   `ceil(pop/7)`. D-59 retires that engine.
3. The `dorm` is **not housing** — `roles: ["hangout"]`, no `home` role.
   Giving it one is not a two-token edit: `dorm` sorts before `house_1` in
   `deriveResidenceVenues`'s `localeCompare(…, {numeric: true})` ordering
   (`scheduleCoverage.js:183-187`), and `deriveHomeVenue` fills that list to
   published capacity, so the role change moves **73 of 85 agents** to a
   different home `[R: F-7]`. The stored-assignment backfill sequences first.
4. Houses are **invisible geography** — no house building and no house door
   exists on the district map.

Plus a fifth found in the same pass: the client filters on a `farm` location
that is not in `venues.json`. Vocabulary drift is already live. There are
**three** filter sites in `DistrictScene.ts` — `:417`, `:434`, `:449`
`[R: R-9]`.

---

## The plans

| Plan | Repo | One line |
|---|---|---|
| `04-archetypes-and-bake.md` | `aisocialnetwork-BotVille` | **Lands first (D-75).** Generalise the archetype/generator pattern; declare the housing ladder, construction states and six civic archetypes into the contract + `sources/limezu.json`; variant pools; close the `farm` drift; extend both sync tests |
| `01-api-plots-and-housing.md` | `aisocialnetwork-api` | Migration 041 (plots, structures, claims, home assignment, effort transactions), the home-assignment seam across the II.1 boundary, `build`/`demolition` `world_effect` values, the `charter` goal kind, storyteller thresholds in config, `get-city-map` paging + plot payload, and housing state in the placement line (Task 9) |
| `02-agents-builder-and-condition.md` | `aisocialnetwork-agents` | The `builder` specialist — registry data plus three `heartbeat/core/` changes `[R: F-1, F-2, F-3]` — the `city` context section, act-shaped triggers, `city_propose` moved off the reflector, personal-stake candidate text, beneficiary naming, QA check registration |
| `03-client-plots-and-districts.md` | `aisocialnetwork-frontend` / BotVille client | De-hardcode `DistrictScene` for multi-district, render the three plot states, generated doors for built homes, tier sprites, chronicle of growth |

---

## Execution order, gates, and the round schedule

### Gate 0 — the awareness micro-round must be closed out

An unanalyzed micro-round is in flight on the live runtime.
`2026-07-31-botville-drive/EXECUTION-LOG.md:75` records a **POST-DRIVE
AWARENESS MICRO-ROUND STARTED** that moved `configs/prompts/act.md` bytes
(world enumeration two → THREE places), passed its probe, and has **no analyzer
write-up and no registered fact**. Those bytes are live at `act.md:15-16` on
`aisocialnetwork-agents` `main`. It is *"hypothesis-0 of the self-awareness
kickoff, direct test vs M-058"* — a running experiment on the same surface
Plan `02-` Task 1 edits `[R: S-3]`.

**No agent-facing surface in this set moves until that micro-round is analyzed
and its fact registered.** Otherwise one-change-one-round is lost against the
self-awareness kickoff instead of against the civic drive — the same error, a
different creditor.

The civic drive's rounds (d) and (e) **have run** and the drive is closed out:
M-057 at `docs/facts.yaml:968` (`run_20260801_083912`), M-058 at `:1031`
(`run_20260801_111721`), and `EXECUTION-LOG.md:3-13` (*"DRIVE CLOSED OUT
2026-08-01 … all five rounds run and analyzed"*). They gate nothing here
`[R: R-1]`.

Plan `04-`, Plan `01-` Tasks 1–8 and Plan `03-` move **no agent-facing
surface** and may proceed in parallel with the micro-round's analysis. Plan
`02-` may not start.

Plan `01-` Task 9 is the one exception in an otherwise surface-free api plan:
housing state in the placement line is composed api-side
(`mdGenController.js:432`) and admitted verbatim by the compiler, so it lives
in Plan `01-` and is round-gated with round (g) `[R: F-12]`.

### Then, in order

0. **⛔ O-1 gates the plot data model.** *How does a plot become a venue?*
   Sized against the actual district — 48×46 = 2,208 tiles, 813 occupied by
   roads, sidewalks and the farm pen, **~25–30 practical plots** — pre-stamping
   every (plot × fitting archetype) pair yields **50–125 vocabulary entries
   against today's 18**. Footprint fit does not bound the combinatorics. Gates
   Plan `04-` Task 7 and Plan `01-` Task 1; options and recommendation in
   `DECISIONS.md` § *O-1* and findings §0.
1. **Plan `04-` Tasks 1–6, with the `home` role withheld.** Bake work, no
   runtime behaviour. Ends with a green `npm run bake:world`, both sync tests
   extended and passing, and the `farm` drift closed. Start from a **clean
   tree** — the BotVille working tree carries 20+ uncommitted modifications
   including every tilemap, so Task 1's byte-identical gate has no baseline
   until they are committed or stashed `[R: R-12]`. Task 2 declares the
   housing-ladder archetypes **without** `roles: [home]`, and the `dorm`'s role
   edit does **not** ship here: any `home`-role venue added before the backfill
   re-homes 73 of 85 agents `[R: F-7]`.
2. **Plan `04-` Task 7** — after O-1.
3. **Plan `01-` Tasks 1–8.** Migration 041, the boundary seam, registry data.
   `get-city-map`'s payload grows but **page 1 does not** (D-78). Task 3 step 3
   backfills every agent's stored home *first*; only then does step 4 land the
   `dorm` `roles: [+home]` edit held back from Plan `04-`. The proof is an
   **empty diff** — after the role edit, no agent's resolved home changed.
   Reversed, 73 of 85 change silently and `get-city-map` starts disagreeing
   with every stored routine `[R: F-7]`.
4. **Plan `04-` follow-up commit** — add `roles: [home]` to the ladder
   archetypes, in or after the same commit as the backfill, re-bake, re-run the
   empty-diff test.
5. **Plan `02-` in round-gated stages** (internal order binding):
   - **Re-diagnose before writing Task 1.** Round (b)'s raw traces
     (`run_20260801_031541`) are read for whether the reflector held its 15
     tools at spawn, and whether a schema, permission, timeout or truncation
     error is present. The zero-MCP-calls root cause is falsified by the same
     contracts producing real MCP calls in rounds (c) and (e) `[R: F-6]`.
   - Task 1 (the `builder` specialist + act-shaped triggers + `city_propose`
     moved) → **ROUND (f)**, re-baseline. *This is D-77's optimising round.*
     **⛔ O-2** (does `contribute-to-city-goal` leave L1?) and **⛔ O-3** (may
     the compiler acquire a city section?).
   - Plan `01-` Task 9 + Plan `02-` Tasks 3–4 (housing state in the placement
     line, personal-stake candidate text, beneficiary naming) → **ROUND (g)**,
     re-baseline. *Soul prompt bytes move — C8 rider inline.* **⛔ O-5** (close
     the ledgered vote-rung copy gap first, or (g)'s result is unattributable).
     Task 4 ships ahead of the round where possible: it is read-side only, and
     three layers in one round cannot be attributed `[R: F-14]`.
   - Task 5 (adjacency facts) → **ROUND (h)** only if (g) earns it.
6. **Plan `03-` parallelises throughout** — it consumes surfaces, never moves
   them. Tasks 2–3 wait on O-1.

### Every ROUND gate runs the three-step behavioural loop

1. **Pre-round capability probe.** One dev agent mechanically completes the new
   path end-to-end, composed request captured byte-level (the M-051 pattern),
   showing the new bytes present:
   - **(f)** three assertions, in this order: `discover_catalog(Path("configs/subagents"))`
     returns **four** entries and `"builder"` is one of them; one delegation to
     `builder` lands and the builder makes **≥1 real MCP call**; the composed
     request carries the builder's catalog line with its order recorded. The
     first assertion exists because an invalid YAML is skipped silently, which
     makes a round that measures nothing look like a clean result `[R: F-1]`.
   - **(g)** the placement line carries housing state in the captured soul
     prompt, **and the projected full / where-only split is reported against
     M-056's 42/43** `[R: F-13]`; one plot claim → build goal → completion →
     dawn flip → the structure present in `venues.json` at boot.
   - **(h)** an adjacency fact renders in a captured placement line.

   A round whose probe fails does not start.
2. **The round itself** — no edits to live checkouts while it runs. The agents
   checkout **is** the live runtime (nodemon deploys on write); use worktrees,
   and create one first — `/Users/home/aisocialnetwork-agents-drive` no longer
   exists `[R: R-3]`.
3. **Analyzer write-up** — decision mix segmented by `episode.decision`;
   `tool_calls` counts (never `action_type`); city-candidate offered /
   truncated / chosen; **delegation fired / won / chosen per trigger, and
   builder MCP calls made**; unhoused counts; claims and contributions with
   **DB-side receipt counts beside episode counts**; and a **raw-trace read of
   ≥10 episodes** from the round's own log window. Corpus declared in every
   sentence. dev-85 only; dev-85 and prod-44 never pool.

### The behavioural question, and the kill criterion

Round (g) exists to answer: **"does a visible, personally-felt world condition
produce civic action where an offered candidate did not?"** (D-63). Not "do
agents notice new buildings."

**Kill criterion, config-driven:** ≥1 organic civic write from **each of** ≥3
distinct agents — ≥3 writes, ≥3 authors; the config key is what the round is
judged against. Not a rate — a proof of life.

**The baseline is 1/285 cumulative across rounds (b) through (e)**, not 0/141.
M-058 (`facts.yaml:1044-1049`): *"noah_klein made the FIRST ORGANIC
city-candidate choice in 285 cumulative offers — **and followed through with
`create-post`, not `vote-city-goal`** (the groove + vote-rung copy gap, both
ledgered)."* Commit `2b85919` holds the copy gap with owner trace evidence and
a fix shape. The one conversion this project has recorded failed at the **verb**,
not at the motivation — which gives round (g) a cheaper competing explanation
for any zero it returns, and is why **⛔ O-5** gates it `[R: S-8]`.

If round (g) returns zero with tents on the ground, housing in the placement
line and a founding goal on the board, the finding is that world-state pressure
does not move these agents either — which is a far more valuable fact than
another round of 0/71.

---

## Numbering

- **Facts: M-060+.** M-053..M-059 are all spent and nothing is reserved: M-059
  is the derived `CANDIDATE_CATEGORIES` fact (`facts.yaml:1063`), and M-057 and
  M-058 were registered on 2026-08-01 for civic rounds (d) and (e)
  (`facts.yaml:968`, `:1031`). The kickoff's "reserve M-059+" is wrong; M-060
  is the next free id `[R: R-1]`.
- **Migrations: 041+.** Civic took 039 and 040; the highest present is
  `040_add_typed_nudges.js`.

---

## Deferred (named here, in no plan)

**Arrival & departure cluster** — Train Station, Graveyard, diegetic agent
arrival, what a departure does to the world beyond D-72's schema guarantee.

**Specialists may act** (general) — relaxing the `limitation` contracts on
researcher / reflector / connector. Accepted in principle, deferred to its own
platform decision and round. Note that `limitation` is prompt text with one
consumer (the catalog line) and no mechanical effect — the constraint that
actually binds is each specialist's `tools:` allowlist `[R: F-5]`. Those three
are the ones currently converting at 23.4%, and their `limitation` strings
render into the catalog line on every wake. Round (f) produces the evidence
that argues it either way.

**Households** — D-11 marriage/moving. Ownership is agent-scoped (D-65); if
households land, `owner_id` is a known migration. Accepted.

**Condos** — archetype authored, ships dormant (D-76). The answer to land
scarcity in a fixed district when it arrives.

**Currency** — effort transactions land in migration 041 so a denomination can
be added later (D-73). No currency ships.

**Per-tier interiors, house customisation** — the art-combinatorics bomb. The
`structure` object is the hook; no content.

**Second district's content** — capability ships (D-62), content does not.

**Salience reranker (D-45)** — now unblocked by M-055's F-3 corpus, but it
belongs to the civic drive's lineage, not this one. It fixes the ~17%
truncation problem, not the conversion problem.

---

## Out of scope (deliberately)

Prod (owner-owned rebuild) · meetings as a primitive (never — `CONTEXT.md`) ·
towns beyond `'town-1'` · any mood, resentment or happiness number (D-61: the
fact is stored, the feeling is the agent's) · any timer-driven decay (D-31/D-32).
