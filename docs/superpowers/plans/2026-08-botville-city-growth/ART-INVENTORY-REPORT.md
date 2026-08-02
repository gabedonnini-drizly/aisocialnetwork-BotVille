# ART INVENTORY REPORT — city-growth kickoff gate 2

**Written 2026-08-01**, executing `ART-BAKE-INVENTORY-PROMPT.md` (this
directory).

> **Gate 2 was already satisfied before this pass ran.** The art/bake
> inventory was done during the planning session and **independently
> verified exact** in the adversarial review — `DECISIONS.md:883`,
> `04-archetypes-and-bake.md:17`, `REVIEW-FINDINGS-2026-08-01.md:67` and
> `:189`. `00-KICKOFF-PROMPT.md:16-18` already records all three gates as
> resolved.
>
> `ART-BAKE-INVENTORY-PROMPT.md` (written 15:16) predates that work
> (`DECISIONS.md` 18:11, `04-` 17:56, `REVIEW-FINDINGS` 18:16) and was
> never retracted, so **its stated premises are stale**. This report does
> not re-run the inventory. It records what this pass actually found:
> three false premises corrected, one real defect located, and the bake
> gates verified by execution rather than assumption.

**Nothing here is blocked on the owner. No purchase is needed.**

---

## 1. The three premises, corrected

| Prompt's premise | Finding |
|---|---|
| "`inspect-assets.mjs` reports **8 MISSING source groups**… the zips sit in `assets-src/` partially unextracted" | **False.** Nothing is unextracted. All eight groups are present under their native LimeZu paths. The script reads retired paths — §2. |
| "`Modern_Interiors_RPG_Maker_Version.zip` looks like the **WRONG VARIANT**" | **False.** It is a *separate RPG-Maker-format bonus download* that ships alongside the 16×16 pack, not a mis-purchase. Its tree is `RPG_MAKER_MV/`, `RPG_MAKER_VX_ACE/`, `RPG_MAKER_XP/`. The 16×16 pack the bake reads is `moderninteriors-win.zip`, already extracted to `interiors/`. **Nothing to buy, nothing to re-download.** |
| "STOP AND ASK the owner for [pack variants]… never guess at purchases" | **No question to ask.** All four required 16×16 packs are present and complete. |

### The recorded inventory re-verified, a third time

Counted fresh this pass — every figure in `DECISIONS.md:883` reproduces
**exactly**:

| Measure | Recorded | This pass |
|---|---|---|
| Total files in `assets-src/` | 35,085 | **35,085** ✅ |
| Total PNGs | 34,078 | **34,078** ✅ |
| Modern Exteriors | 13,081 | **13,081** ✅ |
| Modern Interiors | 17,927 | **17,927** ✅ |
| Modern Farm | 2,411 | **2,411** ✅ |
| Modern Office | 355 | **355** ✅ |
| Exterior theme categories | 24 | **24** ✅ |
| Interior theme sets | 26 | **26** ✅ |

The four-pack PNG breakdown sums to 33,774; the remaining **304** are the
`ui-pack/` subtree — see §6.

---

## 2. The missing-groups table

