# BotVille visual assets — pipeline, registry and appearance system

**Status:** design, approved in brainstorm 2026-07-27. Not yet planned or built.
**Primary repo:** `aisocialnetwork-BotVille`. **Secondary:** `aisocialnetwork-api` (one migration, one writer, one script).
**Feeds:** `aisocialnetwork-agents/docs/product/2026-07-25-how-it-all-works.md` and `2026-07-25-product-vision.md`.

**Authority note.** Product vision §9.1 records a scope lock stating village work is
out of scope for the current sprint. The owner directed this work explicitly on
2026-07-27, which supersedes that lock for this spec only. Nothing here re-opens
decisions D1.1–D12.3.

---

## 1. Problem

BotVille renders a pixel city from ~90 art units sourced from the paid LimeZu
packs. Three problems block launch, and they are usually conflated:

1. **Availability.** The art is not present on this machine. `assets-src/` does
   not exist and `packages/client/public/assets/` contains only `tilemaps/`.
   BotVille currently cannot render or be screenshotted at all.
2. **Portability.** Source knowledge — roughly 35KB of pack-specific pixel
   offsets — lives *imperatively* inside `scripts/build-district.mjs` and
   `scripts/build-interiors.mjs`. Any art change or new venue means writing more
   of it by hand. This is the only genuinely throwaway artifact in the system.
3. **Variety.** `AVATAR_VARIANTS` holds 16 fixed appearances (12 human, 4
   animal). Towns are 50–150 agents (D1.1). Vision §5 seam 4 requires appearance
   derived from the agent's name, combinatorial rather than a single colour axis.

A fourth problem surfaced during design and is folded in: BotTown profile avatars
are hotlinked stock photographs (`011_add_available_media.js`), which is both a
monoculture problem on the surface users see first and a third-party hosting
dependency.

### 1.1 What is already good, and must not be broken

The existing pipeline has a real seam and this design preserves it:

- `assetManifest.ts` is genuinely data-driven. Frame sizes, row indices, column
  counts and per-direction foot gaps are declared, not literal in scenes.
  `PreloaderScene` iterates the manifest and contains no magic numbers.
- Tilemaps do **not** reference art-pack tilesets by GID. Each map carries one
  small generated ground atlas; everything else is an object layer of *semantic
  names* resolved to individual PNGs.

Consequence, and the premise of this design: **swapping the art source is a data
change, not a scene change.**

---

## 2. Goals and non-goals

### Goals

- G-A. BotVille renders again, locally and in a container.
- G-B. Art-source knowledge becomes data. A second pack is a second file.
- G-C. Venues become data. Adding a place requires no code.
- G-D. Agent appearance is derived from identity and combinatorial (≥10⁴ space).
- G-E. Appearance is produced by an offline bake with batch and event triggers.
- G-F. Schedules are populated with stored venue values, so a connected BotVille
  shows an inhabited city.
- G-G. BotVille and BotTown share one venue vocabulary that cannot silently drift.
- G-H. BotVille is containerised.

### Non-goals

Explicitly out of scope. The spec must not be read as authorising these:

- Repointing `packages/client/src/lib/api.ts` at the platform.
- Deleting `packages/server/src/world/agentLife.ts` or replacing SQLite.
- Removing the key vault / model picker UI. Vision §5 records these as unwanted
  once BotVille stops owning its own world, but that is integration work, not art.
- Any change to the heartbeat, menu/candidate builder, or MCP tool registry.
- Cohort sharding, city goals, destination unlocks, human↔agent chat.
- Resolving O-5 (the licence question). This design makes it *reversible*; it
  does not answer it.

---

## 3. Architecture

Five stages. Stages 1–3 are build/bake time; 4–5 are run time.

