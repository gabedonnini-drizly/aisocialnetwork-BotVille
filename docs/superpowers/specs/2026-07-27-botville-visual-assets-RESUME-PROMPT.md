# RESUME PROMPT — BotVille visual assets

**Paste target:** a fresh session with cwd `/Users/home/aisocialnetwork-BotVille`.
**Written:** 2026-07-27, at the end of the brainstorm that produced the design spec.
**Purpose:** carry the full context forward so a new session can act without
re-deriving anything. Everything below marked *verified* was checked against the
filesystem on 2026-07-27. Everything marked *unverified* must be checked before
it is relied on.

---

## 0. The one-paragraph mission

BotVille is a Phaser pixel city that renders ~90 art units. Make its art source
**data instead of code**, make its venues **data instead of code**, derive agent
appearance from identity and bake it **offline (batch + event, content-addressed)**,
and populate BotTown schedules with **stored venue values** so a connected
BotVille shows an inhabited city. The goal is launch readiness for the two product
documents, with no throwaway work.

**Read the spec first:** `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md`
(commit `d695881`). This file is the context around it, not a replacement for it.

---

## 1. Reading order

1. `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md` — **the spec**
2. `/Users/home/aisocialnetwork-agents/docs/product/2026-07-25-how-it-all-works.md` — §9 is BotVille
3. `/Users/home/aisocialnetwork-agents/docs/product/2026-07-25-product-vision.md` — §3, §5, §6, §7, §9
4. `/Users/home/aisocialnetwork-agents/docs/product/2026-07-25-vision-decisions.md` — D1.1–D12.3, **binding, do not re-open**
5. `ARCHITECTURE.md` (this repo) — the original author's design notes
6. `README.md` (this repo) — "About the art" section describes the manual pipeline

---

## 2. Repo map

| Path | What it is | Role here |
|---|---|---|
| `/Users/home/aisocialnetwork-BotVille` | Phaser client + Express/SQLite server. **Primary.** | Phases 1–5, 7–8 |
| `/Users/home/aisocialnetwork-api` | Node/Express + **Postgres**. BotTown API, migrations, agent seeding. | Phase 6 only |
| `/Users/home/aisocialnetwork-agents` | Python heartbeat / MCP tools / configs. Also holds `docs/product/`. | Docs only — **do not modify** |
| `/Users/home/aisocialnetwork-agent-scheduler` | Scheduler harness | Out of scope |
| `/Users/home/aisocialnetwork-frontend` | BotTown web frontend | Out of scope |
| `/Users/home/aisocialnetwork-agents-js`, `/Users/home/ai-social-mega` | Adjacent | Out of scope |

Postgres is shared by frontend, api and scheduler. BotVille is expected to read it
**read-only** eventually — that connection is *not* built and is out of scope.

---

## 3. Verified facts — do not re-derive

Checked on the filesystem 2026-07-27.

### 3.1 The art is absent

- `assets-src/` **does not exist**.
- `packages/client/public/assets/` contains **only** `tilemaps/`. No `tilesets/`,
  no `sprites/`, no `ui/` — all three are gitignored (`.gitignore:23-26`).
- **BotVille cannot render or be screenshotted on this machine right now.**
- `packages/client/public/hero/district-night.{png,gif,mp4,webm}` are pre-rendered
  artifacts from when someone had the packs. They are the only visual evidence.
- Git: single upstream commit `e83c74e`, plus `d695881` (the spec).

### 3.2 The pipeline, and why the coupling is looser than README implies

```
assets-src/ ──sync-assets.mjs──> raw copies (~110 explicit files)
            └─build-district.mjs ─┐
              build-interiors.mjs ┴─> ground atlases + 68 prop PNGs + the .tmj maps
                                      └─> PreloaderScene loads BY NAME
```

- **Tilemaps do not reference art-pack tilesets by GID.** Each map has one small
  *generated* atlas for its ground tilelayer; everything else is an object layer of
  **semantic names** resolved to individual PNGs.
- `district.tmj` — 48×46 tiles; atlas `district_ground.png` 128×48, **23 tiles**.
- `cafe/dorm/library/office.tmj` — 20×15 tiles; atlas `interiors_ground.png`
  128×32, **13 tiles**.
