#!/usr/bin/env node
/**
 * Spritesheet layout analyzer: decodes a PNG (dependency-free)
 * and prints an occupancy map of an NxN grid — which cells contain opaque
 * pixels. Used to pin down frames precisely in assetManifest.ts.
 *
 * Run: node scripts/png-grid.mjs <file.png> [cellW] [cellH]
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';

export function decodePng(file) {
  const buf = readFileSync(file);
  let pos = 8;
  const idat = [];
  let w = 0, h = 0, bitDepth = 8, colorType = 6, palette = null, trns = null;
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      bitDepth = data[8]; colorType = data[9];
      if (data[12] !== 0) throw new Error('interlaced PNG not supported');
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (bitDepth !== 8) throw new Error(`bitDepth ${bitDepth} not supported`);
  const bpp = channels;
  const stride = w * channels;
  const out = Buffer.alloc(h * stride);
  let rp = 0;
  for (let y = 0; y < h; y++) {
    const filter = raw[rp++];
    const row = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const rv = raw[rp + x];
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = x >= bpp && prev ? prev[x - bpp] : 0;
      let v;
      switch (filter) {
        case 0: v = rv; break;
        case 1: v = rv + a; break;
        case 2: v = rv + b; break;
        case 3: v = rv + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = rv + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`bad filter ${filter}`);
      }
      row[x] = v & 0xff;
    }
    rp += stride;
  }
  // per-pixel alpha lookup
  const alphaAt = (x, y) => {
    const i = y * stride + x * channels;
    if (colorType === 6) return out[i + 3];
    if (colorType === 4) return out[i + 1];
    if (colorType === 3) {
      const idx = out[i];
      return trns && idx < trns.length ? trns[idx] : 255;
    }
    return 255;
  };
  return { w, h, alphaAt };
}

export function gridReport(file, cellW, cellH) {
  const { w, h, alphaAt } = decodePng(file);
  const cols = Math.ceil(w / cellW), rows = Math.ceil(h / cellH);
  console.log(`${file}\n  ${w}x${h}, grid ${cellW}x${cellH} -> ${cols} cols x ${rows} rows`);
  for (let r = 0; r < rows; r++) {
    let line = '';
    let count = 0;
    for (let c = 0; c < cols; c++) {
      let occupied = false;
      outer: for (let y = r * cellH; y < Math.min((r + 1) * cellH, h); y += 2) {
        for (let x = c * cellW; x < Math.min((c + 1) * cellW, w); x += 2) {
          if (alphaAt(x, y) > 16) { occupied = true; break outer; }
        }
      }
      line += occupied ? '#' : '.';
      if (occupied) count++;
    }
    console.log(`  r${String(r).padStart(2)} y=${String(r * cellH).padStart(4)} [${line}] ${count}`);
  }
}

const [file, cw = '16', ch = '16'] = process.argv.slice(2);
if (file) gridReport(file, Number(cw), Number(ch));
