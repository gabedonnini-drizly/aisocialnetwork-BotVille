# Art pack — requirements, evaluation and buy list

Research 2026-07-29. Prices read from itch.io buy rows that day; a 50%-ish sale
ended 17:10 UTC 2026-07-29, so post-sale figures are the ones that will apply
from now on.

---

## The buy

Four **separate** itch.io purchases, not a bundle. (A $5 LimeZu bundle exists —
it is Modern Interiors + two fantasy packs, with no Exteriors, Office or Farm.
Ignore it.)

| # | Pack | URL | Sale price | Normal |
|---|---|---|---|---|
| 1 | Modern Interiors **+ Character Generator 2.0** | https://limezu.itch.io/moderninteriors | $1.50 min | ~$3.00 |
| 2 | Modern Exteriors | https://limezu.itch.io/modernexteriors | $2.50 | $5.00 |
| 3 | Modern Office Revamped | https://limezu.itch.io/modernoffice | $2.50 | $5.00 |
| 4 | Modern Farm | https://limezu.itch.io/modernfarm | $4.95 | $7.50 |
| | **The four trees the pipeline requires** | | **$11.45** | **$20.50** |
| 5 | Modern User Interface + Portrait Generator | https://limezu.itch.io/modernuserinterface | $3.90 | $6.00 |
| 6 | Serene Village revamped | https://limezu.itch.io/serenevillagerevamped | free | free |

Modern Interiors is pay-what-you-want above a $1.50 gate; paying it unlocks
`Modern_Interiors_v41.4` (149 MB), the RPG Maker build, and **Character
Generator 2.0** (70 MB Win / 93 MB Linux). Pay more than the minimum — it
carries the entire character system.

**Why #5 is worth adding** even though the plans never mention it: its Portrait
Generator is *"fully synched with the Character Generator from Modern
Interiors"*, and every generated portrait ships **Talk (10 frames), Nod (10),
Shake-head (10)**. That is spec §6.3 / open decision 2 — pointing `users.avatar`
at a baked portrait — answered directly, with animation for a conversational
game.

`assets-src/` layout the pipeline expects: `exteriors/`, `interiors/`,
`farm/16x16/`, `office/`.

---

## Why LimeZu, and how thin the field is

itch.io game-asset tag counts, fetched 2026-07-29:

| Tag | Count |
|---|---|
| `fantasy` | **17,053** |
| `modern` | **908** |
| `modern` + `top-down` | **293** |

~19× more fantasy than modern, and the modern + top-down intersection is under
300 items *total* across all styles, tile sizes and quality tiers, including
free scraps and AI churn. Filtered to pixel-art, genuinely top-down,
multi-venue and maintained, it is realistically **under 15**. Modern-day *plus*
separable character layers is effectively a LimeZu monopoly — and the two
closest challengers are licence-disqualified for this project specifically (see
below).

**Venue coverage** is the widest available: 37 named interior types in Modern
Interiors alone (library, gym, grocery, bakery, hospital, jail, museum,
classroom, clothing store, TV studio, …), plus Subway/Train Station, Beach,
Garden, Graveyard, Post Office, Fire Station and Metropolis from Exteriors. That
covers every venue in the brief and roughly thirty more.

**Animation set** is the broadest in modern-day pixel art: idle, walk, run,
**sit**, **sleep**, phone, read book, pick up, lift, throw, gift, punch, shoot,
hurt, plus sprite emotes. 56×20 grid of 16×32 cells with a shipped
`spritesheet_animation_GUIDE`.

**Gaps:** no seasonal or weather variants at all. Sit is **side-facing only** —
which happens to match the venue descriptor's existing `side: 'right' | 'left'`
field. No true carry animation.

---

## U-1 resolved: separable character layers exist

**High confidence, documentary rather than first-hand.** The paid zip could not
be extracted during research.

The developer of the Character Generator, explaining its 13 GB size:

> *"its 13GB because it contains all different character pieces, body, eyes,
> outfit, hair, and all the accessories, as well as the 32x32 and 48x48 versions
> of them along with the regular 16x16 version, most other character generators
> don't include the actual sprites and require you to import them yourself which
> is why they're smaller"*

Corroborating evidence:

- LimeZu's own compositing instructions to non-RPG-Maker users: *"you import the
  files in the following order: body, outfit, hairstyle, then export the .png."*
  Only coherent if each part is a separate file — and it confirms you can
  composite at runtime in Phaser without the generator app.
- The `MV_Character_Generator` subset is documented as 182 hairstyle files, 20
  accessories, 6 eyes, 4 bodies, 53 outfits — enumerated as *files*.
- Third-party tools (e.g. `0a3r.itch.io/modern-interiors-character-generation-tool`)
  consume the extracted `Character_Generator` folder as layer input. Independent
  tools cannot composite layers that do not exist.
- Store page: *"create countless characters piece by piece (100+ outfits, 200
  hairstyles, 80 accessories and 9 skin colors)"*.

**Verify on arrival.** Per-layer QA has known historical defects: devlog 373
records fixing hairstyles whose colours mismatched on the Hurt animation, and
comments report sleep-frame offsets on some hairstyles and Accessory 13 missing
from some sit-left frames. **Check the chosen hair and accessory against the sit
and sleep rows specifically.**

Note the appearance-space arithmetic: "200 hairstyles" mixes style and colour
variants. Treated as independent layers, 9 skins × 200 hair × 100 outfits is
~180,000 before accessories. The spec's 691,200 target sits comfortably inside
that. The load-bearing fact is layer independence, which the evidence
establishes.

**Fallback if the layers turn out not to exist:**
[Cozy People](https://shubibubi.itch.io/cozy-people) ($3.99) — modern-casual,
confirmed layered, ships greyscale masks for runtime palette-swap. Weaker
animations, smaller sprites, no tileset. Not a substitute, but not zero.

---

## Tile size: 16, not 32

Recorded as decision D-7. The reasoning, since it will be re-litigated:

- **LimeZu's 32 and 48 exports are upscales of 16px art** (developer quote
  above). Rendering at 32 buys zero extra detail from this vendor.
- **Legibility is px-per-tile, not native grid.** At `INTERIOR_CAMERA_ZOOM = 2.4`
  a 16px tile already occupies 38 CSS px — the same screen footprint a 32px pack
  gives at zoom 1.2. Tile size changes neither agents-per-room (300 tiles ÷ 25
  agents ≈ 12 tiles each either way) nor label collision.
- **VRAM.** One 56×20 layer sheet is 896×640 (2.3 MB) at 16px vs 1792×1280
  (9.2 MB) at 32px. Across ~30 preloaded layers: **~69 MB vs ~275 MB** — a real
  mobile ceiling at 150 agents. A 2048² atlas holds 16,384 16px tiles or 4,096
  32px tiles.
- **Native 32px modern-day art with separable characters barely exists.** The
  only 32-native modern packs priced (Kauzz Modern+, Pixel Office) ship no
  modular characters at all.

What 32px would genuinely buy is art-pixel density — glasses, bags, logos. At
16×32 an agent carries ~3 readable colour fields plus silhouette, enough to
distinguish **~10–12 agents at a glance**. Past that you need labels or badges
at *any* tile size.

**The real legibility fix is the night tint, not the grid.** `DAY_TINT_KEYS`
reaches `0x0a0a2e` at alpha 0.45, which crushes 16px agents into near-identical
dark blobs, and `TINT_OVERLAY_DEPTH = 4000` sits above them. Exempt agents from
the tint or tint them at ~0.2.

