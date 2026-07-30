import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  normalizeGender, appearanceRecord, appearanceHash,
  appearanceSpaceSize, SKIN_TONES, EYE_VARIANTS, HAIR_STYLES, HAIR_COLORS,
  OUTFIT_COLORS, ACCESSORIES,
} from '../packages/shared/src/appearance/derive.mjs';

// The hashString unit and cross-repo contract tests live in
// test/shared-types.test.ts (Plan 1 Task 2), beside hash.mjs itself.

test('derive.mjs loads under bare node — the bake CLIs depend on it', () => {
  // No --import ./test/ts-resolve.mjs. If this module ever reaches a .ts file
  // it throws here instead of at `npm run bake:agents` two tasks from now.
  const out = execFileSync(process.execPath,
    ['-e', "import('./packages/shared/src/appearance/derive.mjs').then(m => console.log(typeof m.appearanceHash))"],
    { encoding: 'utf8' });
  assert.match(out, /function/);
});

test('normalizeGender maps the live DB values', () => {
  assert.equal(normalizeGender('male'), 'masc');
  assert.equal(normalizeGender('female'), 'fem');
  assert.equal(normalizeGender('  MALE  '), 'masc');
  assert.equal(normalizeGender('Woman'), 'fem');
});

test('normalizeGender never throws and falls to neutral', () => {
  for (const v of [null, undefined, '', '   ', 'nonbinary', 'agender', 'yes', '🙂', 42, {}])
    assert.equal(normalizeGender(v), 'neutral', String(v));
});

test('derivation is pure and deterministic', () => {
  const a = appearanceRecord('aisha_khan', 'female');
  const b = appearanceRecord('aisha_khan', 'female');
  assert.deepEqual(a, b);
});

test('every axis is seed-derived — no dimension is gated on gender', () => {
  const m = appearanceRecord('aisha_khan', 'male');
  const f = appearanceRecord('aisha_khan', 'female');
  assert.notEqual(m.build, f.build);
  for (const k of ['skinTone', 'eyes', 'hairStyle', 'hairColor', 'outfit', 'accessory'])
    assert.equal(m[k], f[k], `${k} must not depend on build`);
});

test('every derived value comes from its declared palette', () => {
  const r = appearanceRecord('the_skeptic', 'male');
  assert.ok(SKIN_TONES.includes(r.skinTone));
  assert.ok(EYE_VARIANTS.includes(r.eyes));
  assert.ok(HAIR_STYLES.includes(r.hairStyle));
  assert.ok(HAIR_COLORS.includes(r.hairColor));
  assert.ok(OUTFIT_COLORS.includes(r.outfit));
  assert.ok(ACCESSORIES.includes(r.accessory));
});

test('the space is at least 10^4 as G-D requires', () => {
  assert.equal(appearanceSpaceSize(), 3 * 6 * 7 * 12 * 10 * 8 * 5);
  assert.ok(appearanceSpaceSize() >= 1e4);
});

test('10k seeds spread across the space without collapsing', () => {
  const seen = new Set();
  for (let i = 0; i < 10_000; i++) seen.add(appearanceHash(appearanceRecord(`agent_${i}`, 'neutral')));
  assert.ok(seen.size > 5000, `only ${seen.size} distinct appearances in 10k seeds`);
});

test('no palette value is used by more than 30% of a 10k roster', () => {
  const counts = {};
  for (let i = 0; i < 10_000; i++) {
    const r = appearanceRecord(`agent_${i}`, 'neutral');
    counts[r.hairStyle] = (counts[r.hairStyle] ?? 0) + 1;
  }
  for (const [k, n] of Object.entries(counts)) assert.ok(n < 3000, `${k} appears ${n} times`);
});

test('the hash embeds SCHEMA_VERSION so a bump invalidates the cache (I-7)', async () => {
  const mod = await import('../packages/shared/src/appearance/derive.mjs');
  const r = appearanceRecord('aisha_khan', 'female');
  assert.equal(appearanceHash(r), appearanceHash(r));
  assert.notEqual(appearanceHash(r), mod.appearanceHashAt(r, 2));
});

test('the hash is 8 lowercase hex characters — safe as a filename', () => {
  assert.match(appearanceHash(appearanceRecord('x', 'male')), /^[0-9a-f]{8}$/);
});

test('no record can name an animal (I-13)', () => {
  const banned = /cow|pig|dog|chicken|animal/i;
  for (let i = 0; i < 2000; i++) {
    const r = appearanceRecord(`agent_${i}`, 'neutral');
    for (const v of Object.values(r)) assert.equal(banned.test(String(v)), false, `${v}`);
  }
});
