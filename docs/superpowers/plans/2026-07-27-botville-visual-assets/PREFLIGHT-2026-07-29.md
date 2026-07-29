# Pre-flight record — 2026-07-29

Executed per `docs/superpowers/plans/2026-07-30-EXECUTION-PREFLIGHT-PROMPT.md`.
Three parallel checks, one owner decision batch (→ DECISIONS.md D-15..D-18),
one fix pass. Everything below is either fixed in the plans/specs/code or
explicitly accepted; nothing is left open.

## Gate

Main clean at `c7ab17c`; worktree rebased onto main; baseline 13 pass / 2
skips → after guard-rail fixes **14 pass / 1 skip** (the cross-repo
`hashString` pin now runs from worktrees and passes bit-for-bit).

## Check results

**Coherence (six plans + specs):** not executable as-is — 4 blockers, all
fixed: `venues.generated.ts` emission moved into Plan 2 Task 18 (Plan 3
Task 21 now verifies it); `published()` restored to the eight-field
projection; the 927×656 claim corrected (below); Plan 6's bare
`sync-assets.mjs` calls now pass `limezu assets-src`. Global Constraints
were byte-identical across all seven copies (md5-verified); no orphaned
references to cut machinery. Should-fixes all applied, including a closed
`affords` enum (`sleep, read, eat, work, socialize, wander, idle`) in
`schemas/venues.schema.json`.

**Pixel + licence (real pack, measured):**
- Bodies: 9 sheets, all **927×656**. Eyes 7, Hairstyles 200, Outfits 132:
  all **896×656**. Accessories: 80 at 896 + 4 party-cones at 927. Art
  beyond col 895 exists only in Body_01 rows 11–12 (lift/throw — unused by
  the contract). Shared composer canvas is **896×656** (56 frames);
  `char_body` carries a `w:896` crop rect.
- Row map: r0 preview, r1 idle, r2 walk, **r3 sleep**, r4 sit-right,
  r5 sit-left. Sleep row (r3): outfits **zero art in all sampled sheets**,
  eyes zero, accessories split by family (backpack/gloves/monocle/medical
  mask/party cone: none; hats/bugs/beards/glasses: present). Hair passes.
  Sit rows pass on every layer. → D-17: sleep composes body + hair only;
  Plan 4 Task 27 Step 0 is now BLOCKING with this ground truth.
- Licence (`Modern_Exteriors_License.pdf`, read in full): edit + commercial
  use in a project permitted; reselling/redistributing the asset forbidden
  (gitignore rules already comply); **credits required** → D-18, Plan 6
  Task 38b (UI credit + README), exempt from vendor-name scrubbing.

**Substrate review:** verdict **yes-with-fixes**; nothing structurally
invalidates the plans. Both blocks-plans items fixed in worktree commit
`810b369`: `test:all` porcelain gate now fails on untracked files;
`siblingRepo.mjs` resolves the main checkout via `git-common-dir` so the
cross-repo pin runs in worktrees. Fold-into-task findings (vendor-named
paths → Plan 3/6; hardcoded venue vocabulary + `normalizeLocation` clamp →
Plan 3 Tasks 21-24; `AVATAR_VARIANT_COUNT` mirror → Plan 4; dead
`hideInside()` → Plan 3; stale duplicate `*.json` tilemaps → Plan 2 Task 19;
non-graceful `addTilesetImage(...)!` crash → Plan 3 Tasks 34/36) are
annotated here as expected work, not regressions. Fix-later (untouched):
`setApiKey` optimistic `hasKey`, A* linear open list, `LocationId`/
`AgentPosition` dead vocabulary, silent stale-location polling.

## Owner decisions (D-15..D-18 in DECISIONS.md)

Doorless v1 + night-open venues with a seeded night-owl minority (D-15);
owner curates 12 hair / 8 outfits from Task 9a contact sheets (D-16); sleep
= body+hair, verified at the localhost checkpoint (D-17); LimeZu credit
ships (D-18).

## Environment notes

- This machine ran Node v22 despite `engines >=24` — nothing enforces it;
  plan sessions must verify Node before trusting type-stripping claims.
- `packages/server/dist/` (gitignored) still contains Russian comments;
  tracked source is Cyrillic-free.
