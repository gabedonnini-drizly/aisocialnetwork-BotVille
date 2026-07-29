# Review findings — BotVille visual assets plans

Reviewed 2026-07-29 against the working tree at `757ba20` and
`aisocialnetwork-api` at `6b753eb`. Every claim below was checked against the
filesystem or executed; Node 20.20.2 / 22.22.0 / 23.11.1 / 24.18.0 were
installed to make the tooling verdicts empirical rather than recalled.

Ranked by time wasted if discovered during execution rather than now.

---

## Verdict

**Not ready to execute.**

Not because the plans are bad. The engineering is unusually careful, and the
transcription work — the part the spec itself flags as highest-risk (R-5) — is
**flawless**: all 23 district ground tiles, all 13 interior tiles, all 27
furniture rects, all 31 district prop aliases, the district generator's PRNG and
every one of its 34 glow coordinates were checked tuple-by-tuple against the
source and match exactly. The `bookSign` generator in Plan 2 Task 12 is a
verbatim port, not a rewrite. Several mechanisms — the fixture pack, the
reconciliation snapshot, the frozen legacy scripts — are genuinely well-judged.

It is not ready for two reasons.

**First, the premise is false.** The plans assume *"we own the LimeZu packs,
they're just not on this machine."* You own nothing, and pack selection is open.
That strands roughly a third of the plan volume on a decision nobody has made.

**Second, ten blockers would stop a worker**, four of which fail *inside the
modules the plans promise are testable*, with error messages that point at the
wrong thing.

The smallest set of changes is at the end.

---

## Post-review update — 2026-07-29, after the pack research

**F-0 is substantially softened.** The pack research (see `ART-PACK.md`)
recommends the **LimeZu stack**, which the owner is buying. Three consequences:

- **Tasks 5–7 are not wasted.** Their ~64 transcribed rects target the pack that
  is being bought, and this review verified every one as correct.
- **`tileSize: 16` holds** (decision D-7). `loadContract()`'s throw is fine, and
  the contract's geometry is unaffected. LimeZu's 32/48 exports are *upscales*
  of 16px art, so a larger grid would buy no detail.
- **Task 20's golden gate has a real legacy pipeline to reproduce**, so C-2's
  "cut it" recommendation reverts to "keep **Tier 1 only**".

**What survives of F-0, and it still matters:** **U-1 is answered — the pack
ships separable character layers** (D-9). So `capabilities.characterLayers`
should be `true` from Task 5, not defaulted `false` and flipped in Task 3
thirty-four tasks later. **Plan 4's layered path is the one that ships**, and it
is currently exercised only by the fixture pack. The sequencing argument holds;
the "a third of the plan volume is stranded" claim does not.

**Two obligations no task covers:** LimeZu requires **credit** — a link to
`https://limezu.itch.io/` in the credits UI — and the licence does not address
browser delivery in words. The mitigation (bake merged atlases so no shipped
file mirrors the pack layout) is what the world bake already does; see
`ART-PACK.md` §"Licence red flags".

**Owner decisions from the review session are recorded in `DECISIONS.md`,**
including a scope expansion — more residences, opening hours, staged behaviours
— that requires a **spec addendum** before any plan is edited. No plan file has
been changed yet.

---

## The structural finding

### F-0 — The plans invert the spec's build order, and the inversion no longer holds

**Severity:** blocker · **Location:** `00-INDEX.md` "The six plans"; spec §15

**The claim.** Spec §15 phase 1 is *"Acquire and verify. Obtain the art pack;
populate `assets-src/`… Determine R-1 empirically."* The plans move art to
**Plan 6, last**, reasoning *"the art is not a blocker on anything except its own
plan"* (`00-INDEX.md:60`). That reasoning is sound only if the pack is already
chosen.

**The evidence.** Three things downstream depend on the pack and are scheduled
before it:

1. **Tile size.** `loadContract()` *throws* on anything but 16 —
   `01-foundations.md:975`: `if (raw.tileSize !== 16) throw new Error(...)`.
   Every atlas, collision box, camera rung and descriptor assumes it. You have
   said tile size is **open**.
2. **`capabilities.characterLayers`.** Set `false` as a "safe default" in Task 5
   and flipped by Task 3 Step 7 — *thirty-four tasks later*. It is the
   difference between ~690,000 appearances and a few hundred recolours. Plan 4
   develops and tests the whole appearance system against a fixture that
   hardcodes `characterLayers: true` (`01-foundations.md:2045`) while the only
   real adapter says `false`. **The palette-remap path — the one that ships if
   the pack has no layers — is exercised by no test at all.**
3. **~64 hand-transcribed crop rects** across Tasks 5–7, with tests asserting
   exact coordinates (`01-foundations.md:1369`). All verified correct — and all
   discarded if you buy a different pack.

**The fix.** Needs your decision, but the shape is clear: insert a **Plan 0**
before Plan 1 — pack requirements → candidate evaluation → purchase → unpack →
answer U-1 (layers) and U-2 (licence) → fix `tileSize`. Then Tasks 5–7 are
written once, against art you own.

This does **not** re-open the spec's architecture. Contract/adapter/bake is
right and survives intact. What changes is *when* the pack is chosen.

---

## Blockers

### F-1 — TypeScript parameter properties cannot load under `node --test`

**Severity:** blocker · **Location:** `03-runtime-registry.md:695`
(`PresenceModel.ts`), `04-appearance.md:1127` (`AppearanceResolver.ts`)

**The claim.** Two modules the Global Constraints explicitly promise are
node-tested use syntax Node's type stripping refuses, on **both** 22 and 24.

**The evidence.** Executed:

```
######### NODE 24.18 — constructor(private registry: VenueLookup) under node --test
  constructor(private registry: VenueLookup) {}
                      ^^^^^^^^^^^^^^^^^^^^^
SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript parameter property
is not supported in strip-only mode
######### NODE 22.22 — identical failure
```

Parameter properties are non-erasable: they generate assignment code, so
strip-only mode cannot handle them. No flag in the plans fixes it
(`--experimental-transform-types` would, and changes the whole loader story).

The Global Constraints block, repeated in all six plans, says: *"`appearance/derive.mjs`,
`venueRegistry.ts`, `PresenceModel.ts` and `AppearanceResolver`'s resolution
half are unit-tested under `node --test`."* Both named modules fail. A third
instance is at `03-runtime-registry.md:221` (`VenueScene`), which is Phaser-side
and not node-tested, so it is safe — but it will be copied.

This is the **most time-wasting** blocker: it surfaces only after the module and
its whole test file are written, and the instinct will be to blame
`test/ts-resolve.mjs`.

