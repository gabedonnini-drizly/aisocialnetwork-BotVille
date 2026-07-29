# Owner decisions — review session, 2026-07-29

Everything settled in the plan-review session, and everything still open.
Written so a fresh session needs nothing but this file, `REVIEW-FINDINGS.md`
and `ART-PACK.md`.

**Nothing in the six plans has been edited yet.** The review is complete; the
revisions are not started.

---

## Decided

### Process

| # | Decision |
|---|---|
| D-1 | **Report first, fix on approval.** Findings written to `REVIEW-FINDINGS.md`; plan `.md` files edited only after the owner accepts each item. |
| D-2 | **Cut appetite: flag and cost, owner decides.** Owner's words: *"we want to focus on ensuring we have all core parts of the dev work clearly specced and not making any individual part more complex than it needs — simple and dynamic is key."* |
| D-3 | **Node 24.** Owner will install it. Only v22.22.0 was present during review. The plans' `node --test` glob syntax is verified working on both 22 and 24, and broken on 20. |
| D-4 | **Execution model: fresh sessions with continuity, plus many subagents.** Both plan-level *and* task-level self-containment matter. |

### Art

| # | Decision |
|---|---|
| D-5 | **No art pack was owned** as of 2026-07-29. Pack selection became a deliverable of this review. |
| D-6 | **Buy the LimeZu stack** — Modern Interiors (+ Character Generator 2.0), Modern Exteriors, Modern Office Revamped, Modern Farm. `$11.45` in-sale / `$20.50` after. Plus Modern UI + Portrait Generator at `$3.90`. See `ART-PACK.md`. |
| D-7 | **Tile size stays 16.** Was open; resolved on evidence. LimeZu's 32/48 exports are upscales of 16px art, so a larger grid buys no detail from this vendor; legibility is governed by px-per-tile, not native grid; and 32px costs ~275 MB VRAM vs ~69 MB across ~30 layer sheets. **`contract.tileSize: 16` and Tasks 5–7's geometry are unaffected.** |
| D-8 | **Fix legibility with zoom and tint, not tile size.** `INTERIOR_CAMERA_ZOOM` 2.4 → 3 desktop / 2 mobile; `CAMERA.initialZoom` 1.8 → 2; name labels rendered in fixed screen-space px and capped in number; agents exempted from the night tint or tinted at ~0.2 rather than 0.45. |
| D-9 | **U-1 CONFIRMED first-hand 2026-07-29.** The packs are bought and extracted; `Character_Generator/` ships independent 16×16 PNGs — Bodies 9, Eyes 7, Hairstyles 200, Outfits 132, Accessories 84 — and frame-0 bounding boxes confirm they stack at (0,0). **`capabilities.characterLayers` must be `true` from Task 5.** See `ART-PACK-QA.md`. |
| D-9b | **U-2 resolved.** The `LICENSE.txt` inside each zip carries **no anti-AI clause** — the check that disqualified two rival packs. Credits *required* by Interiors and UI, *"much appreciated"* by Farm; the UI pack adds an NFT carve-out absent from its store page. The browser-delivery grey area is unchanged, and the world bake already implements its mitigation. |
| D-9c | **The art is verified against the repo.** The legacy pipeline runs (`90/90`, 121 PNGs, 5 tilemaps) and the committed `.tmj` files regenerate **byte-identically** — so the purchased art matches the original author's version and every crop coordinate still resolves. |
| D-10 | **Real art must reach browsers.** The deployed city is the product. **I-12 as written is wrong** and must be restated as *"no raw source sheets and no `assets-src/` in any image or repo; baked atlases served to browsers are permitted."* |

### Product direction

