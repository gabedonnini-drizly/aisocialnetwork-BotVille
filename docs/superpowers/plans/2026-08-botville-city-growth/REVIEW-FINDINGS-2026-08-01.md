# REVIEW FINDINGS — adversarial review of the BotVille City Growth plan set (2026-08-01)

**Reviewer session:** fresh session, 2026-08-01, per `REVIEW-PROMPT.md`.
**Read order followed:** `DECISIONS.md` → spec → `00-INDEX.md` → `04-` → `01-`
→ `02-` → `03-`.

**Evidence discipline.** Every finding below carries a `file:line` opened this
session, a query actually run, or a computation actually executed. Nothing is
argued from the plan text alone. Files opened across four repos
(`aisocialnetwork-BotVille`, `-api`, `-agents`, plus the civic drive's
`docs/`): `heartbeat/core/domain/subagent_config.py`,
`heartbeat/core/orchestration/subagent_catalog.py`,
`heartbeat/core/orchestration/prompt_compiler.py`,
`heartbeat/core/orchestration/candidate_builder.py`,
`heartbeat/core/domain/decision.py`,
`heartbeat/infra/adapters/crew/{unified_runner,subagent_runner,end_of_turn,exposure_log}.py`,
`configs/subagents/*.yaml`, `configs/prompts/act.md`,
`tests/heartbeat/unit/{test_tool_exclusion,test_subagent_registry,test_soul_prompt_compiler}.py`,
`docs/facts.yaml`, `docs/analysis/2026-08-01-placement-round.md`,
`src/utils/{scheduleCoverage,agentSeed}.js`,
`src/services/botville/{presenceService,venueRegistryService,civicConfig,seasonService,civicService,notesService}.js`,
`src/controllers/mdGenController.js`, `src/mcp/botville-mcp-server.js`,
`src/db/migrations/{038,039,040}*.js`, `scripts/{world-bake.mjs,lib/residences.mjs}`,
`contract/assets.contract.json`, `venues/district/venue.json`,
`venues/_archetypes/house.json`, `packages/client/public/assets/venues.json`,
`packages/client/src/game/{venueRegistry.ts,scenes/DistrictScene.ts}`,
`assets-src/**`, and the civic drive's `EXECUTION-LOG.md`.
Computations run: the home-reassignment simulation (§II F-7), the district
free-tile geometry (§III S-7), and eleven asset-directory counts (§I).

**What this session did NOT run, stated plainly:** no test suite was executed
(`pytest tests/heartbeat/`, api `npm test`, `npm run bake:world`), and no round
or probe was run. Every claim below about a test is a claim about that test's
**source**, read this session at the cited line — the assertion it makes and
the value it pins — not about a live pass/fail. Where a finding predicts a test
will fail (F-1, F-4, S-1), that prediction is derived from the assertion text
and should be confirmed by running it before the amendment lands.

---

## Verdict

**The plan set is not executable as written, and the first thing it does
would fail silently rather than loudly.** Plan `02-` Task 1 — named in
`00-INDEX.md` as *"the highest expected-value round in the set"* — specifies a
`builder.yaml` that **cannot load**: it omits two required fields and declares
a `context_sections` key that does not exist in the validator's vocabulary, and
`discover_catalog` swallows the resulting `ValidationError` and skips the file
with a log warning. Round (f) would run against three specialists, produce a
clean 85/85 PASS, and measure nothing.

That is the shape of the whole set's central defect: **it describes as
"registry data" three things that are code changes**, two of which collide with
tests the civic drive deliberately pinned. And its load-bearing root-cause
claim — that specialists made zero MCP calls *because* their `limitation`
contracts forbid acting — is **falsified twice over by the project's own
records**: `limitation` is prompt text with no mechanical effect, the reflector
already cannot post (no `create-post` in its `tools:`), and specialists made
real MCP calls under those unchanged contracts in rounds (c) and (e).

Separately, one data edit the plan treats as a two-token change —
`dorm` gaining the `home` role — **re-homes 73 of 85 agents**, breaks the
`get-city-map always agrees with stored routines` invariant, and breaks D-59's
own premise. That is computed, not argued.

The bake plan (`04-`) is the strongest document in the set: its art inventory
verified **exactly** (35,085 files / 34,078 PNGs; 13,081 / 17,927 / 2,411 / 355
per pack; 24 exterior categories; 26 interior sets), as did nine of eleven
sampled asset counts. Its structural claims about the pipeline hold.

**Twelve MUST-FIX, eleven SHOULD-FIX, five CONSIDER, thirteen rotted anchors,
six owner calls.** §0 resolves against the author's hypothesis: the
combinatorics do **not** stay small.

Severity: **MUST-FIX** (wrong before execution; blocks or silently corrupts) ·
**SHOULD-FIX** (fix during execution) · **CONSIDER** (recorded, judgement call).

### Amendment status (2026-08-01, same session)

**All MUST-FIX and SHOULD-FIX findings, and every rotted anchor, are landed as
inline amendments** in `DECISIONS.md`, the spec, `00-INDEX.md` and all four
plan files, marked `⚠ AMENDED (review 2026-08-01)` or `⚠ RETRACTED` at the
exact ruling, task or anchor they correct. The CONSIDER items are recorded at
the tasks they bear on. **The six owner calls are NOT resolved** — each is
marked `⛔ OWNER CALL (O-n)` at every point it gates, with the options stated
and a recommendation where the review has one. Structural changes made:

- **Plan `02-` Task 2 → Plan `01-` Task 9** (F-12) — the placement line is
  composed api-side; there is no agents-repo edit that changes it.
- **Plan `02-` Task 1's `builder.yaml` rewritten** (F-1) with the two required
  fields, plus a new always-loads guard test and a three-assertion pre-round
  probe whose *first* check is that the catalog contains four entries.
- **Plan `01-` Task 3 restructured into ordered steps** (F-7) — the stored-home
  backfill now provably precedes the dorm's `roles` edit, with an empty-diff
  test as the proof.
- **Plan `04-` Task 7 rewritten around a derivation** (S-7) — floor 13, ceiling
  ~25–30, `scarcity_ratio` as the single recorded knob, plus a sync-test
  assertion that makes the deadlock case unshippable.
- **Plan `00-INDEX.md` Gate 0 replaced** (R-1 + S-3) — the stale (d)/(e) gate is
  retired; the live blocker is the unanalyzed awareness micro-round.
- **`04-` Task 5 split** (S-4) — pool stays in the bake, the deterministic pick
  moves to `03-` Task 2, where a `spriteSeed` exists.

---

## §0 — The gap the author knew about: RESOLVED AGAINST THE HYPOTHESIS

**The claim under test.** *"Footprint fit bounds this naturally — a school does
not fit a house plot, so most plots admit one to three archetypes and the
combinatorics stay small."* (`REVIEW-PROMPT.md:38-41`)

**Sized against the actual district.** `venues/district/venue.json` is
`sizeTiles: [48, 46]` = 2,208 tiles, with `vRoad [22,24]`, `hRoad [21,23]`,
`vSidewalks [[20,21],[25,26]]`, `hSidewalks [[19,20],[24,25]]` and the farm
`pen [36,2,47,18]`. Computed occupancy of those alone: **813 tiles, leaving
1,395 free** — before the five existing buildings, the `paths` entries, the
`scatter` bushes/crops/fence, spawn points and any walkable margin. Free tiles
per quadrant: **NW 380 · NE 195 · SW 400 · SE 420** (NE is mostly farm pen).
At a 6×5 house footprint that is a *theoretical* ceiling of ~45 plots and a
practical one nearer **25–30**.