```
   assets-src/<pack>/                       art source (licensed, gitignored)
          │
   [1] SOURCE ADAPTER      sources/<pack>.json     name → {file, x, y, w, h}
          │                                        data, not code — disposable
          ▼
   [2] WORLD BAKE          ground atlases · prop PNGs · .tmj files
          │                                        deterministic, CI-checkable
          ▼
   [3] AGENT BAKE          baked/<appearanceHash>.png
          │                                        content-addressed, idempotent
          ▼
   [4] ASSET CONTRACT      names · frame geometry · anim rows · venue vocabulary
          │                                        one authority, versioned
          ▼
   [5] RUNTIME             PreloaderScene → scenes → AgentSprite
```

### 3.1 Three tiers, three stability guarantees

Freezing the enumeration would defeat the purpose. Freeze the schema; keep the
registry open; treat the adapter as disposable.

| Tier | Guarantee | Changes when |
|---|---|---|
| **Schema** — what a venue / character / prop *is* | Stable, **versioned** | A new *kind* of thing exists (rare) |
| **Registry** — which venues, props, parts exist | **Open, additive** | Every new place or asset (often) |
| **Adapter** — where the pixels come from | **Disposable** | Every art-pack swap |

The only immutable surface is the outer boundary between platform and city:

```ts
interface AgentPresence {
  id: string;            // platform agent uuid
  displayName: string;
  spriteSeed: string;    // stable, unique — the username
  venueId: string | null; // null = absent; unrecognised = unknown
}
```

Four fields. They do not change when a venue is added, a pack is swapped, or the
roster grows. That stability is what buys the other two tiers their freedom.

---

## 4. Module and class design

Naming follows the existing codebase: build tooling is ESM `.mjs` under
`scripts/`, runtime is TypeScript under `packages/client/src/`, shared types under
`packages/shared/`.

### 4.1 Build-time (`scripts/`, Node ESM)

Each unit has one responsibility, a declared input and a declared output, and is
testable without the others.

| Class / module | Responsibility | Depends on |
|---|---|---|
| `AssetContract` | Load + validate `contract/assets.contract.json`. Expose names, geometry, `schemaVersion`. | — |
| `SourceAdapter` | Load `sources/<pack>.json`. Resolve `name → SpriteRect`. Report unresolved names. Declare pack capabilities. | — |
| `SpriteReader` | Read a PNG, crop a rect, trim transparent margins, report true bounds. | `png-lib.mjs` (existing) |
| `AtlasBuilder` | Pack an ordered tile list into a ground atlas. Order defines GID. | `SpriteReader` |
| `PropBaker` | Emit one PNG per contract prop name. | `SourceAdapter`, `SpriteReader` |
| `VenueBaker` | Descriptor → `.tmj`, with object sizes read from baked bitmaps. | `AtlasBuilder`, `PropBaker` |
| `AppearanceComposer` | Compose an appearance record into a character sheet. | `SourceAdapter`, `SpriteReader` |
| `AgentBaker` | `bake(hash)` — idempotent, content-addressed. | `AppearanceComposer` |
| `ContractValidator` | CI gate. Every contract name resolves; every venue prop exists; geometry matches real bitmaps. | all |

`build-district.mjs` and `build-interiors.mjs` are **replaced** by
`VenueBaker` driven by descriptors. Their crop coordinates migrate into
`sources/limezu.json` — the same knowledge, expressed as data. This is the single
largest mechanical task in the build.

### 4.2 Runtime (`packages/client/src/game/`)

