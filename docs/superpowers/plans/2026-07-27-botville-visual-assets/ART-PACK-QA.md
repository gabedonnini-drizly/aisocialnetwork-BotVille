# Art pack QA — results

Run 2026-07-29 against the purchased LimeZu packs on disk. This is Track B of
`NEXT-SESSION-PROMPT.md`, and it **resolves U-1 and U-2**, the two questions the
spec deferred to Plan 6 Task 3.

**Headline: everything works. BotVille renders for the first time.**

---

## What was extracted, and where

Only the **16×16** subsets — tile size is locked at 16 (D-7) and the 32/48
exports are upscales of the same art.

| Zip | Extracted to | Size |
|---|---|---|
| `moderninteriors-win.zip` | `assets-src/interiors/` | 153 MB |
| `modernexteriors-win.zip` | `assets-src/exteriors/` | 89 MB |
| `Modern_Farm_v1.2.zip` | `assets-src/farm/` | 17 MB |
| `Modern_Office_Revamped_v1.2.zip` | `assets-src/office/` | 2.7 MB |
| `modernuserinterface-win.zip` | `assets-src/ui-pack/` | 1.4 MB |

Deliberately **not** extracted: all 32×32 and 48×48 variants, `2_Characters/Old/`,
`6_Home_Designs/`, and `OLD.zip`. The Character Generator and Portrait Generator
application builds (`.exe` / Linux `.zip`) are left packed — they are GUI tools,
and the sprite layers they compose from are already extracted.

The original zips remain in `assets-src/`, plus the owner's own `backup/` copy.
All of it is gitignored via `.gitignore:21`.

---

## The layout mismatch, and the fix

**The paths `sync-assets.mjs` expects are a hand-made reorganisation by the
previous author, not the packs' native structure.** `interiors/themes/` does not
exist in any LimeZu download; the pack ships `1_Interiors/16x16/Theme_Sorter/`.

Rather than restructure ~53,000 files — which would have to be redone on every
pack update — the native trees are preserved and a thin **symlink compatibility
layer** maps the expected names onto them:

| Expected path | Symlink target |
|---|---|
| `interiors/themes` | `1_Interiors/16x16/Theme_Sorter` |
| `interiors/Room_Builder_16x16.png` | `1_Interiors/16x16/Room_Builder_16x16.png` |
| `interiors/animated` | `3_Animated_objects/16x16/spritesheets` |
| `interiors/ui` | `4_User_Interface_Elements` |
| `interiors/characters-premade` | `2_Characters/Character_Generator/0_Premade_Characters/16x16` |
| `exteriors/themes` | `Modern_Exteriors_16x16/ME_Theme_Sorter_16x16` |
| `exteriors/animated` | `Modern_Exteriors_16x16/Animated_16x16/Animated_sheets_16x16` |
| `office/singles` | `4_Modern_Office_singles/16x16` |
| `office/room-builder` | `1_Room_Builder_Office` |
| `farm/16x16` | *(already correct — the Farm zip ships `16x16/` at its root)* |

All links are relative, so the tree stays portable.

**This is a stopgap.** The durable fix is Plan 1 Tasks 5–7: put the *real* paths
in `sources/limezu.json`'s `files` block, where pack specifics belong (I-1), and
drop the symlinks. The symlinks exist so the **legacy** pipeline runs today —
which is what Task 3's golden baseline needs.

---

## Verification results

**`node scripts/sync-assets.mjs` → `скопировано 90/90`.** Every file resolves;
nothing missing.

> Correction to the plans: Plan 6 Task 3 Step 3 expects `110/110`. The real
> number is **90**. This confirms `REVIEW-FINDINGS.md` F-27 — the plans also
> describe the script as holding "59 hardcoded pairs" when it is 61 literal
> pairs expanding to 90 files at runtime.

**`node scripts/build-district.mjs`** → `district.tmj: 48x46, атлас 23 тайлов,
объектов: 272`, plus `villa_building.png: 140x224` and the generated
`library_building.png` "BOOKS" sign.

**`node scripts/build-interiors.mjs`** → all 27 furniture sprites cropped, and
`office.tmj` (16 furniture / 4 seats), `cafe.tmj` (18 / 9), `dorm.tmj` (13 / 6),
`library.tmj` (19 / 4).

**121 PNGs and 5 tilemaps generated.**

### The strongest result: the tilemaps are byte-identical to what is committed

`.tmj` files are tracked in git. After regenerating all five,
`git status --porcelain` shows **only the pre-existing `package-lock.json`**.

That means: the purchased art is the same version the original author used,
every crop coordinate in the build scripts is still valid, and the legacy
pipeline is deterministic. **Plan 6 Task 3 Step 10's determinism check has
effectively already passed**, and the risk that a pack update had silently
shifted a sheet — the risk the whole pin mechanism exists to catch — did not
materialise.

---

