/**
 * What the outdoor scene would draw, as data.
 *
 * The bracketing check Plan 03 asks for: a comparable artifact of the current
 * rendered state, captured BEFORE the multi-district refactor and compared
 * after. There is no headless Phaser render in this repo, so this captures the
 * strongest thing that exists — the deterministic INPUTS and DECISIONS that
 * drive the render, all of them read from the real shipped modules and the
 * committed .tmj:
 *
 *   • the map objects DistrictScene turns into game objects, with the depths
 *     and door points it computes from them;
 *   • the door registry, keyed exactly as the scene keys it;
 *   • the walkability grid the real Pathfinder builds from the collision
 *     layer, plus fixed A* paths through it;
 *   • scene-key routing for every venue and every location the server can
 *     announce (the real venueRegistry);
 *   • the per-agent draw decision for a fixed roster (the real
 *     districtPresence.planSync) — one frozen "tick" of syncAgents.
 *
 * What it does NOT cover, stated plainly so nobody reads more into a green:
 *
 *   • no pixels, no textures, no Phaser at all; nothing about glow alphas,
 *     tweens or the night routine's timing. THE CAMERA CAVEAT IS NARROWER
 *     THAN IT WAS: `camera` now captures the bounds, the opening centre, the
 *     tint overlay rect and the car-cull box — by CALLING config.ts's
 *     `cameraBounds` / `districtViewCentre` / `tintOverlayRect` /
 *     `carCullBounds`, which are the same functions DistrictScene.create
 *     calls (F-1). What is still uncovered: zoom behaviour, pan inertia,
 *     `cam.pan` on agent:focus, tint COLOUR over the hour curve, and the car
 *     spawn cadence and lane positions — `AMBIENT_CAR.rightLaneY` /
 *     `.downLaneX` remain hand-tuned pixel constants, verified by hand
 *     against the 92x92 roads layer (row 21 is road for all 92 columns;
 *     column 21 is the west sidewalk beside vRoad 22..24, which it also was
 *     at 48x46 — unchanged, not re-derived);
 *   • the spawn-point index (it depends on the live sprite count);
 *   • the building<->door hover pairing DistrictScene builds from
 *     `targetVenue` — the doors are captured, which building each highlights
 *     is not;
 *   • DistrictScene.init's throw on an id that is not an outdoor venue: the
 *     scene needs Phaser, so no node test reaches it;
 *   • for the parcels: `composePlot`'s answer is captured, but everything
 *     DistrictScene.renderPlots does WITH it is not — the tile-to-pixel
 *     conversion, the `centre-bottom` offset by a loaded texture's size, the
 *     depth rule, the missing-texture guard, and the redraw-on-change wiring.
 *     Those are Phaser and stay uncovered by any node test.
 *
 * AND THE BIG ONE — PART OF THIS FILE IS STILL A REIMPLEMENTATION, not a call
 * into the scene. `planSync`, `Pathfinder`, `sceneKeyFor`, `sceneForLocation`,
 * `districtGeometry`, the four `camera` functions, `composePlot`, `gateTile`
 * and `plotDoorFor` are the real modules. What remains TRANSCRIBED from
 * DistrictScene.create, with nothing coupling the two: the map-object reading,
 * the AUTHORED door-point offset (+width/2, +height+6), the depth rule
 * (y + height) and the walkability construction. Change those in the scene and
 * this file goes on agreeing with its own past self while the game moves.
 *
 * The previous version of this paragraph warned that Task 3 would widen that
 * gap when it generated doors from plot anchors. IT DID NOT, and the shape of
 * why is worth keeping: the generated door's geometry lives in
 * `plotComposition.plotDoor`, which the scene CALLS and this file CALLS, so
 * the two cannot disagree. The authored door's geometry is still inline in the
 * scene, and so is still transcribed here. The transcription surface got
 * smaller, not larger — but it is not zero, and a green here still does not
 * mean the authored-door path is what this document says it is.
 *
 * ── PROVENANCE ────────────────────────────────────────────────────────────
 * Captured at a882a79 from the pre-refactor scene. Re-baselined twice since,
 * both deliberate and both diffed line by line:
 *   799979f  objects.doors[*].key: 'VenueScene:<venue>' -> '<venue>'.
 *            doorPoints is keyed by target venue id now that every district
 *            shares one scene key. Nothing else in the document moved.
 *   ac3f9da  objects.doors[*].key removed. Since 799979f it was a
 *            byte-identical duplicate of `targetVenue`, and two fields that
 *            must agree are a place for them to disagree.
 *   (this)   THE MERGE OF plan-04-archetypes-bake (Task 7, D-88/D-89). Four
 *            fields moved and NOTHING ELSE did; each is accounted for:
 *
 *            geometry           48x46 -> 92x92 (widthPx 768 -> 1472,
 *                               heightPx 736 -> 1472). D-88: the district
 *                               grows; the size is bake data (town/growth.json
 *                               districtSizeTiles).
 *            routing            +23 entries, plot_1..plot_23, every one
 *                               {sceneKeyFor: DistrictScene, sceneForLocation:
 *                               DistrictScene}. D-79 publishes a venue per
 *                               parcel. ZERO pre-existing entries changed.
 *            objects.propsAbove 6 of 95 scatter bushes swap bush_1 <-> bush_2
 *                               at IDENTICAL x/y/depth (indices 86, 88, 89,
 *                               90, 92, 93). The cityGrid generator's PRNG
 *                               draw order is part of its contract and the
 *                               grown map re-picks scatter flavour; Task 7
 *                               declared this and proved buildings, doors,
 *                               spawns, glows and night byte-identical over
 *                               the original region. Every other entry, and
 *                               every other object layer, is unchanged.
 *            walkability        blockedTiles 870 -> 872, sha256 moves. The
 *                               ORIGINAL 48x46 REGION IS CELL-FOR-CELL
 *                               IDENTICAL — verified by diffing the two grids
 *                               over it: 0 differing cells, still exactly 870
 *                               blocked. The +2 are (4,46) and (5,46), from
 *                               ONE prop collision box at tile (4.1875,
 *                               45.625) size 1.5x1 that the old grid's bottom
 *                               edge used to clip away. The sha moves because
 *                               the serialised grid is now 92 rows of 92.
 *                               The grown region carries no other collision:
 *                               it is open grass, which is why plot door
 *                               anchors are a long walk and never a blocked
 *                               one (growth.json maxDoorAnchorDistanceNote).
 *
 *            NOT moved, and worth saying because it is the load-bearing half:
 *            objects.buildings, .doors, .spawns, .penSpots, .glows,
 *            .propsBelow, .collisionRects, `paths` (all four spawn-to-door
 *            routes, step for step) and the whole `tick`.
 *   (F-1)    ADDITIVE: a new top-level `camera` section. Nothing existing
 *            moved. It exists because the review's six F-1 sites included
 *            four the golden explicitly did not cover, so "the golden is
 *            green" said nothing about them. `initialCentre` is the one that
 *            is a BEHAVIOUR CHANGE and not just newly-recorded: the scene used
 *            to open at `(widthPx/2 - 24, heightPx/2 - 8)`, which on the grown
 *            map is (712, 728) — the far corner of the built town. It now
 *            opens at the spawn-point centroid, (378.5, 362.5). On the OLD
 *            48x46 map the two answers were (360, 360) and (378.5, 362.5):
 *            about one tile apart, which is why this was never visible before
 *            the district grew.
 *   (Task 2) ADDITIVE: a new top-level `plots` section, 23 entries. Nothing
 *            existing moved. Per parcel: its rectangle, its gate tile, and for
 *            EACH of the three declared states the placement count, the
 *            distinct prop names, and a sha of the full ordered placement list
 *            (name|layer|tile|align). It is a CALL into `composePlot` over the
 *            real `contract/plot_states.json` and `contract/variant_pools.json`
 *            — not a transcription — so re-running it after an edit to either
 *            document moves these lines, which is the whole claim Task 2
 *            makes ("the mapping is data").
 *
 *            `vacant` is captured with a synthetic four-agent camp
 *            (GOLDEN_CAMP) because NOBODY IS HOUSED ON A PARCEL TODAY —
 *            derived capacity is 97 against a roster of 85, so the town's
 *            real answer is "fenced empty lots" and the tent pick, which is
 *            the one thing D-75 actually rules, would go unrecorded. Four is
 *            the camp's published capacity. `built` is captured against
 *            `terraced_house_1` for the same reason: no structure exists yet.
 *            BOTH ARE HYPOTHETICALS, and the golden being green says nothing
 *            about a camp or a house existing in the world.
 *   (Task 3) ADDITIVE: `doorWhenBuilt` on each of the 23 plot entries. Nothing
 *            existing moved; in particular `objects.doors` (the four AUTHORED
 *            .tmj doors) and `paths` are untouched, because the world still has
 *            exactly four doors.
 *
 *            THE WHOLE SECTION IS A HYPOTHETICAL AND ITS NAME SAYS SO. Nothing
 *            is built, so no generated door exists in the world today; what is
 *            recorded is what `plotDoorFor` answers for each state. `vacant`
 *            and `under_construction` are `null` BY RULING ("a vacant plot is
 *            not enterable"), not by omission — the null is the assertion.
 *            `built` carries the zone and the waiting spot, and
 *            `pathFromSpawn0` is the real Pathfinder's route length from spawn
 *            point 0 to that spot, so a parcel whose door stops being reachable
 *            moves a line here. All 23 are currently reachable; the shortest
 *            route is 34 steps and the longest 121, which is the long walk past
 *            no pavement that town/growth.json's maxDoorAnchorDistanceNote
 *            already predicted and named the road-extension follow-up for.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  cameraBounds,
  carCullBounds,
  districtGeometry,
  districtViewCentre,
  tintOverlayRect,
} from '../../packages/client/src/game/config.ts';
import { Pathfinder } from '../../packages/client/src/game/Pathfinder.ts';
import { composePlot, gateTile, plotDoorFor } from '../../packages/client/src/game/plotComposition.ts';
import { plotRegistry } from '../../packages/client/src/game/plotRegistry.ts';
import { planSync } from '../../packages/client/src/game/districtPresence.ts';
import {
  CLIENT_INTERNAL_LOCATION_IDS,
  sceneForLocation,
  sceneKeyFor,
  venueRegistry,
} from '../../packages/client/src/game/venueRegistry.ts';
import { AGENT_LOCATIONS } from '../../packages/shared/src/types/Agent.ts';

const TILE_SIZE = 16;
const TMJ = id => `packages/client/public/assets/tilemaps/${id}.tmj`;

const layer = (map, name) => map.layers.find(l => l.name === name)?.objects ?? [];
const propsOf = o => Object.fromEntries((o.properties ?? []).map(p => [p.name, p.value]));
/** Every .tmj object carries width/height, so the scene's `o.height ?? img.height` is o.height. */
const depthOf = o => o.y + o.height;
const sha = s => createHash('sha256').update(s).digest('hex');

