# Plan 04 — Archetypes and bake (BotVille repo)

**Lands first (D-75).** Every later plan inherits the shape this one
establishes. No runtime behaviour changes here; nothing agent-facing moves. The
civic drive's rounds (d) and (e) have run and the drive is closed out, so this
plan is gated on nothing but **⛔ O-1 for Task 7** and a clean working tree
`[R: R-1, R-12]`.

**Repo:** `aisocialnetwork-BotVille`
**Spec:** `docs/superpowers/specs/2026-08-01-botville-city-growth-design.md` §3, §4.1, §7.2, §8

---

## The premise this plan is written to

The rate limiter for growth is **bake authoring, not art**. `assets-src/` holds
35,085 files / 34,078 PNGs — LimeZu Modern Exteriors (13,081 PNGs across 24
themed categories), Modern Interiors (17,927 across 26 interior sets), Modern
Farm (2,411), Modern Office (355). Every rung of the housing ladder, the full
construction kit, and ~20 civic building types with both exterior and interior
art are present. **None of it is declared.**

The pipeline is finished. Adding a building is three files and no new code:

1. `contract/assets.contract.json` — a name and its `maxSize`. The contract
   names things and their shape; *it never names a file or a coordinate* (I-1).
2. `sources/limezu.json` — a `rects` entry (plus a `files` entry for a new
   sheet). Variants are already first-class (`sources/limezu.variants.json`).
3. `venues/<id>/venue.json` — only if the place is enterable.

I-2 is the guardrail: an unresolved name **fails the build**, never renders as
a missing texture.

### Anchors (re-verified 2026-08-01; they rot in days — re-open before editing)

- [x] `scripts/world-bake.mjs` — archetype load `:57`; `deriveResidenceInstances`
      `:58`; published projection begins at `:101` (`:106` is the
      `archetype: v.archetype ?? v.id` line inside it) `[R: R-13]`
- [x] `scripts/lib/residences.mjs` — `RESIDENCE_OCCUPANCY_TARGET_AGENTS = 7`;
      `deriveResidenceCount(town)` takes the town **object**, not
      `town.population` (`:21-28`) `[R: R-7]`
- [ ] `scripts/lib/assetContract.mjs` — `loadContract`, `allNames()`, `gidOf()`
      *(not re-opened in review; verify before use)*
- [x] `contract/assets.contract.json` — `props.district` **32**,
      `props.interior` **36**, `groundAtlases` (`district_ground`,
      `interiors_ground`), `tileSize: 16`, `schemaVersion: 1`
- [ ] `sources/limezu.json` — `pack`, `capabilities`, `files`, `rects`,
      `emoteFrames` *(not re-opened in review; verify before use)*
- [x] `packages/client/src/game/venueRegistry.ts` — `published()` `:29`;
      `sceneKeyFor()` `:50-52`
- [x] `test/vocabulary-sync.test.mjs`, `test/residences.test.mjs`,
      `test/bake/world-bake.test.mjs`,
      `aisocialnetwork-api/tests/venueVocabularySync.test.js` — all present
- [x] `pickFrom` is in `aisocialnetwork-api/src/utils/agentSeed.js:178`, not
      `scheduleCoverage.js`, which imports it at `:41` `[R: R-5]`
- [x] `venues.lock.json` is at `packages/client/public/assets/venues.lock.json`,
      not the repo root `[R: R-10]`
- [x] `DistrictScene.ts` has three `farm` filter sites: `:417`, `:434`, `:449`
      `[R: R-9]`
- [x] `22_Post_Office_Singles_16x16` holds **45** files `[R: R-8]`

**Blocking pre-step: clean the tree.** `git status --short` shows `CONTEXT.md`,
all 18 tilemaps and `assets.generated.ts` modified, on `main` ahead 34. Task 1's
byte-identical gate has no baseline until those are committed or stashed.
Do that first, then record the `venues.json` sha256 from the clean tree
`[R: R-12]`.

---

## Task 1 — Generalise the archetype/generator pattern

`_archetypes/house.json` + `deriveResidenceInstances` already stamps N venues
from one authored template. That is the pattern; it is currently hardcoded to
residences.

- [ ] Extract a general `deriveInstances(archetype, count, opts)` from
      `deriveResidenceInstances`, preserving its guarantees exactly: **the
      instance list is append-only**, ids are `<archetype>_1..N` in provisioning
      order, `structuredClone` per instance so instances are independent copies,
      `labelPrefix` stripped from the template and used for the label.