**The fix.** Declare the field explicitly in all three constructors:

```ts
private readonly registry: VenueLookup;
constructor(registry: VenueLookup) { this.registry = registry; }
```

and add a line to the Global Constraints block banning parameter properties
alongside enums and namespaces.

### F-2 — `@botville/shared/appearance/derive.mjs` resolves under nothing

**Severity:** blocker · **Location:** `04-appearance.md:365` (Task 26 Step 4),
consumed by `03-runtime-registry.md:1017` and Plan 4 Tasks 29/30/34

**The claim.** The subpath import breaks bare `node`, `node --test` and
`vite build` simultaneously — and fails *differently* in each, so it reads like
three unrelated bugs.

**The evidence.** `packages/shared/package.json`'s `exports` map has **only
`"."`**, and no subpath import exists anywhere in the repo today to have shaken
this out. Executed against the real package:

```
$ node -e "import('@botville/shared/appearance/derive.mjs')…"
ERR_PACKAGE_PATH_NOT_EXPORTED: Package subpath './appearance/derive.mjs' is not
defined by "exports" in /…/node_modules/@botville/shared/package.json
```

Vite is worse. The client's `resolve.alias` uses a **string** key, and
`@rollup/plugin-alias` prefix-matches (`importee === find || importee.startsWith(find + '/')`),
so the single `'@botville/shared'` alias mangles the subpath into a path
*through* a file:

```
$ vite build
[vite:load-fallback] Could not load …/shared/src/index.ts/appearance/derive.mjs
  (imported by src/main.ts): ENOTDIR: not a directory
```

Both fixes were verified working:

```
FIX A: add  "./appearance/derive.mjs": "./src/appearance/derive.mjs"  to exports
  → RESOLVED, SCHEMA_VERSION=1
FIX B: replace the string alias with an exact+prefix regex pair
  {find: /^@botville\/shared$/,  replacement: …/shared/src/index.ts}
  {find: /^@botville\/shared\//, replacement: …/shared/src/}
  → ✓ 3 modules transformed. ✓ built in 19ms
```

**Both halves are needed.** Make this part of **Plan 1 Task 2**, not a discovery
in Plan 4.

### F-3 — Client `tsc --noEmit` fails on the same import, and Task 2 argues against the fix

**Severity:** blocker · **Location:** `01-foundations.md:572-588` (Task 2 Step 5)

**The evidence.** Task 2 scopes `allowJs` to shared and states the rationale
explicitly: *"this package only, since it is the only one with a `.mjs` source
and widening the whole repo buys nothing."* But Plan 3 Task 37 and Plan 4 Task 34
put that `.mjs` import inside client `.ts` files, and the client tsconfig maps
`@botville/shared/*` → `../shared/src/*`:

```
$ npx tsc --noEmit   # client tsconfig as it exists today
error TS7016: Could not find a declaration file for module
'@botville/shared/appearance/derive.mjs'. '…/shared/src/appearance/derive.mjs'
implicitly has an 'any' type.
$ npx tsc --noEmit   # same, with allowJs added to the client tsconfig
exit 0
```

The `shared` half of Task 2's claim is **correct** — replicated exactly with
TypeScript 5.9.3:

```
dist/schemaVersion.d.mts  dist/schemaVersion.mjs  dist/types/Assets.js  …
```

Current baseline is green: `npx turbo typecheck --force` → 3 successful, 0 cached.

**The fix.** Also set `allowJs: true` in `packages/client/tsconfig.json`, and
correct Task 2's rationale — the client *does* end up with a `.mjs` in its
program.

### F-4 — Plans 3 and 4 are circularly dependent

**Severity:** blocker · **Location:** `04-appearance.md:13` vs
`03-runtime-registry.md:903,1017`

**The evidence.** `04-appearance.md:13` declares **"Depends on: … Plan 3."**
But `03-runtime-registry.md:903` says Task 37 *"Consumes: `hashString` (Task 26)"*
and `:1017` imports it:

```ts
import { hashString } from '@botville/shared/appearance/derive.mjs';
```

`hashString` is produced by **Plan 4** Task 26. `00-INDEX.md:27` says "Execute
in order", so Plan 3 runs first — and Task 37 cannot.

**The fix.** Move Task 37 (and Task 36, see the plan-quality section) into a
later polish plan after Plan 4, or move `hashString` into Plan 1 Task 2
alongside `schemaVersion.mjs`. The second is cleaner: it is a pure 8-line
function with no dependencies, and Plan 1 already owns the `.mjs` seam.

### F-5 — Task 8a is sequenced before Task 9 but statically imports it

**Severity:** blocker · **Location:** `01-foundations.md:2233` (Task 8a Step 3)

**The evidence.** `scripts/lib/decisions.mjs` opens with a top-level

```js
import { readSprite } from './spriteReader.mjs';
```

`spriteReader.mjs` is created by **Task 9**, which runs *after* Task 8a. The
plan admits it in its own Interfaces block: *"Consumes: … `readSprite()` (Task 9)
for pinning."* Every test in `test/decisions.test.mjs` fails at import with
`ERR_MODULE_NOT_FOUND`, as does the `pretest` hook Step 6 rewrites to call
`adapt.mjs --pin`.

**The fix.** Swap the order (9 before 8a), or make it lazy — `pinFor` is the only
consumer, so `const { readSprite } = await import('./spriteReader.mjs')` inside
it works and preserves the sequence.

### F-6 — Task 8a Step 7 asserts an outcome that cannot happen

**Severity:** blocker · **Location:** `01-foundations.md` Task 8a Step 7

**The claim.** *"Expected: **`sources/limezu.json` is unchanged.** … if
regenerating the adapter from the decision record alters a single byte, a
decision was transcribed wrong."* It will always alter many bytes, and a worker
will hunt a transcription error that does not exist.

**The evidence.** `toAdapter()` (`:2248-2266`) guarantees three differences from
the Task 5–7 hand-written file:

1. A new top-level `_generated` key. The plan's own test two screens earlier
   *requires* it: `assert.match(j._generated, /decisions\.json/)` (`:2168`).
2. Key order changes — hand-written is `{pack, capabilities, files, rects}` with
   `emoteFrames` appended; generated emits `emoteFrames` before `files`.
3. `rects` keys are re-sorted alphabetically (`Object.keys(decisions).sort()`,
   `:2250`), whereas Tasks 5–7 wrote them in semantic order.

**The fix.** State the truth and verify semantically:

