import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  campSlotTile, centreTile, composeDistrict, composePlot, gateTile, GATE_WIDTH_TILES, plotDoor,
} from '../packages/client/src/game/plotComposition.ts';
import { plotRegistry } from '../packages/client/src/game/plotRegistry.ts';
import { buildingRegistry } from '../packages/client/src/game/buildingRegistry.ts';
import { DISTRICT_PROPS } from '../packages/client/src/game/assets.generated.ts';

/**
 * Plan `03-` Task 2: the three plot states render, and they render from DATA.
 *
 * The load-bearing claim is not "a fence appears". It is that plot_states.json
 * decides what appears — that a fourth state, or a different prop for an
 * existing one, is an edit to that file and to nothing else. So the tests
 * below drive `composePlot` with the REAL registry, and separately with
 * synthetic documents, and assert that the second changes the answer.
 */
const STATES = JSON.parse(readFileSync('contract/plot_states.json', 'utf8'));
const POOLS = JSON.parse(readFileSync('contract/variant_pools.json', 'utf8'));
const PLOTS = plotRegistry.all();
const declared = new Set(DISTRICT_PROPS);

const compose = (plot, state, extra = {}) =>
  composePlot({ plot, state, states: STATES, pools: POOLS, ...extra });

test('every declared state composes something on every parcel', () => {
  assert.ok(PLOTS.length > 0, 'no parcels — this check is vacuous');
  for (const state of STATES.states) {
    for (const plot of PLOTS) {
      const out = compose(plot, state, state === 'built' ? { exterior: 'terraced_house_1' } : {});
      assert.ok(out.length > 0, `${plot.id} in state '${state}' composes nothing`);
    }
  }
});

/**
 * I-2, carried all the way to the texture. `test/plot-states.test.mjs` already
 * checks the registry's names against the CONTRACT; this checks the names that
 * actually come out of a composition against what the client PRELOADS, which
 * is the list that decides whether a name draws or logs an error.
 */
test('every composed prop is a texture the preloader loads (I-2)', () => {
  const seen = new Set();
  for (const state of STATES.states) {
    for (const plot of PLOTS) {
      for (const p of compose(plot, state, { exterior: 'terraced_house_1' })) seen.add(p.name);
    }
  }
  assert.ok(seen.size > 5, `only ${seen.size} distinct props composed — the walk is not running`);
  const unloaded = [...seen].filter(n => !declared.has(n)).sort();
  assert.deepEqual(unloaded, [], 'composed props the client never loads — they render as nothing');
});

test('every building the config declares has a loaded exterior (I-2)', () => {
  const rows = buildingRegistry.all();
  assert.ok(rows.length > 0, 'contract/buildings.json declares nothing');
  const unloaded = rows.filter(b => !declared.has(b.exterior)).map(b => `${b.archetype} -> ${b.exterior}`);
  assert.deepEqual(unloaded, [], 'a building whose exterior is not a preloaded district prop');
});

test('every tent in the pool is a loaded texture (I-2)', () => {
  const unloaded = POOLS.pools.tent.filter(n => !declared.has(n));
  assert.deepEqual(unloaded, [], 'a tent variant the client cannot draw');
});

// ── vacant: a fenced empty lot ───────────────────────────────────────────

