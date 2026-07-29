# Next session — BotVille visual assets

Paste into a fresh session at the repo root. Assumes no prior context.

---

We reviewed the six implementation plans in
`docs/superpowers/plans/2026-07-27-botville-visual-assets/` on 2026-07-29. The
review is **complete**; the revisions are **not started**. No plan file has been
edited.

## Read these four first, in order

| File | What it is |
|---|---|
| `DECISIONS.md` | Owner decisions from the review session, and what is still open. **Start here.** |
| `REVIEW-FINDINGS.md` | The review: 11 blockers, ~13 significant findings, cut recommendations, game-design analysis. Ranked by cost-if-found-late. |
| `ART-PACK.md` | Pack requirements, why LimeZu, the U-1 evidence, the tile-size decision, a 16-point evaluation checklist, licence red flags. |
| `00-INDEX.md` | The plan map. Its pre-flight table contains at least one wrong "✅ CONFIRMED" (`Schedule.js:47`) — treat the rest as hypotheses. |

The approved spec is
`docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md`.

## Two workstreams

### A — Verify the art pack (do this first if the packs are on disk)

The owner was buying the LimeZu stack (Modern Interiors + Character Generator
2.0, Modern Exteriors, Modern Office Revamped, Modern Farm; optionally Modern
UI). Expected `assets-src/` layout: `exteriors/`, `interiors/`, `farm/16x16/`,
`office/`.

If `assets-src/` exists, **run the 16-point checklist in `ART-PACK.md` against
the real files** and report. The three that matter most:

1. **Are body / eyes / hair / outfit / accessory separate PNGs?** This is U-1.
   Evidence says yes at high confidence but it is documentary, not first-hand.
   Confirm by listing the `Character_Generator` folder.
2. **Do hair and accessory layers cover the sit and sleep rows?** Known
   historical defects: mismatched hair colours on Hurt frames, sleep-frame
   offsets, Accessory 13 missing from some sit-left frames.
3. **Read the licence `.txt` inside the zip** — it differs from the store page.

If the owner bought something else instead, run the same checklist and report
whether it clears the bar; the requirements are in `ART-PACK.md`.

### B — The spec addendum, then the plan edits

**The addendum is not written and not approved. It blocks every plan edit.**

The owner expanded scope during review (`DECISIONS.md` D-11..D-14): roughly one
home per agent with multi-occupant options, agents that move / marry / form
relationships, per-venue opening hours, day/night routines, and staged
behaviours in all four senses — multi-step activities, unlocks over time, phased
rollout, and an agent state machine. Seed-assigned to start. The stated
constraint: *"build from a foundation that scales to this with minimal
rewrite… but we can keep it simple at the start."*

Four foundational changes were recommended and not yet approved
(`DECISIONS.md` O-1):

1. **Affordance-tagged venues** — `roles` / `affords` / `hours` on descriptors
   and in `venues.json`; nothing queries a venue by id. Replaces the hardcoded
   `ACTIVITY_POOLS` id lists, which currently live in the *API* repo and make
   every new venue a code change in two repos.
2. **`stored ?? derived`** for `home` / `workplace` / `hangout`. No storage on
   day one; marriage and moving later add one nullable column.
3. **Venue archetypes + instancing** — one `house` archetype plus an instance
   list, expanded by the bake.
4. **`AgentPresence` versioned, not frozen** — keep four required fields, add
   `schemaVersion`, make everything beyond optional. Restate the invariant as
   *"the client renders nothing the platform did not assert."*

Plus simulation LOD: lazy-load a venue's `.tmj` on scene enter rather than
preloading every map, and instantiate sprites only for the active venue.

**Three questions were asked and never answered** (`DECISIONS.md` O-2) — resolve
them before writing the addendum:

- Does the client need to know what an agent is *doing*, or only where it is?
  (This is the pressure point on the four-field boundary. Emote status comes
  from `agentLife.ts` today, which is being retired.)
- How do houses relate to the district map — enterable buildings, a procedural
  residential zone, or off-map?
- How many residences in v1? (Recommendation was 10–12 shared, ~7 agents each.)

Then: write the addendum, get approval, and only then edit the six plans.

## How to work

- **Report, then fix on approval** (`DECISIONS.md` D-1). Do not edit plan files
  unprompted.
- **The filesystem wins over the plan.** Every claim about existing code is a
  hypothesis until checked — the review found the pre-flight table certifying a
  wrong line number.
- **Simple and dynamic** (D-2). Do not make any individual part more complex
  than it needs to be, but make sure every core part is clearly specced.
- Node 24 is required (`engines: >=24.0.0`, `.nvmrc` = 24). Only 22.22 was
  installed during review; the owner intended to install 24. The plans'
  `node --test` glob syntax works on 22 and 24, and **breaks on 20**.
- The sibling API repo is `aisocialnetwork-api`, resolved by convention, never
  by hardcoded path. It is **CommonJS on Node 22.x** — BotVille's Global
  Constraints do not apply to it (`REVIEW-FINDINGS.md` F-22).

## Highest-value fixes, if you want to start on plan edits immediately

`REVIEW-FINDINGS.md` F-1, F-2 and F-3 are all fixable in **Plan 1 Task 2** and
should be done together — each otherwise surfaces two plans later as an
unrelated-looking failure:

- TypeScript **parameter properties** (`constructor(private x: T)`) cannot load
  under `node --test` on either Node 22 or 24. Three sites.
- `@botville/shared/appearance/derive.mjs` **resolves under nothing** — no
  `exports` subpath, and the client's string alias prefix-matches into a path
  *through* a file under Vite. Both fixes verified working.
- Client `tsc --noEmit` fails **TS7016** on the same import; Task 2 currently
  argues against the fix.