- [ ] Keep `deriveResidenceInstances` as a thin caller so the existing
      `test/residences.test.mjs` and `test/bake/world-bake.test.mjs` pass
      unchanged. **Do not modify those tests in this task** — an unchanged
      green test is the proof the extraction is behaviour-preserving.
- [ ] Add `venues/_archetypes/README.md` documenting the three-file rule
      (contract name → `rects` → optional `venue.json`) and the append-only
      invariant.
- [ ] Tests: instance independence, append-only under growth, id/label
      stability, and a new test that a second archetype stamps correctly
      alongside residences without id collision (the `world-bake.mjs` duplicate
      check must still fire on a real collision).

**Gate:** `npm run bake:world` produces a byte-identical `venues.json` and
`venues.lock.json` to the pre-change commit. Growth that changes the baked
output in a *refactoring* task is a defect.

---

## Task 2 — Declare the housing ladder

Per D-65. Tier changes the **exterior only**; interiors are shared.

- [ ] Contract entries + `sources/limezu.json` `rects` for:
      - **T0 `tent`** — `11_Camping_Singles_16x16`: `Tent` (6), `Sleeping_Bag`
        (5), `Campfire` (3), `Lantern`
      - **T1 `mobile_home`** — `Mobile_House_Small` / `_Medium` / `_Big`
      - **T2 `house`** — `24_Additional_Houses`: `One_Story_House`,
        `Terraced_House_1..6` + modular pieces, `Country_House`
      - **T3 `villa`** — `7_Villas_Singles_16x16`: `Villa_1..5`, chimneys, roof
        windows, solar panels
- [ ] `venues/_archetypes/` gains `mobile_home.json` and `villa.json` beside
      `house.json`. **Interiors are shared with `house.json`** — copy the
      furniture/seats/spawns/doors block, vary only capacity if the tier
      warrants it.
- [ ] `condo.json` archetype authored (D-76) using `4_Generic_Building`
      `Condo_1..9` (verified present) — **declared, not instantiated.** State
      what makes condo's count zero once Task 1's generalised `deriveInstances`
      is wired to a count registry — a registry entry of `0`, or absence from
      the registry — and test *that*. Asserting "zero condo instances" against
      the bake as it stands is a tautology: `world-bake.mjs:47` treats
      `_`-prefixed entries as archetypes and `:57-58` stamps only `house.json`,
      so nothing could produce one regardless `[R: S-6]`.

### The `home` role is withheld from this task on purpose

`roles: [home]` on a new venue is a home-reassignment event, not a
declaration. `deriveResidenceVenues` (`api/src/utils/scheduleCoverage.js:183-187`)
selects `roles.includes('home')` and orders by `localeCompare(…, {numeric: true})`;
`deriveHomeVenue` (`:218-235`) fills that list to published capacity. `'dorm'`
sorts before `'house_1'`, so adding the role moves **73 of 85 agents** to a
different home and breaks `venueRegistryService.js:17-20`'s live invariant.
`'tent'` would do the same `[R: F-7, S-5]`.

- [ ] **Here (Task 2):** declare every ladder archetype **without**
      `roles: [home]`. The art, the contract entries and the `rects` all land;
      the role does not. The `dorm`'s role edit does not ship here either.
- [ ] **Plan `01-` Task 3 step 3:** backfill one stored home assignment per
      agent, computed against this pre-role vocabulary.
- [ ] **Plan `01-` Task 3 step 4, then a follow-up bake commit here:** add
      `roles: [home]` and re-bake. The empty-diff test is the proof.
- [ ] ⛔ **O-1 lands here too.** Whether `tent` is a venue at all depends on the
      plot-identity ruling: under option (b) the tent is a plot **state**, not
      an archetype instance, and this task's T0 rung changes shape entirely.

**Note on tiers and art:** `structure.tier` lives in the schema (plan `01-`)
regardless of how many tiers ship art. Declaring all four here is cheap
precisely because the art exists; instantiating them is plan `01-`'s business.

---

## Task 3 — Declare construction states

Per spec §3.2. Three visibly distinct plot states, all art-backed.

- [ ] Contract + `rects` from `8_Worksite_Singles_16x16`: `Building_Skeleton`
      (2), `Excavator` (4), `Scissor_Lifter`, `Light_Tower`, `Stacked_Material`
      (7), `Cone`, `Fence_1` (8) + `Fence_2` (8), `Ground_1` (6), `Entrance`
- [ ] Confirm the existing `fence_*` 8-piece set covers the `vacant`/`claimed`
      lot rendering; if `1_Terrains_and_Fences_Singles_16x16` offers a better
      match, declare it rather than reusing the farm pen's fence.
