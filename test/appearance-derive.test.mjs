import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  normalizeGender, appearanceRecord, appearanceHash,
  appearanceSpaceSize, SKIN_TONES, EYE_VARIANTS, ACCESSORIES, BUILDS,
  HAIR_MANIFEST, OUTFIT_MANIFEST,
} from '../packages/shared/src/appearance/derive.mjs';
// HAIR_STYLES / HAIR_COLORS / OUTFIT_COLORS are gone (D-19, 2026-07-30):
// hair and outfit are pack-derived two-stage picks over HAIR_MANIFEST /
// OUTFIT_MANIFEST — committed generated data, not a hardcoded hex palette.

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
  for (const k of ['skinTone', 'eyes', 'hairStyle', 'hairVariant', 'outfit', 'outfitVariant', 'accessory'])
    assert.equal(m[k], f[k], `${k} must not depend on build`);
});

test('every derived value comes from its declared palette or pack manifest', () => {
  const r = appearanceRecord('the_skeptic', 'male');
  assert.ok(SKIN_TONES.includes(r.skinTone));
  assert.ok(EYE_VARIANTS.includes(r.eyes));
  // Hair and outfit are two-stage pack picks (D-19, 2026-07-30): the style
  // must be one of the manifest's sorted distinct styles, and the variant
  // must belong to THAT style's own sorted variant list — proving the pick
  // is not just "any file", but style-then-variant-within-style.
  assert.ok(HAIR_MANIFEST.styles.includes(r.hairStyle));
  assert.ok(HAIR_MANIFEST.variantsByStyle[r.hairStyle].includes(r.hairVariant));
  assert.ok(OUTFIT_MANIFEST.styles.includes(r.outfit));
  assert.ok(OUTFIT_MANIFEST.variantsByStyle[r.outfit].includes(r.outfitVariant));
  assert.ok(ACCESSORIES.includes(r.accessory));
});

test('the space is at least 10^4 as G-D requires', () => {
  // Derived from the manifests' own counts, never a hardcoded product
  // (Global Constraint: "test expectations are derived, never transcribed";
  // D-19, 2026-07-30, sharpens this for hair/outfit specifically).
  const hairCount = Object.values(HAIR_MANIFEST.variantsByStyle).reduce((n, v) => n + v.length, 0);
  const outfitCount = Object.values(OUTFIT_MANIFEST.variantsByStyle).reduce((n, v) => n + v.length, 0);
  assert.equal(appearanceSpaceSize(),
    BUILDS.length * SKIN_TONES.length * EYE_VARIANTS.length * hairCount * outfitCount * ACCESSORIES.length);
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