All eight "missing" groups are the **legacy compatibility symlink paths
deliberately deleted in Plan 6 Task 3b** (`docs/ASSETS.md`, *"Re-recording
the golden baseline after the freeze"*). `inspect-assets.mjs` still reads
the link paths; the durable fix (`sources/limezu.json`'s `files` block)
moved every consumer to the packs' real paths. The script was never
updated with them.

| Reported group | Path the script reads (a deleted link) | Real path | State |
|---|---|---|---|
| Premade characters | `interiors/characters-premade` | `interiors/2_Characters/Character_Generator/0_Premade_Characters/16x16` | **present**, 20 PNGs |
| UI | `interiors/ui` | `interiors/4_User_Interface_Elements` | **present**, 6 PNGs |
| Room Builder (interiors) | `interiors/Room_Builder_16x16.png` | `interiors/1_Interiors/16x16/Room_Builder_16x16.png` | **present** |
| Room Builder (office) | `office/room-builder` | `office/1_Room_Builder_Office` | **present** |
| Exterior themes *(needed for district)* | `exteriors/themes` | `exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16` | **present**, 24 PNGs |
| Interior themes | `interiors/themes` | `interiors/1_Interiors/16x16/Theme_Sorter` | **present**, 26 PNGs |
| Animated interiors | `interiors/animated` | `interiors/3_Animated_objects/16x16/spritesheets` | **present**, 311 PNGs |
| Animated exteriors | `exteriors/animated` | `exteriors/Modern_Exteriors_16x16/Animated_16x16/Animated_sheets_16x16` | **present**, 453 PNGs |

**Resolved: 8 of 8. Blocked on owner: 0.** `find assets-src -maxdepth 2
-type l` returns **0** links, exactly as Task 3b intended.

The ninth deleted link, `office/singles` →
`office/4_Modern_Office_singles/16x16` (339 PNGs), is also absent-as-link
and present-as-real-path; `inspect-assets.mjs` does not read it, so it
never appeared in the missing count.

---

## 3. The one real defect — `scripts/inspect-assets.mjs` is stale

**The prompt calls this script "the inventory truth". It is not.** It is
Step-0 reconnaissance tooling from TZ-01 that predates the
`sources/limezu.json` rewrite, and it reports **8 false MISSINGs against a
complete, correctly-extracted pack**. That false signal is what put the
three wrong premises into `ART-BAKE-INVENTORY-PROMPT.md` in the first
place, and it will mislead the next reader identically.

Per the prompt's own scope (*"Its deliverable is a report, not code"*),
**this pass did not change it.** The fix is mechanical — replace the eight
link paths with the real ones from the table in §2:

| Line | Current | Should be |
|---|---|---|
| `:38` | `join(SRC, 'interiors', 'characters-premade')` | `interiors/2_Characters/Character_Generator/0_Premade_Characters/16x16` |
| `:50` | `join(SRC, 'interiors', 'ui')` | `interiors/4_User_Interface_Elements` |
| `:53` | `join(SRC, 'interiors', 'Room_Builder_16x16.png')` | `interiors/1_Interiors/16x16/Room_Builder_16x16.png` |
| `:54` | `join(SRC, 'office', 'room-builder')` | `office/1_Room_Builder_Office` |
| `:57` | `join(SRC, 'exteriors', 'themes')` | `exteriors/Modern_Exteriors_16x16/ME_Theme_Sorter_16x16` |
| `:66` | `join(SRC, 'interiors', 'themes')` | `interiors/1_Interiors/16x16/Theme_Sorter` |
| `:71` | `join(SRC, 'interiors', 'animated')` | `interiors/3_Animated_objects/16x16/spritesheets` |
| `:72` | `join(SRC, 'exteriors', 'animated')` | `exteriors/Modern_Exteriors_16x16/Animated_16x16/Animated_sheets_16x16` |

Recommended alongside: make `report()` **exit non-zero on a MISSING**, so
a stale path fails loudly instead of printing a line nobody reconciles.

---

## 4. Re-bake — verified by execution, all gates green

Run in `/Users/home/aisocialnetwork-BotVille` on **Node v24.18.0** (engines
say ≥24; the default shell is v22).

```
node scripts/sync-assets.mjs limezu assets-src
  → 28/28 sheet(s) copied from pack "limezu" (23 runtime + 5 animated)
npm run bake:world -- limezu assets-src
  → world bake OK: 2 atlases, 68 props, 18 venues
```

Matches the prompt's recorded state exactly (2 atlases, 68 props, 18
venues). No character source changed, so the agent bake was not re-run.

| Gate | Result |
|---|---|
| `venues.json` md5 byte-stable across the re-bake | ✅ `0859edd81fb0c6513a169e9404862424` before **and** after |
| `venues.lock.json` sha256 | ✅ `c552703455…7607fc`, count 18, unchanged |
| Standing limezu working-tree diff reproduces byte-identically | ✅ `git diff` md5 `e2e3afd4bda1dd744404bcd6196fa489` before **and** after — 21 files, 72 insertions, 41 deletions, unchanged |
| `BOTVILLE_PACK=limezu npm test` | ✅ **274 pass / 0 fail** (root) + **22 pass / 0 fail** (client) |

The diff-hash identity is the stronger result: the bake is **deterministic
and idempotent** against this pack, which is what makes the `venues.json`
stability claim trustworthy rather than incidental.

### `npm run test:bake` is red **by design** in an owner-local real-art tree

Not one of the prompt's gates, but worth recording so nobody reads it as a
regression. Two guards fail, and both are doing exactly their job against
the deliberate standing diff:

- `test/bake/tmj-fixture-geometry-guard.test.mjs` — *"`cafe.tmj` does not
  match a fixture bake — this looks like a real-pack (limezu) bake got
  committed by mistake."*
- `test/bake/zz-clean-tree.test.mjs` — *"tests modified tracked files."*

That is the I-12 artifact policy holding. **The standing diff was not
committed and not reverted.** The tree hash was re-checked after the test
run and after the contact sheets: unchanged.

---

## 5. Growth-venue capability

The kickoff's growth candidates were inventoried during planning and
verified in review — **not repeated here**. The authoritative lists are
`DECISIONS.md:883-889` and `04-archetypes-and-bake.md:17`, with eleven
sampled counts confirmed exact at `REVIEW-FINDINGS-2026-08-01.md:189-199`
(Garden 570, School 125, Swimming Pool 179, Floor Modular 343, `Tent` ×6,
`Mobile_House_{Small,Medium,Big}` ×8 each, `Villa_1..5`,
`Building_Skeleton` ×2, `Excavator` ×4, `Terraced_House_1..6`,
`One_Story_House`, `Country_House`, `Condo_1..9`).

That record's conclusion stands and this pass found nothing against it:
**the rate limiter is bake authoring, not art.**

### New this pass — D-37's noticeboard has no art by that name

The one growth candidate the review did **not** sample. Searched
`exteriors/`, `interiors/` and `office/` by filename for
`noticeboard`/`notice`/`bulletin`/`board`/`cork`/`poster`:

- **No noticeboard, bulletin board, cork board or poster board exists as a
  named file** in any of the three packs. The only interior hit is
  `Room_Builder_Baseboards_16x16.png` (skirting, not a board).
- Nearest exterior stand-ins, all real files:
  `ME_Singles_Garage_Sales_16x16_Signboard_1.png`,
  `ME_Singles_Vehicles_16x16_Bus_Stop_Sign_{1,2,3}.png`,
  `ME_Singles_Vehicles_16x16_Gas_Station_Price_Signboard_4.png`,
  `24_Additional_Houses_Haunted_House_Sign_1_16x16.png`.

**This does not block D-37.** The pipeline already solves exactly this
problem once: `library_building` is `hardware_single` plus a
`generated: "bookSign"` transform, because *"the pack has no bookstore
sign"* (`sources/limezu.json:411-415`). A noticeboard is the same shape of
work — a `generated:` stamp over `Signboard_1` — i.e. still three files and
no new code, consistent with `DECISIONS.md:889`.

**Stated limitation:** this is a *filename* search. The 24 exterior and 26
interior theme sheets are unnamed grids, so a notice board could exist
inside one (`3_City_Props_16x16.png` is the likeliest) without matching any
filename. Confirming that needs the visual pass in §7, not another grep.

---

## 6. Additions to the growth budget

### Serene Village (`Serene_Village_revamped_v1.9.zip`, 637 KB)

Present in `assets-src/`, **not referenced by `sources/limezu.json`, and
left unwired** as the prompt instructed. Inventoried from the zip index
without extracting:

- 36 files. The usable sheet is `Serene_Village_16x16.png` — **304×720 px =
  19×45 tiles** of 16px. Also ships at 32×32 and 48×48, plus RPG Maker
  MV/VX-ACE/XP conversions and a Construct 3 autotile sheet.
- `Animated stuff/`: campfire, door, water waves — each at 16/32/48 px, as
  both `.png` and `.gif`.
- **Caveat before anyone plans against it:** file dates are 2020-10 →
  2021-03, well before the Modern Exteriors revamp. It is a *rural village*
  tileset in an older LimeZu style — a **district-theme** candidate (a
  village outskirt reads as deliberately different), not a source of props
  to mix into the existing modern city. One 19×45 sheet is a small budget
  next to Modern Exteriors' 13,081 PNGs.

### `ui-pack/` — a fifth extracted subtree nothing reads

`modernuserinterface-win.zip` is extracted to `assets-src/ui-pack/` (**304
PNGs**) and is referenced by **nothing**: `sources/limezu.json` takes its UI
from `interiors/4_User_Interface_Elements/UI_16x16.png` instead. It
contains `Modern_UI_Style_1.png`, `Modern_UI_Style_2.png`,
`Modern_UI_Gamepad.png`, an `Animated/` set of button GIFs, and a whole
**`Portrait_Generator/`** tree (Skins, Eyes, Hairstyles, Accessories).

Not a growth blocker, but it is unbudgeted inventory: the portrait
generator in particular is a composable character-portrait axis that
nothing in the client uses today. Recorded, not proposed.

### Interior shadow variants

`interiors/1_Interiors/16x16/` ships `Theme_Sorter` alongside
`Theme_Sorter_Black_Shadow`, `Theme_Sorter_Shadowless` and
`Theme_Sorter_Shadowless_Singles`. The bake reads `Theme_Sorter` only. If
district-theme work ever wants shadowless compositing, the art is already
on disk.

---

## 7. Open owner actions

| # | Action | Blocking? |
|---|---|---|
| 1 | **Eyeball the contact sheets.** Regenerated this pass: `contact/district.html` + `contact/district.png` (32 district sprites), `contact/interior.html` + `contact/interior.png` (36 interior sprites). Open `contact/district.html`. `contact/` is gitignored and excluded from every Docker build context. | No — the visual pass is yours by design |
| 2 | **Approve the `inspect-assets.mjs` fix in §3.** Deliberately not made — the prompt scoped this pass to a report. Until it lands, the script keeps reporting 8 false MISSINGs. | No, but it is the one thing here that will re-cause this confusion |
| 3 | **Decide whether Serene Village becomes a district theme** (§6) or stays unwired. | No |
| 4 | Purchases / variant downloads | **None. Nothing to buy.** |

`generated:` props are a known blind spot in the contact sheet —
`contact-sheet.mjs` uses `spriteReader.readSprite`, which never applies a
`generated:` transform, so `library_building`'s "BOOKS" stamp does not
render there (`docs/ASSETS.md`, Step 6 review). If the D-37 noticeboard is
built as a `generated:` stamp per §5, **it will not appear in the contact
sheet either** — check the baked PNG directly.

---

## Gate status

**Gate 2 (art/bake inventory) — satisfied.** It was satisfied before this
pass by the planning session's inventory and the review's exact
verification; this report adds the correction of three false premises, one
located defect, the D-37 noticeboard finding, and an executed rather than
assumed verification of the bake gates.

No licensed bytes were committed, staged, or copied to a tracked path. The
standing limezu working-tree diff is untouched and byte-identical to how
this pass found it.
