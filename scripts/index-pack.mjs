#!/usr/bin/env node
/**
 * Inventories an art pack, so choosing a sprite starts from a candidate list
 * instead of from someone's memory of what they scrolled past.
 *
 * Two outputs, on purpose:
 *
 *   sources/<pack>.sheets.json   COMMITTED. One row per sheet with a file
 *       hash. Small and diffable: when a pack ships an update, this file's
 *       diff names exactly which sheets moved, which is the signal that the
 *       crops taken from them need re-reviewing.
 *
 *   sources/<pack>.index.json    GITIGNORED. Every non-empty cell, with its
 *       trimmed bounds, opaque-pixel count, dominant palette and crop hash.
 *       Regenerable, large, and used for browsing while curating.
 *
 *   node scripts/index-pack.mjs [pack] [srcRoot]
 */
import { createHash } from 'node:crypto';
import { closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, writeFileSync, writeSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './png-lib.mjs';
import { loadContract } from './lib/assetContract.mjs';

/**
 * Writes { key: value, ... } as JSON one entry at a time, so a real 16×16
 * pack — tens of thousands of sheets, one candidate-cell array apiece — never
 * forces `JSON.stringify` to materialise a single string past V8's ~512MB
 * limit. Only used for the (gitignored, regenerable) per-cell index; the
 * small committed sheets manifest still goes through plain JSON.stringify.
 */
function writeJsonMapSync(path, map) {
  const fd = openSync(path, 'w');
  writeSync(fd, '{\n');
  const keys = Object.keys(map);
  keys.forEach((k, i) => {
    const entry = `  ${JSON.stringify(k)}: ${JSON.stringify(map[k])}${i < keys.length - 1 ? ',' : ''}\n`;
    writeSync(fd, entry);
  });
  writeSync(fd, '}\n');
  closeSync(fd);
}

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

/** Every .png under a directory, as forward-slashed relative paths, sorted. */
function pngsUnder(root) {
  const out = [];
  (function walk(d) {
    for (const e of readdirSync(d).sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.toLowerCase().endsWith('.png')) out.push(relative(root, p).split('\\').join('/'));
    }
  })(root);
  return out.sort();
}

/**
 * What a candidate cell looks like. Returns null when the cell is entirely
 * transparent — an empty cell is not a candidate, and most of a tilesheet is
 * empty.
 *
 * `palette` is quantised to 5 bits per channel before counting, so two shades
 * a human reads as "the same brown" group together instead of producing four
 * near-identical entries.
 */
export function cellSignature(img, x, y, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1, opaque = 0;
  const counts = new Map();

  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const p = img.px(x + xx, y + yy);
      if (p[3] <= 8) continue;                 // same alpha threshold as SpriteReader
      opaque++;
      if (xx < minX) minX = xx;
      if (xx > maxX) maxX = xx;
      if (yy < minY) minY = yy;
      if (yy > maxY) maxY = yy;
      const key = ((p[0] >> 3) << 10) | ((p[1] >> 3) << 5) | (p[2] >> 3);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  if (maxX < 0) return null;

  const hex = key => '#' + [(key >> 10) & 31, (key >> 5) & 31, key & 31]
    .map(v => (v << 3).toString(16).padStart(2, '0')).join('');
  const palette = [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0] - b[0])
    .slice(0, 4)
    .map(([key]) => hex(key));

  // Hash the TRIMMED pixels: the same sprite at a different offset in a
  // re-laid-out sheet still hashes the same, which is what makes the adapter's
  // `pin` field survive a cosmetic pack reshuffle.
  const hash = createHash('sha256');
  const row = Buffer.alloc((maxX - minX + 1) * 4);
  for (let yy = minY; yy <= maxY; yy++) {
    for (let xx = minX; xx <= maxX; xx++) {
      const p = img.px(x + xx, y + yy);
      const i = (xx - minX) * 4;
      row[i] = p[0]; row[i + 1] = p[1]; row[i + 2] = p[2]; row[i + 3] = p[3];
    }
    hash.update(row);
  }

  return {
    trimmed: { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 },
    opaque,
    palette,
    sha256: hash.digest('hex'),
  };
}