- Object layers: `district` has `props-below`, `buildings`, `props-above`, `doors`,
  `spawns`, `collision`, `glows`, `night`. Interiors have `furniture`, `seats`,
  `animated`, `doors`, `spawns`, `collision`.
- **Object sizes are baked into the `.tmj`** (e.g. `chair_red_r` 14×28,
  `counter_wide` 46×14). This is the one hard binding; the spec removes it by
  deriving sizes from baked bitmaps.

### 3.3 The complete art surface — ~90 units

| Class | Count | Contract lives at |
|---|---|---|
| Ground tiles (2 atlases) | 36 | `ATLAS_TILES` in the two build scripts |
| District props/buildings | 32 | `DISTRICT_IMAGES`, `config.ts:169` |
| Interior furniture | 36 | `INTERIOR_IMAGES`, `config.ts:156` |
| Character sheets | 16 (12 human + 4 animal) | `AVATAR_VARIANTS`, `assetManifest.ts:116` |
| Animated objects | 5 | `ANIMATED_OBJECTS`, `assetManifest.ts:242` |
| Emote/status sheet | 1 | `EMOTES`, `assetManifest.ts:194` |

### 3.4 Key file anchors (this repo)

| File | Lines | Notes |
|---|---|---|
| `packages/client/src/game/assetManifest.ts` | 248 | **Data-driven, no magic numbers in scenes.** `AVATAR_VARIANTS`:116, `EMOTES`:194, `byStatus`:210, `ANIMATED_OBJECTS`:242. Comments are in Russian. |
| `packages/client/src/game/config.ts` | 179 | `DISTRICT`:29, `CAMERA`:40 (zoom 1.8 / 0.6–4 / step 1.3), `WANDER_RADIUS`:59, `TIME`:65 (`msPerGameHour: 60_000`), `DAY_TINT_KEYS`:75, `NIGHT_SCHEDULE`:114, `INTERIORS`:143, `INTERIOR_IMAGES`:156, `DISTRICT_IMAGES`:169 |
| `packages/client/src/game/scenes/PreloaderScene.ts` | 131 | Iterates the manifest. No literals. |
| `packages/client/src/game/scenes/DistrictScene.ts` | 457 | Outdoor scene |
| `packages/client/src/game/scenes/InteriorScene.ts` | 261 | Base class |
| `Cafe/Dorm/Library/OfficeScene.ts` | **6 each** | Pure duplication — deleted in phase 4 |
| `packages/client/src/game/agents/AgentSprite.ts` | 389 | Gains `AppearanceResolver` |
| `packages/client/src/game/SceneRegistry.ts` | 26 | Becomes registry-driven |
| `packages/client/src/lib/api.ts` | 198 | **Only network module.** `fetchAgentLocations`:125 → `GET /api/agents/locations` |
| `packages/server/src/world/agentLife.ts` | — | Random mover, 6 venues. **Out of scope, still running.** |
| `scripts/sync-assets.mjs` | 150 | Explicit file list |
| `scripts/build-district.mjs` / `build-interiors.mjs` | 18.7KB / 16.2KB | **The ~35KB of crop coordinates that must become `sources/<pack>.json`.** This is the largest mechanical task. |
| `scripts/inspect-assets.mjs`, `png-grid.mjs`, `crop.mjs`, `png-lib.mjs`, `tile-strip.mjs` | — | Existing tooling for verifying sheet layouts. **Reuse, don't rewrite.** |

### 3.5 Key file anchors (`aisocialnetwork-api`)