- [ ] A `plot_states.json` registry mapping state → prop composition. **This is
      data, not client code** — the client reads it, so a fourth state later is
      a data change.

---

## Task 4 — Declare the six civic archetypes

Per D-75's building set. Exteriors and interiors both exist for all six.

- [ ] **Garden / Park** — `17_Garden_Singles_16x16` (570 assets). Outdoor only,
      **no interior needed** — the cheapest archetype and the one to build
      first as the pattern's proof.
- [ ] **Market** — `9_Shopping_Center_and_Markets_Singles_16x16` exterior,
      `16_Grocery_Store_Singles` interior.
- [ ] **Post Office** — `22_Post_Office_Singles_16x16` (45 assets `[R: R-8]`).
      Folds in **D-37's owed noticeboard** — zero new mechanics, per the
      kickoff's hygiene list.
- [ ] **School** — `13_School_Singles_16x16` (125) exterior,
      `5_Classroom_and_Library_Singles` interior.
- [ ] **Swimming Pool** — `14_Swimming_Pool_Singles_16x16` (179).
- [ ] **Museum** — interior confirmed (`22_Museum_Singles`); **no dedicated
      museum exterior exists.** Compose the facade from
      `5_Floor_Modular_Building_Singles_16x16` (343 assets, modular). Budget
      real authoring time for this one; it is the only building in the set
      without a ready-made exterior.
- [ ] All six are authored as archetypes and bake **dormant** — I-8 holds:
      the art exists, the vocabulary exists, the unlock state (plan `01-`)
      decides whether they appear.

---

## Task 5 — Variant pools

Per the owner's ruling. Variants are already a first-class adapter concept —
`sources/limezu.variants.json` exists.

**The pool is bake data; the pick is not.** `world-bake.mjs` reads only
`town/town.json` (`{"population": 85}`) — there are no agents and no
`spriteSeed` at bake time, and the roster is an api runtime concept, so
"same seed → same variant" is not assertable in this repo `[R: S-4]`.

- [ ] Register tent variants (6 — `Tent_1..6`, verified) and, where art
      supports it, per-tier home variants as pools in
      `sources/limezu.variants.json`.
- [ ] Test: the pool is declared, complete, and **stable across bakes** — the
      same names in the same order. That stability is what makes the downstream
      deterministic pick reproducible.
- [ ] The pick itself lives in plan `03-` Task 2, via the existing
      `pickFrom(pool, spriteSeed, salt)` helper at
      `api/src/utils/agentSeed.js:178` `[R: R-5]`. Do not invent a second
      seeding scheme; if the helper is not importable across repos, mirror it
      with a shared-fixture test asserting identical output for the same inputs.

---

## Task 6 — Close the `farm` drift and extend the sync tests

The client filters on `a.location === 'farm'` and `farm` is **not in
`venues.json`** (verified — 18 venues, no `farm`). The barn is furniture
labelled "Farm" with no `targetVenue`. Growth multiplies exactly this failure.

There are **three** filter sites: `DistrictScene.ts:417` (presence filter),
`:434` (`newLoc !== 'farm'`, door-target branch) and `:449`
(`from !== 'farm'`, door-origin branch), plus non-filter references at `:132`,
`:392` and a comment at `:416`. "Remove the client filter" is three edits
`[R: R-9]`.

- [ ] **Rule it, then do it.** Either promote `barn` to a real venue (author an
      interior, give it a `targetVenue` and a door — it is a spare building
      sprite already placed on the map) **or** remove the client filter. Record
      which, and why, in the task notes.
- [ ] Extend `test/vocabulary-sync.test.mjs`: every location string the client
      can filter on must exist in the published vocabulary. This is the test
      that would have caught `farm`.
- [ ] Extend `aisocialnetwork-api/tests/venueVocabularySync.test.js`
      symmetrically for the api's copy.
- [ ] Add plot coverage to both: every plot's `archetype` allowlist references
      declared archetypes; every plot's footprint fits inside its district's
      `sizeTiles`; no two plots overlap.

---

## Task 7 — Plot authoring for the existing district ⛔ O-1

**Do not start before O-1 is ruled.** Whether a plot *is* a venue, or merely
names one, changes what these records contain. See `DECISIONS.md` § *O-1* and
findings §0.