/**
 * Filters a full sheets map down to just the paths a pack manifest's `files`
 * block actually names. Exported so the scoping decision itself is
 * unit-testable without a real (or even the fixture) pack on disk: given any
 * `sheets` map and any `manifest` shape, the result must (1) only contain
 * keys the manifest's `files` values name, (2) contain exactly that many —
 * not fewer, if every named file is present in `sheets` — and (3) never
 * contain a `sheets` key the manifest doesn't name. `manifest == null` (no
 * `sources/<pack>.json` yet, e.g. indexing a brand-new pack for the first
 * time) means nothing to scope against, so everything passes through.
 *
 * This is the fix for the rejected full-pack manifest design (measured at
 * 41,488 sheets / 9.7MB against the real four packs): the COMMITTED manifest
 * exists so a pack update's diff names exactly which sheets moved, which is
 * only ever true for a sheet a crop actually reads.
 */
export function scopeToReferenced(sheets, manifest) {
  if (!manifest) return sheets;
  const referenced = new Set(Object.values(manifest.files ?? {}));
  return Object.fromEntries(Object.entries(sheets).filter(([p]) => referenced.has(p)));
}

export function indexPack({ srcRoot, tileSize = 16, out }) {
  const root = resolve(ROOT, srcRoot);
  const sheets = {};
  const cells = {};

  for (const rel of pngsUnder(root)) {
    const file = join(root, rel);
    sheets[rel] = {
      ...(({ w, h }) => ({ w, h }))(decodePng(file)),
      sha256: createHash('sha256').update(readFileSync(file)).digest('hex'),
    };

    const img = decodePng(file);
    const list = [];

    // A sheet smaller than two cells in both axes is a single sprite, not a
    // grid — the packs ship hundreds of those under Singles/ directories.
    const single = img.w < tileSize * 2 && img.h < tileSize * 2;
    const step = single ? Math.max(img.w, img.h) : tileSize;

    for (let y = 0; y < img.h; y += step) {
      for (let x = 0; x < img.w; x += step) {
        const w = Math.min(step, img.w - x);
        const h = Math.min(step, img.h - y);
        const sig = cellSignature(img, x, y, w, h);
        if (sig) list.push({ x, y, w, h, ...sig });
      }
    }
    if (list.length) cells[rel] = list;
  }

  if (out) {
    mkdirSync(out, { recursive: true });
    writeFileSync(join(out, 'sheets.json'), JSON.stringify(sheets, null, 2) + '\n');
    writeJsonMapSync(join(out, 'index.json'), cells);
  }
  return { sheets, cells };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pack = process.argv[2] ?? 'fixture';
  const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');
  const { sheets, cells } = indexPack({ srcRoot, tileSize: loadContract().tileSize });

  mkdirSync(join(ROOT, 'sources'), { recursive: true });

  // The COMMITTED manifest is scoped to sheets sources/<pack>.json actually
  // names (its own header above: "this file's diff names exactly which
  // sheets moved, which is the signal that the crops taken from them need
  // re-reviewing" — a sheet nothing crops from can never trigger that
  // signal). A full-pack manifest was measured against the real four-pack
  // assets-src/ at 41,488 sheets / 9.7MB and rejected: almost none of those
  // rows name a sheet anything in this repo ever reads, so its diff would
  // fire on pack noise no crop depends on. The gitignored per-cell index
  // stays full-pack — it is the browsing aid for CHOOSING a crop in the
  // first place, which is exactly the job a scoped-to-already-chosen list
  // cannot do. See scopeToReferenced() above (unit-tested independently of
  // any pack) for the filter itself.
  const manifestPath = join(ROOT, 'sources', `${pack}.json`);
  const manifest = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : null;
  const scopedSheets = scopeToReferenced(sheets, manifest);
  writeFileSync(join(ROOT, 'sources', `${pack}.sheets.json`), JSON.stringify(scopedSheets, null, 2) + '\n');
  writeJsonMapSync(join(ROOT, 'sources', `${pack}.index.json`), cells);

  const candidates = Object.values(cells).reduce((n, l) => n + l.length, 0);
  console.log(`pack index: ${Object.keys(scopedSheets).length} sheets referenced (of ${Object.keys(sheets).length} pack files scanned), ${candidates} candidate cells -> sources/${pack}.{sheets,index}.json`);
}
