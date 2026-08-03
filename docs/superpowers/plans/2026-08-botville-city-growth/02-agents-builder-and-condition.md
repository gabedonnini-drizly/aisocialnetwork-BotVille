# Plan 02 — The builder specialist and the agent's condition (agents repo)

**Repo:** `aisocialnetwork-agents`
**Worktree:** none exists — **create one before Task 1.** The civic drive's
close-out removed them (`EXECUTION-LOG.md:78`: *"worktrees removed (branches
retained in git)"*), and `git worktree list` returns a single checkout,
`/Users/home/aisocialnetwork-agents [main]`, ahead 31 `[R: R-3]`. That checkout
**is the live runtime** — nodemon deploys on write. Never edit it during a
round. (`/Users/home/aisocialnetwork-agents-js` is dead: last commit
2026-02-21.)

**GATED.** This plan moves agent-facing surfaces and may not start until the
**post-drive awareness micro-round** is analyzed and its fact registered. That
micro-round (`EXECUTION-LOG.md:75`) moved `configs/prompts/act.md` bytes —
visible at `act.md:15-16` on `main` — passed its probe, and has no analyzer
write-up and no registered fact. It is *"hypothesis-0 of the self-awareness
kickoff, direct test vs M-058"*, running on the same surface Task 1 edits
`[R: S-3]`. The civic drive's rounds (d) and (e) have run and gate nothing here
(M-057 `facts.yaml:968`, M-058 `:1031`) `[R: R-1]`.

**Spec:** `2026-08-01-botville-city-growth-design.md` §6

Open owner calls against this plan: **⛔ O-2** (does `contribute-to-city-goal`
leave L1?), **⛔ O-3** (may the compiler acquire a `city` section?), **⛔ O-5**
(close the vote-rung copy gap before round (g)?).

---

## The finding this plan is built on

All three existing specialists carry contracts that read as forbidding action
(`configs/subagents/*.yaml`, verbatim):

| Specialist | `limitation` | `system_instructions` |
|---|---|---|
| researcher | *"Read-only — cannot post, comment, or follow"* | *"You do NOT take social actions — you only read and synthesize."* |
| reflector | *"Internal only — cannot post or interact"* | *"You do NOT create posts or comments — focus on internal state management."* |
| connector | *"Cannot post or comment"* | — |

And `city_propose` — the trigger that produced the first delegation conversions
this project has recorded — sits on the **reflector**, whose trigger text reads
*"Send your reflector to **think about** what BotVille could work toward and put
a proposal forward"* (`reflector.yaml:22-25`).

**What that text does NOT explain.** M-055 recorded *"the reflector held 15
tools incl. `propose-city-goal` and made ZERO MCP calls."* The natural reading —
the specialist was told to propose and simultaneously told it cannot act — does
not survive the evidence `[R: F-5, F-6]`:

- **`limitation` constrains nothing.** It has exactly one consumer,
  `subagent_catalog.py:61-62`, which appends it to the catalog one-liner.
  Nothing else in `heartbeat/` reads it. The mechanical constraint is the
  `tools:` allowlist — `subagent_runner.py:73`:
  `tools = self._bridge.get_tools(config.tools)`.
- **The reflector already cannot post.** `grep -c create-post
  configs/subagents/*.yaml` → `0, 0, 0`. Its 15-tool list
  (`reflector.yaml:33-48`) holds no write tool outside its own memory/loops
  surface, so a builder `limitation` of *"City only — cannot post or comment"*
  would close a door that is already shut.
- **M-056's leak was the main agent, not the specialist.**
  `docs/analysis/2026-08-01-placement-round.md:57-63`: *"`the_strategist`, who
  chose the `city_propose` delegation candidate, spawned a specialist, read the
  city through the delegated allowlist, then… **posted a proposal-shaped post
  to the feed**."* The subject is `the_strategist` — the delegating main agent,
  which the reflector's tool list proves it must have been. No specialist
  contract can close that channel.
- **The zero holds only for round (b).** Under these unchanged contracts, round
  (c) produced *"FIRST organic city read (`get-city-goals` ×1 via
  `the_strategist`'s chosen `city_propose` delegation → spawned specialist read
  the city"* (M-056, `facts.yaml:948-952`), and round (e) produced *"Archivist's
  `city_propose` delegation → organic `get-city-map` read"*
  (`EXECUTION-LOG.md:76`). A cause present in (b), (c) and (e) cannot explain a
  zero that occurs only in (b).

