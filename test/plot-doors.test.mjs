import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  composePlot, plotDoor, plotDoorFor,
} from '../packages/client/src/game/plotComposition.ts';
import { plotRegistry } from '../packages/client/src/game/plotRegistry.ts';
import { buildingRegistry } from '../packages/client/src/game/buildingRegistry.ts';
import {
  applyPlotStates, districtDrawing, resetPlotStates,
} from '../packages/client/src/game/plotState.ts';
import { drawnByDistrict, planSync } from '../packages/client/src/game/districtPresence.ts';
import {
  sceneTargetFor, DISTRICT_SCENE_KEY, opensASceneFrom,
} from '../packages/client/src/game/venueRegistry.ts';
import { Pathfinder } from '../packages/client/src/game/Pathfinder.ts';
import { districtGeometry } from '../packages/client/src/game/config.ts';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';

/**
 * Plan `03-` Task 3 — generated doors, proved on a SYNTHETIC BUILT PLOT.
 *
 * "This is what finally makes houses reachable. Since the district's founding
 * there has been no house building and no house door on the map, while 85
 * agents slept in 13 rooms nightly."
 *
 * Nothing is built in the world, and nothing in this drive builds anything —
 * that is the api's (045 + the civic loop's). So the proof uses the same shape
 * as the synthetic second district in multi-district.test.mjs: the CAPABILITY
 * is exercised against a state that exists only inside this file, while the
 * shipped world stays exactly as it is. `resetPlotStates()` at the end of each
 * test is what keeps it that way.
 *
 * The claim being tested is not "a door object appears". It is the plan's own
 * wording: navigation and pathfinding "route to a plot-generated door EXACTLY
 * as to an authored one" — so the last test drives `planSync` against an
 * authored door and a generated one and demands the same answer.
 */

const STATES = JSON.parse(readFileSync('contract/plot_states.json', 'utf8'));
const POOLS = JSON.parse(readFileSync('contract/variant_pools.json', 'utf8'));
const DISTRICT = 'district';
const PLOTS = plotRegistry.all();
/** A housing parcel that admits `house` — the tier-2 exterior D-65's ladder names. */
const HOME = PLOTS.find(p => p.kind === 'housing' && p.allowedArchetypes.includes('house'));

const built = id => applyPlotStates([{ id, state: 'built', archetype: 'house' }]);

test('a fixture parcel exists to build on at all', () => {
  assert.ok(HOME, 'no housing parcel admits `house` — the whole test file is vacuous');
  assert.equal(buildingRegistry.exteriorFor('house'), 'terraced_house_1');
});

// ── the door is AT the anchor ────────────────────────────────────────────

test('the door is generated from the plot’s doorAnchor, on the side it names', () => {
  for (const plot of PLOTS) {
    const door = plotDoor(plot);
    const [dx, dy] = plot.doorAnchor;
    assert.equal(door.targetVenue, plot.id, 'the plot id IS the venue id (D-79)');
    assert.equal(door.zone.x, dx * 16, `${plot.id}: the door drifted off the anchor in x`);
    assert.equal(door.zone.y, dy * 16, `${plot.id}: the door drifted off the anchor in y`);

    // The waiting spot is OUTSIDE the parcel, on the door's own side. Every
    // authored door faces south, so the authored offset (`y + height + 6`)
    // would put a west-facing door's waiting spot inside the house.
    const [ax, ay] = plot.at;
    const [w, h] = plot.size;
    const out = {
      north: door.point.y < ay * 16,
      south: door.point.y > (ay + h - 1) * 16,
      west: door.point.x < ax * 16,
      east: door.point.x > (ax + w - 1) * 16,
    }[plot.doorSide];
    assert.ok(out,
      `${plot.id} (${plot.doorSide}): the waiting spot ${JSON.stringify(door.point)} is not outside `
      + `the parcel ${plot.at}+${plot.size} — an agent would wait inside the building`);
  }
});