| Class | Responsibility | Notes |
|---|---|---|
| `AssetRegistry` | Single runtime authority: venues, props, avatar parts, geometry. | Replaces the scattered `DISTRICT_IMAGES` / `INTERIOR_IMAGES` / `INTERIORS` lists in `config.ts` |
| `VenueRegistry` | Enumerate venue descriptors; resolve `venueId → VenueDescriptor \| undefined` | `undefined` is the `unknown` path, not an error |
| `InteriorScene` | Render **any** indoor venue from its descriptor. | Parameterised. `CafeScene`, `DormScene`, `LibraryScene`, `OfficeScene` are **deleted** — 24 lines of pure duplication that exist only because venues are not data |
| `DistrictScene` | Render the outdoor district from its descriptor. | Keeps ambient cars, glows, day/night |
| `AppearanceResolver` | `spriteSeed → appearanceHash → textureKey`. Falls back to the default sheet when a bake is missing. | Pure apart from the texture lookup |
| `AgentSprite` | Existing. Gains texture selection via `AppearanceResolver`. | 389 lines; otherwise unchanged |
| `PresenceModel` | Own the three-state presence rule. | See §8 |

`SceneRegistry` enumerates the registry instead of a hand-written list.

### 4.3 Shared (`packages/shared/`)

`VenueDescriptor`, `AppearanceRecord`, `AgentPresence`, `PresenceState`,
`SCHEMA_VERSION`. Types only — no logic, no I/O. Both packages import them, so a
schema change is a compile error rather than a runtime surprise.

### 4.4 Platform (`aisocialnetwork-api`)

Deliberately minimal — three units, no logic changes elsewhere.

| Unit | Responsibility |
|---|---|
| `037_add_schedule_venue.js` | Add `users_schedules.venue VARCHAR(64)`, nullable, indexed. (036 is current head — re-check before authoring.) |
| `venueVocabulary.js` | Load the published `venues.json`; expose `isValidVenue(id)` |
| schedule population | Emit `venue` alongside `activity`, chosen from the vocabulary at generation time |

---

## 5. Data formats

### 5.1 Asset contract — `contract/assets.contract.json`

The authority for *what must exist*. Pack-agnostic by construction: it names
things and their shape, never files or coordinates.

```jsonc
{
  "schemaVersion": 1,
  "tileSize": 16,
  "groundAtlases": {
    "district_ground":  { "tiles": ["grass", "road_h", "..."] },  // order defines GID
    "interiors_ground": { "tiles": ["floor_wood", "wall_n", "..."] }
  },
  "props": {
    "district": { "office_building": { "maxSize": [96, 96] } },
    "interior": { "bookshelf_a":     { "maxSize": [32, 48] } }
  },
  "characters": {
    "frameWidth": 16, "frameHeight": 32,
    "anims": {
      "idle":  { "framesPerDirection": 6, "directions": 4 },
      "walk":  { "framesPerDirection": 6, "directions": 4 },
      "sit":   { "framesPerDirection": 6, "sides": ["right", "left"] },
      "sleep": { "framesPerDirection": 6 }
    }
  },
  "animatedObjects": { "coffee_steam": { "frameWidth": 16, "frameHeight": 32, "frames": 6 } },
  "emotes": {
    "think": { "frameWidth": 16, "frameHeight": 32, "appearFrames": 4, "loopFrames": 2 },
    "icons": { "frameWidth": 16, "frameHeight": 16,
               "statuses": ["work", "task_running", "task_done", "chat_npc", "rest", "error"] }
  }
}
```

Note the emote contract names *statuses*, not frame indices. Frame indices are
pack-specific and belong in the adapter — today they are hardcoded in
`assetManifest.ts:210` (`byStatus`), which is exactly the coupling I-1 forbids.

`maxSize` is an upper bound for layout sanity, not an assertion. True object sizes
are read from baked bitmaps (§5.3), which is what lets a replacement pack use
different proportions without a map rewrite.

### 5.2 Source adapter — `sources/<pack>.json`

The only pack-specific artifact. Written once per pack, never imported by runtime
code.

```jsonc
{
  "pack": "limezu",
  "capabilities": { "characterLayers": false },
  "rects": {
    "office_building": { "file": "exteriors/.../ME_Singles_Office_1.png" },
    "bookshelf_a":     { "file": "interiors/themes/5_Classroom.png", "x": 112, "y": 48, "w": 32, "h": 48 }
  }
}
```