test('vacant fences the lot, leaves the gate open, and does nothing else', () => {
  for (const plot of PLOTS) {
    const out = compose(plot, 'vacant');
    const [ax, ay] = plot.at;
    const [w, h] = plot.size;

    // Nothing outside the parcel, ever — a fence on the road is a bug you see
    // once the town is full.
    for (const p of out) {
      assert.ok(p.tile[0] >= ax && p.tile[0] < ax + w && p.tile[1] >= ay && p.tile[1] < ay + h,
        `${plot.id}: '${p.name}' at ${p.tile} is outside the parcel ${plot.at}+${plot.size}`);
    }

    // The boundary is a ring: only perimeter cells.
    const fence = out.filter(p => p.name.startsWith('fence_'));
    assert.ok(fence.length > 0, `${plot.id} has no boundary`);
    for (const p of fence) {
      const onEdge = p.tile[0] === ax || p.tile[0] === ax + w - 1
        || p.tile[1] === ay || p.tile[1] === ay + h - 1;
      assert.ok(onEdge, `${plot.id}: fence at ${p.tile} is not on the perimeter`);
    }

    // ...and the gate is a VISIBLE opening in it. Nothing about reachability
    // depends on this: plot props are decorative and collide with nothing
    // (the ruling is in plotComposition.ts's header). What it buys is that
    // the lot READS as enterable at the point where its door is, instead of
    // showing an unbroken fence with a door drawn on top of it.
    const [gx, gy] = gateTile(plot);
    assert.equal(fence.some(p => p.tile[0] === gx && p.tile[1] === gy), false,
      `${plot.id}: the fence is drawn across the door anchor ${plot.doorAnchor}`);
  }
});

test('the gate is exactly as wide as the ruling, on the side the anchor names', () => {
  for (const plot of PLOTS) {
    const fence = compose(plot, 'vacant').filter(p => p.name.startsWith('fence_'));
    const [gx, gy] = gateTile(plot);
    const [ax, ay] = plot.at;
    const [w, h] = plot.size;
    const horizontal = plot.doorSide === 'north' || plot.doorSide === 'south';
    const span = horizontal ? w : h;
    const edgeCells = horizontal
      ? Array.from({ length: w }, (_, i) => [ax + i, gy])
      : Array.from({ length: h }, (_, i) => [gx, ay + i]);
    const missing = edgeCells.filter(([x, y]) => !fence.some(p => p.tile[0] === x && p.tile[1] === y));
    assert.equal(missing.length, Math.min(GATE_WIDTH_TILES, span),
      `${plot.id}: the ${plot.doorSide} edge is drawn with a ${missing.length}-tile opening, `
      + `not ${GATE_WIDTH_TILES}`);
  }
});

test('a vacant lot with nobody on it is a lot, not a camp', () => {
  const plot = PLOTS[0];
  const out = compose(plot, 'vacant', { occupants: [] });
  assert.deepEqual(out.filter(p => p.name.startsWith('tent_')), [],
    'a tent with no occupant — the camp is the people, D-60');
});

test('a tent per occupant, picked by spriteSeed, and nobody shares a slot', () => {
  const plot = PLOTS.find(p => p.size[0] >= 10 && p.size[1] >= 10);
  const occupants = [
    { id: 'b', spriteSeed: 'noah_klein' },
    { id: 'a', spriteSeed: 'the_strategist' },
    { id: 'c', spriteSeed: 'archivist' },
  ];
  const out = compose(plot, 'vacant', { occupants });
  const tents = out.filter(p => p.name.startsWith('tent_'));
  assert.equal(tents.length, 3);
  assert.equal(new Set(tents.map(t => t.tile.join(','))).size, 3, 'two tents on one slot');
  for (const t of tents) {
    const inside = t.tile[0] > plot.at[0] && t.tile[0] < plot.at[0] + plot.size[0] - 1
      && t.tile[1] > plot.at[1] && t.tile[1] < plot.at[1] + plot.size[1] - 1;
    assert.ok(inside, `a tent at ${t.tile} is on or outside the fence of ${plot.id}`);
  }
  // Roster ORDER must not decide anything: the same three in another order
  // give the same three tents on the same three slots.
  const shuffled = compose(plot, 'vacant', { occupants: [occupants[2], occupants[0], occupants[1]] });
  assert.deepEqual(shuffled, out, 'the camp depends on roster order');
});