test('an odd-sized parcel keeps its half-tile anchor: a door is pixels, a fence gap is tiles', () => {
  const odd = PLOTS.find(p => !Number.isInteger(p.doorAnchor[0]) || !Number.isInteger(p.doorAnchor[1]));
  assert.ok(odd, 'no fractional anchor in the bake — this check is vacuous');
  const door = plotDoor(odd);
  assert.equal(door.zone.x, odd.doorAnchor[0] * 16);
  assert.equal(door.zone.y, odd.doorAnchor[1] * 16);
});

// ── built is enterable; vacant is not ────────────────────────────────────

test('a built plot has a door; a vacant one does not, and neither does a worksite', () => {
  for (const plot of PLOTS) {
    assert.equal(plotDoorFor(plot, 'vacant'), undefined,
      `${plot.id}: a vacant plot is not enterable — it is a tent camp in the open`);
    assert.equal(plotDoorFor(plot, 'under_construction'), undefined,
      `${plot.id}: you do not move into a building site`);
    assert.deepEqual(plotDoorFor(plot, 'built'), plotDoor(plot));
  }
});

test('a built plot renders its tier exterior AND a door at the anchor', () => {
  const placements = composePlot({
    plot: HOME,
    state: 'built',
    states: STATES,
    pools: POOLS,
    exterior: buildingRegistry.exteriorFor('house'),
  });
  assert.deepEqual(placements.map(p => p.name), ['terraced_house_1']);
  assert.equal(placements[0].layer, 'buildings');
  const door = plotDoorFor(HOME, 'built');
  assert.ok(door);
  assert.deepEqual([door.zone.x / 16, door.zone.y / 16], [...HOME.doorAnchor]);
});

// ── routing: the HUD and the deep link ───────────────────────────────────

test('a HUD click on somebody at a built home routes to the district that draws it', () => {
  built(HOME.id);
  // `sceneTargetFor` is what navigation.ts's agent:goto handler calls. The
  // parcel must resolve to its DISTRICT, never to itself: `plot_7` as a
  // districtId means make.tilemap({key:'plot_7'}), a file the bake never
  // wrote — the farm black screen with a new name.
  assert.deepEqual(sceneTargetFor(HOME.id), {
    key: DISTRICT_SCENE_KEY, data: { districtId: DISTRICT },
  });
  resetPlotStates();
});

test('somebody INSIDE a built home is not drawn standing on its roof', () => {
  // Vacant: the camp is in the open and the sleeper is visible — that is the
  // whole of D-60, and D-89 publishes the parcel roles:['home'] for it.
  assert.equal(districtDrawing(HOME.id), DISTRICT);
  assert.equal(drawnByDistrict(HOME.id, DISTRICT, districtDrawing), true);

  built(HOME.id);
  assert.equal(districtDrawing(HOME.id), undefined,
    'a built parcel is a BUILDING — somebody at it is inside it');
  assert.equal(drawnByDistrict(HOME.id, DISTRICT, districtDrawing), false);

  // ...and the district itself, and every other parcel, are unaffected.
  assert.equal(districtDrawing(DISTRICT), DISTRICT);
  assert.equal(districtDrawing('farm'), DISTRICT);
  for (const other of PLOTS.filter(p => p.id !== HOME.id)) {
    assert.equal(districtDrawing(other.id), DISTRICT);
  }
  resetPlotStates();
});

// ── pathfinding: the door is reachable ───────────────────────────────────

/** The real Pathfinder over the real collision layer, sized by the real geometry. */
function districtPathfinder() {
  const venue = venueRegistry.get(DISTRICT);
  const geo = districtGeometry(venue);
  const map = JSON.parse(readFileSync(`packages/client/public/assets/tilemaps/${geo.mapKey}.tmj`, 'utf8'));
  const pf = new Pathfinder(geo.widthTiles, geo.heightTiles);
  for (const o of map.layers.find(l => l.name === 'collision').objects) {
    pf.blockRect(o.x, o.y, o.width, o.height);
  }
  const spawns = map.layers.find(l => l.name === 'spawns').objects.map(o => ({ x: o.x, y: o.y }));
  return { pf, spawns };
}