**Therefore the hypothesis is false.** With ~25 plots and the three-to-four
size classes a tent/mobile-home/house/villa ladder plus six civic archetypes
implies, footprint fit admits roughly **2–5 archetypes per plot**, i.e.
**50–125 pre-stamped (plot × archetype) venues** against today's **18-entry**
published vocabulary (`packages/client/public/assets/venues.json`, counted).
That is a 3–7× blowup of the exact artifact D-78 is written to cap, and it
lands in `get-city-map`'s payload and in `venueRegistry.published()`'s
byte-for-byte projection.

**Compounding it, the tent has the same problem and no answer at all.** Spec
§7.3 rules *"Plots are not venues — they are map features with state."*
`resolvePresence` (`presenceService.js:45-48`) requires a `venueId` or returns
absent. I-8 forbids the runtime inventing one. So a tent on a plot has no
venue identity in the model as specified — see **F-8**.

**Recommendation (needs a ruling — O-1).** Take the second option the author
listed: **decouple venue identity from archetype**. `plot_7` is the venue id
from the bake; the archetype selects the interior TMJ and the exterior sprite.
This costs exactly what the author feared — `roles`/`affords` become
state-dependent rather than static — but that cost is already unavoidable,
because a plot that is `vacant` (tent camp, D-60) and later `built` (a school)
*must* change what it affords no matter which option is chosen. Re-state I-8 as
*"every **asset** is baked before it can appear"* rather than *"every
vocabulary **entry** is static"*, which is what I-8 actually protects against
(a missing texture, I-2). The third option — `allowedArchetypes` fixed at
authoring time — is not a compromise, it is **D-66 repealed**; if it is taken,
take it explicitly with the owner, not by erosion.

**This gates Plan `04-` Task 7 and Plan `01-` Task 1, as the author suspected.**

---

## §I — Rotted anchors

Every one found. Verified-correct anchors are listed at the end of this
section so the author knows what held.

