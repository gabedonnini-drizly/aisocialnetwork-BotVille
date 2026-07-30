import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createUnknownWarner,
  flattenSomewhere,
  liveVenueLookup,
  presenceModel,
} from '../packages/client/src/game/presence.ts';
import type { AgentPresence } from '../packages/shared/src/types/Assets.ts';

const p = (venueId: string | null, id = 'a'): AgentPresence =>
  ({ id, displayName: id, spriteSeed: id, venueId });

// F-3: the retired clamp used to fold ANY id outside the six-string
// AGENT_LOCATIONS union into 'district'. These tests cover the live wiring
// that replaces it — PresenceModel constructed over the venue registry (+farm).

test('farm is known even though it is not a registered venue (drawn inside DistrictScene)', () => {
  assert.equal(liveVenueLookup.has('farm'), true);
  assert.equal(presenceModel.resolve(p('farm')).kind, 'somewhere');
});

test('a real venue and farm both land in "somewhere"; a bogus id does not', () => {
  const roster = [p('cafe', '1'), p('farm', '2'), p('house_3', '3'), p('ghost-town', '4'), p(null, '5')];
  const { somewhere, absent, unknown } = presenceModel.partition(roster);
  const visible = flattenSomewhere(somewhere);
  assert.equal(visible.has('1'), true);
  assert.equal(visible.has('2'), true);
  assert.equal(visible.has('3'), true, 'house_N scenes must genuinely receive their occupants (F-3)');
  assert.equal(visible.has('4'), false);
  assert.equal(visible.has('5'), false);
  assert.deepEqual(unknown.map(u => u.id), ['4']);
  assert.deepEqual(absent.map(u => u.id), ['5']);
});

test('flattenSomewhere loses nobody across venues', () => {
  const roster = Array.from({ length: 30 }, (_, i) => p(i % 2 === 0 ? 'cafe' : 'office', `a${i}`));
  const { somewhere } = presenceModel.partition(roster);
  assert.equal(flattenSomewhere(somewhere).size, roster.length);
});

test('warnUnknown logs once per id, not once per call (rate-limited)', () => {
  const logged: string[] = [];
  const warn = createUnknownWarner((m) => logged.push(m));
  warn([p('ghost', 'x'), p('ghost', 'x')]); // same id twice in one call
  warn([p('ghost', 'x')]);                  // same id again on a later poll
  warn([p('ghost2', 'y')]);
  assert.equal(logged.length, 2);
  assert.ok(logged[0].includes('x') && logged[0].includes('ghost'));
  assert.ok(logged[1].includes('y') && logged[1].includes('ghost2'));
});

test('two independent warners do not share dedupe state', () => {
  const a: string[] = [];
  const b: string[] = [];
  const warnA = createUnknownWarner((m) => a.push(m));
  const warnB = createUnknownWarner((m) => b.push(m));
  warnA([p('ghost', 'x')]);
  warnB([p('ghost', 'x')]);
  assert.equal(a.length, 1);
  assert.equal(b.length, 1);
});