test('every generated door is reachable from a district spawn point', () => {
  const { pf, spawns } = districtPathfinder();
  assert.ok(spawns.length > 0, 'no spawn points — this check is vacuous');
  for (const plot of PLOTS) {
    const door = plotDoor(plot);
    assert.ok(pf.isWalkable(Math.floor(door.point.x / 16), Math.floor(door.point.y / 16)),
      `${plot.id}: the waiting spot ${JSON.stringify(door.point)} is inside a collision box — `
      + 'nobody can ever stand at that door');
    const path = pf.findPath(spawns[0].x, spawns[0].y, door.point.x, door.point.y);
    assert.ok(path.length > 0,
      `${plot.id}: no route from spawn point 0 to the generated door — the house is unreachable, `
      + 'which is the exact defect Task 3 exists to close');
  }
});

test('a generated door routes no differently from an authored one', () => {
  // The plan's own wording: "route to a plot-generated door EXACTLY as to an
  // authored one". So: the same agent, the same journey, once through the
  // cafe's authored .tmj door and once through a built parcel's generated one,
  // must produce IDENTICAL decisions out of planSync — which is the module the
  // walk-out, the return spawn and the golden baseline all run on.
  built(HOME.id);
  const doorPoints = new Map([['cafe', { x: 1, y: 1 }], [HOME.id, plotDoor(HOME).point]]);
  const run = venueId => planSync({
    districtId: DISTRICT,
    fullList: [{ id: 'walker', location: venueId }],
    drawnIds: ['walker'],
    lastLoc: new Map([['walker', DISTRICT]]),
    hasDoorFor: id => doorPoints.has(id),
    isAsleep: () => false,
    isLeaving: () => false,
    resolveDistrict: districtDrawing,
  });

  const authored = run('cafe');
  const generated = run(HOME.id);
  assert.deepEqual(generated.drawn.get('walker'), { kind: 'walk-to-door', venueId: HOME.id });
  assert.deepEqual(authored.drawn.get('walker'), { kind: 'walk-to-door', venueId: 'cafe' });
  assert.equal(generated.drawn.get('walker').kind, authored.drawn.get('walker').kind,
    'the generated door takes a different branch from the authored one');
  assert.deepEqual(generated.present, authored.present);

  // ...and coming back OUT of the built home spawns at its door, exactly as
  // coming out of the cafe does.
  const back = venueId => planSync({
    districtId: DISTRICT,
    fullList: [{ id: 'walker', location: DISTRICT }],
    drawnIds: [],
    lastLoc: new Map([['walker', venueId]]),
    hasDoorFor: id => doorPoints.has(id),
    isAsleep: () => false,
    isLeaving: () => false,
    resolveDistrict: districtDrawing,
  });
  assert.deepEqual(back(HOME.id).spawn.get('walker'), { atDoorOf: HOME.id });
  assert.deepEqual(back('cafe').spawn.get('walker'), { atDoorOf: 'cafe' });
  resetPlotStates();
});

test('a VACANT parcel’s occupant stays outside, drawn, and never walks to a door', () => {
  resetPlotStates();
  const plan = planSync({
    districtId: DISTRICT,
    fullList: [{ id: 'camper', location: HOME.id }],
    drawnIds: ['camper'],
    lastLoc: new Map([['camper', HOME.id]]),
    // Even if something claimed there were a door for every venue...
    hasDoorFor: () => true,
    isAsleep: () => false,
    isLeaving: () => false,
    resolveDistrict: districtDrawing,
  });
  assert.deepEqual(plan.present.map(a => a.id), ['camper'],
    'the camper vanished — D-60 says the unhoused are visible, never absent');
  assert.deepEqual(plan.drawn.get('camper'), { kind: 'stay', cancelLeaving: false },
    'a camper walked into a tent as though it were a front door');
});

