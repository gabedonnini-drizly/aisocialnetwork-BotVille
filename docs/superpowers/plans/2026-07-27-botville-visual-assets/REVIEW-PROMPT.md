# Review prompt — BotVille visual assets plans

Paste into a fresh session at the repo root. Nothing in this file assumes prior
context.

---

Review the implementation plans in
`docs/superpowers/plans/2026-07-27-botville-visual-assets/` — an index plus six
plans, 43 tasks, ~10.7k lines. They implement the spec at
`docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md`.

Read `00-INDEX.md` first, then the plans. **Do not implement anything.** The
output is a review.

## Ground rules

1. **The filesystem wins over the plan.** Every claim about existing code is a
   hypothesis until you check it. The plans cite line numbers, function names,
   file paths, counts and constraints — spot-check them. A plan that is wrong
   about the code it is modifying will fail at step 3 of task 1.
2. **The spec is approved; the plans are not.** Do not re-litigate the design.
   Do challenge whether the plans implement it, and whether they implement more
   than it.
3. **Adversarial, not confirmatory.** Do not summarise what the plans say. Find
   what is wrong, missing, or overbuilt. A review that concludes "this is
   comprehensive and well-structured" has not been done.
4. **Verify before reporting.** For each finding, state the concrete failure:
   which command, which step, what happens instead. A finding you cannot make
   concrete is a hunch — say so or drop it.

## What to review for

### 1. Correctness against the repo

