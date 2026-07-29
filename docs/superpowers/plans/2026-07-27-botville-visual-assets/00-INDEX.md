# BotVille Visual Assets — plan index

> **Read this first, then execute one plan at a time.** This is not a plan; it
> is the map. Each of the six plans below is independently executable, ends
> with working software, and carries its own copy of the Global Constraints so
> a fresh session needs nothing but that file.

**Goal:** Turn BotVille's art source into data, its venues into data, derive agent appearance from identity via an offline content-addressed bake, publish one venue vocabulary that BotTown validates against, and ship the whole thing through the deployments BotVille already has.

**Architecture:** Five stages. A pack-specific **source adapter** (`sources/<pack>.json`) maps semantic names to pixel rects. A pack-agnostic **asset contract** (`contract/assets.contract.json`) declares what must exist. A **world bake** turns venue descriptors + adapter + contract into ground atlases, prop PNGs, `.tmj` maps and a published `venues.json`. An **agent bake** composes character sheets content-addressed on `appearanceHash`. At runtime Phaser scenes read a registry, never a hand-written list. Build tooling is dependency-free ESM `.mjs` reusing the existing `scripts/png-lib.mjs`; runtime is TypeScript.

**Tech Stack:** Node ≥24 (ESM), TypeScript 5.7, Phaser ^3.88.2 declared / 3.90.0 installed, Vite 6, npm workspaces + Turbo, `node:test` (no new test dependency), the existing `scripts/png-lib.mjs` PNG codec, Postgres (`aisocialnetwork-api` only), Docker Compose (local parity only — created by Plan 6 Task 35; no Docker artifact exists in the repo today).

**Spec:** `docs/superpowers/specs/2026-07-27-botville-visual-assets-design.md` (commit `d695881`). Approved — do not re-brainstorm.

## The six plans

| | Plan | Tasks | Needs art? |
|---|---|---|---|
| 1 | [Foundations](01-foundations.md) — contract, curation record, fixture pack, CI gate | 1, 2, 4–10 (+4a, 9a) | no |
| 2 | [The world bake](02-world-bake.md) — venues become data | 11–19 (+14a, 19a), 25 | no |
| 3 | [The runtime registry](03-runtime-registry.md) — scenes read the registry | 21–24, 34, 36, 37 | no |
| 4 | [Appearance](04-appearance.md) — identity-derived, content-addressed sprites | 26–30, 38 | no |
| 5 | [The platform seam](05-platform-seam.md) — venue at write time, one vocabulary | 31–33 | no |
| 6 | [Art and deployment](06-art-and-deployment.md) — real pixels, real deploys | 3, 3b, 20, 35, 38b, 39 | **yes, Tasks 3/3b/20/39** |

Execute in order. Pause after Plan 2 and look at the result: it is where the
design's central claim (venues are data) either holds or does not, and every
later plan assumes it does.

---

## Pre-flight verification results (2026-07-27)

Run before planning, per resume-prompt §10. **The filesystem and the live DB win over the spec.**

| Claim | Result |
|---|---|
| **U-3** `users_schedules` = 0 rows | ✅ **CONFIRMED.** Live Postgres `ai_social_network`: `users_schedules` 0, `users_occupations` 0, `users_interests` 0, `users_hobbies` 0, `users` = **85**. §9.1's "no backfill problem" holds. |
| **U-3b** migration head | ✅ `036_drop_users_birthday_default.js` (migrations.id 40). New migration is **037**. |
| **U-4** `getCurrentSlot` is `LIMIT 1`, no `ORDER BY` | ✅ **CONFIRMED** — `aisocialnetwork-api/src/models/Schedule.js` (the function opens at `:10`; the bare `LIMIT 1` is at `:49`). Returns `null` on gaps. |
| `users_schedules` constraints | ✅ `start` 0–23, `end_hour` 1–24, `CHECK (start < end_hour)`, **`day_type CHECK IN ('weekday','weekend')`** — exactly two day types. 22→24 and 00→07 are both legal. No `venue` column exists. |
| `users.gender` in practice | 85 rows: `male` 47, `female` 38. Column is unbounded `VARCHAR(50)` — still normalise, never branch on raw values. |
| `users.avatar` | 85/85 are hotlinked `fakepersongenerator.com` URLs. 0 nulls. |
| **U-1** separable character layers | ✅ **RESOLVED 2026-07-29** (art-pack QA, after the packs landed): the Character Generator ships separable 16×32 layer directories — Bodies 9, Eyes 7, Hairstyles 200, Outfits 132, Accessories 84. `capabilities.characterLayers` is **`true`** from Plan 1 Task 5; Plan 6 Task 3 Step 7 re-verifies on the unpacked copy. |
| **U-2** licence text | ❌ **UNRESOLVED.** Gated on Task 3. |
| `assets-src/` | ❌ Absent, as the spec says. `packages/client/public/assets/` holds only `tilemaps/`. |

