import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PresenceModel, resolvePresence } from '../packages/client/src/game/PresenceModel.ts';
import { venueRegistry } from '../packages/client/src/game/venueRegistry.ts';
import type { AgentPresence } from '../packages/shared/src/types/Assets.ts';

const p = (venueId: string | null, id = 'a'): AgentPresence =>
  ({ id, displayName: id, spriteSeed: id, venueId });

test('the §8.1 matrix, row by row', () => {
  assert.deepEqual(resolvePresence(p('cafe'), venueRegistry), { kind: 'somewhere', venueId: 'cafe' });
  assert.deepEqual(resolvePresence(p(null), venueRegistry), { kind: 'absent' });
  assert.deepEqual(resolvePresence(p('speakeasy'), venueRegistry), { kind: 'unknown' });
});

test('every published venue resolves to somewhere', () => {
  for (const v of venueRegistry.published())
    assert.deepEqual(resolvePresence(p(v.id), venueRegistry), { kind: 'somewhere', venueId: v.id });
});

test('there is no fourth state, whatever the input (I-3)', () => {
  const inputs = [null, '', '  ', 'cafe', 'CAFE', 'speakeasy', 'district', '../etc/passwd', '🙂'];
  for (const v of inputs) {
    const k = resolvePresence(p(v as string | null), venueRegistry).kind;
    assert.ok(['somewhere', 'absent', 'unknown'].includes(k), `${v} -> ${k}`);
  }
});

test('venue ids are matched exactly — case is not normalised away', () => {
  assert.equal(resolvePresence(p('CAFE'), venueRegistry).kind, 'unknown');
});

test('an empty-string venue is unknown, not absent', () => {
  assert.equal(resolvePresence(p(''), venueRegistry).kind, 'unknown');
});

test('partition groups a roster by state', () => {
  const m = new PresenceModel(venueRegistry);
  const r = m.partition([p('cafe', '1'), p('cafe', '2'), p('office', '3'), p(null, '4'), p('speakeasy', '5')]);
  assert.equal(r.somewhere.get('cafe')?.length, 2);
  assert.equal(r.somewhere.get('office')?.length, 1);
  assert.equal(r.absent.length, 1);
  assert.equal(r.unknown.length, 1);
});

test('partition loses nobody', () => {
  const m = new PresenceModel(venueRegistry);
  const roster = Array.from({ length: 85 }, (_, i) =>
    p(i % 7 === 0 ? null : i % 11 === 0 ? 'ghost' : 'cafe', `a${i}`));
  const r = m.partition(roster);
  const counted = [...r.somewhere.values()].reduce((n, xs) => n + xs.length, 0)
    + r.absent.length + r.unknown.length;
  assert.equal(counted, roster.length);
});