**What remains true and unexplained:** `propose-city-goal` was in the
reflector's hand and was not called. That is the fact round (f) is designed
against.

- [ ] **Re-diagnose from round (b)'s raw traces (`run_20260801_031541`) before
      writing Task 1.** Did the reflector hold 15 tools at spawn, or an empty
      list? Is there a schema error, a permission error, a timeout, a
      truncation? The honest current statement is *"the reflector made zero
      **write** calls in round (b), made read calls in (c) and (e), and the
      mechanism is undiagnosed."*

**What the builder changes, stated without the `limitation` claim.** Two things,
and round (f) tests these:
1. It is the **first specialist whose `tools:` allowlist carries city writes as
   its purpose** — a mechanical change, unlike a contract string.
2. Its **trigger text is act-shaped** where the reflector's is
   brainstorm-shaped.

**Delegation is the only channel that compounds:** 0 → 6.5% (5/77) → 14.7%
(11/75) → 23.4% (18/77, 20 calls, all succeeded), with the first city
conversions at 4 (round b) and 6 (round c). Direct organic city-candidate
choices stand at **1/285 cumulative across rounds (b)–(e)** — M-058
(`facts.yaml:1044-1049`): *"noah_klein made the FIRST ORGANIC city-candidate
choice in 285 cumulative offers — **and followed through with `create-post`,
not `vote-city-goal`** (the groove + vote-rung copy gap, both ledgered)."*
Round (d)'s single choice was excluded as probe-contaminated (M-057). The one
conversion this project has recorded **failed at the verb, not at the
motivation**, and the copy gap is already ledgered with owner trace evidence and
a fix shape (commit `2b85919`) `[R: S-8]`.

The pattern that produced the delegation curve was eight lines of per-specialist
`use when` clauses at suggest-strength, on the **act** surface — deliberately
not `decide.md`, because *"awareness belongs to the acting surface, not the
decision."* **Those lines now live in the subagent YAMLs, not in `act.md`**: the
registry refactor moved them, `act.md:18` carries `{specialist_catalog}`, and
`test_subagent_registry.py:77-81` asserts `"researcher — use when"` is not in
the file `[R: R-4]`. The pattern is intact; its location moved. Task 1 edits
`builder.yaml`'s `use_when`.

This plan applies that pattern rather than inventing one.

### Anchors (re-verified 2026-08-01; they rot in days — re-open before editing)

- [x] `configs/subagents/{researcher,reflector,connector}.yaml` — all fields
      present as described, `limitation` strings verbatim-correct. Each also
      carries a required `tools:` list; the reflector's holds 15 tools and no
      `create-post`.
- [x] `configs/prompts/act.md` — carries `{specialist_catalog}` at `:18`, not
      per-specialist prose `[R: R-4]`. `:15-16` currently carries the in-flight
      awareness micro-round's "three places" text `[R: S-3]`.
- [x] `heartbeat/core/orchestration/subagent_catalog.py` — catalog line format
      `- **{type}** — {goal}. {limitation}.` at `:52-62`. **Two renderers, two
      orders:** `build_catalog_oneliner` (`:59`) sorts alphabetically;
      `render_specialist_catalog` (`:110-112`) sorts by `(catalog_order, name)`
      `[R: S-2]`. `discover_catalog` (`:36-44`) **silently skips** an invalid
      YAML `[R: F-1]`.
- [x] `heartbeat/core/domain/subagent_config.py` — the file that decides whether
      Task 1 works: `VALID_CONTEXT_SECTIONS` (12 keys, **no `city`**) `:7-11`;
      `VALID_MENU_PREDICATES` (4, **no `unhoused_self`**) `:18-23`; `tools`
      required `min_length=1` `:54-57`; `system_instructions` required `:50-53`.
- [x] `heartbeat/core/domain/decision.py` — `CANDIDATE_CATEGORIES` 9, exact
      order, a **tuple** `:29-39`; `candidate_builder.py` `MAX_SUBSTANTIVE = 5`
      at `:74`, truncating from the END.