### Two corrections to the resume prompt

1. **Four paid packs are needed, not two.** `scripts/sync-assets.mjs` reads from four top-level `assets-src/` trees: `exteriors/` (Modern Exteriors), `interiors/` (Modern Interiors), `farm/16x16/` (Modern **Farm**), `office/` (Modern **Office**). `README.md:82-99` lists only Exteriors, Interiors and optional UI — **it is incomplete**, and following it will make Task 3 fail with missing-file errors. Task 3 fixes the README.
2. **`docs/ASSETS.md` does not exist.** `assetManifest.ts:5` and both build scripts cite it. `docs/` contains only `superpowers/specs/`. Do not go looking for it.

### The art blocker, stated plainly

**Three tasks need the licensed packs — 3, 20 and 39 — and all three live in Plan 6** (Task 3b also needs the packs on disk, though it produces nothing from them). Everything else, including the appearance composer and the whole deployment story, runs without a licensed pixel.

The pipeline is developed and tested against a *synthetic fixture pack* generated by `scripts/gen-fixture-pack.mjs` (Task 8) from the repo's own `png-lib.mjs` — real PNGs, known geometry, zero licensed pixels. That is not a testing convenience, it is the design: it makes the bake verifiable in CI and on a fresh clone, and it is what lets a public Vercel build produce a complete, renderable, **art-free** city (I-12).

So the art is not a blocker on anything except its own plan. Plans 1–5 ship a working city; Plan 6 swaps the pixels in and proves nothing drifted.

### Where art selection and curation happen

Four decisions stand between an art pack and a pixel on screen. The second one had no home until Plan 1's curation tasks:

| Decision | Home | Where |
|---|---|---|
| What must exist — the world needs a `bookshelf_a` | `contract/assets.contract.json` | Plan 1, Task 4 |
| **Which sprite is it, and why that one** | `note` + `pin` fields on `sources/<pack>.json` | **Plan 1, Tasks 4a / 5–7 / 9a** |
| Which sheets are worth copying at all | derived from the contract + adapter | Plan 2, Task 19a |
| Where it goes in a place | `venues/<id>/venue.json` | Plan 2, Tasks 13–14 |

Before this, a rect in `sources/limezu.json` was the *answer* to a question nobody wrote down, chosen from a candidate set nobody enumerated, verifiable against nothing — `scripts/inspect-assets.mjs` says as much in its own header: "The results are recorded by hand". The curation tasks give that decision an **inventory** (4a), a **record on the adapter itself** — every rect in `sources/<pack>.json` can carry a `note` saying why that sprite won, written as the rects are authored (Tasks 5–7) — and a **review artifact** (9a), plus a **pin**, a hash of the chosen pixels (Task 9), so a pack update that shifts a sheet becomes a named `validate:contract` failure instead of a silently different chair.

Plan 6 Task 3 is where it is used on real art: index, pin, review the contact sheets, then capture the baseline.

**Deliberately not automated:** whether a sprite reads as a bookshelf at 16px, or whether the brown chair sits better on parquet than the grey one. No candidate scorer is built and none is planned. The aim is to make taste cheap to apply and impossible to lose, not to replace it.

### Cross-plan references

Tasks cite each other by number, and those numbers stay stable across the split — Task 27 in Plan 4 still refers to "Task 3 Step 7" in Plan 6. Two places matter in practice:

- **Task 5 sets `capabilities.characterLayers: true`** — U-1 was answered first-hand against the purchased packs (art-pack QA, 2026-07-29): separable layers exist, so the layered path ships. Task 27 still branches on the flag and is correct either way; palette-remap survives as the documented fallback. Plan 6 Task 3 Step 7 re-verifies the answer on the unpacked copy.
- **Plan 6 Task 3 precedes Plan 6 Task 3b** — the golden baseline is captured through the legacy scripts and their QA symlinks *before* Task 3b deletes those symlinks. The legacy scripts are broken from 3b onward, by design; the durable paths are the real-pack `files` entries in `sources/limezu.json`.
- **Task 4's snapshot and Task 19's freeze** are what let Plan 6 run at any time. Neither depends on the art; both exist so Plan 6 does not have to reconstruct the past from git history.