## U-1 — separable character layers: **CONFIRMED**

No longer documentary. `interiors/2_Characters/Character_Generator/` contains
one directory per part, each holding independent 16×16 PNGs:

| Layer | 16×16 files |
|---|---|
| Bodies | 9 |
| Eyes | 7 |
| Hairstyles | **200** |
| Outfits | **132** |
| Accessories | **84** |
| Premade characters | 20 |

Also present and unused so far: `Bodies_kids`, `Eyes_kids`, `Hairstyles_kids`,
`Outfits_kids`, `Books`, `Smartphones`.

**Layers align and stack at (0, 0).** Frame-0 bounding boxes inside the 16×32
cell are anatomically consistent:

```
body    x1-13  y10-31   210 px
eyes    x11-11 y20-21     2 px
hair    x1-13  y10-21   102 px
outfit  x4-11  y24-31    42 px
```

**Consequences for the plans:**

- `capabilities.characterLayers` must be **`true`** in `sources/limezu.json` from
  Plan 1 Task 5 — not `false` with a flip in Plan 6 Task 3 thirty-four tasks
  later. Task 27's layered path is the one that ships.
- The five `char_*` slots in Task 7 must point at **five different files**
  (`Bodies/`, `Eyes/`, `Hairstyles/`, `Outfits/`, `Accessories/`), not five
  copies of one premade sheet.
- The contract's `characters.parts` is `["body","hair","top","bottom","accessory"]`.
  The pack's real parts are **body / eyes / hair / outfit / accessory** — there
  is no separate top-and-bottom split; `Outfits` is one garment layer. The
  contract and `AppearanceRecord` need reconciling with that: either merge
  `top`/`bottom` into one `outfit` axis, or keep both and accept that they
  select from the same sheet.

### Defect found: body sheets are 927×656, every other layer is 896×656

All 9 bodies are **31px wider** than every other layer, and those columns are
not empty — `Body_01` holds **600 opaque pixels in columns 896–926**. 31 is not
a multiple of 16, so it is not an extra frame column; it looks like an authoring
strip.

Task 27's `composeSheet` sizes its output canvas from `parts[0]` — the body —
and blits the rest at `(0,0)`. That would produce a 927px-wide sheet with a
31px band of stray body pixels down the right edge that nothing covers.

**Fix: crop body layers to 896 wide before compositing**, and assert layer
dimensions match in `ContractValidator`. This is exactly what checklist item 2
exists to catch.

**Still to verify:** whether hair and accessory layers cover the **sit and sleep**
rows. Known historical defects (mismatched hair colours on Hurt frames,
sleep-frame offsets, Accessory 13 missing from some sit-left frames) mean this
needs a per-row check before Task 27 is built.

---

## U-2 — the licence: **read, and clean for this project**

Text shipped inside the zips, verbatim.

**Modern Interiors:**
> YOU CAN: Edit and use the asset in any commercial or non commercial project /
> Use the asset in any commercial or non commercial project
> YOU CAN'T: Resell or distribute the asset to others / Edit and resell the
> asset to others
> **Credits required (limezu.itch.io)**

**Modern Farm** — same, except: **"Credits much appreciated"** — *requested,
not required*.

**Modern User Interface** — same, plus an **NFT carve-out not shown on the store
page**: *"Edit and use the asset in any commercial or non commercial project,
expect [sic] NFT minting"*. Credits required, no link specified.

**Modern Exteriors** ships `Modern_Exteriors_License.pdf` rather than a `.txt` —
not yet read.

**The check that mattered: there is no anti-AI clause in any of them.** No
mention of AI, machine learning, training, or datasets. That was checklist item
0, and it is what disqualified Mana Seed and Kokoro Reflections. **BotVille is
clear.**

Neither is there any mention of web or browser delivery, so the grey area
recorded in `ART-PACK.md` stands unchanged — as does its mitigation, which the
world bake already implements by construction.

**Obligation:** a credit link to `limezu.itch.io` in the UI, required by
Interiors and UI. No plan task currently does this.

---

## What this changes

| Finding | Effect |
|---|---|
| U-1 confirmed | `characterLayers: true` from Task 5; Task 7's `char_*` slots point at five real directories; Task 3 Step 7 becomes a formality |
| U-2 read, no AI clause | Spec R-2 / O-5 resolved on the AI question; browser-delivery grey area unchanged |
| Tilemaps byte-identical | Task 3 Step 10 effectively passed; Task 20 Tier 1 has a trustworthy baseline |
| `90/90`, not `110/110` | Task 3 Step 3 expectation corrected |
| Native layout ≠ expected layout | Tasks 5–7 `files` blocks must use real paths; symlinks are a stopgap |
| Body sheets 927 vs 896 | New requirement on Task 27 and `ContractValidator` |
| Pack parts are body/eyes/hair/outfit/accessory | Contract `characters.parts` and `AppearanceRecord` need reconciling |