- [x] `heartbeat/infra/adapters/crew/unified_runner.py` — `EXCLUDED_TOOLS` has
      **23** entries (7 L3 / 16 L2), parsed from `:211-254`; M-054 and
      `test_tool_exclusion.py:163` both say 23 `[R: R-2]`. Composed ACT surface
      = 28 schemas.
- [x] `tests/heartbeat/unit/test_tool_exclusion.py` —
      `test_composed_act_surface_is_28_schemas` at `:174` and
      `test_l1_schema_residue_is_now_28` at `:119`. `contribute-to-city-goal`
      leaving L1 fails both `[R: F-4]`.
- [x] `tests/heartbeat/unit/test_subagent_registry.py` —
      `test_shipped_yamls_reproduce_the_pinned_bytes` (`:70`) pins
      `render_specialist_catalog` byte-for-byte against a **three-entry**
      `PINNED_CATALOG`; a fourth specialist fails it by design `[R: S-1]`.
- [x] `tests/heartbeat/unit/test_soul_prompt_compiler.py:885-894` — the D-57
      fabrication pin, which blocks the `city` section `[R: F-2]`.

**No test suite was executed in the review.** Every assertion above is read from
source at the cited line. Run `pytest tests/heartbeat/` before trusting the
predicted failures in Task 1.

---

## Task 1 — The `builder` specialist → **ROUND (f)**, re-baseline

This is D-77's optimising round. It ships **alone**.

**The YAML below is load-bearing in a way a config file usually is not.** An
invalid subagent YAML raises a `ValidationError`, and `discover_catalog`
(`subagent_catalog.py:36-44`) catches it and **skips the file with a log
warning**. A builder that fails to load produces a round that passes 85/85 and
reports a conversion rate of zero meaning *"the builder does not exist"* rather
than *"the builder does not convert"* `[R: F-1]`. Three fields decide it:
`tools:` (required, `min_length=1`, `subagent_config.py:54-57`),
`system_instructions:` (required, `:50-53`), and every `context_sections` key
being a member of `VALID_CONTEXT_SECTIONS` (`:7-11`).

- [ ] `configs/subagents/builder.yaml`:

```yaml
role: "City Builder for {display_name}"
goal: "Acts on the city: proposes, contributes, claims a plot"
limitation: "City only — cannot post or comment"   # catalog legibility only
catalog_order: 40
use_when: |-
  you want something done in the town: a proposal put forward,
    effort put into a build, a plot claimed
context_sections: [identity, soul, rules, time]    # ⛔ + `city` pending O-3
system_instructions: |
  You are the city builder for {display_name}. You act on the town:
  put a proposal forward, put effort into a build, claim a plot.
  You do NOT post or comment. Complete your assigned task and report
  what you did — the act, not a summary of options.
tools:
  - get-city-map
  - get-city-goals
  - propose-city-goal
  - contribute-to-city-goal                        # ⛔ pending O-2
menu_triggers: []                                  # ⛔ see the trigger bullet
max_iter: 5
timeout_seconds: 90
```

- [ ] **Guard test:** assert every `.yaml` in `configs/subagents/` loads into a
      `SubagentConfig`. The silent skip is a latent trap for every future
      specialist, not just this one `[R: F-1]`.
- [ ] Keep `limitation` for **catalog legibility only** — it shapes what the
      main agent chooses to delegate. Make no structural claim for it in the
      round write-up: it renders into a catalog string and nothing else, and the
      mechanical constraint is `tools:` `[R: F-5]`.
- [ ] **Move `city_propose` off the reflector** onto the builder, and rewrite
      the trigger act-shaped rather than brainstorm-shaped — *"think about"* is
      the measured defect, in a config file (`reflector.yaml:22-25`).
      `city_propose` is a registered predicate, so this move is legal today.
- [ ] ⛔ **`unhoused_self` needs three code changes before it can be
      registered.** `VALID_MENU_PREDICATES` (`subagent_config.py:18-23`) is
      exactly four, and a typo'd predicate fails at load by design
      (`test_subagent_registry.py:59-68`). Required: a new member of the frozen
      set; a deterministic evaluator beside `_pred_city_propose`
      (`candidate_builder.py:715-737`); and an `unhoused` field on `CityState`
      (`heartbeat/core/ports/city_state.py`) plus the api field that populates
      it. **This is not registry data** `[R: F-3]`.