test('a full camp fits inside the fence of even the smallest parcel', () => {
  // Capacity is 4 (VACANT_PLOT_CAPACITY, D-89), so four is the most a camp
  // ever holds — and the smallest class is 6x6. Four slots, all strictly
  // inside the ring, on every parcel in the town.
  const four = ['w', 'x', 'y', 'z'].map(id => ({ id, spriteSeed: `seed_${id}` }));
  for (const plot of PLOTS) {
    const tents = compose(plot, 'vacant', { occupants: four }).filter(p => p.name.startsWith('tent_'));
    assert.equal(tents.length, 4, `${plot.id} lost a camper`);
    assert.equal(new Set(tents.map(t => t.tile.join(','))).size, 4, `${plot.id}: two tents on one slot`);
    for (const t of tents) {
      const inside = t.tile[0] > plot.at[0] && t.tile[0] < plot.at[0] + plot.size[0] - 1
        && t.tile[1] > plot.at[1] && t.tile[1] < plot.at[1] + plot.size[1] - 1;
      assert.ok(inside, `${plot.id} (${plot.sizeClass} ${plot.size}): a tent at ${t.tile} is on the fence`);
    }
  }
});

test('the same agent pitches the same tent on any parcel, and stands beside it', () => {
  const seed = 'noah_klein';
  const picks = new Set();
  for (const plot of PLOTS) {
    const tents = compose(plot, 'vacant', { occupants: [{ id: 'a', spriteSeed: seed }] })
      .filter(p => p.name.startsWith('tent_'));
    assert.equal(tents.length, 1);
    picks.add(tents[0].name);
    // The sprite's slot and the tent's slot are ONE function, so they cannot
    // disagree — the agent is never across town from their own shelter.
    assert.deepEqual(tents[0].tile, campSlotTile(plot, 0));
  }
  assert.equal(picks.size, 1, `the same agent got ${picks.size} different tents across parcels`);
});

// ── under_construction: a worksite ───────────────────────────────────────

test('a worksite is visibly a worksite, and visibly not a vacant lot', () => {
  for (const plot of PLOTS) {
    const out = compose(plot, 'under_construction');
    const names = out.map(p => p.name);
    assert.ok(names.some(n => n.startsWith('building_skeleton_')), `${plot.id}: no skeleton`);
    assert.ok(names.some(n => n.startsWith('worksite_ground_')), `${plot.id}: no worked ground`);
    assert.ok(names.some(n => n.startsWith('worksite_fence_')), `${plot.id}: no site hoarding`);
    assert.ok(names.includes('worksite_entrance'), `${plot.id}: no entrance`);
    // D-75's point: the two states must be distinguishable at a glance.
    assert.deepEqual(names.filter(n => n.startsWith('fence_')), [],
      `${plot.id}: a worksite is wearing the residential fence`);
    assert.deepEqual(names.filter(n => n.startsWith('tent_')), [],
      `${plot.id}: tents on a worksite — the camp is what a plot without a site IS`);
    // The skeleton stands where the building will.
    const skeleton = out.find(p => p.name.startsWith('building_skeleton_'));
    assert.deepEqual(skeleton.tile, centreTile(plot));
    assert.equal(skeleton.layer, 'buildings', 'the skeleton must Y-sort with buildings');
    assert.equal(skeleton.align, 'centre-bottom');
  }
});

test('worksite ground is under everything and the hoarding is over it', () => {
  const out = compose(PLOTS[0], 'under_construction');
  for (const p of out.filter(x => x.name.startsWith('worksite_ground_'))) {
    assert.equal(p.layer, 'props-below', 'worked ground drawn above the agents standing on it');
  }
  for (const p of out.filter(x => x.name.startsWith('worksite_fence_'))) {
    assert.equal(p.layer, 'props-above');
  }
});

// ── built: the archetype, not the table ──────────────────────────────────

test('built renders the archetype’s exterior and no composition of its own', () => {
  const plot = PLOTS[0];
  const out = compose(plot, 'built', { exterior: buildingRegistry.exteriorFor('school') });
  assert.deepEqual(out.map(p => p.name), ['school_building'],
    'a built plot draws the structure and nothing else — props here would make '
    + 'every built plot look the same (plot_states.json’s own ruling)');
  assert.deepEqual(out[0].tile, centreTile(plot));
  assert.equal(out[0].layer, 'buildings');
});