| # | Decision |
|---|---|
| D-11 | **More residences.** Long term: roughly one home per agent, some multi-occupant; agents can move, marry and form relationships. **Seed-assigned to start.** |
| D-12 | **Day/night routines and per-venue opening hours are in scope** for the foundation. |
| D-13 | **Staged behaviours — all four senses are wanted:** multi-step activities within a slot, behaviours that unlock over time, phased rollout of our own build, and an agent state machine. |
| D-14 | **The foundation must scale to D-11..D-13 with minimal rewrite,** while staying simple at the start. |
| D-15 | **Doorless residences confirmed for v1** (Track C: interiors jump-reachable, district doors a follow-up) — **but the night district is not dead:** night-open venues (the speakeasy/club, gym, restaurant-type venues) carry night `hours` windows, and agents form a **seeded night-attendance preference** (derived from the agent seed, no stored columns). Night streets are mostly — not entirely — empty. (2026-07-29 pre-flight decision batch.) |
| D-16 | **Variant curation is the owner's:** the 12 hairstyles / 8 outfits are picked by the owner from the Plan 1 Task 9a contact sheets, at that human-eye checkpoint. |
| D-17 | **Sleep frames compose body + hair only.** The pack has no sleep-row art for outfits or eyes (verified by pixel measurement 2026-07-29); the bed's blanket art covers the body. Accessory families without sleep art (backpack, gloves, monocle, medical mask, party cone) vanish in bed — accepted v1 behavior. Owner verifies the look at the first localhost render checkpoint. |
| D-18 | **LimeZu attribution ships with the app.** The pack licence's "Credits required" is binding: a user-visible credit (limezu.itch.io) in the client UI plus a README line. The vendor-name-scrubbing rule does not apply to this user-facing credit. |

---

## Open — carry into the next session

### O-1 — The spec addendum (blocks all plan edits)

Recommended and **not yet approved**. Four foundational changes, each cheap now
and expensive to retrofit:

1. **Affordance-tagged venues.** `roles` / `affords` / `hours` on every
   descriptor and in the published `venues.json`. Nothing queries a venue by id.
   Replaces the hardcoded `ACTIVITY_POOLS` id lists, which live in the *API*
   repo and today make every new venue a code change in two repos.
2. **`stored ?? derived` for every agent↔world assignment.** `home`,
   `workplace`, `hangout`. Day one there is no storage — pure functions, zero
   rows. Marriage and moving later add one nullable column and nothing else
   changes.
3. **Venue archetypes + instancing.** `venues/_archetypes/house.json` plus an
   instance list, expanded by the bake. 40 more houses becomes 40 lines of JSON,
   not 40 authored descriptors.
4. **`AgentPresence` versioned, not frozen.** Keep the four required fields, add
   `schemaVersion`, make anything beyond it optional-and-ignorable. Restate the
   invariant as *"the client renders nothing the platform did not assert"*
   rather than *"there are exactly four fields."*

Plus: **simulation LOD** — lazy-load a venue's `.tmj` on scene enter rather than
preloading every map, and instantiate sprites only for the active venue.

**This is a spec change, not a plan fix.** It revises spec §3.1 (the frozen
boundary), §5.3 (descriptor), §5.4 (published vocabulary) and §9 (schedule
seam).

### O-2 — Questions asked but not answered

- **Does the client need to know what an agent is *doing*, or only where it is?**
  This is the pressure point on the four-field boundary. Emote status currently
  comes from `agentLife.ts`, which is being retired — so it has to come from
  somewhere. Options: where-only (client infers), where + coarse activity tag,
  or full behaviour state.
- **How do houses relate to the district map?** Enterable buildings with doors
  (consistent with the existing four venues, but the 48×46 district must fit
  them), a procedurally placed residential zone (extends `cityGrid`, Task 16),
  or off-map and menu-reachable.
- **How many residences in v1?** Recommendation was 10–12 shared houses at ~7
  agents each — enough to fix crowding, few enough to author, and roommates make
  homes socially interesting. Not confirmed.

### O-3 — The night rule (F-12)

More houses is agreed (D-11), which resolves the *cause*: today all 85 agents
are assigned `venue: 'dorm'` for 9 hours a day against a declared capacity of 6.
The remaining choice is whether sleeping agents are `absent` (city empties at
night, district night-lighting becomes the hero shot) or present in their own
home venue.

### O-4 — Seasons

LimeZu ships **no** seasonal variants. If seasons are promoted from
nice-to-have to requirement, Omega Modern Graphics Pack ($50) is the only
modern-day answer — it ships a free winter tileset in *identical tile
arrangement*, so a texture-key swap re-renders every map. It fails the
separable-layer requirement, so it would be a tileset-only purchase alongside
LimeZu. Budget after the LimeZu buy: ~$85.

### O-5 — The licence, still

Unchanged from the spec's O-5, now with the actual text read. LimeZu permits
commercial use and forbids redistribution, but **does not address browser
delivery in words**. The near-universal reading is that the clause targets
republishing the pack as a pack. Mitigation — bake merged atlases so no shipped
file mirrors the original pack layout — is what the world bake already does.
**Credit is mandatory:** a link to `https://limezu.itch.io/` in the credits UI.