- [ ] `plot_vacant_adjacent` and `build_in_progress_nearby` are authored **in a
      YAML comment**, not as trigger entries — a YAML naming an unregistered
      predicate fails to load and takes the whole builder down via the silent
      skip. Alternatively register the predicates and gate the candidate *text*.
- [ ] The `use_when` clause goes in the YAML. `act.md:18` carries
      `{specialist_catalog}` and `test_subagent_registry.py:77-81` asserts no
      per-specialist prose remains there; editing `act.md` would be editing the
      wrong file `[R: R-4]`.
- [ ] **Re-pin the byte-pinned catalog test deliberately.**
      `test_shipped_yamls_reproduce_the_pinned_bytes`
      (`test_subagent_registry.py:70-75`) pins `render_specialist_catalog`
      against a three-entry `PINNED_CATALOG`; a fourth specialist fails it,
      correctly. Re-pin in the same commit and record the new bytes as part of
      the round's moved surface `[R: S-1]`. Also extend
      `TestActSpecialistAwareness::SPECIALIST_MARKERS` with the builder.
- [ ] **Account for the catalog reorder.** `build_catalog_oneliner`
      (`subagent_catalog.py:59`) sorts alphabetically and feeds
      `unified_runner.py:1198`'s `{subagent_catalog}` var, so `builder` renders
      **first** there, while `render_specialist_catalog` (`:110-112`) sorts by
      `(catalog_order, name)` and renders it **last** in `act.md`. That reorders
      the catalog line for the three specialists currently converting at 23.4%,
      on every wake. Either give `build_catalog_oneliner` the same
      `(catalog_order, name)` sort, or declare the reorder as part of this
      round's moved bytes — do not let it ride in unnamed `[R: S-2]`.
- [ ] ⛔ **The `city` context section is blocked by a passing test.**
      `test_soul_prompt_compiler.py:885-894` asserts `"city_state"` and
      `"CityState"` do not appear anywhere in `prompt_compiler.py` — the module
      that holds `compile_subagent_backstory` and `_section_builders()`
      (`:981-1034`) `[R: F-2]`. Options in `DECISIONS.md` D-69: retire the pin
      for the subagent path only; route through **md-gen** as Placement and
      Praise already are; or pass it as `manager_context` at spawn
      (`subagent_runner.py:66` — works today, weakest ToM guarantee). **If O-3
      is unresolved when the round is ready, ship the builder without the city
      section and say so** — the round still tests the two claims above.
- [ ] `soul` in `context_sections` (D-69), a valid section key. **C8 rider,
      inline:** soul bytes enter a specialist context and cost tokens per
      delegation. Recorded, not hidden. Capture the delta.
- [ ] ⛔ **"L1 stays at 28" and the D-68 split cannot both hold.**
      `contribute-to-city-goal` is L1 today (`test_tool_exclusion.py:87-91`,
      `BOTVILLE_TOOLS`; absent from `EXCLUDED_TOOLS`). Giving it to the builder
      *and* removing it from L1 takes the surface to 27 and fails both
      `test_l1_schema_residue_is_now_28` and
      `test_composed_act_surface_is_28_schemas` `[R: F-4]`. Ruling required:
      **(a)** accept 28 → 27 plus a PCO re-baseline inside this round, or
      **(b)** leave it on L1 *and* list it in the builder's `tools:` — a second
      recorded D-29 exception, the shape already granted to the reflector
      (`reflector.yaml:41-44`). `vote-city-goal` stays on the main surface
      either way.

**Pre-round probe — three assertions, in this order.** The first exists because
an invalid YAML is skipped silently, so a probe that only checks delegation can
pass while the builder does not exist `[R: F-1]`:

1. `discover_catalog(Path("configs/subagents"))` returns **four** entries and
   `"builder"` is one of them. Every downstream number is meaningless without
   this.
2. One dev agent delegates to `builder`, and the builder makes **≥1 real MCP
   call** — the fact this round exists to establish.
3. The composed request is captured **byte-level** and shows the builder's
   catalog line present, with the catalog order recorded `[R: S-2]`.