| File | Fact |
|---|---|
| `src/utils/agentSeed.js` | **The blessed determinism pattern.** `hashString(str, salt)` FNV-1a; `pickCity` (49-city pool), `deriveDefaultTraits`, `deriveDescriptionSeeds`. Pure, seeded on **username**. Appearance derivation must reuse this exact function with new salts. |
| `src/db/migrations/` | Head is **`036_drop_users_birthday_default.js`** → new migration is `037`. |
| `004_add_schedules.js` | `users_schedules`: `activity VARCHAR(100)` free text, `start` 0–23, `end_hour` 1–24, `CONSTRAINT valid_time_range CHECK (start < end_hour)`. **22→24 and 00→07 are both legal — the night needs two rows, not a migration.** |
| `008_add_gender.js` | `gender VARCHAR(50)`, **no CHECK constraint** — arbitrary strings. 009 makes it required. Normalise, never branch on raw values. |
| `011_add_available_media.js` | Seeds `available_media` with **hotlinked `fakepersongenerator.com` photos**, gender-tagged. Migration's own comment: *"you will replace these URLs with real ones."* Nobody has. |
| `012_add_user_avatar_columns.js` | `users.avatar TEXT`, `users.profile_background TEXT`. Avatar is a **URL**, gender-matched from the pool above. |

---

## 4. Unverified — check before relying on

| # | Claim | How to check |
|---|---|---|
| **U-1** | Whether the chosen art pack provides **separable character layers** at 16×32. Decides full silhouette variation vs palette-only. | Buy/unpack, then inspect with `scripts/inspect-assets.mjs` / `png-grid.mjs`. **First build task.** |
| **U-2** | The **actual licence text**. `README.md:82-86`'s *"permits use, forbids redistribution"* is an unsourced paraphrase that vision §7 O-5 and §17 treat as a hard constraint. | Read the terms shipped with the pack. Affects Docker registry choice only. |
| **U-3** | `users_schedules` = **0 rows**, `users_occupations`/`users_interests`/`users_hobbies`/`voice_exemplar` = 0, roster = **85 users**. Sourced from vision §6, dated 2026-07-25. | Query the live Postgres. **Vision §6 explicitly warns four anchors rotted in a single session and one was never true.** The spec's "no backfill problem" depends on this. |
| **U-4** | `models/Schedule.js` `getCurrentSlot` is `LIMIT 1` with no `ORDER BY`, null on gaps. | Read the file in `aisocialnetwork-api`. |
| **U-5** | Whether LimeZu premade sheets use consistent palette slots (needed for the palette-remap fallback). | Inspect after acquiring. |

---

## 5. Scope discipline — the owner's rules

Stated by the owner during the brainstorm, and binding:

- **Art-driven changes only.** *"Let's not make any unnecessary code changes
  unrelated to the art unless they arise out of certainty due to the art changes."*
- **This is not the integration work.** Build mindful of where it's going; don't go
  there. No repointing `api.ts`, no deleting `agentLife.ts`, no replacing SQLite.
- **Most work is in BotVille.** Only one phase touches `aisocialnetwork-api`.
- **BotVille does not own the activity→venue mapping.** The agents/api/scheduler
  side drives activity; BotVille renders it.
- **Dockerise now** — cheaper than retrofitting, easier to scale later.
- **Offline compute, batch + event** — *"like most modern ML pipelines."*
  Composition happens at bake time, not runtime.
- **Sprite and profile picture may differ** but must share one identity record.
  *"It would be cute if the sprites could look similar to the profile pics."*

Decisions **D1.1–D12.3** in the vision decision log are binding and must not be
re-opened. Vision §9.1 records a scope lock against village work; the owner
superseded it for this spec on 2026-07-27.

---

## 6. Design decisions already made — do not re-litigate

1. **Three tiers:** schema (stable, versioned) / registry (open, additive) /
   adapter (disposable). Freezing the *enumeration* is the mistake to avoid.
2. **Immutable boundary is four fields:** `{ id, displayName, spriteSeed, venueId }`.
3. **Offline bake, content-addressed on `appearanceHash`.** Batch and event call
   the **same** idempotent function — that's why they can't drift.
4. **`SCHEMA_VERSION` is inside the hash**, so a bump invalidates the cache with no
   manual purge.
5. **Venue vocabulary authority = BotVille.** The world bake publishes
   `venues.json`; the platform validates against it; unknown ids render as
   `unknown`, never as a guess.
6. **Venue assigned at write time and stored.** No free-text→venue mapper exists
   anywhere. The schedule generator picks from the vocabulary at generation time.
7. **Total 24h schedule coverage**, non-overlapping, per `day_type` — presence
   becomes a total function without touching `getCurrentSlot`'s logic.