/**
 * The fixed tick. One agent per branch of syncAgents, so a decision that
 * changes shows up as a named agent rather than a count.
 */
export const ROSTER = [
  { id: 'stay-outside', location: 'district' },
  { id: 'stay-at-farm', location: 'farm' },
  { id: 'went-to-cafe', location: 'cafe' },        // drawn, a door exists -> walks out
  { id: 'went-to-house', location: 'house_1' },    // drawn, no door on this map -> vanishes
  { id: 'asleep-to-dorm', location: 'dorm' },      // drawn + asleep -> vanishes, no walk
  { id: 'already-leaving', location: 'library' },  // drawn + mid-departure -> untouched
  { id: 'came-back', location: 'district' },       // drawn + mid-departure but back outside
  { id: 'out-of-cafe', location: 'district' },     // new, was in the cafe -> at its door
  { id: 'out-of-farm', location: 'district' },     // new, was at the farm -> a spawn point
  { id: 'brand-new', location: 'district' },       // new, no history -> a spawn point
  { id: 'to-the-farm', location: 'farm' },         // new, was outside -> a spawn point
  { id: 'indoors-elsewhere', location: 'office' }, // not drawn, not here -> no decision at all
];

/** Sprites already on the map when the tick runs. */
export const DRAWN = [
  'stay-outside', 'stay-at-farm', 'went-to-cafe', 'went-to-house',
  'asleep-to-dorm', 'already-leaving', 'came-back', 'deleted-agent',
];
export const LAST_LOC = new Map([
  ['out-of-cafe', 'cafe'],
  ['out-of-farm', 'farm'],
  ['to-the-farm', 'district'],
  ['stay-outside', 'district'],
]);
export const ASLEEP = new Set(['asleep-to-dorm']);
export const LEAVING = new Set(['already-leaving', 'came-back']);