```bash
node -e 'const a=require("./sources/limezu.json");
const b=JSON.parse(require("child_process").execSync("git show HEAD:sources/limezu.json"));
const k=o=>JSON.stringify(Object.fromEntries(Object.entries(o.rects).sort()));
console.log(k(a)===k(b) ? "rects identical" : "RECTS DIFFER")'
```

### F-7 — `venueIds` is used but never imported; every weekend schedule throws

**Severity:** blocker · **Location:** `05-platform-seam.md:500,594` (Task 32)

**The evidence.** The require at `:500` is

```js
const { indoorVenueIds, isValidVenue } = require('./venueVocabulary');
```

`indoorVenueIds` is imported and never used. `venueIds` is used at `:594`:

```js
return hit ? hit[1] : venueIds();
```

The weekend shape (`:661-665`) contains `activity: 'Slow Morning'` and
`activity: 'Hobbies'`. Checked against all seven `ACTIVITY_POOLS` regexes
(`:581-589`): **neither matches any of them.** (`'Errands'` matches
`/errand|shop|…/`; the `'Downtime'` filler at `:504` matches
`/home|rest|downtime|quiet/`.) So every weekend schedule for every agent hits
the unmatched branch and throws `ReferenceError`.

**The fix.** `const { venueIds, isValidVenue } = require('./venueVocabulary');`
plus a pool entry covering `/morning|hobby|hobbies|leisure/`.

### F-8 — Task 20 Tier 1 treats raw copied sheets as bake outputs

**Severity:** blocker · **Location:** `06-art-and-deployment.md:501,536`

**The evidence.** Task 20 defines

```js
const isGenerated = p => /^(tilesets\/limezu\/|sprites\/limezu\/)/.test(p);
```

commented *"raw sync-assets copies are not bake outputs"*. But
`scripts/sync-assets.mjs:26` copies **into exactly that directory**:

```js
[`${EXT}/1_Terrains_and_Fences_16x16.png`, 'tilesets/limezu/1_Terrains_and_Fences_16x16.png'],
```

`capture-golden-baseline.mjs` runs `sync-assets.mjs` (`:139`) then hashes every
PNG under `public/assets`, so the baseline is full of raw sheets matching
`isGenerated`. `worldBake` writes only `tilesets/pack/{district,interiors}_ground.png`.
The assertion at `:536` fails by roughly the number of raw sheets.

Worse: **`writeReport()` is called *after* that assert**, so
`test/golden/report.json` — the file the failure message tells you to read — is
never written. Same ordering bug in all four tiers.

**The fix.** Derive the expected set from `contract.allNames()` + atlas ids
rather than a path prefix. Move `writeReport()` above the first assertion in
every tier.

### F-9 — Plan 6 Task 3 contradicts Plan 2 Task 19a

**Severity:** blocker · **Location:** `06-art-and-deployment.md:192-194` vs
`02-world-bake.md:2055-2059` — your suspicion #1, **confirmed**

**The evidence.** Task 3 Step 3 says:

> Expected: `sync-assets: скопировано 110/110` … **Fix the path in
> `scripts/sync-assets.mjs` (that is what the explicit list is for)**

Task 19a deletes that list and adds a test forbidding its paths:

```js
for (const marker of ['ME_Singles', 'Room_Builder', '_16x16.png', 'exteriors/themes'])
  assert.equal(src.includes(marker), false, `sync-assets.mjs still names ${marker}`);
```

After Plan 2 there is no list to fix, and the script copies only `runtimeSheets`
(≈7 names), not 110 files. Separately, the legacy scripts read `assets-src/`
**directly** (`scripts/build-district.mjs:19`), so `sync-assets.mjs` is
irrelevant to them — it runs only to populate the raw copies that then break F-8.

**The fix.** Rewrite Task 3 Step 3 for the post-19a world: drop the `110/110`
expectation, replace "fix the path in the list" with "fix the `files` block in
the adapter and re-run `npm run adapt`", and remove the `sync-assets.mjs` call
from `capture-golden-baseline.mjs`.

### F-10 — `deploy:client` is written twice, contradictorily, and ends up wrong

**Severity:** blocker · **Location:** `02-world-bake.md:2191` (Task 19 Step 5)
vs `06-art-and-deployment.md:859` (Task 35 Step 4)

**The evidence.** Plan 2 sets it to
`node scripts/sync-assets.mjs limezu assets-src && npm run bake:world -- limezu assets-src && ...`
— with a **literal `...`** that would be pasted into `package.json` as an
unrunnable script. Plan 6 then rewrites it *dropping* the `limezu assets-src`
arguments from `sync-assets.mjs`. Per Plan 2's own new CLI signature
(`const pack = process.argv[2] ?? 'fixture'`), the owner's real-art deploy would
sync **fixture** sprites while baking the **limezu** world.

Task 35's own test only asserts `/limezu/` appears somewhere in the string, so it
passes anyway.

**The fix.** Delete the Plan 2 snippet (leave a note that Task 35 rewrites it);
make Plan 6's value start `node scripts/sync-assets.mjs limezu assets-src && …`;
strengthen the test to assert `/sync-assets\.mjs limezu assets-src/`.

### F-11 — Plan 5 claims to be the only plan touching the api; it is not

**Severity:** blocker · **Location:** `00-INDEX.md`; `05-platform-seam.md`
"Depends on"

**The evidence.** Plan 5's `scheduleCoverage.js` requires
`const { hashString, pickFrom } = require('./agentSeed');`. Verified in the api:
`src/utils/agentSeed.js:178` defines `pickFrom`, and `module.exports` at 199-206
lists `hashString, CITY_POOL, pickCity, TRAIT_NAMES, deriveDefaultTraits,
deriveDescriptionSeeds` — **`pickFrom` is absent.** The export is added by
**Plan 4 Task 26 Step 5**. Without it, every `deriveVenue` / `venueAffinity` call
throws `TypeError: pickFrom is not a function`. Spec §15's *"Phase 6 is the only
one touching `aisocialnetwork-api`"* is equally false.

**The fix.** Add "Plan 4 Task 26 Step 5" to Plan 5's `Depends on:` and correct
both statements.

---

## Significant

### F-12 — Every agent sleeps in a room that holds six

**Severity:** significant · **Location:** `05-platform-seam.md:653,661`;
`02-world-bake.md:553`

**The claim.** For 9 hours of every day all 85 agents are assigned
`venue: 'dorm'`, capacity **6**. Simultaneously the district — the flagship view
and the subject of the hero image — is **empty**.

**The evidence.** Both day types contain, unconditionally:

```js
{ start: bed, end: wake, activity: 'Sleep', venue: 'dorm' },
```