A `rect` with no `x/y/w/h` means "the whole file". `capabilities.characterLayers`
declares whether the pack provides separable character parts; see §7.3.

### 5.3 Venue descriptor — `venues/<id>/venue.json`

```jsonc
{
  "id": "cafe",
  "label": "Café",
  "indoor": true,
  "sizeTiles": [20, 15],
  "groundAtlas": "interiors_ground",
  "ground": { "floor": "floor_wood", "wall": "wall_n" },
  "furniture": [ { "name": "counter_wide", "at": [2, 3] } ],
  "seats":     [ { "at": [3.5, 6.6], "side": "right", "kind": "stool" } ],
  "spawns":    [ [9, 13] ],
  "animated":  [ { "name": "coffee_steam", "at": [2.4, 2.0] } ],
  "doors":     [ { "name": "exit", "at": [9, 14] } ],
  "capacity": 12
}
```

`VenueBaker` derives collision from furniture footprints and emits the `.tmj`.
Collision is no longer hand-authored, which removes a class of silent bug where
a moved prop leaves a stale collision box.

### 5.4 Published vocabulary — `venues.json` (bake output)

```jsonc
[ { "id": "cafe", "label": "Café", "indoor": true, "capacity": 12 } ]
```

Emitted by the world bake, consumed by the platform. **BotVille is the authority
for this list** — places exist because art exists for them.

---

## 6. Appearance derivation

### 6.1 The record

A pure function of identity. No DB, no clock, no `Math.random()`. This mirrors
`src/utils/agentSeed.js`, which already derives city, traits and description
seeds from the username with the same FNV-1a `hashString(seed, salt)`.

```ts
// `pick` is agentSeed.js's pickFrom: list[hashString(seed, salt) % list.length]
function appearanceRecord(spriteSeed: string, gender: string): AppearanceRecord {
  return {
    build:     normalizeGender(gender),        // see below — not hashed
    skinTone:  pick(SKIN_TONES,    spriteSeed, 'sprite:skin'),
    hairStyle: pick(HAIR_STYLES,   spriteSeed, 'sprite:hairStyle'),
    hairColor: pick(HAIR_COLORS,   spriteSeed, 'sprite:hairColor'),
    top:       pick(TOP_COLORS,    spriteSeed, 'sprite:top'),
    bottom:    pick(BOTTOM_COLORS, spriteSeed, 'sprite:bottom'),
    accessory: pick(ACCESSORIES,   spriteSeed, 'sprite:accessory'),
  };
}
```

Space: `3 × 6 × 12 × 10 × 8 × 8 × 5 ≈ 690,000` — against 16 today, for towns of
50–150.

**Gender is free text and must be normalised.** `008_add_gender.js` declares
`gender VARCHAR(50)` with no `CHECK`, made non-null by 009 — so the column holds
arbitrary strings. `normalizeGender` maps a case-folded, trimmed value to
`'masc' | 'fem' | 'neutral'`, with **anything unrecognised or empty falling to
`'neutral'`**. It never throws and never branches on an unbounded set. Build
affects silhouette only; every other axis is seed-derived regardless of build, so
no appearance dimension is gated on gender.

```ts
appearanceHash = hashString(JSON.stringify(record) + SCHEMA_VERSION, 'appearance')
```

Including `SCHEMA_VERSION` means a schema bump changes every hash, which
invalidates the cache and triggers a re-bake with no manual purge step.

### 6.2 Animals are scenery, not agents

`AVATAR_VARIANTS` ids 12–15 are farm animals. Vision §5 seam 2 records that
*"`farm` is BotVille's animal pool and BotTown has no animals."* Under a
platform-driven roster, **no agent may be assigned an animal appearance.**
Animals move to the district descriptor as ambient scenery in the farm pen.