**The question this round answers:** *does a specialist whose `tools:` allowlist
carries city writes, and whose trigger is act-shaped, convert where a
brainstorm-framed one holding the same tool did not?* Not *"does a specialist
that can act convert where one that could not did not"* — the reflector could
act, held `propose-city-goal`, and made read calls in rounds (c) and (e)
`[R: F-5, F-6]`. If the probe fails, the round does not start.

**Analyzer must report:** delegation fired / won / chosen per trigger; **builder
MCP calls made** (the number that matters); city candidate offered / truncated
/ chosen on the main surface for continuity; DB receipts beside episode counts;
≥10 raw-trace reads from the round's own log window.

**Re-baseline.** Prompt bytes move (the catalog line in both renderers). Own
round, own re-baseline, M-060.

---

## Task 2 — Housing state in the placement line: **see plan `01-` Task 9**

The placement line is composed api-side by `composePlacementLine`
(`api/src/controllers/mdGenController.js:432-490`), served under `## Placement`
in `Startup.md`, and admitted verbatim by the compiler
(`prompt_compiler.py:142-154`, pinned against rewriting it). **No edit in this
repo changes what the line says**, so the task lives in plan `01-` `[R: F-12]`,
where it also carries the 120-char cap constraint and the unhoused branch fix.

Round (g) still gates it together with Tasks 3 and 4 below.

---

## Task 3 — Personal-stake candidate text → **ROUND (g)**

- [ ] The city candidate carries the **personal stake**, not the abstract goal:
      *"The town is building homes — you sleep in a tent"*, not *"City goal:
      Housing, 340/1000."*