- [ ] Author plots into `venues/district/venue.json` (or a sibling
      `plots.json` if that reads cleaner — rule it and note it). Verified
      geometry: `sizeTiles [48,46]`, `vRoad [22,24]`, `hRoad [21,23]`,
      `vSidewalks [[20,21],[25,26]]`, `hSidewalks [[19,20],[24,25]]`, farm
      `pen [36,2,47,18]`, four doors (office, cafe, dorm, library).
- [ ] Each plot carries: `id`, `size` (tile footprint), `doorAnchor`,
      `allowedArchetypes` (**by footprint fit only** — D-66: physics
      constrains, law regulates; there is no zone field). If O-1 resolves to
      option (c), this field becomes the *author's* zoning and D-66 must be
      re-ruled rather than quietly eroded.

### The plot count is derived, not picked

It has a computable floor, a computable ceiling, and one genuine knob between
them `[R: S-7]`.

**Floor — 13.** `ceil(85 / 7)` with `RESIDENCE_OCCUPANCY_TARGET_AGENTS = 7`
(`residences.mjs:21-28`). The engine D-59 retires computes exactly the number of
homes dev-85 needs to be housed at all. **Fewer than 13 housing plots and the
town cannot house itself no matter how well the loop works** — round (g) would
then measure a deadlock the design created, not an agent's unwillingness.

**Ceiling — ~25–30 practical.** Computed from the verified geometry: 48×46 =
**2,208** tiles; roads + sidewalks + farm pen occupy **813**, leaving **1,395**
free *before* the five existing buildings, `paths`, `scatter` and walkable
margin. Free tiles per quadrant: **NW 380 · NE 195 · SW 400 · SE 420** (NE is
mostly farm pen). At a 6×5 house footprint that is ~45 theoretical, ~25–30 real.

**The knob — `scarcity_ratio`.**

```
plots = ceil(scarcity_ratio × 13) + civic_footprints
```

- at **1.0** there is zero slack: one hoarded plot is instantly fatal;
- at **2.0** (26 housing plots) there is no district left for the six civic
  archetypes — and **school and swimming-pool footprints exceed 6×5**, so the
  civic set costs more than six plot-equivalents;
- **~1.2–1.4 is the only band this district actually affords.**

- [ ] Record the **ratio**, not just the integer, in the task notes and in the
      bake data. It is the one number the analyzer will want to tune, and a
      bare integer hides which end of the constraint moved.
- [ ] Assert in the sync tests: `housing_plots ≥ ceil(population / capacity)`.
      That single assertion makes the deadlock case impossible to ship.

**Do not** hand-place house buildings as furniture. Built homes render from
plot state and generated doors (plan `03-`); hand-placement is the pattern this
drive exists to retire.

---

## Task 8 — Verification

- [ ] `npm run bake:world` green; `packages/client/public/assets/venues.lock.json`
      sha256 regenerated and committed — the lock file is there, not at the
      repo root `[R: R-10]`.
- [ ] Both sync tests green, including the new plot and location-string
      coverage.
- [ ] `venueRegistry.published()` still byte-for-byte with the committed
      `venues.json` (the projection test).
- [ ] **No agent-facing surface moved.** Confirm explicitly: the api's published
      vocabulary changed (new dormant venues), but no MCP schema, no prompt
      byte, no candidate ordering. This plan does not consume a round.
- [ ] Contact sheet / `scripts/inspect-assets.mjs` pass over every newly
      declared prop, so a wrong `rects` entry is caught by eye rather than in a
      round.

---

## Planning-mode QA

**Blast radius.** BotVille repo only. The api consumes `venues.json` — new
dormant venues enter its vocabulary, which the sync tests cover. No
agents-repo surface moves.

**Bracketing checks.** First commit or stash the 20+ uncommitted modifications
in the tree (all 18 tilemaps, `assets.generated.ts`, `CONTEXT.md`) — Task 1's
gate is meaningless without a clean baseline `[R: R-12]`. Then: bake green,
sync tests green, `venues.json` sha256 recorded. After: same three, plus the
new coverage. A byte-diff of
`venues.json` is expected in Tasks 2–4 and 7 and **must be empty in Task 1**.

**Fire-proof for the new checks.** Each must be demonstrated failing before it
is trusted: add a location string the client filters on that is absent from the
vocabulary (the `farm` case) → the sync test must fail. Overlap two plots →
plot-integrity must fail. Point a plot's `allowedArchetypes` at an undeclared
archetype → must fail.

**Risk.** The Museum facade is the only unbudgeted authoring work in this plan.
If it slips, ship the other five and carry Museum into the next bake pass — it
is a building, not a mechanism, and nothing downstream depends on it.