`bed = 21 + pick('bed', 2)`, `wake = 6 + pick('wake', 3)` → 21:00/22:00 to
06:00/07:00/08:00. Note it is also **not filtered through `isValidVenue`**,
unlike every other branch — a second, smaller bug against I-8.

Capacities from Task 13's descriptors: office 4 (`:453`), cafe 9 (`:499`),
**dorm 6** (`:553`), library 4 (`:596`), district 96 (`:729`). So the night state
is **85 agents in a capacity-6 room — 14× over** — while a capacity-96 outdoor
district sits empty.

`standingSlot` scatters them over `(20-4) × (15-5) = 160` floor cells: 85 of 160
cells filled with 16×32 sprites in a 320×240px room, standing on beds and
through furniture (F-14).

The G-F test is scoped around this. The exit criterion reads *"no venue holds
more than half the roster **during waking hours**"* (`05-platform-seam.md:15`).
Excluding the hours when the invariant is violated 100% of the time is not a test
of the invariant.

**The fix.** Needs your decision:

- **(a) Dorms are per-agent, not a place.** Sleep sets `venue: null` → `absent`.
  The city empties at night by design and the district's night lighting is the
  show. One line.
- **(b) Multiple dorms**, seed-assigned via `venueAffinity`. Costs *n*
  descriptors and *n* maps.
- **(c) Raise capacity and accept the pile** — requires the overflow UX R-3 defers.

I recommend **(a)**: it is one line, it makes the hero image better, and it
removes the only place the plans guarantee an over-capacity venue.

### F-13 — Task 37 silently deletes existing bed-preference behaviour

**Severity:** significant · **Location:** `03-runtime-registry.md:895,1094-1127`

**The claim.** The plan describes the code it replaces inaccurately, and the
replacement drops a behaviour nobody decided to drop.

**The evidence.** Task 37 says *"seat assignment is `find(s => !s.occupiedBy)` —
order-dependent."* The actual code at `InteriorScene.ts:240-245` is a two-stage
search:

```ts
const isAnimal = getVariant(a.avatarVariant).kind === 'animal';
const wantBed = !isAnimal && isSleepTime(GameTime.hour);
const preferred = this.seats.find(s => !s.occupiedBy
  && (isAnimal ? s.kind !== 'bed' : (wantBed ? s.kind === 'bed' : s.kind !== 'bed')));
const seat = preferred
  ?? this.seats.find(s => !s.occupiedBy && (!isAnimal || s.kind !== 'bed'));
```

Task 37's replacement drops `wantBed` / `isSleepTime` entirely: humans stop
preferring beds at night and stop avoiding them by day. Combined with F-12 —
where every agent is in the dorm all night — this is exactly backwards.

**The fix.** Carry the day/night bed preference into `assignSlots` (it can take
the hour), or state the regression explicitly.

### F-14 — Standing agents are placed without regard to furniture

**Severity:** significant · **Location:** `03-runtime-registry.md:1047-1062`

**The evidence.** `standingSlot` computes its floor grid purely from room
dimensions:

```ts
const cols = W - 4;  const rows = H - 5;  const cells = cols * rows;
const cx = 2 + (cell % cols);
const cy = 3 + Math.floor(cell / cols);
```

`venue.furniture` is never read. Task 15 derives the collision layer from exactly
those footprints, so the system knows precisely which cells are blocked — and the
slot assigner ignores it. None of the ten tests catch it: they assert
determinism, bijection and in-room bounds, never "not inside a prop."

**The fix.** Pass the derived footprints in and filter the cell list before
computing `strideFor(cells)`. The bijection argument survives — it only needs
`cells` to be the count of *free* cells. Add a test asserting no standing slot
intersects a footprint.

### F-15 — The animal-on-bed fallback collides two agents

**Severity:** significant · **Location:** `03-runtime-registry.md:1124-1125`

**The evidence.** `assignSlots` calls
`standingSlot(venue, id, rank - venue.seats.length)` (`:1082`) — the third
argument is a **floor rank**. The scene fallback passes a **global** rank:

```ts
const rank = [...slots.keys()].indexOf(a.id);
const floor = seat ? standingSlot(this.venue, a.id, rank) : slot;
```

A seated agent has `rank < seats.length` — precisely the range already consumed
by the first `seats.length` standing agents. Cafe has 9 seats; a re-routed agent
at rank 3 gets the same cell as the standing agent at overall rank 12. This is
the exact collision Task 37's test at `:943-953` claims is impossible.

**The fix.** `standingSlot(this.venue, a.id, rank + agentList.length)`, or better,
move the animal/bed rule inside `assignSlots` so there is one placement authority.

### F-16 — `scale.resolution` does not exist in the installed Phaser, and the test is a tautology

**Severity:** significant · **Location:** `03-runtime-registry.md:852-874`

**The evidence.** Installed Phaser is **3.90.0** (declared `^3.88.2`).
`types/phaser.d.ts:72843` — `type ScaleConfig` admits only `width, height, zoom,
parent, expandParent, mode, min, max, snap, autoRound, autoCenter,
resizeInterval, fullscreenTarget`. **There is no `resolution`.** Adding it to the
object literal is a TS excess-property error, directly contradicting Step 6's
"typecheck clean".

The behaviour is also wrong: `zoom: 1/floor(dpr)` on a `Scale.RESIZE` canvas
shrinks the game to half CSS size on a 2× display, and on the 1.5× display the
step claims to fix, `floor(1.5) = 1` → no change at all.

And the test (`:866-874`) declares its own local helper and asserts `Math.floor`
works. It never imports `GameInit.ts`. **It would pass if the config were
deleted.**

**The fix.** Drop `resolution`. `pixelArt: true` + `roundPixels: true` + integer
camera zoom already gives sharp edges. Delete the tautological test.

### F-17 — `cameraControls.ts` uses `zoomTo`, not `setZoom`

**Severity:** significant · **Location:** `03-runtime-registry.md:829`

**The evidence.** Step 4 says *"Replace every `cam.setZoom(cam.zoom * CAMERA.zoomStep)`
/ `/ CAMERA.zoomStep`"*. The actual code is:

```ts
cameraControls.ts:89  cam.zoomTo(Phaser.Math.Clamp(cam.zoom * CAMERA.zoomStep, minZoom, maxZoom), 300))
cameraControls.ts:91  cam.zoomTo(Phaser.Math.Clamp(cam.zoom / CAMERA.zoomStep, minZoom, maxZoom), 300))
```

The only bare `setZoom` is a local helper at `:62-63` used by wheel (`:93`) and
pinch (`:112`). **A literal search-and-replace finds nothing.**