Config changes: `TILE_SIZE` stays 16; `INTERIOR_CAMERA_ZOOM` 2.4 → **3**
(desktop) / **2** (mobile); `CAMERA.initialZoom` 1.8 → **2**; snap all zoom to
integers (`CAMERA.zoomStep: 1.3` and `CAMERA_FOCUS.zoom: 2.4` both land on
fractional values); `roundPixels` on, nearest-neighbour filtering. Non-integer
zoom renders some art pixels 2 screen px wide and others 3 — visibly uneven when
panning, and inertial panning is enabled.

---

## Evaluation checklist — run against any pack, in 15 minutes

**Run 0 first.** It is a 30-second filter that eliminated two of the four best
packs evaluated.

0. **Grep the licence for `AI`, `machine learning`, `NFT`, `blockchain`.**
   BotVille's agents are LLM-backed. Two strong candidates are unusable for that
   reason alone, and **neither says so on its itch store page** — the clause
   lives on the author's own site. Follow every "see full terms" link.
1. **Open the character folder — are body, hair, outfit and accessory separate
   PNGs?** If the only character art is `character_01.png` … `character_16.png`,
   the pack fails the highest-value requirement. Grep for a directory named
   `Character_Generator`, `parts`, `layers` or `paperdoll`.
2. **Do all layers share one canvas size and frame grid?** If hair is cropped to
   its bounding box you will hand-compute per-layer offsets forever.
3. **Do hair/outfit/accessory cover *every* animation row, not just walk?**
   Composite and step the whole sheet. **Check sit and sleep specifically.**
4. **Is there a documented frame map?** Without one you reverse-engineer a 56×20
   grid by eye.
5. **Count the non-locomotion animations** — sit, sleep, talk/phone, carry,
   emote, hurt. Walk + idle only is a downgrade on what BotVille already has.
6. **Count distinct interior venue types in the preview.** Under ~10 means
   reskinning one room. Target 20+.
7. **Is the art native at the target size, or upscaled?** Compare the 16px and
   32px versions of one sprite. Exact 2× blocks means you are paying for pixels,
   not detail.
8. **Check tile margin/spacing.** Kenney uses 1px between tiles; LimeZu uses 0.
   A mismatch causes bleed artifacts in WebGL.
9. **Read the licence file inside the zip, not the store page — they differ.**
   Confirm: commercial use, modification, how "redistribute" is worded,
   attribution required or merely appreciated.
10. **Search the licence for `per project`, `micro-transaction`, `encrypt`,
    `share-alike`, `RPG Maker`, `end product`.** Any hit needs reading in full.
11. **Check the itch info panel for the AI disclosure tag** — "No generative AI
    was used" vs "AI Assisted / AI Graphics". Many 2026-vintage modern-city packs
    are the latter. All four LimeZu packs carry the former, at 4.8–4.9 stars
    across 62–601 ratings.
12. **Check the last content devlog date and rating count.** Staleness is common.
13. **Estimate texture budget before buying:**
    `frame_w × frame_h × cols × rows × 4 bytes × layer_count`. Over ~150 MB VRAM
    and mobile will fail at 150 agents.
14. **Verify the free/demo tier matches the paid art.** Some free tiers are
    deliberately noise-filtered previews. LimeZu's free tier is a genuine sample
    but **excludes the Character Generator**.
15. **Confirm 4-direction coverage per animation, not per pack.**
16. **Confirm the purchase channel.** The same art carries different licences on
    itch vs Steam vs RPG Maker Web.

---

## Licence red flags