- Do the cited anchors exist? (`config.ts:40`, `assetManifest.ts:211-218`,
  `Schedule.js:47`, `build-district.mjs:29-53`, the `png-lib.mjs` API surface,
  `AVATAR_VARIANTS` shape, `railway.toml`'s build command, `vercel.json`.)
- Does the code in the plans actually run? Trace imports, signatures and return
  shapes across tasks. A function called `assignSlots` in one task and
  `assignSlot` in another is a bug. So is a module importing a name its
  producer never exports.
- Do the test expectations match the implementations printed beside them?
  Compute the arithmetic. Several assertions count objects produced by loops in
  the same task — check the loop bounds.
- **Node/tooling reality:** does `node --test` accept those globs on the pinned
  Node? Does type stripping handle these files? Does `tsc` with `allowJs` emit
  what Task 2 claims? Does Vite resolve `@botville/shared/appearance/derive.mjs`
  and its relative `.mjs` import?

### 2. Over-complexity — the main thing I want pressure-tested

For every module, artifact and test the plans introduce, ask: **what breaks if
this does not exist?** If the answer is "nothing" or "we would find out
slightly later", say so and recommend cutting it.

Specifically interrogate:

- **The curation layer** (Plan 1 Tasks 4a, 8a, 9a; Plan 2 Task 19a). A pack
  index, a decision record that generates the adapter, contact sheets, crop
  pins. Is this proportionate to a repo with **one** art pack and no concrete
  plan to add a second? Which of the four earns its keep? Would a `note` field
  and a sha256 have covered 80% of it?
- **The tiered golden gate** (Plan 6 Task 20). Four tiers, a declared-difference
  list, a semantic object differ, a sampled collision-coverage check. Is the
  coverage sampler justified, or is it machinery around a check that could be
  "the collision layer changed, here is the diff, a human looks once"?
- **The fixture pack** (Plan 1 Task 8). It is load-bearing for CI and for the
  art-free deploy — but is generating synthetic PNGs the simplest thing that
  achieves that, or would committing a handful of tiny hand-made placeholder
  PNGs be less machinery?
- **The six-way plan split.** Are the boundaries real, or is Plan 3 just "the
  rest of the client work"? Could this be four plans? Does any plan fail the
  "leaves the system working" test?
- **Test count.** Roughly 200 tests across 43 tasks. Find the ones that assert
  a tautology, restate a type, or test the framework rather than the code.

Cutting is a valid recommendation. So is "this is justified, here is why" — but
justify it in terms of a failure it prevents, not in terms of thoroughness.

### 3. Game design

The output is a rendered pixel city with 50–150 simulated agents. Judge it as a
game, not only as software.

- **Legibility.** 16px sprites, name labels, a night tint reaching alpha 0.45.
  Does the appearance system (Plan 4) actually produce distinguishable agents at
  that size, or distinguishable *hex values*? The palette-separation test uses
  CIE Lab ΔE thresholds of 12/7/6 — are those defensible, and does silhouette
  variation actually happen when `characterLayers` is false?
- **Crowding.** ~25 agents per venue in 20×15 rooms with 4–9 seats. Plan 3
  Task 37 assigns deterministic slots. Does the result read as a populated room
  or as a grid of sprites? What does an over-capacity venue look like — the
  plans defer this deliberately (R-3); is deferring it right?
- **Legibility of movement.** Agents animate within a venue, never between
  (I-4). With schedules changing venue on the hour, do agents pop in and out?
  Is that acceptable, and do the plans acknowledge it?
- **The schedule feel** (Plan 5 Task 32). Every agent's day is seed-derived
  across 3-hour windows. Does the town read as *alive* (staggered, varied) or as
  *random* (no shared rhythm, no rush hour, nobody ever meets)? Is there a case
  for deliberate correlation — a lunch peak — that the plans have engineered
  away in the name of spreading agents out?
- **Camera and pixels.** The zoom ladder `[0.5, 1, 2, 3, 4]` and floored DPR
  (Plan 3 Task 36). Is 0.5 usable on 16px art? Does flooring DPR to 1 on a 1.5×
  display make everything soft in a different way?

### 4. Software design

- **Coupling and reversibility.** The design's claim is that swapping the art
  pack is a data change. Test it: walk through what a second pack would actually
  require. Count the files touched. Is the claim true?
- **The generated-file strategy.** `venues.generated.ts`, `assets.generated.ts`,
  a generated `sources/<pack>.json`, a generated sync list. Generated files that
  are committed have a staleness problem — do the plans close every hole, or
  only the ones they noticed?
- **Failure modes.** For each new artifact, what happens when it is missing,
  stale, or corrupt? Which failures are loud, which are silent?
- **Boundaries.** `AgentPresence` is four fields and must stay four. Does
  anything in the plans leak a fifth by another route?
- **The two-repo seam.** Plan 5 writes to `aisocialnetwork-api`. Is the coupling
  minimal and in the right direction? What happens if the two repos are updated
  out of order?

### 5. Plan quality

Judge against `superpowers:writing-plans` if it is available, otherwise
against: no placeholders, real code in every code step, exact file paths,
type/name consistency across tasks, each task independently testable and
worth a reviewer's gate, frequent commits.

- Find any step that says what to do without showing how.
- Find any task that cannot be verified without doing the next one.
- Find any task doing two unrelated things.
- Check the "Verification checklist" in `00-INDEX.md` actually verifies its
  claims.

## Known suspicions — dig here first

These are the author's own doubts. Confirm or dismiss each with evidence:

1. **Task 3 (Plan 6) may still be unrunnable in practice.** It drives frozen
   legacy scripts against packs nobody has. Walk the whole task as if you had
   the art. Does `capture-golden-baseline.mjs` work? Does `sync-assets.mjs`
   still exist in the shape it expects after Plan 2 Task 19a rewrote it?
2. **`worldBake` grew a lot of parameters** (`pack`, `srcRoot`, `outDir`,
   `generatedDir`, `venuesDirs`). Is that a well-factored seam or a smell?
3. **Plan 1 is now 3.2k lines and 12 tasks.** Should the curation tasks be their
   own plan, or dropped to a later phase entirely?
4. **The `.mjs` / `.ts` split** in `packages/shared` is unusual. Is
   `schemaVersion.mjs` the right fix, or is there a cleaner one (build step,
   JSON import, duplicated constant with a test)?
5. **Task 20's collision-coverage sampler** steps a 4px lattice and has an
   early-`break` in a nested loop. Read it closely — is the loop correct?
6. **Task 8a's migration** is a `node -e` one-liner that sets provenance with a
   suspicious `name in { grass: 1 }` expression. Is it right?

## Output

A prioritised list. For each finding:

- **Severity** — blocker / significant / minor / cut-this
- **Location** — plan file and task/step
- **The claim** — one sentence
- **The evidence** — the command you ran, the file you read, the arithmetic
- **The fix** — concrete, or "needs a decision from the owner: X vs Y"

Rank by what would waste the most time if discovered during execution rather
than now. End with a short verdict: **is this plan set ready to execute?** If
not, name the smallest set of changes that would make it so.