**The fix.** Rewrite Step 4 against the real call sites, preserving the 300ms
`zoomTo` tween — dropping it would make button-zoom snap instead of glide.

### F-18 — Three replacement ranges over- or under-reach

**Severity:** significant · **Location:** Plan 3 Tasks 23, 24; Plan 4 Task 30

Applying these verbatim produces duplicated or deleted code:

- **`PreloaderScene.ts`** — Task 23 Step 4 says replace `39-63`, but the snippet
  ends with an `ANIMATED_OBJECTS` loop that lives at **64-69**. Applying it
  leaves a duplicate loop. Correct range: **39-69**. (The task header separately
  says `40-63`, disagreeing with its own step.)
- **`AgentSprite.ts`** — Task 30 says "lines 58-79". The constructor opens at
  **57**, and `:71-72` (`spriteH`, `spriteW`) plus `:75-76` (the shadow ellipse)
  fall inside the range but are **absent from the replacement**, while `spriteH`
  is consumed at `:89` and `this.shadow` throughout.
- **`InteriorScene.ts`** — Task 22 Step 2 says `103-112`; the snippet's first
  line is the `// выход:` comment at **102**.

**The fix.** Correct all three ranges and re-derive the snippets from the current
file contents.

### F-19 — Task 19 and Task 24's expected greps are wrong

**Severity:** significant · **Location:** `02-world-bake.md:1931`;
`03-runtime-registry.md:500`

**Task 19 Step 1** expects hits *"only in README.md, assetManifest.ts:7,
config.ts:28, InteriorScene.ts:35, PreloaderScene.ts:39 and the two files
themselves."* The real grep returns exactly five lines, and the expectation is
wrong four ways:

- `scripts/sync-assets.mjs:81` — **not listed** (a comment naming `build-district.mjs`)
- `config.ts:142` — **not listed** (names `build-interiors.mjs`)
- `README.md` — **does not match at all** (it names only `sync-assets.mjs`)
- `assetManifest.ts:7` — **does not match** (it names `sync-assets.mjs`)
- `InteriorScene.ts` is line **34**, not 35
- the two scripts do not self-reference

**Task 24 Step 1** omits `GameInit.ts:7,8,9,10,29` and `PreloaderScene.ts:2,44,57,61`
from the consumers that must be repointed.

**The fix.** Replace both with the verified lists, and add Step 2 edits for
`config.ts:142` and `sync-assets.mjs:81`.

### F-20 — The clean-tree guard is in the wrong suite and cannot run last

**Severity:** significant · **Location:** `02-world-bake.md:1719-1743`

**The evidence.** The file's comment says *"This runs LAST by filename convention
(z-prefixed suites sort late)"* — but the filename is `clean-tree.test.mjs`,
which sorts near the front. More decisively: it lives in the **fast** suite
(`test/*.test.mjs`) while `world-bake.test.mjs`, which does the writing, lives in
the **slow** one (`test/bake/**`). `npm test` never runs them together. Both
suites also use `--test-concurrency`, so file order is not guaranteed anyway.

**The fix.** Move it to `test/bake/zz-clean-tree.test.mjs` **and** run
`git status --porcelain` as a shell step in `test:all` — a process-level check is
the only one immune to runner ordering.

### F-21 — `worldBake` requires `generatedDir` and never writes to it

**Severity:** significant · **Location:** `02-world-bake.md:1793-1856` — your
suspicion #2

**The evidence.** `worldBake` destructures `generatedDir`, throws if absent
(`:1795`), returns it (`:1855`) — and **never uses it**. The
`assets.generated.ts` emission that would justify it arrives in Plan 3 Task 23.
So for all of Plan 2 every caller must supply a directory that is ignored, and
the test file creates a temp dir per bake for nothing.

The other four parameters are fine. `pack`/`srcRoot` are the adapter pair,
`outDir` is the deliverable, and `venuesDirs` legitimately defaults internally to
`[<repo>/venues]` (`:1800`) — which is why Plan 6 Task 20's four-argument call
works. **The signature is not the smell; this one parameter is.**

**The fix.** Have Task 18 emit `assets.generated.ts` immediately, or add the
parameter in Plan 3 when it acquires a purpose.

### F-22 — The api's conventions are not BotVille's, and the plans apply BotVille's

**Severity:** significant · **Location:** Global Constraints, replicated in all
six plans; applied to Tasks 31-33

**The evidence.** Every plan states *"Node ≥ 24 … `.nvmrc` = 24 … ESM everywhere
(`"type": "module"`)"* as binding on all tasks. In `aisocialnetwork-api`:
`engines` is `"22.x"`, there is **no `.nvmrc`**, `Dockerfile:1` is
`FROM node:22-bookworm`, and the codebase is **CommonJS**. The plan's api code is
correctly CommonJS, so only the constraint text is wrong — but a worker following
it literally will add `"type": "module"` and break ~90 test files.

Four api conventions the plans do not know about:

- **Every migration since 030 ships a paired lint test.**
  `tests/db/migrations/030…036_*.test.js` all exist; 036's header documents the
  pattern and states migrations are *never* run against a live DB from the
  suite — which Task 31 Step 7 and Task 32 Step 8 both do. No
  `037_add_schedule_venue.test.js` is planned.
- **`saveSchedule` is not exported** (`module.exports`, 1032-1057). Task 32 Step 5
  rewrites its signature to take a third argument, but no test can reach it.
- **Three existing tests import `populateUserProfiles.js` at module scope**
  (`buildUserDescription`, `voiceExemplars`, `voiceExemplarsBackfill`). A
  top-level `require('../utils/venueVocabulary')` makes all three read
  `config/venues.json` at import, and the loader throws if it is missing.
- **There is no CI in the api at all** — no `.github/`, no workflows, no lint
  config. Task 33's *"the lock check … runs in CI"* has nothing to run in.

Also: `migrate.js:28` calls `migration.up(pool)` and every existing migration
names the parameter `pool`; Task 31 writes `up(client)`. It works, but breaks the
convention `CLAUDE.md` documents. And `config/` and `src/scripts/` do not exist —
Step 4 `mkdir -p`s the former; nothing creates the latter.

**The fix.** Give Plan 5 its own Global Constraints block stating the api's actual
conventions; add the 037 migration test; export `saveSchedule`; make the
`venueVocabulary` require lazy; restate Task 33 as an `npm test` check.

### F-23 — Two smaller runtime defects

