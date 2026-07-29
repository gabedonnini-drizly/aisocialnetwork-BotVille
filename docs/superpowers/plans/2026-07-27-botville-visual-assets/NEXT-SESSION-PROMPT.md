# Next session — BotVille visual assets

Paste into a fresh session at the repo root. Assumes no prior context.

---

The six implementation plans in
`docs/superpowers/plans/2026-07-27-botville-visual-assets/` were reviewed
adversarially on 2026-07-29 against this repo and the sibling
`aisocialnetwork-api`. **The review is complete. The revisions are not started.
No plan file has been edited.**

Your job is to work the three tracks below.

## Read these first, in order

| File | What it is |
|---|---|
| `DECISIONS.md` | 14 owner decisions and 5 open items. **Start here.** |
| `REVIEW-FINDINGS.md` | 11 blockers, ~13 significant findings, cut recommendations, game-design analysis. Ranked by cost-if-found-late. |
| `ART-PACK.md` | Pack requirements, why LimeZu, the U-1 separable-layer evidence, the 16-vs-32 tile decision, a 16-point evaluation checklist, licence red flags. |
| `00-INDEX.md` | The plan map. Its pre-flight table contains at least one wrong "✅ CONFIRMED" (`Schedule.js:47` — the function is at `:10`, the `LIMIT 1` at `:49`). Treat every other row as a hypothesis. |

Spec: `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md`.

---

## The three tracks

Only Track C is blocked. Most of the review is wrong line numbers and broken
test logic, true regardless of any pending decision.

| Track | Blocked by | Size |
|---|---|---|
| **A — mechanical corrections** | nothing | ~16 findings |
| **B — art-pack QA** | packs on disk | ~30 min |
| **C — design-dependent findings** | the spec addendum (O-1) → the 3 unanswered questions (O-2) | ~6 findings |

---

### Track A — incorporate the review findings

Five batches, grouped by how a reviewer would read them, not by file.
**Report each batch and get approval before editing** (`DECISIONS.md` D-1).

**A1 — the Task 2 cluster.** All three land in Plan 1 Task 2 and each otherwise
surfaces two plans later looking like an unrelated bug:
- **F-1** TypeScript parameter properties (`constructor(private x: T)`) cannot
  load under `node --test` on Node 22 *or* 24. Three sites: `PresenceModel.ts`,
  `AppearanceResolver.ts`, `VenueScene`.
- **F-2** `@botville/shared/appearance/derive.mjs` resolves under nothing — no
  `exports` subpath (bare node), and the client's *string* alias prefix-matches
  into a path through a file (Vite). Both fixes verified working.
- **F-3** client `tsc --noEmit` fails TS7016 on the same import; Task 2
  currently argues *against* the fix.

**A2 — ordering and dependencies.**
- **F-4** Plan 3 ↔ Plan 4 are circularly dependent. Cleanest fix: move
  `hashString` into Plan 1 Task 2 beside `schemaVersion.mjs`.
- **F-5** Task 8a is sequenced before Task 9 but statically imports it.
- **F-11** Plan 5 hard-depends on Plan 4 Task 26 Step 5 (`pickFrom` export) and
  does not say so; two "only plan/phase touching the api" claims are false.

**A3 — wrong anchors and ranges.** High volume, near-zero judgement; do in one
pass. **F-17** (`cameraControls.ts` uses `zoomTo`, not `setZoom` — a literal
search-and-replace finds nothing), **F-18** (three replacement ranges that
duplicate or delete code), **F-19** (two wrong expected greps), **F-27** (the
anchor and count table).

