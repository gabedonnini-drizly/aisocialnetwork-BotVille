# Next session — BotVille visual assets

> **SUPERSEDED 2026-07-29.** All three tracks below are closed (A applied and
> execution-verified, B done, C incorporated). The live entry point is
> `../2026-07-30-EXECUTION-PREFLIGHT-PROMPT.md`.

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
| `ART-PACK.md` | Pack requirements, why LimeZu, the 16-vs-32 tile decision, a 16-point evaluation checklist, licence red flags. |
| `ART-PACK-QA.md` | **The packs are bought, extracted and verified.** U-1 and U-2 resolved; the legacy pipeline runs; new defects found. |
| `00-INDEX.md` | The plan map. Its pre-flight table contains at least one wrong "✅ CONFIRMED" (`Schedule.js:47` — the function is at `:10`, the `LIMIT 1` at `:49`). Treat every other row as a hypothesis. |

Spec: `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md`.

---

## The three tracks

Only Track C is blocked. Most of the review is wrong line numbers and broken
test logic, true regardless of any pending decision.

| Track | Blocked by | Size |
|---|---|---|
| **A — mechanical corrections** | nothing | ~16 findings |
| **B — art-pack QA** | ✅ **DONE 2026-07-29** | see `ART-PACK-QA.md` |
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

**A6 — corrections that came out of the art-pack QA.** All new since the review;
all now verified against real files rather than inferred:

- **`capabilities.characterLayers` must be `true` in `sources/limezu.json` from
  Task 5.** U-1 is answered. Task 27's *layered* path is the one that ships, and
  it is currently exercised only by the fixture pack. Task 3 Step 7 becomes a
  formality.
- **Task 7's five `char_*` slots must point at five different directories**
  (`Bodies/`, `Eyes/`, `Hairstyles/`, `Outfits/`, `Accessories/`), not five
  copies of one premade sheet.
- **The contract's `characters.parts` does not match the pack.** It declares
  `["body","hair","top","bottom","accessory"]`; the pack ships **body / eyes /
  hair / outfit / accessory** — one garment layer, no top/bottom split, and an
  eyes layer the contract has no slot for. Reconcile `characters.parts` *and*
  `AppearanceRecord` (which has `top` and `bottom` as separate seed-derived
  axes).
- **Body sheets are 927×656; every other layer is 896×656**, and the extra 31px
  holds real art (600 opaque px in `Body_01`). Task 27's `composeSheet` sizes its
  canvas from `parts[0]` — the body — so it would emit a 927px sheet with a stray
  band nothing covers. **Crop bodies to 896 before compositing**, and have
  `ContractValidator` assert that all character layers share one canvas size.
- **Tasks 5–7's `files` blocks must use the packs' real paths** and the symlinks
  then deleted. Mapping table is in `ART-PACK-QA.md`.
- **Task 3 Step 3 expects `110/110`; the real number is `90/90`.** Already logged
  as F-27; now confirmed by running it.

**How to verify Track A — do this, don't skip it.** Do not accept revised prose
as proof. **Execute Plan 1 Tasks 1–2 for real.** F-1, F-2 and F-3 were all found
by running things and all three live in that region. If the revised Task 2 comes
out green — `npm test` passes, `tsc --noEmit` clean, `vite build` resolves the
subpath — the fixes are proven rather than asserted. Roughly an hour, and it
validates the highest-risk cluster.

---

### Track B — art-pack QA ✅ DONE

All five LimeZu packs are bought, extracted to `assets-src/` and verified. Full
detail in `ART-PACK-QA.md`; the results you need to carry:

**The legacy pipeline runs end to end.** `sync-assets.mjs` → `copied 90/90`
(copied 90/90);
`build-district.mjs` and `build-interiors.mjs` produce **121 PNGs and 5
tilemaps**. BotVille renders.

**The committed `.tmj` files regenerated byte-identically** — `git status` stayed
clean. The purchased art is the same version the original author used, every
crop coordinate still resolves, and the legacy pipeline is deterministic. **Plan
6 Task 3 Step 10 has effectively already passed**, and Task 20 Tier 1 has a
trustworthy baseline.

**U-1: CONFIRMED, first-hand.** `Character_Generator/` ships independent 16×16
PNGs — Bodies 9, Eyes 7, Hairstyles 200, Outfits 132, Accessories 84 — and
frame-0 bounding boxes confirm they stack at (0,0).

**U-2: read from the `LICENSE.txt` inside each zip.** **No anti-AI clause in any
of them** — the check that disqualified two rival packs. Credits *required* by
Interiors and UI, *"much appreciated"* by Farm; the UI pack adds an NFT carve-out
absent from its store page. Browser-delivery grey area unchanged.

**Note on the layout.** The paths `sync-assets.mjs` expects are a hand-made
reorganisation by the previous author, not the packs' native structure. The
native trees are preserved and a **relative symlink layer** maps the expected
names onto them (table in `ART-PACK-QA.md`). That is a stopgap so the legacy
pipeline runs today; the durable fix is real paths in `sources/limezu.json`'s
`files` block — see batch A6.

**What still needs checking before Task 27 is built:** whether hair and accessory
layers cover the **sit and sleep** rows. Known historical defects — mismatched
hair colours on Hurt frames, sleep-frame offsets, Accessory 13 missing from some
sit-left frames.

The remaining half of Track B — the **curation review** ("is *this* the right
chair?") — still belongs to Plan 6 Task 3, because it needs `index-pack.mjs` and
`contact-sheet.mjs` from Plan 1.

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

Track B is done, so:

1. **Run `npm run dev` and look at the city.** It renders now. Everything below
   is easier to judge once you have seen it.
2. **A1–A4 and A6 in parallel** — no owner decisions needed for any of them.
3. **A5 and the spec addendum together**, once the three questions in O-2 are
   answered.

One caveat carried from the QA: `assets-src/` currently holds the extracted
packs *and* a symlink layer that the plans do not describe. Anyone re-running
`sync-assets.mjs` or the legacy build scripts depends on those symlinks until
A6 replaces them with real paths in the adapter.

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