**`Slot.seatIndex` indexes two different arrays.** `assignSlots` sets
`seatIndex: rank` as an index into `venue.seats` (descriptor order, shape
`{at, side, kind}`). The scene consumes it as `this.seats[slot.seatIndex]`
(`:1111`), where `this.seats` is built from the TMJ `seats` object layer
(`InteriorScene.ts:92-100`, shape `{x, y, side, kind, occupiedBy}`, pixel
coords). The two orderings coincide only because `VenueBaker` emits objects in
descriptor order — **nothing asserts it and no test covers it.**

**`venueRegistry.all()` is documented "sorted by id" and does no sorting.**
Declared at `03-runtime-registry.md:68`; implemented at `:164-166` as
`return VENUES;`. The sort happens upstream in `02-world-bake.md:1801-1803`. The
`:84-87` test therefore tests the bake, not the registry, and breaks silently if
the bake's sort is removed.

### F-24 — `docker compose up` fails: `packages/server/.env` does not exist

**Severity:** significant · **Location:** `06-art-and-deployment.md:1038-1039`

Verified: `ls packages/server/.env` → *No such file or directory*, and it is
gitignored. Compose treats a missing `env_file` as a hard error, so Step 11's
`docker compose up -d` fails before any container starts.

**The fix.** `env_file: [{path: packages/server/.env, required: false}]` (compose
spec 2.24+), or commit `packages/server/.env.example`.

---

## Minor

### F-25 — `name in { grass: 1 }` sets the wrong provenance for nearly every decision

**Location:** `01-foundations.md:2309` — your suspicion #6, **confirmed wrong**

```js
provenance: name in { grass: 1 } ? "transcribed:build-district.mjs" : "transcribed:build-interiors.mjs",
```

`in` tests key membership, so this is true **only for the literal string
`grass`**. All 22 other ground tiles and all 32 district props — which really do
come from `build-district.mjs` — are labelled `build-interiors.mjs`.

The plan then says *"Then fix the provenance properly…"* — i.e. it knowingly
writes a wrong value and asks the worker to repair it **with no code shown**.
The clearest "says what to do without showing how" step in the set.

**Fix.** Derive it from the Task 4 snapshot, which already knows the split:

```js
const snap = JSON.parse(readFileSync("test/golden/legacy-names.json","utf8"));
const district = new Set([...snap.atlasTiles.district_ground, ...snap.propNames.district]);
provenance: district.has(name) ? "transcribed:build-district.mjs" : "transcribed:build-interiors.mjs",
```

### F-26 — `coversAll`'s lattice sampler has three defects

**Location:** `06-art-and-deployment.md:422-439` — your suspicion #5

1. **Rects thinner than the half-step are never sampled.** The loop starts at
   `r.y + step/2` (= +2), so any rect with `h <= 2` (or `w <= 2`) yields zero
   sample points and is silently reported as fully covered.
2. **The outer break can fire on a different rectangle's result.**
   `if (uncovered.at(-1)?.x === r.x && uncovered.at(-1)?.y === r.y) break;`
   inspects the global array. If the previous legacy rect shared an origin with
   the current one, the y-loop breaks early on a rect never found uncovered.
3. **`areaRatio` double-counts overlaps.** `sum(baked)/sum(legacy)` adds
   rectangle areas without union; derived footprint collision overlaps heavily,
   so `<= 1.6` compares two differently inflated numbers.

The inner x-loop `break` is **correct** — it stops at the first uncovered point
per row, which is the intent.

### F-27 — Counts and anchors that are simply wrong

| Claim | Location | Reality |
|---|---|---|
| *"roughly ninety judgements"* | `01-foundations.md:2097`, twice more in 9a | `allNames()` = **116**; rects with explicit crops = **64**; whole-file picks = 52 |
| *"59 hardcoded pairs"* in `sync-assets.mjs` | `02-world-bake.md:2019` | **61** literal pairs; **90** files at runtime once the fence/office/character loops run |
| *"ESM everywhere (`"type": "module"`)"* | Global Constraints, all six plans | Root `package.json` has **no `type` key**. Only the three workspace packages do. Root `.mjs` is ESM by extension. |
| *"Docker Compose"* in Tech Stack | all six plans | No Docker artifact of any kind exists; Task 35 creates them from scratch |
| `assetManifest.ts:210` (`byStatus`) | `01-foundations.md:953` | 210 is the doc comment; `byStatus:` is **211**, pairs **212-217** |
| `InteriorScene.ts:35` | `02-world-bake.md:1981` | line **34** |
| `InteriorScene.ts:76-119` layer reads | `02-world-bake.md` Task 15 | `ground` is read at **:70**; real range **70-119** |
| `Schedule.js:47` | `00-INDEX.md:41` + 2 more | `getCurrentSlot` opens at **:10**; the `LIMIT 1` is **:49**. The pre-flight table records this as **"✅ CONFIRMED"** |
| Phaser 3.88 | all six plans | declared `^3.88.2`, **installed 3.90.0** |
| Task 23 "3 new tests" | `03-runtime-registry.md:473` | **4** (Step 3 adds one) |
| Task 37 "9 new tests" | `03-runtime-registry.md:1135` | **10** |
| `$BOTVILLE_REPO` | Global Constraints | the helper implements `$BOTVILLE_REPOS_ROOT` |
| fixture char sheet *"the layout AVATAR_VARIANTS documents"* | `01-foundations.md:2034` | real sheets are 896×**656** (~20.5 rows); 8 rows is the *used* subset |

### F-28 — Smaller items

- **`readdirSync` without `isDirectory()`** in `validate-contract.mjs`
  (`01-foundations.md:3128`) and `worldBake` (`02-world-bake.md:1802`). One
  `.DS_Store` in `venues/` — near-certain on macOS — throws `ENOTDIR`.
- **Contact-sheet cells overflow.** `cellW = max(s.w*3 + PAD*4)` but the
  night-tinted copy ends at `PAD*3 + s.w*4`, which exceeds it whenever
  `s.w > 8` — i.e. every prop. It does not crash (`png-lib.mjs:85` silently
  ignores out-of-bounds writes), so the third column overwrites its neighbour.
  Fix: `cellW = max(s.w*4 + PAD*5)`.
- **`npm run test:bake` is green while running zero tests** from Task 1 until
  Task 4a creates the first `test/bake/` file. Exit 0, `ℹ tests 0`, on both 22
  and 24.
- **Node 20 breaks the harness entirely** — quoted globs are not expanded
  (`Could not find '…/test/*.test.mjs'`). Node 21+ globs; 22.22 and 24.18 both
  verified working with the plans' exact syntax. Moot once you install 24.