test('built with nothing built on it draws nothing, and does not throw', () => {
  // The api owns "what was built"; until it says, `built` with no archetype is
  // a state of the world (a plot mid-transition), not a bug.
  assert.deepEqual(compose(PLOTS[0], 'built'), []);
  assert.deepEqual(compose(PLOTS[0], 'built', { exterior: undefined }), []);
});

// ── the data is the authority ────────────────────────────────────────────

test('a FOURTH state is a data change, not a client change', () => {
  // The whole point of plot_states.json. A state this code has never heard of,
  // declared only in a document, must render.
  const doc = {
    states: [...STATES.states, 'condemned'],
    composition: {
      ...STATES.composition,
      condemned: { boundary: { prefix: 'fence_', layer: 'props-above' } },
    },
  };
  const out = composePlot({ plot: PLOTS[0], state: 'condemned', states: doc, pools: POOLS });
  assert.ok(out.length > 0, 'a declared fourth state rendered nothing — the states are hardcoded');
  assert.ok(out.every(p => p.name.startsWith('fence_')));
});

test('swapping a prop in the document swaps it on the map', () => {
  const doc = structuredClone(STATES);
  doc.composition.vacant.scatter.pick = ['tree_1'];
  const out = composePlot({ plot: PLOTS[0], state: 'vacant', states: doc, pools: POOLS });
  assert.ok(out.some(p => p.name === 'tree_1'), 'the composition is not read from the document');
  assert.equal(out.some(p => p.name.startsWith('bush_')), false);
});

test('an UNDECLARED state fails loudly rather than rendering bare grass (I-2)', () => {
  assert.throws(
    () => composePlot({ plot: PLOTS[0], state: 'haunted', states: STATES, pools: POOLS }),
    /plot_1: state 'haunted' has no composition/,
  );
});

test('plot props are DECORATIVE — a composition never claims to block anything', () => {
  // The ruling, pinned where a future change would have to notice it: a
  // Placement is {name, layer, tile, align} and carries no collision box, so
  // "the fence blocks the lot" cannot become quietly true. Walkability comes
  // from the .tmj's collision layer, which is the bake's (see the header of
  // plotComposition.ts for why, and for when to revisit).
  const fields = new Set();
  for (const state of STATES.states) {
    for (const p of compose(PLOTS[0], state, { exterior: 'terraced_house_1' })) {
      for (const k of Object.keys(p)) fields.add(k);
    }
  }
  assert.deepEqual([...fields].sort(), ['align', 'layer', 'name', 'tile'],
    'a placement grew a field. If it is collision, read plotComposition.ts’s header first: '
    + 'the pathfinder grid is baked, and the golden’s walkability sha describes it.');
});

// ── one parcel never takes the town with it (review finding 4) ───────────

test('an undrawable parcel is SKIPPED and named — the other 22 still render', () => {
  // The boot-crash path, exactly: composePlot throws on a state with no
  // composition, renderPlots runs from create(), so an uncaught throw is a
  // black screen. It is reachable from DATA, not code — a stale published
  // plot_states.json missing a state the wire is already sending. Here that
  // document is synthesised; the pin against the real published copy lives in
  // test/plot-states.test.mjs.
  const stale = { states: ['vacant'], composition: { vacant: STATES.composition.vacant } };
  const broken = PLOTS[3].id;
  const skipped = [];
  const rendered = composeDistrict({
    plots: PLOTS,
    statusOf: id => (id === broken ? { state: 'built', archetype: 'house' } : { state: 'vacant' }),
    states: stale,
    pools: POOLS,
    onSkip: (id, reason) => skipped.push([id, reason]),
  });

  assert.equal(rendered.length, PLOTS.length - 1, 'a skipped parcel took its neighbours with it');
  assert.equal(rendered.some(r => r.plot.id === broken), false);
  assert.equal(skipped.length, 1);
  assert.equal(skipped[0][0], broken, 'the skip did not name the parcel');
  assert.match(skipped[0][1], /has no composition/, 'the skip did not say why');
  for (const r of rendered) assert.ok(r.placements.length > 0, `${r.plot.id} rendered nothing`);
});

