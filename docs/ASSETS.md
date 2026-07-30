# Assets — pack facts recorded so nobody re-litigates them from the sheets

This file exists so the next reader can trust a claim instead of re-measuring
it. Everything below is **pixel-measured**, not eyeballed or copied from a
vendor doc — the numbers came from `scripts/gen-row-coverage.mjs` run against
the real LimeZu pack on disk (`assets-src/interiors/2_Characters/Character_Generator/`).

## The four packs (Plan 6 Task 3, 2026-07-30)

`scripts/sync-assets.mjs` and `sources/limezu.json`'s `files` block read from
four LimeZu 16×16 packs, unpacked by hand into `assets-src/` (gitignored,
never committed — see `.gitignore:21`), each keeping its own vendor folder
layout:

| `assets-src/` subtree | Pack |
|---|---|
| `exteriors/` | [Modern Exteriors](https://limezu.itch.io/modernexteriors) 16×16 |
| `interiors/` | [Modern Interiors](https://limezu.itch.io/moderninteriors) 16×16 |
| `farm/16x16/` | [Modern Farm](https://limezu.itch.io/modernfarm) 16×16 |
| `office/` | [Modern Office](https://limezu.itch.io/modernoffice) 16×16 |

No `sync-assets.mjs` path corrections were needed this run: the four subtrees
above matched the `files` block's existing paths exactly on first `npm run
golden:capture` (28/28 runtime + animated sheets copied). The one real gap
found was structural, not a path typo — see "Legacy-compat bridge" below.

### U-1 — separable character layers (re-verified on this machine's copy)

U-1 was already answered first-hand during the 2026-07-29 art-pack QA:
`characters-premade` layer directories are separable, so `capabilities.characterLayers`
is `true` (`sources/limezu.json`) and Task 27 composes rather than palette-remaps.
Re-verified against this machine's unpacked copy, 2026-07-30:

```
node scripts/inspect-assets.mjs "assets-src/interiors/2_Characters/Character_Generator/0_Premade_Characters/16x16/Premade_Character_01.png"
node scripts/png-grid.mjs "assets-src/interiors/2_Characters/Character_Generator/Bodies/16x16/Body_01.png" 16 32
ls "assets-src/interiors/2_Characters/Character_Generator"
```

Confirmed: `Bodies`, `Eyes`, `Hairstyles`, `Outfits`, `Accessories` all present
(plus `Bodies_kids`, `Eyes_kids`, `Hairstyles_kids`, `Outfits_kids`, `Books`,
`Smartphones` — extra pack content nothing here reads). File counts match the
brief exactly: Bodies 9, Eyes 7, Hairstyles 200, Outfits 132, Accessories 84.
`Body_01.png` is 927×656 (58×20.5 frames of 16×32, `png-grid.mjs` confirms
`927x656, grid 16x32 -> 58 cols x 21 rows`). No reconciliation needed —
this machine's edition matches what U-1 was answered against.

### U-2 — the licence text (verbatim, replaces the README's paraphrase)

`office/LICENSE.txt` (shipped inside the Modern Office pack, the only one of
the four whose unpacked tree includes a licence file) reads, verbatim:

> MODERN OFFICE LICENSE
>
> YOU CAN:
> - Edit and use the asset in any commercial or non commercial project
> - Use the asset in any commercial or non commercial project
>
> YOU CAN'T:
> - Resell or distribute the asset to others
> - Edit and resell the asset to others
>
> Credits are appreciated

The itch.io purchase pages for the other three packs were fetched directly
(2026-07-30) and carry byte-for-byte the same "YOU CAN" / "YOU CAN'T" block —
[modernexteriors](https://limezu.itch.io/modernexteriors),
[moderninteriors](https://limezu.itch.io/moderninteriors) and
[modernfarm](https://limezu.itch.io/modernfarm) all quote identically. This is
one shared LimeZu licence, not four different ones, and none of the four
pages or files says anything more specific about derived/baked images than
"you can edit and use the asset ... you can't resell or distribute the asset
to others" — a baked crop or atlas PNG shipped to end users is still LimeZu's
pixels, just cropped/composited, so it falls under "the asset," not a
carve-out. This replaces README.md's prior unsourced paraphrase ("permits use
but forbids redistribution") with the actual quotation; the substance was
already correct. **Decision for Task 35: private registry** — redistribution
is forbidden, so baked art ships from a private/authenticated store, never a
public CDN or public npm package.

### Legacy-compat bridge (`scripts/capture-golden-baseline.mjs`) — a real gap, not a path typo

Running the capture script exactly as specified failed twice before
succeeding, for reasons worth recording because they are structural, not
incidental:

1. **`build-interiors.mjs` needs office singles pre-placed.** The frozen
   script reads `workstation_single`, `workstation_double`, `whiteboard`,
   `printer`, `coffee_machine`, `plant_pot`, `plant_small` back from
   `public/assets/sprites/limezu/interior/*.png` to get real width/height for
   map-object collision. The pre-Task-19a `sync-assets.mjs` placed these with
   a hardcoded `OFFICE_SINGLES` list; Plan 2's derived rewrite correctly
   dropped that list — these names are now baked contract props, not runtime
   sheets sync-assets.mjs's own header says it copies. Nothing had exercised
   the frozen scripts against a real pack since that rewrite, so the gap was
   never caught until this task.
2. **`build-district.mjs`'s `IMG()` helper never generates most of what it
   references.** It writes 30 `.tmj` object entries pointing at
   `sprites/limezu/district/<name>.png` — office/cafe buildings, barn, trees,
   lamps, benches, hydrant, cars, bushes, crops, soil, all eight fence
   pieces — without ever creating those PNGs itself (only `villa_building`
   and `library_building` are crops it computes; everything else was a raw
   copy the same retired `OFFICE_SINGLES`-style list used to place).
3. `capture-golden-baseline.mjs` bridges both gaps itself (not in
   `sync-assets.mjs`, which stays exactly as scoped as its header says): after
   `sync-assets.mjs` runs, it copies every `contract.props` name whose adapter
   rect is a bare whole-file reference (no crop `x/y/w/h`, no `generated`
   stamp — those two are what the legacy scripts compute themselves) straight
   from its pinned `sources/limezu.json` file mapping into the legacy
   destination path. Byte-identical to what the old `sync-assets.mjs` would
   have copied, because it is resolved through the same pinned adapter every
   other sprite is. `scripts/index-pack.mjs` also needed a fix unrelated to
   this bridge — see the sheets-manifest note below.

### Known baseline divergences from a future world-bake (for Task 20)

The golden baseline (`test/golden/baseline.json`) captures what the FROZEN
scripts produce *today*, against the pinned, already-corrected
`sources/limezu.json`. Two of the historical legacy-vs-fixed art bugs
genuinely show up as expected differences against a future `world-bake`
comparison; a third one that might be expected to does not, for a specific
and worth-recording reason:

- **`grassA`/`grassB` (in `tilesets/limezu/district_ground.png`)** —
  `build-district.mjs` hardcodes its own crop coordinates
  (`['grassA', TERR, 3, 5]`, `['grassB', TERR, 4, 5]`) independent of
  `sources/limezu.json`, and was never touched by the 2026-07-29 fix that
  shifted the *adapter's* grassA/grassB one tile-row down (the frozen script
  still lands on the same transparent gap the fix corrected). **This is a
  real, expected divergence**: the baseline's atlas carries the old
  (near-invisible) grass tile; a future `world-bake` will carry the corrected
  one, from the same two named tiles.
- **`plant_small`/`plant_pot`** — both are whole-file contract props (no crop
  rect in `sources/limezu.json`), so the legacy-compat bridge above copies
  them raw: **32×48, untrimmed** — confirmed by direct measurement of the
  captured files. The 2026-07-29 validator fix trims both to their real
  content bbox (16×18 and 12×26) because the raw file exceeds the contract's
  `maxSize`; `world-bake`'s `PropBaker` applies that trim. **This is a real,
  expected divergence** for exactly these two names.
- **`car_down_2` — NOT a divergence, on inspection.** The note in
  `sources/limezu.json` records the file was "retargeted to Car_Down_19"
  after the original pick (`Car_Down_12`) proved oversize. But
  `build-district.mjs` never places `car_down_2` as a map object at all (only
  `car_right_1`/`car_left_1` appear in its `IMG()` calls) — the name is a
  whole-file contract prop the legacy-compat bridge above copies from
  whichever file `sources/limezu.json` currently names. Since that mapping is
  already the corrected `Car_Down_19`, the baseline and a future `world-bake`
  read the **same** current file: there is nothing for `car_down_2` left to
  diverge on. The historical `Car_Down_12` pick only ever lived in the fully
  retired pre-19a `sync-assets.mjs`; nothing byte-identical to it survives
  anywhere in this baseline to compare against.

Task 20's comparison needs to tolerate the first two names and can treat
`car_down_2` as an ordinary match.

### Sheets-manifest scoping (`sources/limezu.sheets.json`) — full-pack rejected, adapter-referenced sanctioned

`npm run pack:index limezu assets-src` against the real four packs walks
41,488 PNGs. An unscoped `sheets.json` (one row per PNG in the pack) measured
9.7MB and is the rejected design recorded in this plan's ledger: almost none
of those rows name a sheet anything in this repo actually crops from, so its
diff would fire on pack noise no crop depends on — exactly the opposite of
the file's own stated job ("this file's diff names exactly which sheets moved,
which is the signal that the crops taken from them need re-reviewing"). The
brief's Step 4 text does not itself describe a scoping mechanism, so per the
standing ruling this task implements the **sanctioned, scoped design**:
`sources/limezu.sheets.json` is filtered, at write time, to only the sheets
`sources/limezu.json`'s `files` block actually names (81 of the 41,488 —
17KB). The full, unscoped per-sheet/per-cell data stays available as the
gitignored `sources/limezu.index.json` (826MB locally, never committed) — it
is the browsing aid for *choosing* a crop in the first place, a job a
scoped-to-already-chosen list structurally cannot do. `scripts/index-pack.mjs`
also needed a small unrelated fix to run against a real pack at all: its
per-cell index write used a single `JSON.stringify` over 4,039,223
candidate cells, which threw `RangeError: Invalid string length` (V8's
~512MB single-string ceiling) — fixed with a streaming per-key writer;
the (gitignored, regenerable) file it writes is unaffected in content, only
in how it's serialized.

### Step 6 review (contact sheets) — no crop changes

`npm run contact limezu assets-src` renders every pinned crop 1× on its floor
tile, 2×, and night-tinted. Reviewed both sheets in full (68 sprites: 32
district + 36 interior) against the four failure modes in the plan text:

- No neighbour-pixel bleed found at 2× on any crop.
- Nothing vanishes under night tint (`#0a0a2e @ 0.45`) on inspection.
- No new floor/prop color clash found beyond the one already recorded
  (`armchair_grey_r`, TZ-08 — confirmed still correct: the crop is
  deliberately the brown pair from row 582, not the grey one, exactly as the
  note says).
- Nothing hovers `[UNPINNED]` — all 136 pinned crops (116 original + 20 added
  since by later Plan 1 tasks) show a pin.
- The two terse legacy notes reading only "getting clipped"
  (`chalkboard`, `lectern`) were checked specifically at 2× and
  night-tinted: both crops are visually complete (no cut-off edge, no
  neighbour bleed), and both stay legible at night. The note is stale
  context, not an active defect.
- `library_building`'s "BOOKS" sign stamp does not render in the contact
  sheet — `contact-sheet.mjs` uses `spriteReader.mjs`'s `readSprite`, which
  never applies a `generated:` transform (only `propBaker.mjs` does, in the
  new pipeline). Checked the actual generated file directly
  (`packages/client/public/assets/sprites/limezu/district/library_building.png`)
  instead: the stamp renders cleanly and legibly. Worth knowing for whoever
  reviews contact sheets next — `generated` props are a blind spot in that
  tool, not just this one file.

**No crop in `sources/limezu.json` was changed.** 136 transcribed/pinned
crops survived first contact with a real, pixel-level review; that is a real
result, not a null one, per the plan text.

Crop coordinates throughout were verified with `scripts/inspect-assets.mjs`,
`scripts/png-grid.mjs`, `scripts/crop.mjs` and `scripts/tile-strip.mjs`.

## Character-sheet row map (Task 27 Step 0, D-19 2026-07-30)

**Provenance:** `docs/ASSETS.md` itself was created by Plan 6 Task 27
(commit `80c2485`, amended by `359cb9e`) to record this section — Task 27 ran
before Task 3 and needed the file to exist. Task 3 (this task) added "The four
packs" section above on top of it; everything from this heading to
end-of-file predates Task 3 and isn't part of its own capture — kept here
rather than duplicated or dropped, since it's already pixel-verified and this
is the one file both `assetManifest.ts` and the build scripts have always
cited.

Every separable character layer (Bodies, Eyes, Hairstyles, Outfits,
Accessories) ships as a sheet 656px tall — 20.5 rows of 32px, the half row
empty. The six populated rows, by pixel measurement:

| Row | Meaning |
|---|---|
| r0 | preview |
| r1 | idle |
| r2 | walk |
| r3 | **sleep** |
| r4 | sit (right: cols 0–5, left: cols 6–11) |
| r5 | sit (same layout as r4 — pixel-measured to carry both halves too) |

Both r4 and r5 carry a full sit-right-then-sit-left pair of six-frame halves
(pixel-measured, not eyeballed) — the pack ships the row twice. The runtime
only ever plays **r4**: `HUMAN_SHEET.rows.sit = 4` and `sitFrames()`
(`packages/client/src/game/assetManifest.ts`) read sit-right from r4 cols
0–5 and sit-left from r4 cols 6–11; r5 is never referenced by any texture
key baked or resolved by this plan. `scripts/gen-row-coverage.mjs` still
measures both rows for every layer (a pack update could, in principle, drop
art from one row and not the other), but only r4's coverage is load-bearing
for what actually renders today.

Bodies (and the four `Accessory_19_Party_Cone_*` sheets) ship 927px wide;
every other layer ships 896px wide — 56 whole 16px frames, where 927 is not
a multiple of 16. The extra 31 columns on Body sheets hold art only at rows
11–12 (lift/throw animations the contract never uses), so the adapter crops
`char_body` to 896 wide (Plan 1 Task 7) with no loss to anything the runtime
reads. `AppearanceComposer.composeSheet` sizes its canvas to
`floor(w / frameWidth) * frameWidth` (never the raw sheet size) as a guard
for packs whose sheets are not frame-aligned; on the real pack this floors
896 → 896 and 656 → 640 (20 whole rows), a no-op past the crop.

## Step 0 coverage measurement — full pack, no curated subset (D-19)

D-19 (2026-07-30) supersedes D-16's owner-pick-12/8: there is no hand-picked
dozen anymore, so every hair variant and every layer in use was sampled, not
a sample of them. Measured 2026-07-30 with `scripts/gen-row-coverage.mjs`:

| Layer | Files sampled | Rows checked | Result |
|---|---|---|---|
| Hairstyles | 200 (all) | r3 (sleep), r4, r5 (sit) | **0 excluded** — every sheet has art in all three rows |
| Outfits | 132 (all) | r4, r5 (sit only — see below) | **0 excluded** — every sheet has art in both sit rows |
| Eyes | 7 (all) | r4, r5 (sit) | 0 sit-row failures (no manifest to exclude from — see below) |
| Bodies | 9 (all) | r4, r5 (sit) | 0 sit-row failures (no manifest to exclude from — see below) |

**Outfits and eyes have ZERO sleep-row (r3) art in every sheet** — a
universal pack defect (or rather, intentional pack design: nobody sleeps in
their eyeglasses or their outfit), not a per-variant one, so r3 is **not**
an exclusion gate for outfits: a per-variant defect would exclude that one
variant, but "every single sheet lacks it" is a property of the LAYER, not
of any one variant, and the design decision below is what handles that.

### Automatic exclusion (D-19 mechanism) — result: nothing dropped, today

The gate: a **hair** variant is excluded if it lacks r3 OR r4 OR r5 art (hair
is the one non-body layer a sleep frame actually shows, so it alone is
sleep-gated). An **outfit** variant is excluded if it lacks r4 OR r5 art
(sleep is not a gate for outfits — see above). Both manifests
(`sources/limezu.variants.json`, `sources/limezu.variants.outfit.json`) were
regenerated via `node scripts/gen-variant-manifest.mjs --pack limezu` with
the (empty) exclude set this measurement produced —
**the regeneration is byte-identical to what was already committed**, i.e.
today's automatic exclusion drops **0 of 200** hair variants and **0 of
132** outfit variants. The manifests stay the full 29 styles / 200 hair
files and 33 styles / 132 outfit files. Re-running this step against a
changed or updated pack may drop some in the future; that is the mechanism
working as designed (`scripts/gen-variant-manifest.mjs`'s `--exclude-hair` /
`--exclude-outfit` flags), not a regression to chase down, and never a hand
swap.

### Bodies and eyes: measured, but nothing (yet) selects a variant of them

Bodies and eyes were sampled for r4/r5 too (0 failures each), but neither
has a *generated variant manifest* to exclude a failing file FROM: the
composer always reads the pack's aliased default file for `char_body` and,
as of this task, resolves eyes to a concrete sibling exactly like hair/
outfit (`Eyes_04.png` for `record.eyes === '04'`) rather than a tinted
default. The r4/r5 measurement across all 9 bodies and all 7 eyes exists so
a future per-body or new eye variant would have a coverage baseline to
check against, not because today's composer picks among them by coverage.

### Accessories: split, by family — exactly D-17's decision, now over every file

All 84 accessory files (19 families) were sampled for r3 (sleep) and r4/r5
(sit). **Sit rows: every accessory file passes**, same as every other
layer — no accessory is excluded from anything on sit-row grounds. Sleep-row
(r3) coverage is a genuine per-**family** split (every file within a family
agreed — no family was "mixed"):

| Has sleep art (r3) | Files | No sleep art (r3) | Files |
|---|---|---|---|
| Bataclava | 3 | Backpack | 10 |
| Beanie | 5 | Chef | 3 |
| Beard | 5 | Gloves | 4 |
| Bee | 3 | Medical_Mask | 5 |
| Bolt | 3 | Monocle | 3 |
| Detective_Hat | 3 | Party_Cone | 4 |
| Dino_Snapback | 3 | | |
| Glasses | 6 | | |
| Ladybug | 4 | | |
| Mustache | 5 | | |
| Policeman_Hat | 6 | | |
| Snapback | 6 | | |
| Zombie_Brain | 3 | | |

13 families (52 files) have sleep art; 6 families (29 files) do not. (This
list is a strict superset of the illustrative families named in the amended
plan text — `Bataclava`, `Bolt` and `Chef` are additional families the real
pack ships that weren't individually named there; the measurement here is
exhaustive over the actual 19, not the plan's illustrative subset.)

Accessories are a small fixed enum on `AppearanceRecord`
(`ACCESSORIES = ['none', 'cap', 'beanie', 'backpack', 'satchel']`), not a
pack-file-derived manifest, so there is nothing here to "exclude" the way a
hair or outfit variant can be — this table is a record of the finding, per
Step 0's instruction to document per-layer coverage even where no
manifest-editing action follows from it.

## Design decision (owner, final — D-17): sleep frames are body + hair only

**Composed sleep frames show body + hair, and nothing else.** Outfit and
eyes are absent by pack design (confirmed universal above, not a sampling
artifact), and the bed's blanket art covers the body in-scene, so the
missing layers never actually show on screen. Accessory families without
sleep art (Backpack, Chef, Gloves, Medical_Mask, Monocle, Party_Cone —
above) simply vanish in sleep frames — **accepted v1 behavior**: they are
removed at bedtime, which is arguably correct realism. `composeSheet` does
not special-case row r3 at all: blitting an empty row for outfit/eyes (and
for a no-sleep-art accessory) is the correct behavior, not a bug, so no
per-row branch exists in the composer for it. The owner verifies the
composed sleep look at the first localhost render checkpoint.

## Variant-axis mechanism (D-19, 2026-07-30)

Eyes, hair and outfit are all **sheet-selection** axes on the real pack, not
tints: the adapter aliases one index-0 sibling file per layer
(`Eyes_01.png`, `Hairstyle_01_01.png`, `Outfit_01_01.png`), and
`appearanceComposer.mjs`'s `resolveVariantFile` substitutes the record's own
style/variant into that same filename shape to resolve the concrete sibling
— single-stage for eyes (`_01` → `_04`), two-stage for hair and outfit
(`_01_01` → `_14_03`). One mechanism, generalized over how many numeric
segments the filename carries, not a separate implementation per layer.
`scripts/lib/spriteReader.mjs`'s `readSprite` grew an optional third
argument (`{ file }`) to carry that override — additive: every existing
two-argument call (including `pinFor`, which pins the DEFAULT file) is
unaffected.

## Party-cone width

The four `Accessory_19_Party_Cone_*` sheets are 927px wide, like Bodies —
confirmed by direct measurement (`927 656` for all four files). They are not
resolved via `resolveVariantFile` (accessory selection is presently the
fixed enum above, not a two-stage pack pick), but if a future task adds
per-accessory sheet resolution, `composeSheet`'s `Math.min(layer.w, out.w)`
blit clamp already handles the extra 31px of padding harmlessly — same as
it does for the body sheet.