---

## Global Constraints

Every task's requirements implicitly include this section.

- **Node ≥ 24.** Root `package.json` `engines: { "node": ">=24.0.0" }`, `.nvmrc` = `24`. ESM: the three workspace packages (`client`, `server`, `shared`) each declare `"type": "module"`; the root `package.json` has **no** `type` key, so root-level scripts are ESM by their `.mjs` extension only.
- **No new npm dependencies.** Not in `packages/client`, not in `packages/server`, not at the root. Build tooling uses `node:` builtins plus the existing `scripts/png-lib.mjs`. Tests use `node:test` + `node:assert/strict`.
- **Build tooling is `.mjs` under `scripts/`; runtime is TypeScript under `packages/`.** Follow the existing split exactly.
- **Comments in `packages/client/` are English and load-bearing** — they record verified crop coordinates and frame layouts. Read them; preserve them and their intent; never delete or "clean up" an explanatory comment.
- **`SCHEMA_VERSION = 1`**, exported from `@botville/shared`, and included in every `appearanceHash`.
- **Path segment rename: `limezu/` → `pack/`** throughout `public/assets/`. No directory, key or string in committed code may name a vendor.
- **The `AgentPresence` boundary is four *required* fields** — `{ id, displayName, spriteSeed, venueId }`, required and unrenamed. Additions are permitted but must be optional; nothing beyond the four may ever be required (addendum §I.4).
- **Licensed art is never committed and never enters a publicly pushed image.** `assets-src/`, `public/assets/tilesets/pack/`, `public/assets/sprites/pack/`, `public/assets/ui/pack/`, `public/assets/baked/` stay gitignored.
- **Pure modules must not import Phaser.** `appearance/derive.mjs`, `venueRegistry.ts`, `PresenceModel.ts` and `AppearanceResolver`'s resolution half are unit-tested under `node --test`, which cannot load Phaser.
- **No non-erasable TypeScript: no parameter properties, no `enum`, no `namespace`.** `node --test` type-strips only — it never generates code. `constructor(private x: T)` fails with `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` on Node 22 *and* 24, and the error names the resolve hook's file, not yours. Declare the field and assign it in the constructor body. The pre-existing parameter properties — `packages/client/src/game/Pathfinder.ts:9` and `packages/client/src/game/scenes/InteriorScene.ts:55-58` — are all Phaser-side and never node-tested; leave them, do not copy them, and know that lifting InteriorScene code into a node-tested module will hit this error.
- **`.mjs` must never import a `.ts` file, directly or transitively.** `test/ts-resolve.mjs` only exists inside `node --test`. A `.mjs` module in `packages/shared/` or `scripts/` is loaded by bare `node` (the bake CLIs) and by Vite (the client bundle), and **neither rewrites `.js` → `.ts`**. Constants a `.mjs` module needs live in a sibling `.mjs`. See Task 2's `schemaVersion.mjs`, `hash.mjs` and the subpath seam in Step 5b.
- **Library functions never write to the source tree.** `worldBake()` takes `outDir` and `generatedDir` as *required* arguments; only the CLI wrapper supplies the repo defaults. `npm test` must leave `git status --porcelain` empty — `test:all`'s trailing shell check (Task 1) is the authoritative gate, and Task 18's in-suite guard gives the early warning.
- **No absolute path to a sibling repo, anywhere.** Cross-repo lookups go through `test/helpers/siblingRepo.mjs` (BotVille) / `tests/helpers/siblingRepo.js` (api). The two helpers implement **different** resolution chains — BotVille's: `$BOTVILLE_<NAME>_REPO` (e.g. `BOTVILLE_API_REPO`) → `$BOTVILLE_REPOS_ROOT/<name>` → sibling of the repo root; the api's: `$BOTVILLE_REPO` → `$BOTVILLE_REPOS_ROOT/<name>` → sibling. Either way the final fallback is an explicit skip with a reason. A hardcoded `/Users/home/...` is a review failure.
- **Test expectations are derived, never transcribed.** No test may hardcode a count that the contract, a descriptor or a generator parameter already determines. Assert `bakeProps(...).size === Object.keys(contract.props.district).length`, not `=== 32`. Golden *pixels* are the one exception — those are snapshots by definition.
- **Deployment is Vercel (client) + Railway (server), not Docker.** `vercel.json`, `railway.toml` and `scripts/deploy-server.mjs` are the production paths and must keep working. Docker is local-parity and self-host only. See Task 35.
- **Invariants I-1 … I-13 (spec §11) are binding.** Each is asserted by a named test in this plan.
- **Scope bar (owner, binding):** art-driven changes only. Do not repoint `packages/client/src/lib/api.ts`, do not delete or modify `packages/server/src/world/agentLife.ts`, do not replace SQLite, do not touch the key vault / model picker / heartbeat / MCP registry. This is not the integration work.

