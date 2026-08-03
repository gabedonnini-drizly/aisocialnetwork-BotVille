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
 * no pixels, no textures, no Phaser at all; nothing about the camera, tints,
 * glow alphas, car ambience, tweens or the night routine's timing; and the
 * spawn-point index (which depends on live sprite count) is out of frame.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pathfinder } from '../../packages/client/src/game/Pathfinder.ts';
import { planSync } from '../../packages/client/src/game/districtPresence.ts';
import {
  CLIENT_INTERNAL_LOCATIONS,
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
    const key = sceneKeyFor(target);
    const point = { x: o.x + o.width / 2, y: o.y + o.height + 6 };
    doorPoints.set(key, point);
    doors.push({ name: o.name, targetVenue: target, key, ...point });
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
    fullList: ROSTER,
    drawnIds: DRAWN,
    lastLoc: LAST_LOC,
    hasDoorForScene: key => doorPoints.has(key),
    isAsleep: id => ASLEEP.has(id),
    isLeaving: id => LEAVING.has(id),
  });

  const locations = [...new Set([
    ...venueRegistry.all().map(v => v.id),
    ...AGENT_LOCATIONS,
    ...CLIENT_INTERNAL_LOCATIONS,
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