test('two plots cannot share a door anchor (plot integrity)', () => {
  // The Planning-mode QA fire-proof: "give two plots the same door anchor ->
  // plot-integrity fails". With doors generated FROM anchors, a shared anchor
  // is two doors on one tile and a doorPoints key that silently wins.
  const seen = new Map();
  for (const plot of PLOTS) {
    const key = plotDoor(plot).zone.x + ':' + plotDoor(plot).zone.y;
    assert.equal(seen.get(key), undefined,
      `${plot.id} and ${seen.get(key)} generate their doors on the same tile`);
    seen.set(key, plot.id);
  }
  assert.equal(seen.size, PLOTS.length);
});

// ── the affordance is honest (review finding 5) ──────────────────────────

test('a built parcel’s door opens no scene — and the predicate says so', () => {
  built(HOME.id);
  // `opensASceneFrom` is what DistrictScene asks TWICE: once to decide whether
  // the cursor becomes a hand, once before refusing a fade into the same view.
  // One predicate, so the cursor and the click cannot disagree — a hand cursor
  // over a click that does nothing is the dead end this closes.
  assert.equal(opensASceneFrom(HOME.id, DISTRICT), false,
    'a built parcel resolves back to the district you are standing in: the door is real, '
    + 'the room behind it is not baked yet');
  resetPlotStates();
});

test('an authored door DOES open a scene, so the predicate is not just always false', () => {
  for (const id of ['cafe', 'office', 'library', 'dorm']) {
    assert.equal(opensASceneFrom(id, DISTRICT), true, id);
  }
  // ...and a location with no scene of its own, from a DIFFERENT district,
  // still counts as somewhere to go.
  assert.equal(opensASceneFrom(DISTRICT, 'somewhere-else'), true);
  assert.equal(opensASceneFrom(DISTRICT, DISTRICT), false, 'the district you are already in');
});

test('the scene asks the predicate for the cursor AND for the transition', () => {
  // Source-level, because no node test in this repo boots Phaser and the
  // regression is one identifier: a hard-coded `useHandCursor: true` on the
  // generated door, or a hand-rolled copy of the comparison in
  // transitionToVenue that drifts from the one the cursor uses.
  const src = readFileSync('packages/client/src/game/scenes/DistrictScene.ts', 'utf8');
  const doorFn = src.slice(src.indexOf('private registerPlotDoor'), src.indexOf('private placePlotProp'));
  assert.match(doorFn, /useHandCursor:\s*opens/,
    'the generated door promises a destination unconditionally');
  assert.match(doorFn, /console\.info\(/,
    'a click with nowhere to go must say so, not return silently');
  const transition = src.slice(src.indexOf('private transitionToVenue'), src.indexOf('// ------------------------------------------------------ the land'));
  assert.match(transition, /opensASceneFrom\(venueId, this\.districtId\)/,
    'transitionToVenue re-implements the comparison instead of asking the shared predicate');
});

test('a HUD click that lands on nobody says so instead of doing nothing', () => {
  // Latent today and guaranteed once anything is built: an agent inside a
  // built parcel is not drawn outdoors (districtDrawing), so agent:goto routes
  // to this district, finds no sprite, and the camera silently does not move.
  const src = readFileSync('packages/client/src/game/scenes/DistrictScene.ts', 'utf8');
  const focus = src.slice(src.indexOf('const onFocusAgent'), src.indexOf('GameBridge.on(\'agent:focus\''));
  assert.match(focus, /console\.warn\(/,
    'onFocusAgent swallows a focus that cannot be satisfied — `if (!sprite) return`');
  assert.match(focus, /agentId/, 'the refusal must name the agent it refused');
});