test('composeDistrict throws for nobody — a whole broken document is 23 skips, not a crash', () => {
  const skipped = [];
  const rendered = composeDistrict({
    plots: PLOTS,
    statusOf: () => ({ state: 'haunted' }),
    states: STATES,
    pools: POOLS,
    onSkip: id => skipped.push(id),
  });
  assert.deepEqual(rendered, []);
  assert.equal(skipped.length, PLOTS.length);
});

test('composeDistrict hands back the door with the parcel it belongs to', () => {
  const rendered = composeDistrict({
    plots: PLOTS,
    statusOf: id => (id === PLOTS[0].id ? { state: 'built', archetype: 'house' } : { state: 'vacant' }),
    states: STATES,
    pools: POOLS,
    exteriorFor: a => buildingRegistry.exteriorFor(a),
  });
  const first = rendered.find(r => r.plot.id === PLOTS[0].id);
  assert.ok(first.door, 'a built parcel came back without its door');
  assert.equal(first.door.targetVenue, PLOTS[0].id);
  assert.deepEqual(first.placements.map(p => p.name), ['terraced_house_1']);
  for (const r of rendered.filter(x => x.plot.id !== PLOTS[0].id)) {
    assert.equal(r.door, undefined, `${r.plot.id} is vacant and came back with a door`);
  }
});

// ── minors ──────────────────────────────────────────────────────────────

test('a camp past capacity fans out instead of stacking on the first tent', () => {
  const big = PLOTS.find(p => p.size[0] >= 18 && p.size[1] >= 16);
  const eight = Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, spriteSeed: `s${i}` }));
  const tiles = compose(big, 'vacant', { occupants: eight })
    .filter(p => p.name.startsWith('tent_'))
    .map(p => p.tile.join(','));
  assert.equal(tiles.length, 8);
  assert.equal(new Set(tiles).size, 8,
    'the fifth occupant landed on the first one’s slot — capacity is the api’s derivation, '
    + 'not a lock, and D-89 puts the camp wherever the unhoused are');
});

test('the worksite hoarding uses both declared sets, deterministically per parcel', () => {
  // boundaryAlternate used to be data nothing read: every site in town wore
  // set 1, so two sites side by side looked like one site.
  const setOf = plot => compose(plot, 'under_construction')
    .find(p => p.name.startsWith('worksite_fence_')).name.split('_')[2];
  const seen = new Set(PLOTS.map(setOf));
  assert.deepEqual([...seen].sort(), ['1', '2'], 'only one hoarding set is ever drawn');
  for (const plot of PLOTS) {
    assert.equal(setOf(plot), setOf(plot), 'the set is not stable for a parcel');
    const ring = compose(plot, 'under_construction').filter(p => p.name.startsWith('worksite_fence_'));
    const sets = new Set(ring.map(p => p.name.split('_')[2]));
    assert.equal(sets.size, 1, `${plot.id}: one parcel is wearing two hoarding sets at once`);
  }
});

test('the door threshold lies along the wall it is in, not always east-west', () => {
  for (const plot of PLOTS) {
    const { zone } = plotDoor(plot);
    const horizontal = plot.doorSide === 'north' || plot.doorSide === 'south';
    assert.deepEqual([zone.width, zone.height], horizontal ? [32, 16] : [16, 32],
      `${plot.id} (${plot.doorSide}): a 32x16 threshold on a vertical wall sticks two tiles into `
      + 'the street and spans one tile of the wall it is supposed to be in');
  }
});