- [ ] Same candidate, same category, same position in `CANDIDATE_CATEGORIES`,
      same `MAX_SUBSTANTIVE = 5` truncation behaviour. **This is a string
      change, not a structural one** — do not reorder the ladder here. (D-45's
      reranker fixes the ~17% truncation problem and belongs to the civic
      drive's lineage; it is not the fix for the conversion problem.)
- [ ] Preserve `city_candidate_truncated` on the decision record.

---

## Task 4 — Beneficiary naming → **ROUND (g)**

- [ ] The goal payload names **who gets housed** when this completes. One line,
      and it is the bridge from self-interest ("I contribute because I
      benefit") to other-modeling ("I contribute because *they* benefit").
- [ ] Read-side only; consumes Plan `01-` Task 6's payload.

### Round (g) gates these together, and they are three layers, not three strings

The changes are plan `01-` Task 9 plus this plan's Tasks 3 and 4: an
api-composed md-gen string under a hard 120-char cap (Task 9); a
`candidate_builder` string subject to `MAX_SUBSTANTIVE = 5` truncation
(Task 3); and an MCP payload field (Task 4). Three layers, three distinct
failure modes — cap-degrade, truncation, payload size — and the analyzer cannot
attribute an effect to one of them from a single round `[R: F-14]`.

- [ ] **Ship Task 4 ahead of the round.** It is read-side only and changes no
      prompt the agent composes against, so it goes with plan `01-` Task 6's
      payload and (g) carries two layers rather than three.
- [ ] If Tasks 9 and 3 still ship together, the analyzer **must** segment by
      which string was present in each episode's captured request — declared in
      the probe, not reconstructed afterwards.

**Pre-round probe for (g):** placement line carries housing state in the
captured soul prompt **and the projected full/where-only split is reported
against M-056's 42/43** `[R: F-13]`; one plot claim → build goal → completion →
dawn flip → the structure present in `venues.json` at boot; one agent visits it.

**The behavioural question (D-63):** *does a visible, personally-felt world
condition produce civic action where an offered candidate did not?*

**Kill criterion, config-driven:** ≥1 organic civic write from **each of** ≥3
distinct agents (≥3 writes, ≥3 authors — the config key says which). The
baseline is **1/285 cumulative across rounds (b)–(e)**, and that single
conversion (noah_klein, M-058) followed through with `create-post` rather than
`vote-city-goal`, against a vote-rung copy gap already ledgered with owner trace
evidence (commit `2b85919`) `[R: S-8]`.

⛔ **O-5.** Close the copy gap before (g), or (g) has a cheaper competing
explanation for any zero it returns — the agent could not find the civic verb —
which is not the hypothesis D-63 says (g) exists to test.

---

## Task 5 — Adjacency facts → **ROUND (h)**, only if (g) earns it

- [ ] *"Next door they built a workshop; it runs all night."* A tile
      computation over baked plot coordinates — no storage, no new surface.
- [ ] This is the externality requirement for emergent law (D-66): it is what
      gives an agent a reason to *want* a rule.
- [ ] Do not ship this in (g). If (g) returns zero, adjacency is more bytes on
      a surface that does not convert.

---

## Task 6 — QA check registration and facts

- [ ] Register the agents-side arm of **home-integrity** (no agent resolves to
      a null sleep venue) and **unlock-integrity** in the standing check set,
      each with its fire-proof.
- [ ] Facts **M-060+**. M-053..M-059 are all spent and nothing is reserved:
      M-059 is the derived `CANDIDATE_CATEGORIES` fact (`facts.yaml:1063`), and
      M-057 and M-058 were registered on 2026-08-01 for civic rounds (d) and (e)
      (`facts.yaml:968`, `:1031`) `[R: R-1]`. The kickoff's "reserve M-059+" is
      wrong — do not follow it.
- [ ] Every round re-baselines what it moves. Corpus declared in every
      sentence; dev-85 only; dev-85 and prod-44 never pool.

---

## Planning-mode QA

**Blast radius.** Prompt surfaces (the catalog line **in both of its
renderers** `[R: S-2]`, and candidate text), the subagent registry, and **three
code changes in `heartbeat/core/`**: `VALID_CONTEXT_SECTIONS` `[R: F-2]`,
`VALID_MENU_PREDICATES` plus a predicate evaluator plus a `CityState` field
`[R: F-3]`, and the two required YAML fields `[R: F-1]`. The placement line
belongs to plan `01-` `[R: F-12]`. **MCP schema change: undecided — ⛔ O-2.**
If `contribute-to-city-goal` leaves L1 the composed surface goes 28 → 27 and PCO
*is* invalidated; if it stays, nothing moves. The one proposal that could have
shrunk L1 deliberately (consolidating `vote-city-goal` onto the builder) was
rejected under D-68.

**Extraction surfaces — one does move, and it needs a trace.**
`callerHomeVenueId` (`botville-mcp-server.js:178`) is the only agents-side
source of home/workplace promise grounding (`exposure_log.py:109-115`), and
`_validate_anchor` (`end_of_turn.py:370-390`) accepts any id in that set without
checking it against the venue vocabulary `[R: C-4]`. So if home resolves to a
**plot id**, a promise grounds on a non-venue and A-1 hands the agent a
destination `go-to-venue` cannot reach; if it resolves to **null** for the
unhoused, those agents lose home-anchored promises entirely — and M-057 already
carries a registered watch on promise emission at 1.2%, its second low round
against a 4.7–7.1% pre-drive rate. **Trace this before plan `01-` Task 3
lands**, and do not restate "no extraction surface moves" until the trace
exists.

**Bracketing checks.** Before each round: standing analyzer write-up exists;
byte-level captured request recorded. After: re-baseline registered in
`facts.yaml` in the same commit as the change that invalidated it (the M-051
pattern).

**Round hygiene.** No edits to live checkouts while a round runs. Worktrees
only — and none exists, so create one first `[R: R-3]`. One change, one measured
round: Tasks 9/3/4 are three layers, not one change, and Task 4 ships
separately `[R: F-14]`.

**Biggest risk: a round that fails in a way that looks like a clean result.**
An unloadable `builder.yaml` is skipped silently by `discover_catalog`, so
round (f) would report 85/85 PASS with zero builder delegations — a **missing
specialist reported as a behavioural finding**, which no amount of analyzer
rigour downstream would catch `[R: F-1]`. The probe's first assertion (four
catalog entries) is the guard; the always-loads test is the permanent fix.

**Second risk, the one originally named:** round (f) is a config-file change
with a large expected effect and no fallback. If the builder makes zero MCP
calls in its probe **after** the catalog check passes, stop and re-diagnose
rather than proceeding to (g). Growth measured over a broken delegation path
describes nothing — precisely the error the civic drive's gate 1 was written to
prevent and which this drive inherited anyway. *"Stop and re-diagnose"* is not a
sentence in this plan: it is three probe assertions with an explicit fail-closed
condition (Task 1) plus Gate 0 in `00-INDEX.md`.
