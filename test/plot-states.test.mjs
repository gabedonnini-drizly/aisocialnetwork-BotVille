import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadContract } from '../scripts/lib/assetContract.mjs';

const OURS = 'contract/plot_states.json';
const PUBLISHED = 'packages/client/public/assets/plot_states.json';
const registry = JSON.parse(readFileSync(OURS, 'utf8'));
const contract = loadContract();

/**
 * The equality pin `variant_pools.json` has had all along and this file did
 * not — and the asymmetry mattered, because the two are copied side by side
 * by the same three lines of world-bake.mjs and read at RUNTIME by the client.
 *
 * A stale copy is not a cosmetic drift here. The published file is the one the
 * client fetches and `composePlot` composes against; a state declared in
 * `contract/` and missing from the copy is a plot the client cannot draw, and
 * a state in the copy that `contract/` has retired is a prop name nothing
 * validates. `test/plot-render.test.mjs`'s I-2 checks all read `contract/`, so
 * without this test they were checking a file the game never opens.
 */
test('the published state registry is this file, byte for byte', () => {
  assert.equal(readFileSync(PUBLISHED, 'utf8'), readFileSync(OURS, 'utf8'),
    'plot_states.json is stale — run npm run bake:world. The client fetches the PUBLISHED copy '
    + 'at runtime, so a drift here means the checks in this file are validating a document '
    + 'nothing renders from.');
});

/** Every prop name the registry references, wherever it hides in the shape. */
function referencedProps(node, into = []) {
  if (Array.isArray(node)) {
    for (const v of node) referencedProps(v, into);
    return into;
  }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'name' && typeof v === 'string') into.push(v);
      else if (k === 'pick' && Array.isArray(v)) into.push(...v);
      else referencedProps(v, into);
    }
  }
  return into;
}

test('the three ruled states are declared, and each has a composition', () => {
  // Spec §3.2 / D-75: vacant -> under_construction -> built. Three, art-backed,
  // an enum rather than a progress bar.
  assert.deepEqual(registry.states, ['vacant', 'under_construction', 'built']);
  for (const state of registry.states) {
    assert.ok(registry.composition[state], `${state} has no composition`);
  }
  assert.deepEqual(Object.keys(registry.composition).sort(), [...registry.states].sort(),
    'a composition for a state that does not exist, or a state with none');
});

/**
 * I-2, applied to a registry the bake copies rather than resolves: an
 * unresolved name must fail the BUILD, never render as a missing texture.
 * Nothing else checks this file — it is data the client reads, so a typo
 * here would surface as a hole in the map.
 */
test('every prop the registry composes is a name the contract declares (I-2)', () => {
  const declared = new Set([
    ...Object.keys(contract.props.district),
    ...Object.keys(contract.props.interior),
  ]);
  const referenced = referencedProps(registry.composition);
  assert.ok(referenced.length > 0, 'the registry composes nothing — the walker is broken');
  const unresolved = [...new Set(referenced.filter(n => !declared.has(n)))].sort();
  assert.deepEqual(unresolved, [], 'plot_states.json names props the contract does not declare');
});

test('the vacant lot reuses the shipped fence set the district already renders by prefix', () => {
  const { boundary } = registry.composition.vacant;
  assert.equal(boundary.prefix, 'fence_');
  const pieces = Object.keys(contract.props.district).filter(n => n.startsWith(boundary.prefix));
  assert.equal(pieces.length, 8, 'the corner/edge set is 8 pieces — a lot boundary needs all of them');
});

test('a worksite is visibly not a vacant lot: the two boundaries share no piece', () => {
  const vacant = Object.keys(contract.props.district)
    .filter(n => n.startsWith(registry.composition.vacant.boundary.prefix));
  const site = registry.composition.under_construction.boundary.pick;
  assert.deepEqual(site.filter(n => vacant.includes(n)), [],
    'reusing the residential fence for a worksite makes the states indistinguishable');
  assert.equal(site.length, 8);
});

test('built composes from the archetype, not from this table', () => {
  // A built plot renders whatever was built on it. Props here would make every
  // built plot look the same, which is the failure this ruling avoids.
  assert.equal(registry.composition.built.exterior, 'archetype');
  assert.deepEqual(referencedProps(registry.composition.built), []);
});