- **`git stash -u` does not stash ignored files**, so Task 35 Step 11's "fresh
  clone" simulation leaves `assets-src/` in place. Use `git stash -a` or build
  from `git archive HEAD`.
- **`npx vercel build`** needs the Vercel CLI, which is not in devDependencies.
- **Task 24 and Task 36 contradict** on `INTERIOR_CAMERA_ZOOM` — Task 24 says
  keep it, Task 36 says delete it. Task 36 is right (its `snapZoom` replacement
  removes the last consumer).
- **`ANIMATED_OBJECT_KEYS` is produced and never consumed** — the rewritten
  `PreloaderScene` still iterates `ANIMATED_OBJECTS` from `assetManifest.ts`.
- **`appearanceHashAt` and `BUILDS` are used by Task 26's own tests** but absent
  from its declared "Produces" list.
- **`PresenceModel` is never wired**, yet Task 22 adds a comment to
  `InteriorScene` asserting *"Неизвестный id сюда просто не доходит — его
  отсеивает PresenceModel"*. `00-INDEX.md:349` concedes it is unwired. The
  comment states as fact something no code does.
- **`indexPack` decodes every PNG twice** (`01-foundations.md:1241,1245`).
- **Duplicate index** — 037's `idx_users_schedules_lookup` largely duplicates
  `004:32`'s `idx_schedules_user_day`; the convention there is `idx_schedules_*`.
- **`README.md` documents three packs**, not the four `sync-assets.mjs` reads —
  Modern Farm and Modern Office are used but undocumented. Task 3 Step 9 fixes
  this, correctly.

**One suspicion dismissed.** I expected the `bookSign` generator to be a risky
rewrite that could never match Tier 1's byte-exact requirement. It is not:
`02-world-bake.md` Task 12 is a **verbatim port** of `build-district.mjs:97-122`
— same FONT glyphs, `TEXT='BOOKS'`, `textW = len*6-1`, `plateW`, `plateH`,
`py0=85`, and the same BORDER/PLATE/INK values. No action needed.

---

## Over-complexity: what to cut

You asked to keep every part no more complex than it needs to be. Four
candidates, judged by the failure each prevents.

### C-1 — The curation layer (Tasks 4a, 8a, 9a, 19a) — **keep two, defer one, cut one**

Roughly **1,400 lines of plan and ~30 tests**.

| Piece | Failure it prevents | Verdict |
|---|---|---|
| **Pins** (8a) | A pack update silently changes a sprite while every coordinate still resolves. Real, and undetectable any other way. | **Keep** |
| **`sheets.json`** (4a) | Same failure, coarser — names *which sheet* moved. A hash per file. | **Keep** |
| **Contact sheets** (9a) | Nothing breaks without them; they make a review *possible* that is currently *impossible*. You are about to validate a brand-new pack — this earns its keep soonest. | **Keep, move earlier** |
| **Decision record → generated adapter** (8a) | Preserves *why* a crop won. But for a pack you have not bought, there are no decisions yet — the migration exists purely to convert 64 rects that are themselves provisional. It is also the sole source of blockers F-5 and F-6. | **Defer** |
| **Per-cell `index.json`** (4a) | Nothing. Gitignored, regenerable, ~15,000 rows. | **Cut** |

You asked whether *"a `note` field and a sha256 would have covered 80% of it."*
**Yes, for the repo as it stands.** `note` + `pin` as fields on
`sources/<pack>.json` gets you provenance and change-detection with no generated
file, no `adapt.mjs`, no byte-identity test, and neither F-5 nor F-6. The
generated-adapter machinery only pays for itself once there are two packs and a
real migration to do.

**Recommendation:** keep pins + `sheets.json` + contact sheets; fold `why`/`pin`
into the adapter directly; drop `decisions.json`, `adapt.mjs`, `toAdapter()` and
the byte-identity test. Removes ~700 lines and two blockers.

### C-2 — The tiered golden gate (Task 20) — **cut, conditionally**

Four tiers, a declared-difference list, a semantic differ and a sampled collision
checker: ~600 lines, and the source of F-8 and F-26.

Its entire value is *"the new bake reproduces the old LimeZu pipeline byte for
byte."* **If you buy a different pack there is no old pipeline to reproduce** —
`build-district.mjs` reads LimeZu paths from `assets-src/` and will not run. The
gate's value is contingent on a decision not yet made.

Even on LimeZu, note what it protects: Tier 1 catches transcription errors in
Tasks 5–7 — which this review verified are **already correct**, tuple by tuple.
And Task 3 Step 6 explicitly invites you to *change* crops after reviewing the
contact sheets, each change then needing a hand-written `expectedDifferences`
entry. The gate fights the review.

**Recommendation:** if the pack changes, **delete Task 20**. If you buy LimeZu,
keep **Tier 1 only** and replace Tiers 2–4 with "the collision layer changed;
here is the diff; a human looks once."

### C-3 — The fixture pack (Task 8) — **keep; it is the best idea in the set**

You asked whether committing a few hand-made placeholder PNGs would be less
machinery. Less code, yes — the generator is ~120 lines. But it would lose the
property that makes it valuable: the fixture is generated **from the contract**,
so adding a contract name nobody has supplied pixels for fails at generation
(`01-foundations.md:2055-2059`) rather than three tasks later. Hand-made PNGs go
stale the first time the contract grows. Keep it.

### C-4 — Tests that assert nothing

- `03-runtime-registry.md:866` — the DPR test (F-16): declares a local helper and
  asserts `Math.floor` works. Tests no product code.
- `03-runtime-registry.md:757` — `Number.isInteger(z * 16)` over
  `[0.5, 1, 2, 3, 4]`. True by construction; restates the constant above it.
- `03-runtime-registry.md:786` — the same assertion again across three tile sizes.
- `01-foundations.md:1114` — `assert.equal(JSON.stringify(run().sheets),
  JSON.stringify(run().sheets))` calls `indexPack` over the whole fixture pack
  twice to prove a pure function is pure.
- `01-foundations.md:2195` — `assert.ok(Array.isArray(names))`. Asserts a type.
- `03-runtime-registry.md:319-320` — hardcodes `DISTRICT_PROPS.length === 32` and
  `INTERIOR_PROPS.length === 36`, which the plans' own Global Constraint
  explicitly forbids (*"Assert … not `=== 32`"*). Same violation at
  `02-world-bake.md:1699` (cafe capacity 9).

---

## Game design

### The zoom ladder's bottom rung is unusable

`[0.5, 1, 2, 3, 4]` with `initialZoom: 2`. The ladder is right in principle —
1.8 × 1.3 genuinely produced shimmer. But **0.5 on 16px art is destructive**:
with nearest-neighbour sampling it discards every other pixel row and column,
turning a 16×32 character into 8×16. Name labels — which the spec calls *"the
authoritative identifier"* — become larger than the agents they label.

