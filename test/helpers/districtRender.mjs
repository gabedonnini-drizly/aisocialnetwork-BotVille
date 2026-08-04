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
 *   • no pixels, no textures, no Phaser at all; nothing about the camera,
 *     tints, glow alphas, car ambience, tweens or the night routine's timing;
 *   • the spawn-point index (it depends on the live sprite count);
 *   • the building<->door hover pairing DistrictScene builds from
 *     `targetVenue` — the doors are captured, which building each highlights
 *     is not;
 *   • DistrictScene.init's throw on an id that is not an outdoor venue: the
 *     scene needs Phaser, so no node test reaches it.
 *
 * AND THE BIG ONE — HALF OF THIS FILE IS A REIMPLEMENTATION, not a call into
 * the scene. `planSync`, `Pathfinder`, `sceneKeyFor` and `sceneForLocation`
 * are the real modules; but the map-object reading, the door-point offset
 * (+width/2, +height+6), the depth rule (y + height) and the walkability
 * construction are TRANSCRIBED from DistrictScene.create (currently :117-172),
 * with nothing coupling the two. Change the scene's door geometry and this
 * file agrees with its own past self while the game moves — which is exactly
 * what Plan 03 Task 3 will do when it generates doors from plot anchors. Task
 * 3 must re-read this file, not just re-run it.
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
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pathfinder } from '../../packages/client/src/game/Pathfinder.ts';
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

  // --- walkability: the real Pathfinder over the real collision layer
  const pathfinder = new Pathfinder(venue.sizeTiles[0], venue.sizeTiles[1]);
  for (const o of layer(map, 'collision')) pathfinder.blockRect(o.x, o.y, o.width, o.height);
  const grid = [];
  let blocked = 0;
  for (let ty = 0; ty < venue.sizeTiles[1]; ty++) {
    let row = '';
    for (let tx = 0; tx < venue.sizeTiles[0]; tx++) {
      const walkable = pathfinder.isWalkable(tx, ty);
      if (!walkable) blocked++;
      row += walkable ? '.' : '#';
    }
    grid.push(row);
  }
  const spawns = layer(map, 'spawns').map(o => ({ x: o.x, y: o.y }));
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
    walkability: { blockedTiles: blocked, sha256: sha(grid.join('\n')) },
    paths,
    tick: {
      present: plan.present.map(a => a.id),
      drawn: Object.fromEntries([...plan.drawn].map(([id, d]) => [id, d])),
      spawn: Object.fromEntries([...plan.spawn].map(([id, s]) => [id, s.atDoorOf ?? 'spawn-point'])),
    },
  };
}
