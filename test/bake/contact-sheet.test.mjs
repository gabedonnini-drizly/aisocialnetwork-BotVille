import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadContract } from '../../scripts/lib/assetContract.mjs';
import { loadAdapter } from '../../scripts/lib/sourceAdapter.mjs';
import { contactSheet, nightTint, writeContactSheets } from '../../scripts/contact-sheet.mjs';
import { createCanvas } from '../../scripts/png-lib.mjs';

const c = loadContract();
const a = () => loadAdapter('sources/fixture.json', 'test/fixtures/pack-src');

test('every prop in a group appears exactly once', () => {
  const { cells } = contactSheet(c, a(), 'interior', { floorTile: 'floorCafe', columns: 8 });
  assert.equal(cells.length, Object.keys(c.props.interior).length);
  assert.equal(new Set(cells.map(x => x.name)).size, cells.length);
});

test('cells are alphabetical, so the same sprite sits in the same place across packs', () => {
  const { cells } = contactSheet(c, a(), 'district', { floorTile: 'grass', columns: 8 });
  assert.deepEqual(cells.map(x => x.name), [...cells.map(x => x.name)].sort());
});

test('every cell reports where it landed, so the HTML can label it', () => {
  const { cells, canvas } = contactSheet(c, a(), 'interior', { floorTile: 'floorCafe', columns: 8 });
  for (const cell of cells) {
    assert.ok(cell.x >= 0 && cell.x < canvas.w, cell.name);
    assert.ok(cell.y >= 0 && cell.y < canvas.h, cell.name);
    assert.ok(cell.w > 0 && cell.h > 0, cell.name);
  }
});

test('the night tint darkens without flattening to black', () => {
  const cv = createCanvas(1, 1);
  cv.set(0, 0, [200, 100, 50, 255]);
  const out = nightTint(cv);
  const [r, g, b, alpha] = [out.data[0], out.data[1], out.data[2], out.data[3]];
  assert.ok(r < 200 && g < 100, 'not darkened');
  assert.ok(r > 0 && b > 0, 'flattened to black — the tint is too strong to review under');
  assert.equal(alpha, 255);
});

test('a transparent pixel stays transparent under the tint', () => {
  const cv = createCanvas(1, 1);
  assert.equal(nightTint(cv).data[3], 0);
});

test('sheets are deterministic, so a diff means the ART changed', () => {
  const x = contactSheet(c, a(), 'interior', { floorTile: 'floorCafe', columns: 8 });
  const y = contactSheet(c, a(), 'interior', { floorTile: 'floorCafe', columns: 8 });
  assert.deepEqual([...x.canvas.data], [...y.canvas.data]);
});

test('writeContactSheets emits a png and an html per group', () => {
  const out = mkdtempSync(join(tmpdir(), 'contact-'));
  writeContactSheets(c, a(), out);
  const files = readdirSync(out).sort();
  for (const group of Object.keys(c.props)) {
    assert.ok(files.includes(`${group}.png`), group);
    assert.ok(files.includes(`${group}.html`), group);
  }
});

test('the html labels every cell and cites the reason the sprite was chosen', () => {
  const out = mkdtempSync(join(tmpdir(), 'contact-html-'));
  writeContactSheets(c, a(), out);
  const html = readFileSync(join(out, 'interior.html'), 'utf8');
  for (const name of Object.keys(c.props.interior)) assert.ok(html.includes(name), name);
  assert.match(html, /generated fixture sprite/, 'the note should be visible on hover');
});