**Anti-AI clauses — disqualifying for this project.**
[Seliel the Shaper](https://selieltheshaper.weebly.com/user-license.html)
(Mana Seed Character Base, $19.98 — the best paper doll found; and Weather
Effects, $6 — the best weather overlay found):

> *"I do not consent for any of my art to be used in any machine learning
> datasets, nor used in a project alongside 'AI' generated imagery, writing,
> code, or anything else… please do not ask me if your use-case is special; it
> is not."*

[Kokoro Reflections](https://kokororeflections.com/terms-use/) (KR Urban Modern
Interiors, $19.99 — the best venue list after LimeZu, plus Hospital / High
School / Skyscraper companions):

> *"They are not for use in NFTs, blockchain, anything AI-related or any similar
> usage, whether in-game or otherwise. NO EXCEPTIONS!"*

and, separately disqualifying for a browser game:

> *"You may not post the assets themselves anywhere online for any reason. This
> may include repositories like Github. They must be included in a game."*

**Engine-restricted store variants.** finalbossblues assets are openly licensed
on itch but the Steam / RPG Maker Web SKUs are RPG-Maker-only per the RPG Maker
EULA. **Buy finalbossblues from itch.io only.**

**Share-alike contamination.** LPC art is CC-BY-SA; baking it into a shared
atlas alongside paid art arguably makes the atlas a derivative. Isolate it, or
prefer the CC0 `LPC Modern Streets`.

**Non-commercial free tiers that look usable.** Sprout Lands and Mystic Woods
free tiers both forbid commercial use, including derivatives.

**Unreadable licences.** Serene Village revamped renders its licence as an image
— read the `.txt` in the zip. VisuStella Urban City ($39.99) displays no terms
at all.

**LimeZu's own wording — the grey area that applies here.** Verbatim, identical
across all four packs:

> *"YOU CAN: Edit and use the asset in any commercial or non commercial project…
> YOU CAN'T: Resell or distribute the asset to others. Edit and resell the asset
> to others. Credits required (this link)."*

A browser game transmits sprite PNGs to every visitor, where they are
recoverable from the Network tab — factually a distribution, in a way a compiled
desktop build is not. The near-universal reading is that the clause targets
republishing the pack *as a pack*; otherwise every game built on these packs
would breach it, and the author actively promotes such games. **But the licence
does not address the web case in text.** This is unresolved as a legal matter
and nothing here is legal advice.

Mitigations, all explicitly permitted since modification is allowed:

- **Bake merged multi-source atlases so no shipped file mirrors the original
  pack layout** — which is exactly what the world bake already does.
- Never serve an original pack file verbatim at a guessable path.
- Ask LimeZu directly; he answers page comments routinely.
- **Honour the credit requirement** — a link to https://limezu.itch.io/ in the
  credits UI is mandatory, not optional. No plan task currently does this.

**For contrast, the clean end:** Kenney (CC0), Ninja Adventure (CC0),
finalbossblues on itch (*"no engine restrictions"*), Kauzz (*"any engine…
allowed"*).

---

## Rejected, with reasons

| Pack | Price | Why not |
|---|---|---|
| Mana Seed Character Base | $19.98 | Best animation set anywhere — sit on chair *and* floor, 4 sleep poses, climb, drink. **Anti-AI clause.** |
| KR Urban Modern Interiors | $19.99 | Best venue list after LimeZu. **Anti-AI clause + no-online-posting clause.** |
| Omega Modern Graphics Pack | $50.00 | **The only modern-day seasonal answer** — free winter tileset in *identical tile arrangement*, so a texture-key swap re-renders every map. Cleaner licence than LimeZu. But half the budget, a palette that won't sit beside LimeZu, and **premade characters — fails the layer requirement.** Revisit only if seasons become a hard requirement. |
| Kenney roguelike + Ninja Adventure | free | CC0, zero licence risk. Kenney's modular characters are **static single-frame poses**; Ninja Adventure is feudal-Japan. Prototype tier, not a shipping look. |
| Cute SCKR, amadeva Modern Town, bobmac321 | $2.99–3.99 | Seller-flagged "AI Assisted / AI Graphics". |

**Optional top-up if niche venues are wanted:**
[X Modern RPG Environment](https://finalbossblues.itch.io/x-modern-rpg-tile-asset-packs)
($8.00, 16px) covers exactly what LimeZu lacks — arcade, pinball, bowling, ball
pit, museum, pool hall, gym, bleachers, boxing ring. No characters. Its licence
text is not printed on the store page (site-wide terms are open; the `.txt`
ships in the zip) — unverified for that pack specifically.