/** `deleted-agent` has a sprite and is absent from the roster entirely. */

/**
 * A fixed camp for the golden's `vacant` composition. Nobody is housed on a
 * parcel today (capacity 97 > roster 85), so without a synthetic camp the
 * baseline would record the tent pick as "absent" and say nothing about the
 * one thing D-75 rules — the same seed giving the same tent, forever.
 */
export const GOLDEN_CAMP = [
  { id: 'camper-a', spriteSeed: 'noah_klein' },
  { id: 'camper-b', spriteSeed: 'the_strategist' },
  { id: 'camper-c', spriteSeed: 'archivist' },
  { id: 'camper-d', spriteSeed: 'ada_lovelace' },
];

export function captureDistrictRender(districtId = 'district') {
  const venue = venueRegistry.get(districtId);
  if (!venue) throw new Error(`no such venue: ${districtId}`);
  const map = JSON.parse(readFileSync(TMJ(districtId), 'utf8'));

  // --- doors: the registry the scene builds, keyed the way the scene keys it
  const doorPoints = new Map();
  const doors = [];
  for (const o of layer(map, 'doors')) {
    const target = propsOf(o).targetVenue;
    if (typeof target !== 'string') continue;
    // Keyed by target venue id — the same key DistrictScene uses, though
    // this is a transcription of its keying, not a call into it (see above).
    const point = { x: o.x + o.width / 2, y: o.y + o.height + 6 };
    doorPoints.set(target, point);
    doors.push({ name: o.name, targetVenue: target, ...point });
  }

  // --- walkability: the real Pathfinder, sized by the REAL districtGeometry
  // (the scene's own sizing function), over the real collision layer.
  const geo = districtGeometry(venue);
  const pathfinder = new Pathfinder(geo.widthTiles, geo.heightTiles);
  for (const o of layer(map, 'collision')) pathfinder.blockRect(o.x, o.y, o.width, o.height);
  const grid = [];
  let blocked = 0;
  for (let ty = 0; ty < geo.heightTiles; ty++) {
    let row = '';
    for (let tx = 0; tx < geo.widthTiles; tx++) {
      const walkable = pathfinder.isWalkable(tx, ty);
      if (!walkable) blocked++;
      row += walkable ? '.' : '#';
    }
    grid.push(row);
  }
  const spawns = layer(map, 'spawns').map(o => ({ x: o.x, y: o.y }));
  const spawns0 = spawns[0];

  // --- the land: the REAL composePlot over the REAL contract documents, for
  // every parcel this district draws, in every declared state. Not a
  // transcription — this is the module DistrictScene.renderPlots calls.
  const plotStates = JSON.parse(readFileSync('contract/plot_states.json', 'utf8'));
  const plotPools = JSON.parse(readFileSync('contract/variant_pools.json', 'utf8'));
  const plots = plotRegistry.inDistrict(districtId).map(plot => {
    const perState = {};
    for (const state of plotStates.states) {
      const placements = composePlot({
        plot,
        state,
        states: plotStates,
        pools: plotPools,
        // A fixed camp, so the tent pick is in the baseline rather than
        // rendering only when the api eventually houses somebody.
        occupants: state === 'vacant' ? GOLDEN_CAMP : [],
        ...(state === 'built' ? { exterior: 'terraced_house_1' } : {}),
      });
      perState[state] = {
        count: placements.length,
        names: [...new Set(placements.map(p => p.name))].sort(),
        sha256: sha(placements.map(p => `${p.name}|${p.layer}|${p.tile}|${p.align}`).join('\n')),
      };
    }
    // The DOOR REGISTRY's generated half (Task 3). Recorded for the state
    // that has one, labelled for the state that has one: `vacant` and
    // `under_construction` produce `null` here, which is the ruling ("a
    // vacant plot is not enterable") and not a gap in the capture. The path
    // is the real Pathfinder's, spawn point 0 to the waiting spot, so a
    // parcel whose door stops being reachable moves a line.
    const door = plotDoorFor(plot, 'built');
    return {
      id: plot.id,
      at: plot.at,
      size: plot.size,
      gate: gateTile(plot),
      states: perState,
      doorWhenBuilt: {
        vacant: plotDoorFor(plot, 'vacant') ?? null,
        under_construction: plotDoorFor(plot, 'under_construction') ?? null,
        built: door,
        pathFromSpawn0: pathfinder.findPath(spawns0.x, spawns0.y, door.point.x, door.point.y).length,
      },
    };
  });

  // Fixed routes: spawn point 0 to every door. A geometry change moves them.
  const paths = doors.map(d => {
    const p = pathfinder.findPath(spawns[0].x, spawns[0].y, d.x, d.y);
    return { to: d.targetVenue, steps: p.length, end: p.at(-1) ?? null };
  });

  // --- the fixed tick
  const plan = planSync({
    districtId,
    fullList: ROSTER,
    drawnIds: DRAWN,
    lastLoc: LAST_LOC,
    hasDoorFor: venueId => doorPoints.has(venueId),
    isAsleep: id => ASLEEP.has(id),
    isLeaving: id => LEAVING.has(id),
  });

  const locations = [...new Set([
    ...venueRegistry.all().map(v => v.id),
    ...AGENT_LOCATIONS,
    ...CLIENT_INTERNAL_LOCATION_IDS,
    'no-such-place',
  ])].sort();

  return {
    _readme: 'Golden baseline for the outdoor scene. See test/helpers/districtRender.mjs '
      + 'for what it does and does not cover. Regenerate: npm run golden:district',
    district: districtId,
    geometry: {
      mapKey: districtId,
      sizeTiles: venue.sizeTiles,
      widthPx: venue.sizeTiles[0] * TILE_SIZE,
      heightPx: venue.sizeTiles[1] * TILE_SIZE,
      groundAtlas: venue.groundAtlas,
      mapWidth: map.width,
      mapHeight: map.height,
    },
    // F-1. The review named six sites that must follow the descriptor rather
    // than a literal, and the golden's own caveat said it covered "nothing
    // about the camera, tints [or] car ambience". These are the real
    // functions DistrictScene calls, not a transcription of them, so a
    // re-hardcoded dimension moves a line here.
    camera: {
      bounds: cameraBounds(geo),
      initialCentre: districtViewCentre(geo, spawns),
      tintOverlay: tintOverlayRect(geo),
      carCull: carCullBounds(geo),
    },
    routing: Object.fromEntries(locations.map(id => [id, {
      sceneKeyFor: sceneKeyFor(id),
      sceneForLocation: sceneForLocation(id),
    }])),
    objects: {
      propsBelow: layer(map, 'props-below').map(o => ({ name: o.name, x: o.x, y: o.y, depth: 2 })),
      buildings: layer(map, 'buildings').map(o => {
        const target = propsOf(o).targetVenue;
        return {
          name: o.name, x: o.x, y: o.y, depth: depthOf(o),
          targetVenue: typeof target === 'string' ? target : null,
          targetScene: typeof target === 'string' ? sceneKeyFor(target) : null,
        };
      }),
      propsAbove: layer(map, 'props-above').map(o => ({ name: o.name, x: o.x, y: o.y, depth: depthOf(o) })),
      doors,
      spawns,
      penSpots: layer(map, 'night').filter(o => o.name === 'animal_sleep').map(o => ({ x: o.x, y: o.y })),
      glows: layer(map, 'glows').map(o => ({ kind: o.name, x: o.x, y: o.y })),
      collisionRects: layer(map, 'collision').length,
    },
    plots,
    walkability: { blockedTiles: blocked, sha256: sha(grid.join('\n')) },
    paths,
    tick: {
      present: plan.present.map(a => a.id),
      drawn: Object.fromEntries([...plan.drawn].map(([id, d]) => [id, d])),
      spawn: Object.fromEntries([...plan.spawn].map(([id, s]) => [id, s.atDoorOf ?? 'spawn-point'])),
    },
  };
}
