#!/usr/bin/env node
// Precise PNG crop: node scripts/crop.mjs <in> <out> <x> <y> <w> <h> [zoom]
import { writeFileSync } from 'node:fs';
import { decodePng, createCanvas, encodePng } from './png-lib.mjs';
const [inF, outF, x, y, w, h, zoom = '1'] = process.argv.slice(2);
const img = decodePng(inF);
const W = Number(w), H = Number(h), Z = Number(zoom);
const cv = createCanvas(W * Z, H * Z);
for (let yy = 0; yy < H * Z; yy++)
  for (let xx = 0; xx < W * Z; xx++)
    cv.set(xx, yy, img.px(Number(x) + Math.floor(xx / Z), Number(y) + Math.floor(yy / Z)));
writeFileSync(outF, encodePng(cv));
console.log(`${outF}: (${x},${y}) ${W}x${H} @${Z}x`);