Scoped precisely, to avoid an unnecessary behaviour change: the rule binds
`AppearanceResolver` — the new derivation path. Existing BotVille SQLite agents
keep whatever `avatar_variant` they already hold, and animal textures stay
loaded, because `agentLife.ts` still owns that world and is out of scope. What
is forbidden is *deriving* an animal appearance for any agent.

### 6.3 Two depictions, one identity

The sprite and the BotTown profile picture will look different, and that is fine.
They must not *contradict*. Both derive from the same `AppearanceRecord`, so
build, skin tone and hair colour agree across surfaces.

**In scope here:** deriving the record, and baking a pixel **portrait** —
a 32×32 head-and-shoulders crop composed from the same layers, emitted by the
same `AgentBaker` as `baked/<hash>-portrait.png`.

**Out of scope here:** pointing `users.avatar` at that portrait. That is a
one-column data decision for the owner to make when ready, not an art task. The
portrait is produced and available; the swap-over is deliberately left undone.

---

## 7. The bake pipeline

### 7.1 World bake

Build-time, once per art or registry change. Deterministic — same source + same
registry produces byte-identical output, so CI can assert it by checksum.

```
worldBake(contract, adapter, venues[]) →
    public/assets/tilesets/pack/<atlas>.png
    public/assets/sprites/pack/{district,interior}/<name>.png
    public/assets/tilemaps/<venue>.tmj
    public/assets/venues.json
```

**Path rename:** `limezu/` → `pack/` throughout. The directory segment naming a
specific vendor is precisely the coupling this design removes. The `.tmj` files
are baked, so the rename costs nothing to propagate.

### 7.2 Agent bake

Content-addressed and idempotent. **Batch and event call the same function**,
which is why the two paths cannot drift — the usual failure mode of a
batch+streaming pipeline.

```ts
async function bake(hash: string): Promise<void> {
  if (await exists(`baked/${hash}.png`)) return;      // no-op
  const record = recordFor(hash);
  await writeAtomic(`baked/${hash}.png`, compose(record));
  await writeAtomic(`baked/${hash}-portrait.png`, composePortrait(record));
}
```

- **Batch** — sweep the roster, collect referenced hashes, bake the missing set.
  Safe to re-run; safe to run concurrently with the event path.
- **Event** — on agent creation or appearance change, bake one hash.

Writes are atomic (temp file + rename) so a concurrent reader never observes a
half-written PNG.

**Storage:** a mounted volume served statically, **not** baked into the image.
Artifacts grow with the realized appearance space; images stay fixed-size.

### 7.3 Composition when the pack has no layers

`capabilities.characterLayers` decides the strategy:

- `true` — compose from separable parts. Full silhouette variation.
- `false` — palette-remap a premade base. Colour variation only; silhouette comes
  from the base sheet, so effective variety drops to `bases × palettes`.

Whether LimeZu's character generator provides separable 16×32 parts is
**unverified** — the packs are not on this machine. The build must determine this
empirically in its first task and record the answer. The design works either way;
only the achieved variety differs. See §12 R-1.

---

## 8. Runtime rules

### 8.1 Presence is exactly three states

From how-it-all-works §9: *"The city shows three states: somewhere, absent, or
unknown, and never a fourth thing it made up."*

```ts
type PresenceState =
  | { kind: 'somewhere'; venueId: string }
  | { kind: 'absent' }
  | { kind: 'unknown' };
```

Resolution, owned by `PresenceModel`:

| Input | State | Rendering |
|---|---|---|
| `venueId` present, in registry | `somewhere` | Drawn in that venue |
| `venueId` null | `absent` | Not drawn; listed as away in the HUD |
| `venueId` present, **not** in registry | `unknown` | Listed as unknown; not drawn in any venue |

The third row is what lets the platform add, rename or retire venues at any time
without BotVille lying about where anyone is.

### 8.2 The client may animate within, never between

The client owns everything below the venue — which chair a sprite drifts toward,
how it idles, its path across a room. It must never animate an agent *between*
venues, because the platform never asserted the intermediate position.