---

## File Structure

### Created

| Path | Responsibility |
|---|---|
| `contract/assets.contract.json` | Pack-agnostic authority for *what must exist*: names, geometry, anim rows, statuses. |
| `sources/limezu.json` | The only pack-specific artifact: `name → {file,x,y,w,h}` rects with optional `note`/`pin`, + capabilities. |
| `sources/fixture.json` | Synthetic test pack manifest — same shape, generated pixels. |
| `venues/<id>/venue.json` | One descriptor per authored venue (district, cafe, dorm, library, office), carrying `roles`/`affords`/`hours` (addendum I.1). |
| `venues/_archetypes/house.json` | Residence archetype — layout, affordances, capacity of a venue *type* (addendum I.3). |
| `town/town.json` | Measured town snapshot (`population`); input to residence provisioning. |
| `scripts/lib/residences.mjs` | `deriveResidenceCount` / `deriveResidenceInstances` — append-only instance list (addendum I.2). |
| `schemas/venues.schema.json` | Canonical JSON Schema for the published vocabulary, published beside it (Conventions table). |
| `scripts/lib/assetContract.mjs` | Load + validate the contract. |
| `scripts/lib/sourceAdapter.mjs` | Load an adapter; resolve names; report unresolved. |
| `scripts/lib/spriteReader.mjs` | Crop a rect from a pack PNG, trim transparent margins, report true bounds. |
| `scripts/lib/atlasBuilder.mjs` | Pack an ordered tile list into a ground atlas; order defines GID. |
| `scripts/lib/propBaker.mjs` | Emit one trimmed PNG per contract prop name. |
| `scripts/lib/venueBaker.mjs` | Descriptor → `.tmj`; object sizes read from baked bitmaps; collision derived. |
| `scripts/lib/districtGround.mjs` | The `cityGrid` procedural ground/roads generator (seeded, order-sensitive). |
| `scripts/lib/appearanceComposer.mjs` | `AppearanceRecord` → character sheet + portrait canvases. |
| `scripts/lib/agentBaker.mjs` | `bake(record)` — idempotent, content-addressed, atomic. |
| `scripts/lib/contractValidator.mjs` | CI gate: every name resolves, every venue prop exists, geometry matches bitmaps. |
| `scripts/world-bake.mjs` | Entry point for the world bake. |
| `scripts/agent-bake.mjs` | Entry point for batch and single-hash agent bake. |
| `scripts/validate-contract.mjs` | Entry point for the CI gate. |
| `scripts/gen-fixture-pack.mjs` | Generate the synthetic pack under `test/fixtures/pack-src/`. |
| `packages/shared/src/types/Assets.ts` | `VenueDescriptor`, `AppearanceRecord`, `AgentPresence`, `PresenceState`, `PublishedVenue`, `SCHEMA_VERSION`. |
| `packages/shared/src/hash.mjs` | FNV-1a `hashString`. One definition, shared by the appearance bake, `venueSlots` and (by mirror) the api. |
| `packages/shared/src/appearance/derive.mjs` | Pure derivation + `appearanceHash`; re-exports `hashString` from `../hash.mjs`. One implementation, shared by bake and runtime. |
| `packages/client/src/game/venueRegistry.ts` | Enumerate venue descriptors; `venueId → VenueDescriptor \| undefined`. |
| `packages/client/src/game/venues.generated.ts` | Bake-emitted (Plan 2 Task 18): the full `VenueDescriptor[]` as a TS module Vite bundles statically; `venueRegistry.ts` imports it. |
| `packages/client/src/game/assets.generated.ts` | Bake-emitted (Plan 3 Task 23): prop names, animated-object keys, emote frame pairs. |
| `packages/client/src/game/PresenceModel.ts` | The three presence states. |
| `packages/client/src/game/agents/AppearanceResolver.ts` | `spriteSeed → appearanceHash → textureKey`, with default-sheet fallback. |
| `test/*.test.mjs`, `test/*.test.ts` | All tests. |
| `Dockerfile.client`, `Dockerfile.server`, `docker-compose.yml` | Containerisation. |
| `aisocialnetwork-api/src/db/migrations/037_add_schedule_venue.js` | `users_schedules.venue`. |
| `aisocialnetwork-api/src/utils/venueVocabulary.js` | Load + validate against the published `venues.json` (schema'd shape checked at load time). |
| `aisocialnetwork-api/src/utils/scheduleCoverage.js` | SC-1 normalisation + affordance-queried venue assignment (`deriveVenuesAffording`, `deriveHomeVenue`, …). Supersedes the `ACTIVITY_POOLS` design (F-7). |

### Modified

| Path | Change |
|---|---|
| `package.json` (root) | `test`, `bake:world`, `bake:agents`, `validate:contract` scripts. |
| `packages/shared/package.json` | `exports` gains the `./*.mjs` subpath pattern. |
| `packages/{shared,client,server}/tsconfig.json` + `packages/server/tsconfig.build.json` | `allowJs`, so `tsc` follows the shared `.mjs` modules (all four configs — Plan 1 Task 2). |
| `packages/client/vite.config.ts` | String alias → exact+prefix regex pair, so `@botville/shared/*.mjs` subpaths resolve. |
| `.gitignore:20-24` | `limezu/` → `pack/`; add `baked/`. |
| `README.md:82-99` | Correct the pack list to four; document the new pipeline. |
| `scripts/build-district.mjs`, `scripts/build-interiors.mjs` | **Deleted** in Task 19, after `VenueBaker` reproduces their output. |
| `packages/client/src/game/config.ts` | `CAMERA` ladder; `INTERIOR_IMAGES` / `DISTRICT_IMAGES` / `INTERIORS` removed once the registry supersedes them. |
| `packages/client/src/game/assetManifest.ts` | Emote frame indices move to the adapter; paths `limezu/` → `pack/`. |
| `packages/client/src/game/scenes/PreloaderScene.ts` | Loads from the registry. |
| `packages/client/src/game/scenes/InteriorScene.ts` | Parameterised by descriptor. |
| `packages/client/src/game/scenes/{Cafe,Dorm,Library,Office}Scene.ts` | **Deleted** in Task 24. |
| `packages/client/src/game/{SceneRegistry,GameInit}.ts` | Registry-driven scene list. |
| `packages/client/src/game/agents/AgentSprite.ts` | Texture via `AppearanceResolver`. |
| `aisocialnetwork-api/src/utils/agentSeed.js` | Export `pickFrom` (currently module-private) — Plan 5 Task 32 Step 0. |
| `aisocialnetwork-api/src/models/Schedule.js` | Add `ORDER BY start` (explicit, not load-bearing). |
| `aisocialnetwork-api/src/workers/populateUserProfiles.js` | Emit + validate + store `venue`; normalise to total coverage. |

---

## How this work is split

This is six plans, not one. Each is independently executable, ends with working
software, and is worth a fresh reviewer's gate. Execute them in order; only
Plan 6 needs the licensed art.

| Plan | Tasks | Depends on | Deliverable | Exit criterion |
|---|---|---|---|---|
| **1 — Foundations** | 1, 2, 4–10 | — | Contract, adapter, reader, CI gate, fixture pack | `npm run validate:contract` green for both packs; zero behaviour change |
| **2 — World bake** | 11–19 (+14a, 19a), 25 | 1 | Venues and art source become data | `npm run bake:world` builds the whole world from data — residence instances included; a venue no code mentions produces a loadable map (G-C) |
| **3 — Runtime registry** | 21–24, 34, 36, 37 | 1, 2 | Scenes read a registry | Four interiors load, four subclasses gone, typecheck clean |
| **4 — Appearance** | 26–30, 38 | 1, 3 | Identity-derived, content-addressed sprites | Distinct sprites across an 85-agent roster (G-D) |
| **5 — Platform seam** | 31–33 | 1, 2 | `venue` stored at write time, one vocabulary | SC-1 holds for every agent in the live DB (G-F, G-G) |
| **6 — Art & deployment** | 3, 3b, 20, 35, 38b, 39 | 1–5 | Real pixels, real deploys | Golden gate green; Vercel and Railway deploys work; LimeZu credit shipped; hero re-rendered |

**Plans 1–5 need no licensed art and no owner input.** They are developed and
tested against the synthetic fixture pack. Plan 6 is where the packs land, and
it is the only plan that can be blocked by something outside the repo.

**Iterating.** Ship a plan, look at it, then start the next. Plan 2 is the one
worth pausing after — it is where the design's central claim (venues are data)
either holds or does not, and everything downstream assumes it.

---

## The art, and why it no longer gates anything

The original blocker: Task 3 captures a byte-level baseline by running
`scripts/build-district.mjs` and `build-interiors.mjs`, but Task 19 deletes
those scripts sixteen tasks earlier. With the packs absent, Task 3 runs *last*
and the scripts it needs are gone.

**The fix is to freeze, not delete.** Task 19 moves both scripts to
`test/golden/legacy/` — removed from `scripts/` (so the bake has one source of
truth) but preserved as a frozen reference implementation the golden gate can
run whenever the art arrives. They are never invoked by the build, never
imported by anything, and carry a header saying so.

Consequences:

- Task 3 works at any point in the sequence, before or after Plan 2.
- Plan 6 is genuinely deferrable: Plans 1–5 ship a complete, renderable,
  deployable city on the fixture pack, and Plan 6 swaps the pixels in.
- Task 20 stops needing the "if you still have the Task 3 working tree"
  archaeology — it runs the frozen scripts itself.

---

## Task index

| # | Task | Plan | Needs art? |
|---|---|---|---|
| 1 | Test harness | 1 | no |
| 2 | Shared asset types, `SCHEMA_VERSION` + `schemaVersion.mjs` + `hash.mjs` + the `.mjs` subpath seam | 1 | no |
| 4 | `assets.contract.json` + `AssetContract` loader | 1 | no |
| 4a | **Pack index — inventory and sheet hashes** | 1 | no |
| 5 | `sources/limezu.json` — ground atlas tiles | 1 | no |
| 6 | `sources/limezu.json` — district props | 1 | no |
| 7 | `sources/limezu.json` — interior furniture | 1 | no |
| 8 | `SourceAdapter` + synthetic fixture pack | 1 | no |
| 9 | `SpriteReader` + crop pins | 1 | no |
| 9a | **Contact sheets — every choice on its floor, at 2×, night-tinted** | 1 | no |
| 10 | `ContractValidator` + CI gate | 1 | no |
| 11 | `AtlasBuilder` | 2 | no |
| 12 | `PropBaker` | 2 | no |
| 13 | Venue descriptors — four interiors | 2 | no |
| 14 | Venue descriptor — district | 2 | no |
| 14a | **Residence archetype + derived instances (addendum I.2/I.3, F-12)** | 2 | no |
| 15 | `VenueBaker` — interiors | 2 | no |
| 16 | `districtGround` generator | 2 | no |
| 17 | `VenueBaker` — district | 2 | no |
| 18 | `world-bake.mjs` + `venues.json` + `pack/` rename | 2 | no |
| 19 | Retire the old build scripts (freeze as legacy) | 2 | no |
| 19a | **Retire `sync-assets.mjs`'s 59 hardcoded paths** | 2 | no |
| 25 | Fixture-venue test (G-C as an executable claim) | 2 | no |
| 21 | `venueRegistry.ts` | 3 | no |
| 22 | Parameterise `InteriorScene` | 3 | no |
| 23 | Registry-driven `PreloaderScene` / `GameInit` | 3 | no |
| 24 | Delete the four interior subclasses | 3 | no |
| 34 | `PresenceModel` | 3 | no |
| 36 | Camera zoom ladder | 3 | no |
| 37 | Capacity + deterministic slot assignment | 3 | no |
| 26 | Appearance derivation (pure) | 4 | no |
| 27 | `AppearanceComposer` + U-1 fallback | 4 | no |
| 28 | `AgentBaker` — idempotent, atomic, portrait | 4 | no |
| 29 | Batch + event entry points | 4 | no |
| 30 | `AppearanceResolver` + I-13 | 4 | no |
| 38 | Palette separation check | 4 | no |
| 31 | Migration 037 + `venueVocabulary.js` | 5 | no |
| 32 | Schedule population: venue + SC-1 total coverage | 5 | no |
| 33 | Vocabulary sync CI check (both repos) | 5 | no |
| 3 | **Acquire packs, capture golden baseline, resolve U-1/U-2** | 6 | **YES — owner-gated** |
| 3b | Delete the QA symlink compatibility layer (after Task 3's capture) | 6 | **YES** (needs the packs on disk) |
| 20 | **Golden gate against the frozen legacy pipeline** | 6 | **YES** |
| 35 | Deployment: bake in Vercel/Railway, Docker for parity | 6 | no |
| 38b | LimeZu credit link (licence obligation) | 6 | no |
| 39 | Hero re-render | 6 | **YES** |

Task 27 left the art-gated set: it develops and tests entirely against the
fixture pack, and `capabilities.characterLayers` is a data flag — already
`true` from Task 5 (U-1 answered 2026-07-29), re-verified by Task 3 Step 7.
Nothing in it needs a licensed pixel. Task 35 left it too — the
deploy pipelines must work *without* art, which is precisely what makes them
safe to publish (I-12).

---

---

## Verification checklist

Run at the end of each plan. Every line is a claim stated so it fails if untrue.

**After every plan** — the loop you should be able to run at any commit:

```bash
npm run test:all          # fast suite, then the bake suite
npm run typecheck
npm run build
git status --porcelain    # must be empty: the tests do not touch the tree
```

**After Plan 2** (the world is data):

```bash
npm run validate:contract
npm run validate:contract -- limezu assets-src   # name resolution only, no art needed
npm run bake:world
npm run golden:names                              # the legacy lists still reconcile
```

**After Plan 4** (appearance):

```bash
npm run bake:agents -- --seed aisha_khan --gender female   # fixture pack by default; roster/roster.json does not exist until Plan 6 Task 35
node -e "import('./packages/shared/src/appearance/derive.mjs').then(()=>console.log('derive.mjs loads under bare node'))"
```

**After Plan 5** (platform seam), from the api repo located per Plan 5's «Before you start»:

```bash
cd "$API" && npm run migrate && npm test
```

**After Plan 6** (art and deployment):

```bash
npm run golden:capture                            # needs assets-src/
npm run test:bake                                 # the golden gate runs instead of skipping
npm run bake:agents -- --roster roster/roster.json  # roster created in Task 35 Step 11
npx vercel build                                  # the art-free public build
npx turbo build --filter=@botville/server         # the exact Railway command
docker compose build && docker compose up -d && curl -sSf http://localhost:8080/ >/dev/null && echo "docker OK"
```

A skipped suite prints its reason (Task 1 Step 4). If `npm run test:bake` says
`assets-src/ absent`, the golden gate did **not** run — that is Plan 6
outstanding, not a pass.

| Invariant | Asserted by |
|---|---|
| **I-1** no art-pack knowledge in code | `test/asset-contract.test.mjs` "emotes name statuses, never frame indices"; `test/asset-index.test.ts` "no source file hardcodes an emote frame index"; `test/bake/world-bake.test.mjs` "no output path names a vendor"; `test/sync-assets.test.mjs` "no LimeZu path appears in the script any more" |
| **I-2** unresolved name fails the build | `test/contract-validator.test.mjs`; `worldBake()` throws before writing |
| **I-3** exactly three presence states | `test/presence-model.test.ts` "there is no fourth state, whatever the input" |
| **I-4** animate within, never between | Structural: `VenueScene` only ever moves sprites inside its own map. `NIGHT_SCHEDULE` is recorded as a known violation (Task 22 note, spec §8.2) and removed by the integration project |
| **I-5** derivation is pure | `test/appearance-derive.test.mjs` "derivation is pure and deterministic" |
| **I-6** `bake()` idempotent, one implementation | `test/agent-baker.test.mjs` "bake is idempotent"; `test/agent-bake-cli.test.mjs` "batch and event agree" |
| **I-7** `SCHEMA_VERSION` in the artifact | `test/appearance-derive.test.mjs` "the hash embeds SCHEMA_VERSION" |
| **I-8** one vocabulary, checked both ends | `test/vocabulary-sync.test.mjs`; the api's `tests/venueVocabularySync.test.js` — lock check always, sibling check when reachable; `tests/scheduleCoverage.test.js` "every derived venue is in the published vocabulary" |
| **I-9 / SC-1** total non-overlapping coverage | `tests/scheduleCoverage.test.js` "deterministicDay tiles the day for both day types"; the live-DB query in Task 32 Step 8 |
| **I-10** venue assigned at write time | `saveSchedule` stores `venue`; no read-time matcher exists anywhere — `grep -rn "activity.*match\|match.*venue" src/` returns nothing |
| **I-11** identity projected, never copied | `AgentPresence` requires the four boundary fields; any additions are optional (addendum §I.4, `test/shared-types.test.ts`); BotVille stores no agent identity of its own |
| **I-12** no art in a public build | `test/deploy-config.test.mjs` "a Vercel Git build cannot contain licensed art"; `.dockerignore` and `PACK=fixture` exclude `assets-src` from every image; `deploy-server.mjs`'s safety gate strips it from the server mirror |
| **I-13** no animal appearances | `test/appearance-resolver.test.ts` "the fallback is always a human variant"; `test/appearance-derive.test.mjs` "no record can name an animal" |
| **Curation is recorded, not remembered** | every rect in `sources/<pack>.json` carries its `note` in the same committed file the build reads; a crop whose pixels changed fails `validate:contract` by name (pin tests in `test/contract-validator.test.mjs`) |
| **G-C** venues are data | `test/bake/fixture-venue.test.mjs` — a venue no code mentions produces a loadable scene, and the commit that adds it touches only `test/` |
| **G-F** the city looks inhabited | `tests/scheduleCoverage.test.js` "no venue holds more than half the roster at ANY hour — nights included" (F-12 resolved: sleep distributes across residences), "every published venue is occupied at some point in the week" |
| **G-H** BotVille is containerised | `test/deploy-config.test.mjs`; `docker compose up` in Task 35 Step 11 — alongside the Vercel and Railway paths it must not replace |
| **G-D** ≥10⁴ appearance space | `test/appearance-derive.test.mjs` "the space is at least 10^4" — 604,800 against 16 today |

---

## What this plan deliberately does not do

Recorded so a later reader does not mistake absence for oversight.

- **`NIGHT_SCHEDULE` stays.** `config.ts:114` has the client decide idle agents go to bed at 22:00. That invents a fact once presence is platform-driven (I-4), but `agentLife.ts` still owns the world and is out of scope. The integration project removes it. Tasks 22 and 37 leave it untouched and annotate it.
- **`api.ts` is not repointed.** `fetchAgentLocations` still calls BotVille's own server. `PresenceModel` is built and tested but not yet wired to a platform feed — that is the integration work.
- **`agentLife.ts` is not deleted, SQLite is not replaced.** Both explicitly out of scope (spec §2 non-goals).
- **`users.avatar` still points at `fakepersongenerator.com`.** The portrait is *produced* at `baked/<hash>-portrait.png` (Task 28); pointing the column at it is a one-column data decision for the owner, not an art task (spec §6.3, open decision 2).
- **Overflow UX above venue capacity is deferred.** `capacity` and deterministic slotting are in (Task 37); what a genuinely over-capacity room should *look* like needs a populated world to evaluate against (R-3, open decision 3).
- **Residence door tiles on the district map are a recorded FOLLOW-UP, not a gap.** Houses exist, bake, publish and load (Task 14a), and are reachable through the HUD agent-click path — but the `cityGrid` residential-zone extension (door tiles, addendum I.3 lazy-load LOD) deliberately waits until Plan 6 Task 20 captures the golden baseline, because extending the generator first would make the byte-exact gate compare against a moving target. See Task 14a's FOLLOW-UP note for the full reasoning.
- **O-5, the licence, is unblocked but unanswered.** The adapter makes the pack a data choice; Task 3 Step 8 reads the actual terms and Task 35 offers both deploy configurations. The design does not decide it (R-2, open decision 1).
- **Animals are not moved into the district descriptor as scenery.** Spec §6.2 says both that no agent may be *assigned* an animal appearance and that "animals move to the district descriptor as ambient scenery in the farm pen." The first is binding and is enforced (I-13, Task 30). The second would change what `agentLife.ts` renders in the farm pen today, and that file still owns the world and is explicitly out of scope — the same paragraph says so. So animal *textures* stay loaded, existing SQLite agents keep their `avatar_variant`, and the district descriptor keeps only the four `animal_sleep` night points it has now. What is forbidden is *deriving* an animal appearance, which nothing in the new path can do. Moving them to scenery belongs with the integration project that retires `agentLife.ts`.
- **`agentLife.ts`'s six-venue random mover keeps running.** It is what makes the city move until the platform feed exists.

### One naming divergence from the spec

Spec §4.2 lists a single runtime class `AssetRegistry` — "venues, props, avatar parts, geometry" — replacing the scattered `DISTRICT_IMAGES` / `INTERIOR_IMAGES` / `INTERIORS` lists in `config.ts`. This plan splits that responsibility in two, because the two halves have different lifetimes:

- `venueRegistry.ts` (Task 21) — hand-written, holds the venue lookup and the `unknown` path.
- `assets.generated.ts` (Task 23) — emitted by the bake, holds prop names, animated-object keys and emote frame pairs.

All three `config.ts` lists are deleted in Task 24, which is the outcome §4.2 asks for. A single `AssetRegistry` wrapping both would be a wrapper with no behaviour of its own; if a later task needs one façade, it is a rename, not a redesign.