| id | anchor as claimed | actual | cited at |
|---|---|---|---|
| **R-1** | *"M-057 and M-058 are reserved and unspent"*; *"Rounds (d) and (e) of the civic drive have not run"* | **Both are spent. Both rounds ran on 2026-08-01 and the whole civic drive is CLOSED OUT.** `docs/facts.yaml:968` = M-057 (round (d), promises, `run_20260801_083912`); `:1031` = M-058 (round (e), nudges, `run_20260801_111721`). `EXECUTION-LOG.md:3-13` — *"DRIVE CLOSED OUT 2026-08-01 … M-052..M-058 registered … all five rounds run and analyzed"*; `:76`, `:79`. | `DECISIONS.md:596-602`, spec `:476-481`, `00-INDEX.md:64-73`, `00-INDEX.md:135-137`, `02-:9-11`, `02-:200-202` |
| **R-2** | `EXCLUDED_TOOLS` **22 entries**, 7 L3 / 16 L2 | **23 entries.** Parsed from `unified_runner.py:211-254`. 7 + 16 = 23; `test_tool_exclusion.py:163` asserts `len(EXCLUDED_TOOLS) == 23`; M-054 (`facts.yaml:1015-1020`) states 22 → 23. The "22" is the pre-civic number the *previous* review verified. | `02-:66` |
| **R-3** | Worktree `/Users/home/aisocialnetwork-agents-drive` (`feat/botville-drive`) | **Does not exist.** `ls` fails; `git worktree list` returns one checkout, `/Users/home/aisocialnetwork-agents [main]`, ahead 31. The civic close-out removed them: `EXECUTION-LOG.md:78` — *"worktrees removed (branches retained in git)"*. Plan `02-` has no working directory. | `02-:4-7` |
| **R-4** | *"One `use when` line in `configs/prompts/act.md`, matching the existing three exactly in shape"* | **`act.md` has no per-specialist lines.** It carries `{specialist_catalog}` at `act.md:18`, and `test_subagent_registry.py:77-81` asserts `"researcher — use when" not in act.md`. The registry refactor moved those lines into the YAMLs; the plan is written against the pre-refactor `1514b0a` shape it cites. | `02-:100-102` |
| **R-5** | `pickFrom(pool, spriteSeed, salt)` *"from `api/src/utils/scheduleCoverage.js`"* | **It lives in `src/utils/agentSeed.js:178`.** `scheduleCoverage.js:41` imports it. | `04-:154-156`, `DECISIONS.md` § *Variant pools* |
| **R-6** | `deriveVenuesAffording` at `scheduleCoverage.js:196`; the *"strangers do not lunch in a living room"* comment at `:196` | Function at **`:203`**; comment at **`:197-198`**. | `01-:29-30`, spec `:209` |
| **R-7** | `deriveResidenceCount(town.population)` | Signature is `deriveResidenceCount(town)` — takes the town **object** and reads `town?.population` (`residences.mjs:21-28`). | `DECISIONS.md:19`, spec `:29` |
| **R-8** | `22_Post_Office_Singles_16x16` (**44**) | **45** files. | `04-:129` |
| **R-9** | `DistrictScene` `farm` sites at `:417` and `:449` | Both exact ✅ — but there is a **third** at `:434` (`newLoc !== 'farm'`), plus `:132`/`:392`/`:416`. Removing "the client filter" is three edits, not two. | `03-:12-14`, `04-:163` |
| **R-10** | `venues.lock.json` at repo root | It is at `packages/client/public/assets/venues.lock.json` (and `dist/`). No root copy exists. | `04-:206` |
| **R-11** | *"The dorm is one of only **six** public venues"* | **Five**: `cafe`, `district`, `dorm`, `library`, `office` — counted from the 18-entry `venues.json`. (This one is the REVIEW-PROMPT's own number, `:98-99`.) | `REVIEW-PROMPT.md:98` |
| **R-12** | Plan `04-` Task 1's gate: *"byte-identical `venues.json` to the pre-change commit"* | **The BotVille working tree is dirty**: `git status --short` shows `CONTEXT.md`, every one of the 18 tilemaps, and `assets.generated.ts` modified, on `main` ahead 34. There is no clean pre-change baseline to diff against. Establish one first. | `04-:70-73`, `04-:228-230` |
| **R-13** | `world-bake.mjs` *"published projection at ~line 106"* | Projection begins at **`:101`**; `:106` is the `archetype: v.archetype ?? v.id` line inside it. Archetype load `:57` ✅ and `deriveResidenceInstances` `:58` ✅ are exact. | `04-:37` |

**Verified correct, no action.** `contract/assets.contract.json` — `props.district`
**32**, `props.interior` **36**, `groundAtlases` `[district_ground,
interiors_ground]`, `tileSize 16`, `schemaVersion 1` (all exact). District
`sizeTiles [48,46]`, `vRoad [22,24]`, `hRoad [21,23]`, `pen [36,2,47,18]`, four
doors (office, cafe, dorm, library), no house door, no `farm` venue — all
exact. `scheduleCoverage.js` `deriveHomeVenue:218` ✅,
`deriveResidenceVenues:183` (≈182 claimed) ✅, `deriveWorkplaceVenue:238` ✅.
`MAX_SUBSTANTIVE = 5` at `candidate_builder.py:74` ✅. `CANDIDATE_CATEGORIES` —
9 entries, exact order, a **tuple** (`decision.py:29-39`) ✅.
`deriveGoalContributors(goalId, callerUserId, limit = 3)` at `civicService.js:227`
✅. `NOTES_PER_VENUE_LIMIT = 10` at `notesService.js:19` ✅. Migrations 038/039/040
present, **041 free** ✅. `test/vocabulary-sync.test.mjs`, `test/residences.test.mjs`,
`test/bake/world-bake.test.mjs` all present ✅. All three specialist `limitation`
and `system_instructions` strings quoted verbatim-correct ✅. **Art inventory
verified exactly**: 35,085 files / 34,078 PNGs; exteriors 13,081 / interiors
17,927 / farm 2,411 / office 355; 24 exterior theme categories; 26 interior
sets. Sampled counts: Garden **570** ✅, School **125** ✅, Swimming Pool **179** ✅,
Floor Modular **343** ✅, `Tent` ×6 ✅, `Mobile_House_{Small,Medium,Big}` ×8 each ✅,
`Villa_1..5` ✅, `Building_Skeleton` ×2 ✅, `Excavator` ×4 ✅, `Fence_1`/`Fence_2`
×8 each ✅, `Ground_1` ×6 ✅, `Stacked_Material` ×7 ✅, `Scissor_Lifter` ×2 ✅,
`Terraced_House_1..6` + modular ✅, `One_Story_House` ✅, `Country_House` ✅,
`Condo_1..9` ✅, `22_Museum_Singles` interior present and **no museum exterior in
any of the 24 exterior categories** ✅ (the plan's risk note is correct).

---

## §II — MUST-FIX

### F-1 — `builder.yaml` as specified cannot load, and fails **silently**

`SubagentConfig` (`subagent_config.py:43-82`) requires `tools: list[str]` with
`min_length=1` (`:54-57`) and `system_instructions: str` (`:50-53`). The
plan's YAML (`02-:79-88`, identical to spec `:299-307` and `DECISIONS.md`
D-68) declares **neither**. It also declares
`context_sections: [identity, soul, rules, city, time]`, and `city` is **not**
in `VALID_CONTEXT_SECTIONS` (`:7-11` — twelve keys: identity, soul, voice,
startup, rules, profile, schedule, relationships, happenings, recently,
open_loops, time). The `context_sections` validator (`:84-92`) raises on it.

Any of those three raises a `ValidationError` — and `discover_catalog`
(`subagent_catalog.py:36-44`) wraps construction in
`except Exception: logger.warning(...); continue`. **The file is skipped. No
error surfaces.** Round (f) would run with three specialists, pass 85/85, and
report a builder-delegation rate of zero that means "the builder does not
exist," not "the builder does not convert."

**Fix.** Add `tools:` (see F-4 for *which* tools), add `system_instructions:`,
resolve `city` per F-2. **And add a test that every YAML in
`configs/subagents/` loads** — the silent-skip is a latent trap for every future
specialist, not just this one.

### F-2 — The `city` context section is forbidden by a passing test

`compile_subagent_backstory` and `_section_builders()` live in
`prompt_compiler.py` (`:981-1034`). `test_soul_prompt_compiler.py:885-894` —
the civic drive's **fabrication pin**, written for D-57 — asserts:

```python
source = inspect.getsource(prompt_compiler)
assert "city_state" not in source
assert "CityState" not in source
```

and the module's own comment (`prompt_compiler.py:143-146`) states the rule it
enforces: *"the compiler has no city-state-port or cached placement path —
**city state is menu data for the candidate builder, never identity**; a
source-level pin enforces this."*

D-69 and the ToM seam require exactly that path, in exactly that module.
**This is not registry data; it is a code change that retires a deliberate
civic-drive pin.** Plan `02-` Task 1 does not name the pin, the test, or the
decision it reverses. Needs a ruling (**O-3**) before it is written.

### F-3 — `unhoused_self` is not a valid predicate, and cannot be "authored but not registered"

`VALID_MENU_PREDICATES` (`subagent_config.py:18-23`) is exactly four:
`own_thread_activity`, `open_loops_piling`, `unreciprocated_attention`,
`city_propose`. The frozen set exists so *"a typo'd YAML fails at load, not
silently at wake time"* (`:14-17`), and `test_subagent_registry.py:59-68` pins
that behaviour.

D-70's `unhoused_self` therefore needs: a new member of the frozen set, a
deterministic evaluator beside `_pred_city_propose`
(`candidate_builder.py:715-737`), and a signal to evaluate it against — which
means an `unhoused` field on `CityState` (`heartbeat/core/ports/city_state.py`)
and an api field to populate it. Three code changes in two repos.

And `plot_vacant_adjacent` / `build_in_progress_nearby` **cannot be "authored
but not registered"** (`02-:97-99`): a YAML naming them fails to load, taking
the whole builder with it (F-1's silent skip). Author them in a comment, or
register the predicates and gate the *text*.

### F-4 — Moving `contribute-to-city-goal` to the builder breaks the 28-schema pin

`contribute-to-city-goal` is **L1 today**. `test_tool_exclusion.py:87-91` lists
it in `BOTVILLE_TOOLS`; it is **not** in `EXCLUDED_TOOLS`
(`unified_runner.py:211-254`, parsed); it is registered at
`botville-mcp-server.js:378`.

D-68 (`DECISIONS.md:318-321`), spec §6.1 (`:284-286`) and Plan `02-:110-113`
all assign it to the builder **and** assert *"L1 stays at 28 schemas —
nothing added, nothing removed, no PCO re-baseline"* and *"`test_composed_act_surface_is_28_schemas`
must still pass — if it moves, this task is wrong."*

**Both cannot be true.** Removing it takes the residue to 26 MCP + delegate-tasks
= 27, failing `test_l1_schema_residue_is_now_28` (`:119-131`) and
`test_composed_act_surface_is_28_schemas` (`:174-196`), and invalidating the
M-054 baseline mid-drive. By the plan's own test, **this task is wrong as
written.** Needs a ruling (**O-2**): either accept the 28→27 re-baseline, or
leave it on L1 and *also* give it to the builder — a second recorded D-29
exception, exactly like the reflector's `get-city-map`/`get-city-goals`
(`reflector.yaml:41-44`).

### F-5 — The builder's `limitation` does **no** structural work; the leak was the main agent

D-68 (`DECISIONS.md:361-364`) and Plan `02-:90-93` both state the builder's
`limitation` is *"load-bearing, not flavour"* because *"a specialist that
physically cannot post cannot express a city intention as a feed post — the
exact channel M-056's conversion leaked into."*

Three facts falsify it:

1. **`limitation` has exactly one consumer, and it is a string.**
   `subagent_catalog.py:61-62` appends it to the catalog one-liner. Nothing
   else in `heartbeat/` reads it (grepped). The mechanical constraint is
   `tools:` — `subagent_runner.py:73`: `tools = self._bridge.get_tools(config.tools)`.
2. **The reflector already cannot post.** `grep -c create-post configs/subagents/*.yaml`
   → **0, 0, 0**. Its 15-tool list (`reflector.yaml:33-48`) has no write tool
   outside its own memory/loops surface.
3. **The leak was not the specialist.** `docs/analysis/2026-08-01-placement-round.md:57-63`:
   *"`the_strategist`, who chose the `city_propose` delegation candidate,
   spawned a specialist, read the city through the delegated allowlist, then…
   **posted a proposal-shaped post to the feed**."* The subject is
   `the_strategist` — **the delegating main agent**. It could not have been the
   reflector; the reflector has no `create-post`.

**So the builder's `limitation` closes a channel that was already closed, and
leaves open the one that actually leaked** — the main agent's own
`create-post`, which no specialist contract can touch. Round (f) as designed
does not address the defect it is named for. Rewrite the rationale to what the
builder actually changes (a `tools:` allowlist that includes the city *writes*,
plus act-shaped trigger text), and drop the structural claim.

### F-6 — The root-cause claim is falsified by rounds (c) and (e)

D-68's *"Root cause this fixes (verified, file-level)"* (`DECISIONS.md:338-357`)
and `02-:19-40` assert specialists made zero MCP calls **because** their
contracts forbid acting. Under those **unchanged** contracts:

- **Round (c):** *"FIRST organic city read (`get-city-goals` ×1 via
  `the_strategist`'s chosen `city_propose` delegation → spawned specialist read
  the city"* — `facts.yaml:948-952` (M-056).
- **Round (e):** *"Archivist's `city_propose` delegation → organic
  `get-city-map` read"* — `EXECUTION-LOG.md:76`.

A cause that is present in (b), (c) and (e) cannot explain a zero that occurs
only in (b). The `limitation`/`system_instructions` text is a *correlate*, not
the cause — precisely the "plausible because legible" failure the review prompt
warned about.

**What was not checked, and must be, before round (f) is spent:** did the
round-(b) reflector episodes show a tool list of 15 at spawn, or an empty one?
Was there a schema error, a permission error, a timeout, or a truncation? The
per-round raw traces exist (`run_20260801_031541`); read them. The honest
current statement is *"the reflector made zero **write** calls in round (b);
it made read calls in (c) and (e); the mechanism is undiagnosed."*

### F-7 — The `dorm` `home` role re-homes **73 of 85 agents** (computed)

`deriveResidenceVenues` (`scheduleCoverage.js:183-187`) selects
`roles.includes('home')` and sorts `id.localeCompare(b.id, 'en', {numeric:true})`.
`deriveHomeVenue` (`:218-235`) walks that list in order, filling each to its
published `capacity`. `'dorm'` sorts **before** `'house_1'`.

Simulated against the shipped `venues.json` (13 houses × cap 7, dorm cap 6,
roster of 85 in creation order):

```
before: agent[0..6] → house_1, agent[7..13] → house_2, …
after:  agent[0..5] → dorm,    agent[6..12] → house_1, …
agents whose derived home CHANGES: 73 of 85
```

Consequences the plan does not name:

- **It breaks the invariant Plan `01-` flags but mislocates.**
  `venueRegistryService.js:17-20`: *"the schedule writer's own assignment
  derivations are the single authority on home/workplace — **get-city-map must
  never disagree with a stored routine**."* `botville-mcp-server.js:178` calls
  `deriveHomeVenue` live. Every already-stored sleep slot points at the old
  house; `get-city-map` would report the new one, for 73 agents, on the first
  wake after the bake.
- **It breaks D-59's own premise.** D-59 retires *"same seed, same answer,
  forever"* on purpose — but by making home *stored and movable*, not by
  silently shuffling the derived fallback under every agent at once.
- **It also breaks D-48's placement line for those agents**, since
  `composePlacementLine` renders home-role venues specially (F-8).

Plan `01-:108-113` flags only the *daytime-pool* effect and calls it *"a
behaviour change hiding inside a data edit."* It is two behaviour changes, and
the unflagged one is far larger.

**Fix.** Land `botville_home_assignments` and backfill every current derived
assignment as a stored row **before** the dorm's `roles` change, so the
`stored ?? derived` registry pins today's answer. Then the role edit only moves
the fallback, which nobody reaches. Sequence it explicitly in Task 3.

### F-8 — The unhoused have no venue to resolve to, and the placement line already tells them they are home

Three rules collide:

- Spec §7.3 (`:412`): *"Plots are not venues — they are map features with state."*
- `resolvePresence` (`presenceService.js:45-48`): no `venueId` ⇒ `{venueId: null}`
  ⇒ absent.
- I-8: the runtime never invents a venue.

So a tent on a plot has **no venue identity**. Neither Plan `01-` Task 3
(*"Unhoused agents resolve to the shelter, never to null"*) nor Plan `03-`
Task 2 (*"Tents render on `vacant`/`claimed` plots"*) closes it — and the
shelter holds **6** of 85.

**And the prompt-side failure is not the one the spec describes.**
`composePlacementLine` (`mdGenController.js:432-490`) already has a total
fallback:

```js
if (caller.venueId === null) return "You're at home.";      // :452
if (venue.roles.includes('home')) return "You're at home.";  // :461
```

So an unhoused agent does **not** blink out of the placement line. It is told
*"You're at home."* The failure mode is a **false first-person statement about
the agent's own condition**, in the exact line the drive is using to create the
condition. Spec §4.2's framing (*"a null venue means absent from the map… an
agent that blinks out at night"*) is true of the **map** and false of the
**prompt**, and only the prompt version matters to the behavioural question.

**Fix.** Rule venue identity for plots (O-1 / §0), then add the fourth branch
to `composePlacementLine` before Task 2 touches it.

### F-9 — The founding charter cannot seat at season 0; season 0 is nearly over

`civicConfig.js:20-21`: `SEASON_EPOCH_START_UTC = '2026-07-27T00:00:00Z'`,
`SEASON_LENGTH_DAYS = 7`. Season 0 therefore runs **2026-07-27 → 2026-08-03**
and is live *today*. M-055 already records a system-Radiant proposal inside it
(`facts.yaml:912-914`: *"proposals 1 = system Radiant"*), and the placement
round's analysis states *"Season 0 resolves at the 2026-08-03 UTC boundary."*
Radiant templates instantiate for `currentSeasonId + 1`
(`seasonService.js:399`), not the current one.

Plan `01-` Task 5 requires *"the charter seats exactly once at season 0 and
never again."* Migration 041 lands after Plan `04-` in full. **The condition
will never be true.** The charter never fires, the accrual chain never gets a
target, and D-64's whole reason for existing — *"so the round measures
contribution rather than measuring whether a vote that has never happened will
happen"* — evaporates silently.

**Fix.** Key the one-shot on **world state**, not a season index: *seat the
founding build goal the first time the plots table is non-empty and no build
goal has ever existed.* That is idempotent, survives slippage, and is testable.

### F-10 — "Founding charter" is a category error inside the drive's own vocabulary

Spec §5.3 (`:249-254`) and the §9 vocabulary addition (`:462-466`) define a
**charter** as *"a goal kind with **no target**… seated by election, standing
until a later election unseats it."*

D-64 (`DECISIONS.md:68-81`), spec §5.4 (`:256-262`) and Plan `01-` Task 5
(`:145-146`) seat *"one system-Radiant **build goal** without an election"* and
call it the **founding charter**. A build goal has a target and completes; a
charter has neither. Two different objects, one name, in a spec whose §9 exists
specifically to stop that.

**Fix.** Call it the **founding goal**. Reserve *charter* for the no-target
kind. `CONTEXT.md` inherits whichever word ships.

### F-11 — D-72's no-cascade guarantee is already false, and 041 cannot fix it additively

D-72 (`DECISIONS.md:164-176`): *"Contributions never cascade on agent
deletion."* Plan `01-` Task 1: *"**No cascade on user deletion anywhere.**"*

The tables that hold contributions, proposals and votes were created in **038
and 039**, and all three cascade:

- `botville_goal_contributions.user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  — `038_add_botville_world.js:63`
- `botville_goal_proposals.proposer_id UUID REFERENCES users(id) ON DELETE CASCADE`
  — `039_add_botville_civics.js:38`
- `botville_proposal_votes.voter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE`
  — `039:70`

Writing 041 with no cascades protects the *new* tables and leaves the town's
actual history on the cascading ones. Worse, **D-67's demolition difficulty is
derived from those exact rows** (`sum(amount)`, `count(distinct user_id)` over
`botville_goal_contributions`): delete a contributor and a building silently
becomes easier to tear down.

Fixing it requires `ALTER TABLE … DROP CONSTRAINT … ADD CONSTRAINT … ON DELETE
SET NULL` on 038/039 — **not additive**, which contradicts Plan `01-`'s
rollback claim (*"041 is additive — no column is dropped, no existing row is
rewritten"*).

**Mitigating fact, and it is load-bearing for the severity:** no code path
deletes a user today. `grep` for `DELETE FROM users`, `deleteUser`,
`destroyUser`, `removeUser` across api `src/` returns nothing. The exposure is
manual/ops SQL — which is exactly how dev rosters get reset. Needs a ruling
(**O-6**): deliver D-72 with a non-additive migration, or downgrade it to
documented intent enforced when a departure mechanic ships.

### F-12 — Plan `02-` Task 2 is in the wrong repo

Task 2 (*"Housing state in the placement line"*) is filed in
`02-agents-builder-and-condition.md`, repo `aisocialnetwork-agents`. The
placement line is composed **api-side** by `composePlacementLine`
(`mdGenController.js:432-490`) and served under `## Placement` in `Startup.md`;
the compiler admits it **verbatim** and is pinned against re-writing it
(`prompt_compiler.py:142-154`, and the F-2 fabrication pin).

There is no agents-repo edit that changes what the placement line says. Task 2
belongs in Plan `01-`. As filed, it also breaks the set's own gating logic:
Plan `01-` is declared *"moves no agent-facing surface"* — but if the placement
line moves, it does.

---

## §III — SHOULD-FIX

### S-1 — Adding `builder.yaml` breaks the pinned-catalog test, unnamed
`test_subagent_registry.py:70-75` asserts
`render_specialist_catalog(catalog) == PINNED_CATALOG`, and `PINNED_CATALOG`
(`:22-29`) contains exactly researcher / reflector / connector — *"the exact
bytes `act.md` carried from `1514b0a`"* (M-043's measured surface). A fourth
specialist fails it. That is correct and intended, but the plan should name the
test it is deliberately re-pinning, because editing a byte-pin quietly is how
measured surfaces drift.

### S-2 — Two catalog renderers, two orders; `builder` reorders one of them
`build_catalog_oneliner` (`subagent_catalog.py:59`) sorts **alphabetically**
and feeds `unified_runner.py:1198`'s `{subagent_catalog}` template var.
`render_specialist_catalog` (`:110-112`) sorts by `(catalog_order, name)` and
feeds `act.md`'s `{specialist_catalog}`. With `catalog_order: 40`, `builder`
renders **last** in `act.md` and **first** in the one-liner block — reordering
the three specialists currently converting at 23.4%, on every wake. That is a
second prompt change inside a round declared to be one change. Either give
`build_catalog_oneliner` the same `(catalog_order, name)` sort, or record the
reorder as part of the round's moved bytes.

### S-3 — Gate 0 is stale and the *real* gate is unnamed: a micro-round is in flight
Rounds (d)/(e) are done (R-1), so `00-INDEX.md`'s Gate 0 is satisfied — but
`EXECUTION-LOG.md:75` records a **POST-DRIVE AWARENESS MICRO-ROUND STARTED**
on 2026-08-01 that moved `act.md` bytes (*"world enumeration two→THREE
places"*), passed its probe, and has **no analyzer entry and no registered
fact**. Those bytes are live on `main`: `act.md:15-16` carries the three-places
text. It is *"hypothesis-0 of the self-awareness kickoff, direct test vs
M-058"* — i.e. a running experiment on the same surface Plan `02-` Task 1
edits. Rewrite Gate 0: **round (f) does not start until the micro-round is
analyzed and its fact registered**, or one-change-one-round is lost anyway,
just against a different drive.

### S-4 — Plan `04-` Task 5's variant test is a category error
*"Test: same seed → same variant **across bakes**."* The bake has no agents and
no `spriteSeed` — the roster is an api runtime concept
(`deriveHomeVenue(spriteSeed, roster, …)`), and `world-bake.mjs` reads only
`town/town.json` (`{"population": 85}`). Per-agent tent selection is a
**client/runtime** concern, and Plan `03-` Task 2 already places it there. What
the bake *can* assert is that the pool is declared, complete and stable. Move
the determinism test to the consumer that has a seed.

### S-5 — Any new `home`-role venue re-homes the town; `tent` is next
Plan `04-` Task 2 requires *"Every archetype's `roles` includes `home`;
`affords` includes `sleep`."* If a `tent` archetype ships as a venue, `'tent'`
sorts before `'dorm'` and `'house_*'` and the F-7 shuffle happens again, larger.
The general rule to write down and test: **`deriveResidenceVenues`'s ordering
is load-bearing; adding any `home`-role venue is a home-reassignment event
unless every agent already has a stored assignment row.**

### S-6 — "Declared, not instantiated" is a tautology as the bake stands
`world-bake.mjs:47` treats `_`-prefixed entries as archetypes and `:57-58`
stamps **only** `house.json`. Dropping `condo.json` into `_archetypes/` cannot
produce an instance regardless, so *"a test asserts zero condo instances"*
proves nothing about D-76's dormancy. Once Task 1's generalised
`deriveInstances` is wired to a count registry, say what makes condo's count
zero — a registry entry of `0`, or absence from the registry — and test *that*.

### S-7 — Plot count has a defensible floor; derive it, do not pick it
The plan calls it *"a game-feel call"* (`04-:194-196`). There is a floor and a
ceiling, both computable:

- **Floor.** `ceil(85 / 7) = 13` — `deriveResidenceCount` with
  `RESIDENCE_OCCUPANCY_TARGET_AGENTS = 7` (`residences.mjs:21-28`). The engine
  D-59 retires computes exactly the number of homes needed for dev-85 to be
  housed. Fewer than 13 housing plots and the town **cannot** house itself no
  matter how well the loop works — the round would measure a deadlock the
  design created.
- **Ceiling.** ~45 six-by-five plots theoretically, **~25–30 practically**
  (§0's geometry).
- **The knob.** `plots = ceil(scarcity_ratio × 13) + civic_footprints`, with
  `scarcity_ratio` the one number the analyzer tunes. At 1.0 there is no
  slack and hoarding is instantly fatal; at 2.0 (26 housing plots) there is no
  scarcity left for the six civic archetypes. **~1.2–1.4 is the only band the
  district actually affords** — and note the school and pool footprints exceed
  6×5, so the civic set costs more than six plot-equivalents.

Record the ratio, not the integer. The analyzer will want the knob.

### S-8 — The kill criterion is under-specified and its baseline is superseded
*"≥1 organic civic write from ≥3 distinct agents"* — ≥1 write from each of ≥3
agents is arithmetically ≥3 writes. Say which, in the config key, because the
config is what the round is judged against.

The baseline is worse. The set repeats *"0/141 offered, chosen 0 across (b) and
(c)"* (`00-INDEX.md:124-125`, `02-:180`). Cumulative is now **1/285 across (b)
through (e)**, and M-058 (`facts.yaml:1044-1049`) records the milestone:
*"noah_klein made the FIRST ORGANIC city-candidate choice in 285 cumulative
offers — **and followed through with `create-post`, not `vote-city-goal`** (the
groove + vote-rung copy gap, both ledgered)."* Commit `2b85919` records that
copy gap with owner trace evidence and a fix shape.

**So round (g) already has a cheaper competing explanation for any zero it
returns**: the agent that *did* choose the city candidate could not find the
civic verb, not that it lacked a personal stake. If the copy gap is not closed
first, (g) cannot attribute its result to the world-condition hypothesis —
which is the one thing D-63 says the round exists to test. **Needs a ruling
(O-5).**

### S-9 — D-73's brake is circular, and there is no non-civic backstop
Claims are free and uncapped; the only revocation path is a civic act
(`DECISIONS.md:277-297`); civic acts are measured at ~0 (1/285). A day-one land
grab is therefore permanent **in practice** for the measured population, even
though the design says it is not — and the plan's own argument for why
hoarding *generates* politics (*"those plots sit vacant with tents on them,
visibly"*) depends on a legislative response the town has never once produced.
Options: a per-agent soft cap (repeals part of D-73), a claim that expires
(repealed by D-31/D-32 — no timers), or accept it and say so in the round's
write-up as a known confound. **Needs a ruling (O-4).**

### S-10 — D-66 ships at four of six requirements; that is substrate, not a mechanic
The requirement table (`DECISIONS.md:236-243`) lists externality as **new**,
and Plan `02-` Task 5 defers it to round (h) *"only if (g) earns it."* Without
externality, an agent has no reason to *want* a rule: scarcity + attribution +
declaration + observation produce **complaint**, not **law**. Describe D-66 in
`00-INDEX.md` as substrate-in-progress with the externality gap named, so a
round-(g) write-up cannot claim emergent zoning was "shipped and did not
happen."

### S-11 — Demolition's degenerate case is real and is worsened by F-11
Difficulty derives from `sum(amount)` and `count(distinct user_id)` over the
building's goal. A structure funded by one agent has difficulty ≈ 1 —
removable by any two others. That is defensible as democracy *if* it is
intended; it is griefing if it is an accident of the formula. And under F-11,
deleting a contributor **silently lowers** an existing building's difficulty.
Consider: a config floor on difficulty independent of contributor count, and
exempting the founding goal's output (which by construction has one
contributor: the system).

---

## §IV — CONSIDER

**C-1 — The dorm-as-shelter loses its name in the placement line.**
`composePlacementLine:461` renders **any** home-role venue as `"You're at
home."` and drops the co-present clause. An agent sheltering in the dorm at
noon is told it is at home — the opposite of the legibility D-60 wants, and it
erases the *"four others are here"* signal that makes a shelter feel crowded.

**C-2 — Sizing the dorm's removal from daytime pools.** The dorm affords
`socialize` and `idle`; remaining `socialize` venues are `cafe` and `district`,
remaining `idle` are `district` and `library`. No pool empties, so nothing
breaks — but it removes one of three social venues, and venue-visit
distribution is a thing a growth round would want to read. Capture the
pre-change distribution before Task 3 lands, or the confound is unrecoverable.

**C-3 — §0's combinatorics, restated as a number to design against.** ~25 plots
× 2–5 fitting archetypes = **50–125** pre-stamped venues vs today's **18**. Any
option that pre-stamps needs `get-city-map`'s page-1 cap and
`venueRegistry.published()`'s byte-projection sized against that number, not
against 18.

**C-4 — The promise-grounding surface does move, contrary to Plan `02-`'s QA
note.** `get-city-map`'s `callerHomeVenueId` is the **only** agents-side source
of home/workplace grounding (`exposure_log.py:109-115`), and `_validate_anchor`
(`end_of_turn.py:370-390`) accepts any id present in the grounded set **without
checking it against the venue vocabulary**. If home resolves to a plot id, a
promise will ground on a non-venue and A-1 will hand the agent a destination
`go-to-venue` cannot reach. If home resolves to `null` for the unhoused, those
agents lose home-anchored promises entirely — and M-057 already flags promise
emission as a **registered watch** at 1.2%, second-low round. Trace it before
claiming *"Extraction surfaces: none moved by this plan."*

**C-5 — Museum.** Verified: interior `22_Museum_Singles` present; **no museum
exterior in any of the 24 exterior categories**; `5_Floor_Modular_Building_Singles_16x16`
holds 343 assets. Plan `04-`'s risk note and its "ship the other five if it
slips" fallback are both correct. No change.

---

## §V — Owner calls

These are decisions the review reveals as needing a **ruling**, not a fix.

| id | call | why it cannot be decided in-plan |
|---|---|---|
| **O-1** | **How does a plot become a venue?** Recommendation: decouple venue identity from archetype (`plot_7` is the venue; archetype selects interior + exterior), and re-state I-8 as *"every asset is baked first"* rather than *"every vocabulary entry is static."* | The pre-stamp option costs 50–125 vocabulary entries (§0, measured); the `allowedArchetypes` option **repeals D-66**, which was ruled with owner rationale. Neither is the author's to choose. Gates `04-` T7 and `01-` T1. |
| **O-2** | Does `contribute-to-city-goal` **leave L1** (28→27, PCO re-baseline, M-054 superseded mid-drive), or **stay L1 and also sit on the builder** (a second recorded D-29 exception)? | D-68 asserts both simultaneously. The plan's own pin test decides it either way. (F-4) |
| **O-3** | May `prompt_compiler` acquire a `CityStatePort` path **for the subagent backstory only**, retiring the D-57 fabrication pin for that path? | The pin is a ruled civic-drive invariant with a passing test. D-69's ToM seam cannot ship without reversing it. (F-2) |
| **O-4** | Is a **non-civic backstop** to claim hoarding acceptable, given D-31/D-32 forbid timers and civic action is measured at 1/285? | D-73's brake is circular by construction. Either the design accepts permanent day-one grabs for the measured population, or a ruled invariant bends. (S-9) |
| **O-5** | Does the drive **close the ledgered vote-rung copy gap before round (g)**? | If not, a zero in (g) is attributable to the copy gap rather than to the world-condition hypothesis — and D-63 says (g) exists to test that hypothesis. (S-8) |
| **O-6** | Is **D-72 delivered** (non-additive `ALTER` on 038/039 FKs) or **downgraded** to documented intent until a departure mechanic ships? | The guarantee is false today and 041 cannot fix it additively; the plan's rollback promise and D-72 are mutually exclusive. (F-11) |

---

## §VI — Traceability

| finding | severity | amends |
|---|---|---|
| §0 / O-1 | MUST-FIX | spec §3.1, §7.3, §8; `04-` Task 7; `01-` Task 1; `DECISIONS.md` D-66 |
| F-1 | MUST-FIX | `02-` Task 1 (the YAML block); spec §6.2; `DECISIONS.md` D-68 |
| F-2 / O-3 | MUST-FIX | `02-` Task 1 (`city` section); spec §6.3; `DECISIONS.md` D-69, § *The ToM seam* |
| F-3 | MUST-FIX | `02-` Task 1 (triggers); `DECISIONS.md` D-70 |
| F-4 / O-2 | MUST-FIX | `02-` Task 1 + Planning-mode QA; spec §6.1; `DECISIONS.md` D-68; `00-INDEX.md` (L1-28 claim) |
| F-5 | MUST-FIX | `02-` § *The finding this plan is built on* + Task 1; spec §6.2; `DECISIONS.md` D-68 |
| F-6 | MUST-FIX | `02-` § *The finding*; `DECISIONS.md` D-68 § *Root cause this fixes* |
| F-7 | MUST-FIX | `01-` Task 3; `04-` Task 2; spec §4.2; `01-` Planning-mode QA item 1 |
| F-8 | MUST-FIX | spec §4.2, §7.3; `01-` Task 3; `02-` Task 2; `03-` Task 2 |
| F-9 | MUST-FIX | `01-` Task 5; spec §5.4; `DECISIONS.md` D-64 |
| F-10 | MUST-FIX | spec §5.3, §5.4, §9; `DECISIONS.md` D-64; `01-` Task 5 |
| F-11 / O-6 | MUST-FIX | `01-` Task 1 + Rollback; `DECISIONS.md` D-72; D-67 (difficulty derivation) |
| F-12 | MUST-FIX | `02-` Task 2 → move to `01-`; `01-` Planning-mode QA (blast radius) |
| S-1 | SHOULD-FIX | `02-` Task 1 (test list) |
| S-2 | SHOULD-FIX | `02-` Task 1 (moved bytes); `00-INDEX.md` round-(f) description |
| S-3 | SHOULD-FIX | `00-INDEX.md` Gate 0; `02-` header |
| S-4 | SHOULD-FIX | `04-` Task 5; `03-` Task 2 |
| S-5 | SHOULD-FIX | `04-` Task 2; `01-` Task 3 |
| S-6 | SHOULD-FIX | `04-` Tasks 1 and 2; `DECISIONS.md` D-76 |
| S-7 | SHOULD-FIX | `04-` Task 7 |
| S-8 / O-5 | SHOULD-FIX | `00-INDEX.md` kill criterion; spec §10; `02-` Task 4 block; `DECISIONS.md` D-63 |
| S-9 / O-4 | SHOULD-FIX | spec §3.3; `DECISIONS.md` D-73 |
| S-10 | SHOULD-FIX | `00-INDEX.md`; spec §6.5; `DECISIONS.md` D-66 |
| S-11 | SHOULD-FIX | `01-` Task 4; spec §5.2; `DECISIONS.md` D-67 |
| C-1 | CONSIDER | `01-` Task 3; spec §4.2 |
| C-2 | CONSIDER | `01-` Task 3; `02-` analyzer requirements |
| C-3 | CONSIDER | `01-` Task 6 (byte budget); `04-` Task 8 |
| C-4 | CONSIDER | `02-` Planning-mode QA (*extraction surfaces*); `01-` Task 3 |
| C-5 | CONSIDER | none — verified correct |
| R-1 | rotted | `DECISIONS.md` § *Numbering corrections*; spec §10; `00-INDEX.md` Gate 0 + § *Numbering*; `02-` header + Task 6 |
| R-2 | rotted | `02-` § *Anchors to verify first* |
| R-3 | rotted | `02-` header |
| R-4 | rotted | `02-` Task 1 |
| R-5 | rotted | `04-` Task 5; `DECISIONS.md` § *Variant pools* |
| R-6 | rotted | `01-` § *Anchors*; spec §4.5 |
| R-7 | rotted | `DECISIONS.md` D-59; spec §0 |
| R-8 | rotted | `04-` Task 4 |
| R-9 | rotted | `03-` § *Anchors*; `04-` Task 6 |
| R-10 | rotted | `04-` Task 8 |
| R-11 | rotted | `REVIEW-PROMPT.md` §2 item 6 |
| R-12 | rotted | `04-` Task 1 gate + Planning-mode QA |
| R-13 | rotted | `04-` § *Anchors* |

---

## §VII — Recommended execution order after amendment

1. **Nothing agent-facing moves until S-3 clears** — the awareness micro-round
   is unanalyzed and its bytes are live on `main`.
2. **O-1 first.** It gates `04-` Task 7 and `01-` Task 1, and it is the only
   finding that changes the *data model* rather than a task.
3. **`04-` Tasks 1–6** can proceed today against a **clean tree** (R-12), with
   Task 5's determinism test relocated (S-4) and Task 2's `home`-role rule
   re-stated (S-5).
4. **`01-` Task 3 before `04-`'s dorm edit lands** — backfill stored home
   assignments first, or F-7 fires.
5. **Re-diagnose F-6 from round-(b) raw traces before writing round (f).** The
   round is cheap; the wrong hypothesis behind it is not. If the traces show
   the reflector held 15 tools and simply did not call the write, the fix is
   trigger text and tool allowlist — which is most of Task 1 anyway, minus the
   `limitation` claim that F-5 falsifies.

---

*The author's four kickoff corrections were all real and all verified in this
pass — the art inventory in particular is exact to the file. The defects above
are concentrated where the set stopped verifying and started reasoning: the
subagent registry's validators, the compiler's pins, the sort order of a venue
list, and a season boundary five days from expiry.*

---

## §VII — Integration record (2026-08-01, same session)

Per `2026-07-31-botville-drive/INTEGRATION-PROMPT.md`, the review's amendment
blocks were folded into single-voice native text and the patch scaffolding
deleted. **This document is immutable provenance from here on** — the plans
point back at it via `[R: <id>]` tags and never restate its narrative.

**Post-merge gate (run, not asserted).** `grep -c 'AMENDED|RETRACTED|⚠|RULED
D-|pending owner|✅ RESOLVED'` over `00-INDEX.md`, `00-KICKOFF-PROMPT.md`,
`01-`, `02-`, `03-`, `04-`, `DECISIONS.md` and the spec → **0 in all eight**.
Provenance survives as 43 `[R: …]` tags plus six `⛔ O-n` gate markers, which
are open questions rather than patch scaffolding and are retained deliberately.

| id | where its content now lives natively |
|---|---|
| **F-1** | `02-` Task 1 (YAML + guard test + probe assertion 1); spec §6.2; `DECISIONS.md` D-68 |
| **F-2** | `02-` Task 1 (`city` bullet); spec §6.3; `DECISIONS.md` D-69 → **⛔ O-3** |
| **F-3** | `02-` Task 1 (trigger bullets); `DECISIONS.md` D-70 |
| **F-4** | `02-` Task 1 (L1 bullet) + Planning-mode QA; spec §6.1; `DECISIONS.md` D-68 → **⛔ O-2** |
| **F-5** | `02-` § *The finding* + Task 1; spec §6.2; `DECISIONS.md` D-68; `00-INDEX.md` Deferred |
| **F-6** | `02-` § *The finding* + pre-Task-1 re-diagnosis; spec §6.3; `00-INDEX.md` step 5 |
| **F-7** | `01-` Task 3 (step order + empty-diff test); `04-` Task 2 (role withheld); spec §4.2; `DECISIONS.md` § *Kickoff corrections* 3; `00-INDEX.md` premise 3 |
| **F-8** | `01-` Task 3 + Task 9; spec §4.2; `DECISIONS.md` D-60 |
| **F-9** | `01-` Task 5; spec §5.4, §9; `DECISIONS.md` D-64, D-74; `00-INDEX.md` |
| **F-10** | `01-` Tasks 4–5; spec §5.4, §9 (*Founding goal* entry added); `DECISIONS.md` D-64, D-74 |
| **F-11** | `01-` Task 1 + Rollback; `DECISIONS.md` D-72 → **⛔ O-6** |
| **F-12** | `01-` Task 9 (new); `02-` Task 2 (pointer); spec §6.4; `00-INDEX.md` |
| **F-13** | `01-` Task 9; spec §6.4 |
| **F-14** | `02-` § *Round (g) gates these together*; spec §6.4; `00-INDEX.md` step 5 |
| **S-1** | `02-` Task 1 (re-pin bullet) + anchors |
| **S-2** | `02-` Task 1 (reorder bullet) + anchors + Planning-mode QA |
| **S-3** | `00-INDEX.md` Gate 0; `02-` header; spec §10; `DECISIONS.md` § *Numbering* |
| **S-4** | `04-` Task 5; `03-` Task 2; spec §4.2; `DECISIONS.md` § *Variant pools* |
| **S-5** | `04-` Task 2; `01-` Task 3 (general-case test); spec §4.2; `DECISIONS.md` |
| **S-6** | `04-` Task 2 (condo bullet) |
| **S-7** | `04-` Task 7 (floor / ceiling / `scarcity_ratio`); spec §0; `DECISIONS.md` D-66 table |
| **S-8** | `00-INDEX.md` kill criterion; spec §10; `02-` § *The finding* + round (g); `DECISIONS.md` D-63 → **⛔ O-5** |
| **S-9** | `01-` Task 2; `DECISIONS.md` D-73 → **⛔ O-4** |
| **S-10** | spec §6.5; `DECISIONS.md` D-66 |
| **S-11** | `01-` Task 4; `DECISIONS.md` D-67 |
| **C-1** | `01-` Task 3 step 5 (shelter placement-branch sub-bullet) |
| **C-2** | `01-` Task 3 step 5 + Planning-mode QA |
| **C-3** | **Covered by O-1** — the 50–125 sizing is the O-1 entry's own evidence in `DECISIONS.md`, `00-INDEX.md` step 0 and spec §3.1. No separate site. |
| **C-4** | `01-` Planning-mode QA; `02-` Planning-mode QA (*Extraction surfaces*) |
| **C-5** | **NOTE — no plan change.** Museum interior `22_Museum_Singles` confirmed present; no museum exterior in any of the 24 exterior categories; `04-` Task 4's risk note and its ship-the-other-five fallback were already correct. |
| **R-1** | `00-INDEX.md` Gate 0 + Numbering; spec §10; `02-` header + Task 6; `04-` header; `DECISIONS.md` § *Numbering corrections* |
| **R-2** | `02-` anchors |
| **R-3** | `02-` header + Round hygiene; `00-INDEX.md` round loop; `DECISIONS.md` § *Numbering corrections* |
| **R-4** | `02-` § *The finding* + Task 1 + anchors; spec §6.2; `DECISIONS.md` D-68 |
| **R-5** | `04-` Task 5 + anchors; `03-` Task 2; `01-` anchors; `DECISIONS.md` § *Variant pools* |
| **R-6** | `01-` anchors; spec §4.5; `DECISIONS.md` D-61 |
| **R-7** | `04-` anchors; spec §0; `DECISIONS.md` D-59 |
| **R-8** | `04-` Task 4 + anchors |
| **R-9** | `03-` anchors + Task 1; `04-` Task 6 + anchors; `00-INDEX.md`; `DECISIONS.md` § *Kickoff corrections* fifth |
| **R-10** | `04-` Task 8 + anchors |
| **R-11** | **NOTE — no plan change.** *"one of only six public venues"* is `REVIEW-PROMPT.md:98`'s own figure, not the plan set's; there are five (`cafe`, `district`, `dorm`, `library`, `office`). The review prompt is a historical artifact and is not edited. |
| **R-12** | `04-` anchors (blocking pre-step) + Planning-mode QA; `00-INDEX.md` step 1; `EXECUTION-PROMPT.md` Gate −1 |
| **R-13** | `04-` anchors |

**Known unfinished business carried forward.** The six owner calls are open and
gate real work: **O-1** (plot→venue identity — `04-` T7, `01-` T1, `03-` T2/T3),
**O-2** (`contribute-to-city-goal` and L1 — `02-` T1), **O-3** (the `city`
section route — `02-` T1), **O-4** (claim-hoarding backstop — `01-` T2),
**O-5** (vote-rung copy gap before round (g)), **O-6** (D-72 delivery vs
downgrade — `01-` T1 and its rollback claim). None was decided during
integration; deciding one is the owner's, not the executor's.

**Gates run, and gates not run.**

- **Root `npm test` (BotVille): exit 0, 22 tests passed, 3 files** — but only
  after stashing the pre-existing uncommitted working-tree changes. **On the
  tree as it stands it FAILS**: `test/asset-index.test.ts:36` asserts the pack
  is `'fixture'` and gets `'limezu'`, because `assets.generated.ts` and the 18
  tilemaps are modified in place. This is not caused by the integration pass —
  no code or config was touched — and it **independently corroborates R-12**:
  the tree must be cleaned before Plan `04-` Task 1's byte-identical gate means
  anything, and before any suite result can be trusted. Logged as the
  `EXECUTION-PROMPT.md` Gate −1 pre-step.
- **`scripts/docs/lint_docs.py` does not apply.** Verified this session: it
  lints the *agents* repo's `docs/layers/` and `facts.yaml`, not
  `BotVille/docs/superpowers/plans/`. No lint gate was skipped.
- **Not run:** `pytest tests/heartbeat/`, api `npm test`, `npm run bake:world`.
  Nothing in those repos was touched by this pass. The F-1/F-4/S-1 failure
  predictions therefore remain **source-read predictions, not observed
  failures**, and `pytest tests/heartbeat/` should confirm them before the
  amendments are treated as fact.

**Did the merge surface a new contradiction?** One, and it was fixed rather than
routed: `00-INDEX.md`'s execution order had Plan `04-` Tasks 1–6 (including the
`dorm` `roles` edit) running *before* Plan `01-` Task 3's backfill, which is the
exact ordering F-7 forbids. Resolved by splitting the `home` role out of `04-`
Task 2 and adding it as a follow-up commit after the backfill — now stated
identically in `00-INDEX.md` step 1/3/4, `04-` Task 2 and `01-` Task 3 step 4.