**A4 — broken test and tooling logic.** **F-6** (Task 8a asserts an outcome that
cannot happen), **F-8** (Task 20 Tier 1 treats raw `sync-assets` copies as bake
outputs, and `writeReport()` runs after the assert that fails), **F-10**
(`deploy:client` defined twice, one with a literal `...`), **F-16**
(`scale.resolution` is not in Phaser 3.90's `ScaleConfig`; its test is a
tautology), **F-20** (the clean-tree guard is in the wrong suite), **F-25**
(`name in { grass: 1 }`), **F-26** (`coversAll`'s three sampler defects).

**A5 — cuts. Needs owner sign-off.**
- **C-1** drop `decisions.json` / `adapt.mjs` / `toAdapter()` in favour of
  `note` + `pin` fields on the adapter. Removes ~700 lines and blockers F-5 and
  F-6. **Keep** pins, `sheets.json` and contact sheets.
- **C-2** **now reverts to "keep Tier 1 only"** — the owner is buying LimeZu, so
  the golden gate has a real legacy pipeline to reproduce. Drop Tiers 2–4.
- **C-4** delete the tautological tests.

**How to verify Track A — do this, don't skip it.** Do not accept revised prose
as proof. **Execute Plan 1 Tasks 1–2 for real.** F-1, F-2 and F-3 were all found
by running things and all three live in that region. If the revised Task 2 comes
out green — `npm test` passes, `tsc --noEmit` clean, `vite build` resolves the
subpath — the fixes are proven rather than asserted. Roughly an hour, and it
validates the highest-risk cluster.

---

### Track B — art-pack QA

Two different activities. Do not conflate them:

- **Purchase validation (now, ~30 min).** Did we get what we paid for? Write a
  throwaway script — the good tools (`index-pack.mjs`, `contact-sheet.mjs`)
  don't exist until Plan 1, so don't wait for them.
- **Curation review (later, Plan 6 Task 3).** Is *this* the right chair? Needs
  the real tools and the contact sheets.

Expected `assets-src/` layout: `exteriors/`, `interiors/`, `farm/16x16/`,
`office/`. Run the 16-point checklist in `ART-PACK.md`. The three that decide it:

1. **Is `Character_Generator` actually separate PNGs per part?** This is U-1.
   Evidence says yes at high confidence, but it is documentary, not first-hand.
2. **Do hair and accessory layers cover the sit and sleep rows?** Known historical
   defects: mismatched hair colours on Hurt frames, sleep-frame offsets,
   Accessory 13 missing from some sit-left frames.
3. **Read the licence `.txt` inside the zip** — it differs from the store page.

Output feeds `capabilities.characterLayers` (→ `true`, per D-9), `docs/ASSETS.md`
(the U-1 and U-2 answers Task 3 Steps 7–8 want), and confirmation that Tasks 5–7's
rects resolve against the real files.

If a different pack was bought, run the same checklist — the requirements in
`ART-PACK.md` are vendor-neutral.

---

### Track C — after the spec addendum

**The addendum is not written and not approved. It blocks these and only these.**

The owner expanded scope during review (`DECISIONS.md` D-11..D-14): roughly one
home per agent with multi-occupant options, agents that move / marry / form
relationships, per-venue opening hours, day/night routines, and staged
behaviours in all four senses. Seed-assigned to start. His constraint: *"build
from a foundation that scales to this with minimal rewrite… but we can keep it
simple at the start."*

Four foundational changes recommended, not yet approved (`DECISIONS.md` O-1):
affordance-tagged venues, `stored ?? derived` assignments, venue archetypes +
instancing, and a versioned-not-frozen `AgentPresence`. Plus simulation LOD —
lazy-load a venue's `.tmj` on scene enter, and instantiate sprites only for the
active venue.

**Answer these three first** (`DECISIONS.md` O-2):
- Does the client need to know what an agent is *doing*, or only where it is?
  (The pressure point on the four-field boundary — emote status comes from
  `agentLife.ts` today, which is being retired.)
- How do houses relate to the district map — enterable buildings, a procedural
  residential zone, or off-map?
- How many residences in v1? (Recommendation: 10–12 shared, ~7 agents each.)

Then the findings that depend on the answers: **F-12** (all 85 agents assigned
to a capacity-6 dorm for 9 hours a day, while the district — the hero shot — is
empty), **F-14** (standing slots ignore furniture footprints, so agents stand
inside tables), the `ACTIVITY_POOLS` → affordances rewrite, and **F-7** — whose
one-line fix should land immediately anyway, since it is a real crash on every
weekend schedule.

---

## Recommended order

1. **Track B** if the packs are on disk — fastest, de-risks the money, produces
   Track C inputs.
2. **A1–A4 in parallel** — no owner decisions needed.
3. **A5 and the spec addendum together**, once the three questions are answered.

## How to work

- **Report, then fix on approval.** Do not edit plan files unprompted.
- **The filesystem wins over the plan.** Every claim about existing code is a
  hypothesis until checked — the review found the pre-flight table certifying a
  wrong line number.
- **Simple and dynamic** (D-2). Every core part clearly specced; no individual
  part more complex than it needs to be.
- Node 24 is required. Only 22.22 was installed at review time. The plans'
  `node --test` glob syntax works on 22 and 24 and **breaks on 20**.
- `aisocialnetwork-api` is resolved by convention, never by hardcoded path. It is
  **CommonJS on Node 22.x** — BotVille's Global Constraints do not apply to it
  (`REVIEW-FINDINGS.md` F-22).
- Two obligations no task covers: LimeZu requires a **credit link** to
  `https://limezu.itch.io/` in the UI, and **I-12 as written is wrong** — real
  art must reach browsers (D-10).