8. **Night splits at midnight** (22→24, 00→07). No migration needed.
9. **Exactly three presence states:** `somewhere | absent | unknown`.
10. **No agent gets an animal appearance.** Animals become district scenery.
11. **Art pack: LimeZu now** (~$40), made reversible by the adapter. Not a
    commitment — it's what the existing 90 crop coordinates already target, and
    no CC0 pack matches its coverage.
12. **Portrait is produced, not adopted.** `baked/<hash>-portrait.png` is emitted;
    pointing `users.avatar` at it is a separate owner decision.

---

## 7. Build order

Each phase leaves the system working. Full detail in spec §15.

1. **Acquire and verify** — populate `assets-src/`, run existing scripts, resolve U-1. *Exit: BotVille renders.*
2. **Contract + adapter** — `assets.contract.json`, `sources/<pack>.json`, `ContractValidator`. *Exit: validator green, no behaviour change.*
3. **World bake** — author 5 venue descriptors, replace both build scripts with `VenueBaker`, rename `limezu/`→`pack/`, emit `venues.json`. *Exit: per-image checksums match phase 1.*
4. **Venue registry** — parameterise `InteriorScene`, delete the 4 subclasses. *Exit: fixture-venue test passes with no code change.*
5. **Appearance + agent bake** — derivation, composer, `AgentBaker`, batch/event, `AppearanceResolver` + fallback. *Exit: distinct sprites across the roster.*
6. **Platform seam** *(only phase touching `aisocialnetwork-api`)* — migration 037, vocabulary validation, schedule population. *Exit: SC-1 holds for every agent.*
7. **Container + presence** — compose files, `PresenceModel`. *Exit: runs in Docker.*
8. **Polish** — zoom ladder, palette separation, capacity slotting, hero re-render.

---

## 8. Guardrails (spec §11) — the short list

I-1 no art-pack knowledge in code · I-2 unresolved name fails the **build**, not
runtime · I-3 exactly three presence states · I-4 animate *within* a venue, never
*between* · I-5 appearance derivation is pure · I-6 `bake()` idempotent, one
implementation · I-7 `SCHEMA_VERSION` in the artifact · I-8 one vocabulary
authority, checked both ends · I-9 total non-overlapping schedule coverage ·
I-10 venue assigned at write time · I-11 identity projected, never copied (CANON
C2) · I-12 no art in a publicly pushed image · I-13 no animal appearances.

---

## 9. Known traps

- **`NIGHT_SCHEDULE` (`config.ts:114`) invents facts.** The client decides idle
  agents go to bed at 22:00. Legal today (`agentLife.ts` owns the world), illegal
  once presence is platform-driven. Recorded, not fixed — the integration project
  removes it.
- **Emote frame indices** (`assetManifest.ts:210`) are pack-specific and currently
  hardcoded. They belong in the adapter, not the contract.
- **Camera zoom 1.8 / step 1.3** produces pixel shimmer on 16px art. Replace with
  the fixed ladder `[0.5, 1, 2, 3, 4]`.
- **Crowding:** 6 venues × 150 agents ≈ 25 per 20×15 room with 4–9 seats. Capacity
  + deterministic slotting is in scope; overflow UX is deferred.
- **Comments and some identifiers in `packages/client/` are Russian.** They are
  accurate and load-bearing (verified crop coordinates, frame layouts). Read them;
  don't discard them.
- **The `.tmj` and `.json` tilemap pairs differ** — `library` has only `.tmj`.
  Confirm which the loader uses (`PreloaderScene:40,58` loads `.tmj`) before
  touching either.

---

## 10. How to start

```
cd /Users/home/aisocialnetwork-BotVille
```

Then, in order:

1. Read the spec (§1 above).
2. Re-verify **U-3** against the live Postgres — it gates phase 6 and the whole
   "inhabited city" deliverable.
3. Resolve **U-1** by acquiring the pack — it gates the achievable variety.
4. Invoke `superpowers:writing-plans` against the spec to produce the
   implementation plan. **The spec is approved; do not re-brainstorm it.**

If anything in §3 disagrees with what you find on disk, **the filesystem wins** and
this document is what gets corrected.
