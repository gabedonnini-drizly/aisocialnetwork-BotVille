import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildVariantManifest } from '../scripts/lib/variantManifest.mjs';

const HAIR_PATTERN = /^Hairstyle_(\d+)_(\d+)\.png$/;

/** Fisher-Yates with a fixed seed so the shuffle itself is reproducible. */
function shuffled(list) {
  const a = [...list];
  let seed = 0x2f6e2b1;
  for (let i = a.length - 1; i > 0; i--) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    const j = seed % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const FILES = [
  'Hairstyle_02_03.png', 'Hairstyle_01_01.png', 'Hairstyle_01_03.png',
  'Hairstyle_03_01.png', 'Hairstyle_02_01.png', 'Hairstyle_01_02.png',
  'Hairstyle_02_02.png', 'Hairstyle_03_02.png',
];

test('regenerating from a shuffled copy of the same file list is byte-identical (sorted-stable derivation)', () => {
  const a = buildVariantManifest(FILES, HAIR_PATTERN);
  const b = buildVariantManifest(shuffled(FILES), HAIR_PATTERN);
  assert.deepEqual(a, b);
  assert.deepEqual(JSON.stringify(a), JSON.stringify(b));
});

test('styles and every style\'s variants come out sorted', () => {
  const { styles, variantsByStyle } = buildVariantManifest(FILES, HAIR_PATTERN);
  assert.deepEqual(styles, [...styles].sort());
  for (const style of styles)
    assert.deepEqual(variantsByStyle[style], [...variantsByStyle[style]].sort());
});

test('every file groups under its own style, and only files matching the pattern are counted', () => {
  const withNoise = [...FILES, 'README.txt', 'Outfit_01_01.png', 'Hairstyle_bad.png'];
  const manifest = buildVariantManifest(withNoise, HAIR_PATTERN);
  assert.deepEqual(manifest.styles, ['01', '02', '03']);
  assert.equal(manifest.variantsByStyle['01'].length, 3);
  assert.equal(manifest.variantsByStyle['02'].length, 3);
  assert.equal(manifest.variantsByStyle['03'].length, 2);
});

test('an empty filename list yields an empty, well-shaped manifest', () => {
  assert.deepEqual(buildVariantManifest([], HAIR_PATTERN), { styles: [], variantsByStyle: {} });
});
