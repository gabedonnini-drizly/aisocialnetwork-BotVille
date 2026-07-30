/**
 * Emits one trimmed PNG per contract prop name and records its TRUE size.
 * VenueBaker stamps those sizes into the .tmj, which is what removes the
 * hand-authored object dimensions the old maps carried.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { createCanvas, encodePng } from '../png-lib.mjs';
import { readSprite, asSource } from './spriteReader.mjs';

/**
 * Named pixel generators for props no pack supplies. Referenced by name
 * from sources/<pack>.json, never called from runtime code.
 */
export const GENERATORS = {
  /**
   * The packs ship no book shop, so a MARKET-style plate reading BOOKS is
   * stamped onto a generic building facade (was build-district.mjs:96-126).
   */
  bookSign(src) {
    const FONT = {
      B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
      O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
      K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
      S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
    };
    const TEXT = 'BOOKS';
    const cv = createCanvas(src.w, src.h);
    cv.blit(asSource(src), 0, 0, src.w, src.h, 0, 0);

    const textW = TEXT.length * 6 - 1;
    const plateW = textW + 8, plateH = 13;
    const px0 = Math.floor((src.w - plateW) / 2), py0 = 85;
    const BORDER = [42, 42, 62, 255], PLATE = [233, 230, 238, 255], INK = [52, 52, 84, 255];

    for (let y = 0; y < plateH; y++) {
      for (let x = 0; x < plateW; x++) {
        const edge = x === 0 || y === 0 || x === plateW - 1 || y === plateH - 1;
        cv.set(px0 + x, py0 + y, edge ? BORDER : PLATE);
      }
    }
    TEXT.split('').forEach((ch, i) => {
      const glyph = FONT[ch];
      for (let y = 0; y < 7; y++)
        for (let x = 0; x < 5; x++)
          if (glyph[y][x] === '#') cv.set(px0 + 4 + i * 6 + x, py0 + 3 + y, INK);
    });
    return cv;
  },
};

/** @returns {Map<string, {canvas: object, w: number, h: number}>} */
export function bakeProps(contract, adapter, group) {
  const defs = contract.props[group];
  if (!defs) throw new Error(`unknown prop group: ${group}`);
  const out = new Map();

  for (const name of Object.keys(defs)) {
    const s = readSprite(adapter, name);
    const gen = adapter.resolve(name).generated;
    if (gen) {
      const fn = GENERATORS[gen];
      if (!fn) throw new Error(`prop ${name} names unknown generator: ${gen}`);
      const canvas = fn(s.canvas);
      out.set(name, { canvas, w: canvas.w, h: canvas.h });
    } else {
      out.set(name, { canvas: s.canvas, w: s.w, h: s.h });
    }
  }
  return out;
}

/** @returns {string[]} written file names */
export function writeProps(baked, outDir) {
  const written = [];
  for (const [name, { canvas }] of baked) {
    const p = join(outDir, `${name}.png`);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, encodePng(canvas));
    written.push(`${name}.png`);
  }
  return written.sort();
}