**Recommendation:** `[1, 2, 3, 4]`, `initialZoom: 2`. If you need to see the whole
48×46 district, that is a minimap, not a zoom rung.

### Agents pop between venues, and the plans never say so

I-4 says the client animates *within* a venue, never *between*. Schedules change
venue on the hour. So at 09:00 an agent vanishes from the cafe and materialises
in the office. The plans acknowledge this only obliquely — the I-4 row in
`00-INDEX.md` calls it "structural" — and never state the visual consequence.

The seed-spread boundaries do mitigate it: popping is staggered rather than a
synchronised blink. That is a real and deliberate design choice. Write it down as
a known artifact so it is not rediscovered as a bug.

### The town is engineered away from having a rhythm — one step too far

`deterministicDay` spreads every boundary over 2–3 hours, and the comment is
explicit: *"a two-hour spread on each boundary is the difference between a busy
town and a queue."* For 85 agents and six venues that is the right call.

But it buys less than it costs. A `lunch` window of 11/12/13 across 85 agents
still gives ~28 per hour into a pool of `['cafe','district']` — the cafe
(capacity 9) is over-subscribed at every lunch hour anyway. Meanwhile the design
has removed the one thing that makes a simulated town read as a society rather
than 85 independent processes: **anyone reliably meeting anyone.**

**Recommendation:** keep the spread, but let `venueAffinity` carry the social
signal — two agents who share a `hangout` and overlapping hours will bump into
each other repeatedly. That already exists in the code and costs nothing.

Related inconsistency: there are **two** venue-assignment paths.
`deterministicDay` uses stable affinity (a legible routine); `deriveVenue`
re-picks per hour with salt `venue:${dayType}:${startHour}` (`:614`), scattering
an agent across venues hour by hour. The LLM-generated path therefore contradicts
the routine-legibility goal the plan states for the deterministic one.

### Silhouette variation does not happen on the path most likely to ship

Spec §10.2: *"Silhouette before colour. At 16px wide, palette alone is weak
differentiation. Accessories must alter silhouette."* `ACCESSORIES` is
`['none','cap','beanie','backpack','satchel']` — genuinely silhouette-altering.

But `composeSheet`'s `characterLayers: false` branch (`04-appearance.md:578-584`)
does a four-colour `remapPalette` and **returns**. No accessory is composited.
No hair style is applied — `hairStyle` is one of 12 values affecting nothing on
this path. So with a non-layered pack the real variety is 4 colour axes on one
silhouette, while `appearanceSpaceSize()` still reports 691,200 and the G-D test
asserting `>= 1e4` passes.

This is the strongest argument for **F-0**: resolve `characterLayers` *before*
building Plan 4, and make separable layers a hard purchase requirement.

**Recommendation:** make `appearanceSpaceSize()` take the adapter and report the
*achievable* space. A number that stays at 691,200 when the truth is a few
hundred is worse than no number.

---

## Plan quality

Judged against `superpowers:writing-plans` — exact paths, real code in every code
step, per-task tests, frequent commits — these clear the bar better than most.
Specific failures:

- **Steps that say what without showing how.** Task 8a Step 4 (*"Then fix the
  provenance properly"* — F-25); Task 35 Step 5 (*"add … if it is not covered by
  an existing prefix rule"*); Task 19 Step 2 (*"Prepend the same warning as a
  comment block"*).
- **Tasks that cannot be verified without the next one.** Task 8a needs Task 9
  (F-5). Task 27's `characterLayers: true` path is exercised only by the fixture;
  the `false` path that ships has no test at all.
- **A task doing several unrelated things.** Task 3 bundles a purchase, a
  baseline capture, a pack index, a pin pass, a contact-sheet review, two
  research questions, a new doc and a README fix — nine tasks wearing one number,
  and it is the only owner-gated one, so it blocks on you nine times.
- **Plan boundaries.** The seams between 2→3 (data → runtime), 4 (appearance) and
  5 (platform) are real. Plan 3 is partly "the rest of the client work": Tasks 36
  (camera) and 37 (slots) share nothing with the registry work in 21–24 except
  the package they touch — and Task 37 is the one creating the circular
  dependency (F-4). Moving 36/37 into a polish plan alongside 38, after Plan 4,
  makes Plan 3 a single idea **and** fixes F-4.
- **The verification checklist.** `00-INDEX.md:297` runs
  `npm run bake:agents -- --roster roster/roster.json`, but nothing in Plans 1–5
  creates `roster/roster.json` — it first appears in Plan 6 Task 35 Step 11.

---

## The smallest set of changes that makes this executable

In order.

1. **Decide the pack first.** Insert **Plan 0**: requirements → candidates →
   purchase → unpack → answer U-1 and U-2 → fix `tileSize`. The only genuinely
   structural change. (Pack research follows separately.)
2. **Rewrite Tasks 5–7 as "transcribe the pack you own"** rather than
   LimeZu-specific rects, and let Task 3 shrink to a baseline capture — or
   disappear, per step 4.
3. **Fix the ten blockers.** F-1 (parameter properties, 3 sites), F-2 (exports
   subpath + Vite alias regex), F-3 (client `allowJs`), F-4 (move Task 37 after
   Plan 4, or move `hashString` into Plan 1), F-5 (lazy import), F-6 (correct the
   expectation), F-7 (`venueIds` import + pool entries), F-8 (`isGenerated` +
   `writeReport` ordering), F-9 (rewrite Task 3 Step 3), F-10 (single
   `deploy:client` definition), F-11 (Plan 5 depends on Plan 4).
   **F-1, F-2 and F-3 are all fixable in Plan 1 Task 2** and should be, since
   all three otherwise surface two plans later as unrelated-looking failures.
4. **Cut per C-1 and C-2.** Drop `decisions.json`/`adapt.mjs` in favour of
   `note` + `pin` fields; drop Task 20 unless you buy LimeZu, in which case keep
   Tier 1 only. Removes ~1,300 lines and three blockers.
5. **Decide the night rule (F-12).** One line; fixes the worst crowding case and
   the hero image together.
6. **Give Plan 5 its own constraints block (F-22)** and add the 037 migration
   test.
7. **Correct the anchors in F-27** and re-verify the rest of the pre-flight
   table — one entry certified "✅ CONFIRMED" was wrong, so the others are
   hypotheses again.

Items 1–4 are what would waste the most time if discovered during execution.
5–7 are cheap.
