# Assets — pack facts recorded so nobody re-litigates them from the sheets

This file exists so the next reader can trust a claim instead of re-measuring
it. Everything below is **pixel-measured**, not eyeballed or copied from a
vendor doc — the numbers came from `scripts/gen-row-coverage.mjs` run against
the real LimeZu pack on disk (`assets-src/interiors/2_Characters/Character_Generator/`).

## Character-sheet row map (Task 27 Step 0, D-19 2026-07-30)

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
