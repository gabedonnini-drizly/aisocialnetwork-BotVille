import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../scripts/lib/sourceAdapter.mjs';
import { validate } from '../scripts/lib/contractValidator.mjs';
import { createCanvas, encodePng } from '../scripts/png-lib.mjs';

const c = loadContract();
const fixture = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('the fixture pack validates clean, pixels and all', () => {
  const { errors } = validate(c, fixture(), { checkPixels: true });
  assert.deepEqual(errors, []);
});

test('the limezu adapter validates clean without pixels (I-2 static half)', () => {
  const { errors } = validate(c, loadAdapter('sources/limezu.json', 'assets-src'), { checkPixels: false });
  assert.deepEqual(errors, []);
});

test('a missing name is an error, not a warning', () => {
  const broken = { ...fixture(), unresolved: () => ['ghost_prop'] };
  const { errors } = validate(c, broken, { checkPixels: false });
  assert.equal(errors.length, 1);
  assert.match(errors[0], /ghost_prop/);
});

test('a prop that exceeds its contract maxSize is an error', () => {
  const a = fixture();
  const inflated = { ...c, props: { ...c.props, interior: { ...c.props.interior, stool: { maxSize: [4, 4] } } } };
  const { errors } = validate(inflated, a, { checkPixels: true });
  assert.ok(errors.some(e => /stool/.test(e) && /maxSize/.test(e)), errors.join('\n'));
});

test('a venue prop absent from the contract is an error', () => {
  const venues = [{ id: 'v', furniture: [{ name: 'not_a_prop', at: [0, 0] }], seats: [], animated: [], doors: [], glows: [], spawns: [] }];
  const { errors } = validate(c, fixture(), { checkPixels: false, venues });
  assert.ok(errors.some(e => /not_a_prop/.test(e)), errors.join('\n'));
});

test('a typo\'d ground floor name is an error, not a silent gid[undefined]', () => {
  const venues = [{
    id: 'v', groundAtlas: 'interiors_ground', ground: { wallA: 'wallCafeA', wallB: 'wallCafeB', floor: 'floorCaef' },
    furniture: [], seats: [], animated: [], doors: [], glows: [], spawns: [],
  }];
  const { errors } = validate(c, fixture(), { checkPixels: false, venues });
  assert.ok(errors.some(e => /ground\.floor/.test(e) && /floorCaef/.test(e)), errors.join('\n'));
});

test('a typo\'d scatter.crops.alternate entry is an error, not a phantom object', () => {
  const venues = [{
    id: 'v', groundAtlas: 'district_ground', scatter: { crops: { alternate: ['crop_cabbage', 'crop_berrry'] } },
    furniture: [], seats: [], animated: [], doors: [], glows: [], spawns: [],
  }];
  const { errors } = validate(c, fixture(), { checkPixels: false, venues });
  assert.ok(errors.some(e => /scatter\.crops\.alternate/.test(e) && /crop_berrry/.test(e)), errors.join('\n'));
});

test('all real authored venues stay clean under the ground/scatter checks', () => {
  const venues = readdirSync('venues')
    .filter(id => !id.startsWith('_') && !id.startsWith('.'))
    .map(id => JSON.parse(readFileSync(join('venues', id, 'venue.json'), 'utf8')));
  const { errors } = validate(c, fixture(), { checkPixels: false, venues });
  assert.deepEqual(errors, []);
});

test('layered char sheets must share one whole-frame canvas (4b)', () => {
  // The fixture is layered; its five char_* sheets are identical in size, so
  // it passes (covered by 'the fixture pack validates clean'). A pack whose
  // hair layer is a different size must fail — stacking would silently
  // misalign frames. Build a two-layer throwaway pack with mismatched sheets.
  const dir = mkdtempSync(join(tmpdir(), 'layers-'));
  // readSprite throws on a fully transparent crop regardless of `trim`
  // (test/sprite-reader.test.mjs: "a fully transparent region throws rather
  // than emitting an empty PNG") — one opaque pixel per sheet keeps this test
  // on the size-mismatch path it's named for, instead of tripping that guard.
  const a = createCanvas(16 * 4, 32 * 2); a.set(0, 0, [255, 0, 0, 255]);
  const b = createCanvas(16 * 4 - 1, 32 * 2); b.set(0, 0, [255, 0, 0, 255]);
  writeFileSync(join(dir, 'a.png'), encodePng(a));
  writeFileSync(join(dir, 'b.png'), encodePng(b));
  const src = {
    pack: 'mismatch',
    capabilities: { characterLayers: true },
    emoteFrames: {},
    files: { a: 'a.png', b: 'b.png' },
    rects: Object.fromEntries(c.characters.parts.map((p, i) =>
      [`char_${p}`, { file: i === 0 ? 'a' : 'b' }])),
  };
  writeFileSync(join(dir, 'mismatch.json'), JSON.stringify(src));
  const { errors } = validate(c, loadAdapter(join(dir, 'mismatch.json'), dir), { checkPixels: true });
  assert.ok(errors.some(e => /char_/.test(e) && /one canvas/.test(e)), errors.join('\n'));
});

test('a crop whose pixels no longer match its pin is an error', () => {
  // The failure this exists for: a pack ships an update, a sheet gains a row,
  // and a chosen rect silently becomes a different sprite. Coordinates still
  // resolve, the build still succeeds, the chair is just wrong.
  const { errors } = validate(c, fixture(), {
    checkPixels: true,
    pins: { stool: 'deadbeef'.repeat(8) },
  });
  assert.ok(errors.some(e => /stool/.test(e) && /pin/.test(e)), errors.join('\n'));
});

test('an unpinned crop is a warning, not an error — the pack may not be here yet', () => {
  const { errors, warnings } = validate(c, fixture(), { checkPixels: true, pins: {} });
  assert.deepEqual(errors, []);
  assert.ok(warnings.some(w => /unpinned/.test(w)));
});

test('the fixture pack validates clean against its own real pins', () => {
  const src = JSON.parse(readFileSync('sources/fixture.json', 'utf8'));
  const pins = Object.fromEntries(Object.entries(src.rects).map(([n, r]) => [n, r.pin ?? null]));
  const { errors } = validate(c, fixture(), { checkPixels: true, pins });
  assert.deepEqual(errors, [], 'the fixture pins should always match — its pixels are generated');
});
