import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  applyPlotStates, DEFAULT_PLOT_STATE, KNOWN_PLOT_STATES, onPlotStatesChanged,
  plotStateOf, plotStatus, resetPlotStates,
} from '../packages/client/src/game/plotState.ts';
import { plotRegistry } from '../packages/client/src/game/plotRegistry.ts';
import { listPlots } from '../packages/server/src/api/plots.ts';

/**
 * The state seam (plan `03-` Task 2).
 *
 * Plot state is on NO wire the client consumes today — measured, not assumed:
 * `LocationsSnapshot` is {schemaVersion, gameHour, locations: AgentPresence[]}
 * and the api's /locations serves exactly that. So the client's answer is
 * `vacant` everywhere, WHICH IS TRUE, and the fixture server answers the same
 * from the same file. These tests pin both halves and the transition path.
 */

test('the default is vacant, for every parcel, before anything speaks', () => {
  resetPlotStates();
  assert.ok(plotRegistry.all().length > 0, 'no parcels — this check is vacuous');
  for (const plot of plotRegistry.all()) {
    assert.equal(plotStateOf(plot.id), DEFAULT_PLOT_STATE);
    assert.deepEqual(plotStatus(plot.id), { state: 'vacant' });
  }
});

test('the fixture server answers vacant for exactly the parcels that exist', () => {
  const served = listPlots();
  assert.deepEqual(
    served.map(p => p.id).sort(),
    plotRegistry.all().map(p => p.id).sort(),
    'the fixture server and the client disagree about which parcels exist',
  );
  assert.deepEqual([...new Set(served.map(p => p.state))], ['vacant']);
});

test('the fixture server reads the same file the client imports', () => {
  // Not "they happen to agree" — the SAME authoring file, so they cannot
  // drift. Compared against the file rather than against each other, or a
  // shared bug would look like agreement.
  const doc = JSON.parse(readFileSync('venues/district/plots.json', 'utf8'));
  assert.deepEqual(listPlots().map(p => p.id), doc.plots.map(p => p.id));
  assert.deepEqual(plotRegistry.all().map(p => p.id), doc.plots.map(p => p.id));
});

test('a source can move a parcel through the states, and back', () => {
  resetPlotStates();
  const id = plotRegistry.all()[0].id;
  const all = () => plotRegistry.all().map(p => ({ id: p.id, state: 'vacant' }));

  assert.equal(applyPlotStates([...all().filter(r => r.id !== id),
    { id, state: 'under_construction' }]), true);
  assert.equal(plotStateOf(id), 'under_construction');

  assert.equal(applyPlotStates([...all().filter(r => r.id !== id),
    { id, state: 'built', archetype: 'school' }]), true);
  assert.deepEqual(plotStatus(id), { state: 'built', archetype: 'school' });

  // Idempotent: the same answer twice must not redraw the town.
  const rows = [...all().filter(r => r.id !== id), { id, state: 'built', archetype: 'school' }];
  assert.equal(applyPlotStates(rows), false, 'an unchanged poll reported a change');

  resetPlotStates();
  assert.equal(plotStateOf(id), 'vacant');
});

test('the client renders nothing the source did not assert', () => {
  resetPlotStates();
  const id = plotRegistry.all()[0].id;
  applyPlotStates([
    { id, state: 'built', archetype: 'school' },
    { id: 'plot_9999', state: 'built' },            // not a parcel
    { id: plotRegistry.all()[1].id, state: 'razed' }, // not a declared state (I-3)
    { id: plotRegistry.all()[2].id },                 // no state at all
    null,                                             // a malformed row
    { state: 'built' },                               // no id
  ]);
  assert.equal(plotStateOf(id), 'built');
  assert.equal(plotStatus('plot_9999').state, 'vacant', 'an unknown id got a state');
  assert.equal(plotStateOf(plotRegistry.all()[1].id), 'vacant', 'a fourth state was invented');
  assert.equal(plotStateOf(plotRegistry.all()[2].id), 'vacant');
  resetPlotStates();
});

test('a parcel the source stops mentioning goes back to the default, not stale', () => {
  resetPlotStates();
  const [a, b] = plotRegistry.all();
  applyPlotStates([{ id: a.id, state: 'built', archetype: 'school' }, { id: b.id, state: 'vacant' }]);
  assert.equal(plotStateOf(a.id), 'built');
  applyPlotStates([{ id: b.id, state: 'vacant' }]);
  assert.equal(plotStateOf(a.id), 'vacant',
    'a parcel dropped from the payload kept a state the source no longer asserts');
  resetPlotStates();
});

test('a change notifies exactly once, and an unchanged poll notifies not at all', () => {
  resetPlotStates();
  let fired = 0;
  const off = onPlotStatesChanged(() => { fired++; });
  const id = plotRegistry.all()[0].id;
  applyPlotStates([{ id, state: 'under_construction' }]);
  assert.equal(fired, 1);
  applyPlotStates([{ id, state: 'under_construction' }]);
  assert.equal(fired, 1, 'a redraw on every poll');
  off();
  applyPlotStates([{ id, state: 'built' }]);
  assert.equal(fired, 1, 'the unsubscribe leaked');
  resetPlotStates();
});

test('the accepted vocabulary is the ruled enum, closed', () => {
  const declared = JSON.parse(readFileSync('contract/plot_states.json', 'utf8')).states;
  assert.deepEqual([...KNOWN_PLOT_STATES], declared,
    'the client accepts a different set of states than the contract declares — one of them '
    + 'is going to be a state nothing can draw');
});