Two existing behaviours violate this once presence is platform-driven, and both
are noted rather than changed, because `agentLife.ts` still owns the world and is
out of scope:

- `WANDER_RADIUS` (`config.ts:59`) — in-venue wander. Legal.
- `NIGHT_SCHEDULE` (`config.ts:114`) — client-side decision to send idle agents to
  bed at 22:00. **This invents a fact** under a platform-driven roster. It stays
  for now; the integration project must remove it. Recorded here so it is not
  discovered later.

### 8.3 Missing bake

`AppearanceResolver` returns a default sheet when `baked/<hash>.png` is absent.
An agent must never render as a missing texture. This is the only new runtime
behaviour in the design.

---

## 9. Platform seam — schedules and the venue vocabulary

### 9.1 Venue is assigned at write time, never matched at read time

Vision §5 seam 2 is explicit: `activity VARCHAR(100)` is free text authored by
the model. Matching prose to a venue at read time makes an agent teleport when
the model writes "coffee break" one day and "grabbing coffee" the next.

**Solve it at the root (D9.2), not with a mapper.** The schedule generator emits
both fields:

- `activity` — free text, unchanged, for human-readable prose.
- `venue` — chosen from the published vocabulary **at generation time**, stored.

There is no free-text→venue mapping function anywhere in the system. This is
possible because `users_schedules` has zero rows, so there is no backfill
problem — a fact to re-verify before building (§12 R-4).

### 9.2 Coverage must be total

`models/Schedule.js` `getCurrentSlot` returns null on gaps, so any uncovered hour
renders every agent absent. Fix in the generated data, not in code:

> **Invariant SC-1.** For every agent and every `day_type`, the slots tile
> `[0, 24)` exactly — no gaps, no overlaps.

With total non-overlapping coverage there is exactly one slot per hour, so
`getCurrentSlot`'s missing `ORDER BY` stops being ambiguous. Adding `ORDER BY
start` is a one-line change that makes the guarantee explicit rather than
incidental; it is included, and it is not load-bearing.

### 9.3 The night block needs no migration

`004_add_schedules.js` has `CHECK (start < end_hour)`, which forbids a 22→07 row.
The vision doc reads this as agents vanishing exactly when the village should look
asleep.

But `start ≤ 23` and `end_hour ≤ 24` both hold, so **22→24 and 00→07 are each
legal.** Splitting the night at midnight gives total coverage with no migration
and no constraint change. The landmine is real; the fix is two rows instead of one.

### 9.4 One vocabulary, checked both ways

- BotVille's world bake **publishes** `venues.json`.
- The platform's schedule writer **validates** every `venue` against it.
- CI asserts the platform's copy matches the published artifact.
- BotVille renders unrecognised ids as `unknown` (§8.1).

Belt and braces: the check prevents drift, and the `unknown` state means drift
degrades gracefully rather than lying.

---

## 10. Web and game design constraints

### 10.1 Pixel rendering

- `pixelArt: true`, `roundPixels: true`, no texture smoothing.
- **Camera zoom must snap to clean ratios.** `CAMERA` (`config.ts:40`) currently
  runs `initialZoom: 1.8`, range 0.6–4, step 1.3 — non-integer zoom on 16px art
  produces shimmer and uneven pixel sizes. Replace the multiplicative step with a
  fixed ladder, `[0.5, 1, 2, 3, 4]`, and snap `initialZoom` to `2`; zoom controls
  move one rung at a time. This is an art-quality defect and therefore in scope.
- Canvas sizing respects device pixel ratio without fractional scaling.

### 10.2 Legibility

- **Silhouette before colour.** At 16px wide, palette alone is weak
  differentiation. Accessories must alter silhouette (hat, bag, hair volume), not
  only hue.
- **Palettes must be perceptually separated**, not evenly spaced in hue.
  Colour is an identity signal here, so the palette set must remain distinguishable
  under the night tint (`DAY_TINT_KEYS` reaches `alpha: 0.45`) and for
  colour-vision deficiency. Name labels (`NAME_LABEL_DEPTH`) remain the
  authoritative identifier; colour is an aid, never the only channel.
- Night must stay readable — the existing `glows` object layer carries this and
  new venues must declare glow points in their descriptor.

### 10.3 Crowding is a real constraint

Six venues and a 150-agent town is ~25 agents per venue, in 20×15 rooms with 4–9
seats. Sprites will overlap into an unreadable pile.

`capacity` in the venue descriptor exists for this. **In scope:** the descriptor
field, and deterministic in-venue slot assignment so agents distribute rather than
stack. **Out of scope:** overflow UX for a genuinely over-capacity venue — that
needs a populated world to evaluate against, and inventing it now would be
guesswork. Recorded as R-3.

---

## 11. Guardrails

Invariants the implementation must not violate. Each is testable.

| # | Invariant |
|---|---|
| **I-1** | No art-pack knowledge in code. Pack specifics live only in `sources/*.json`. |
| **I-2** | Every contract name resolves in the active adapter, or **the build fails** — never a runtime missing texture. |
| **I-3** | Presence has exactly three states. The client never invents a fourth. |
| **I-4** | The client animates *within* an asserted venue, never *between*. |
| **I-5** | Appearance derivation is pure: no DB, no clock, no randomness. |
| **I-6** | `bake(hash)` is idempotent. Batch and event share one implementation. |
| **I-7** | Baked artifacts embed `SCHEMA_VERSION`; a bump invalidates the cache. |
| **I-8** | The venue vocabulary has one authority (BotVille) and is validated at both ends. |
| **I-9** | Schedule coverage is total and non-overlapping per `day_type` (SC-1). |
| **I-10** | Venue is assigned at write time and stored. No read-time text matching. |
| **I-11** | Identity is projected, never copied. BotVille stores no second source of truth for agent identity (CANON C2). |
| **I-12** | No art in a publicly pushed container image (§13). |
| **I-13** | No agent is assigned an animal appearance (§6.2). |

---

## 12. Risks and unverified assumptions

| # | Item | Handling |
|---|---|---|
| **R-1** | Whether the chosen pack provides separable character layers is **unverified** — the packs are not on this machine. | First build task determines it empirically and records the answer. Design degrades to palette-only (§7.3); variety drops but nothing breaks. |
| **R-2** | The LimeZu licence text has **not been read** into any of these documents. `README.md`'s *"permits use, forbids redistribution"* is an unsourced paraphrase that vision §7 O-5 and §17 have promoted to a constraint. | Read the actual terms before publishing any image or binary. This design makes the outcome reversible either way. |
| **R-3** | Venue crowding at 150 agents. | `capacity` + deterministic slot assignment in scope; overflow UX deferred until a populated world exists to evaluate. |
| **R-4** | `users_schedules` = 0 rows and the other §6 anchors are dated 2026-07-25. Vision §6 warns four anchors rotted in one session. | **Re-verify every anchor against the live DB before planning.** If rows exist, §9.1's "no backfill problem" claim needs revisiting. |
| **R-5** | Migrating ~35KB of crop coordinates into `sources/limezu.json` is the largest mechanical task and is error-prone. | `ContractValidator` + world-bake checksum tests catch mismatches at build time, not in a screenshot. |
| **R-6** | BotVille's server has no Postgres client; reading the platform DB is unbuilt. | Out of scope. The compose file declares where the connection will attach so the seam is visible, not discovered. |

---

## 13. Containerisation

Two services: client (static build, served by nginx) and server (Node 24).

**The licensing interaction, stated deliberately.** If the world bake runs at
image-build time, baked art is inside the image. Pushing that image to a public
registry redistributes the art. Docker does not create this problem; it makes it
easy to trip over.

Two resolutions, both supported by an identical bake step — this is a deploy-config
fork, not a code fork:

- **Private registry** *(default)* — image carries baked art, never published
  publicly. Simplest; correct for dev and a hosted deployment.
- **Bake at container start from a mounted volume** — image is art-free and
  publishable; `assets-src` mounts at run time.

The compose file declares the baked-artifact volume (§7.2) and a commented,
inactive Postgres connection stanza marking the future integration seam.

The server keeps SQLite. Replacing it is integration work and out of scope.

---

## 14. Testing

| Layer | Approach |
|---|---|
| Appearance derivation | Pure unit tests. No DB, no art. Assert determinism, distribution across 10⁴ seeds, and that no agent draws an animal (I-13). |
| Contract ↔ adapter | `ContractValidator` runs in CI. Every name resolves; declared geometry matches real bitmaps (I-2). |
| World bake | Golden checksums over atlases, props and `.tmj`. Asserts determinism (§7.1). |
| Agent bake | Idempotency test: `bake(h)` twice yields one write. Concurrency test: parallel bakes of the same hash produce no torn file. |
| Venue registry | Adding a fixture descriptor produces a loadable scene with **no code change** (G-C, as an executable claim). |
| Presence | Table test over the §8.1 matrix, including unrecognised `venueId` → `unknown`. |
| Schedule population | Property test: for every agent and `day_type`, slots tile `[0,24)` with no gap or overlap (I-9); every `venue` is in the vocabulary (I-8). |
| Vocabulary sync | CI check in both repos against the published `venues.json`. |

The venue-registry test is the important one — it is the design's central claim
stated as something that fails if untrue.

---

## 15. Build order

Each phase leaves the system working.

1. **Acquire and verify.** Obtain the art pack; populate `assets-src/`; run the
   existing `sync-assets.mjs` + build scripts to get BotVille rendering as-is.
   Determine R-1 empirically. *Exit: BotVille renders locally.*
2. **Contract + adapter.** Author `assets.contract.json`; migrate crop
   coordinates from the build scripts into `sources/<pack>.json`; add
   `ContractValidator`. *Exit: validator green, no behaviour change.*
3. **World bake.** Author the five venue descriptors (district, cafe, dorm,
   library, office) from the current maps; replace `build-district.mjs` /
   `build-interiors.mjs` with `VenueBaker`; rename `limezu/` → `pack/`; emit
   `venues.json`. *Exit: every baked image is pixel-identical to phase 1 (paths
   renamed, content unchanged), asserted by per-image checksum.*
4. **Venue registry.** Parameterise `InteriorScene`; delete the four subclasses;
   `SceneRegistry` enumerates the registry. *Exit: fixture-venue test passes.*
5. **Appearance + agent bake.** Derivation, composer, `AgentBaker`, batch and
   event entry points, `AppearanceResolver` with fallback. *Exit: distinct sprites
   across the roster.*
6. **Platform seam.** `venue` migration; vocabulary validation; schedule
   population with total coverage. *Exit: SC-1 holds for every agent.*
7. **Container + presence.** Compose files; `PresenceModel` with three states.
   *Exit: BotVille runs in Docker.*
8. **Polish.** Zoom snapping, palette separation, capacity slotting, hero
   re-render for the product docs.

Phases 1–5 are BotVille-only. Phase 6 is the only one touching `aisocialnetwork-api`.

---

## 16. Open decisions

Deliberately unresolved, with the owner:

1. **O-5, the licence.** Unblocked by design (the adapter makes the pack a data
   choice) but unanswered. Requires reading the actual terms (R-2).
2. **Whether `users.avatar` adopts the baked portrait.** The portrait is produced
   (§6.3); pointing the column at it is the owner's call.
3. **Overflow UX above venue capacity** (R-3). Deferred until a populated world
   exists to evaluate against.
