/**
 * Crops a rect out of a pack PNG and trims its transparent margins.
 * This is the alpha-bbox loop that used to be duplicated in
 * build-district.mjs:73-85 and build-interiors.mjs:103-123.
 */
import { createHash } from 'node:crypto';
import { decodePng, createCanvas } from '../png-lib.mjs';

const cache = new Map();
function decodeCached(path) {
  if (!cache.has(path)) cache.set(path, decodePng(path));
  return cache.get(path);
}

/** Adapt a mutable png-lib canvas back into the read-only {w,h,px} shape blit() wants. */
export function asSource(canvas) {
  return {
    w: canvas.w,
    h: canvas.h,
    px: (x, y) => {
      if (x < 0 || y < 0 || x >= canvas.w || y >= canvas.h) return [0, 0, 0, 0];
      const i = (y * canvas.w + x) * 4;
      return [canvas.data[i], canvas.data[i + 1], canvas.data[i + 2], canvas.data[i + 3]];
    },
  };
}

/**
 * @returns {{name:string, w:number, h:number, canvas:object}} true post-trim bounds
 */
export function readSprite(adapter, name) {
  const r = adapter.resolve(name);
  const img = adapter._override ?? decodeCached(r.absPath);

  const rx = r.x;
  const ry = r.y;
  const rw = r.w ?? img.w;
  const rh = r.h ?? img.h;

  let minX = rw, minY = rh, maxX = -1, maxY = -1;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (img.px(rx + x, ry + y)[3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) throw new Error(`empty crop: ${name}`);

  // trim:false keeps the declared rect; trim:true shrinks to real content
  const ox = r.trim ? minX : 0;
  const oy = r.trim ? minY : 0;
  const w = r.trim ? maxX - minX + 1 : rw;
  const h = r.trim ? maxY - minY + 1 : rh;

  const cv = createCanvas(w, h);
  cv.blit(img, rx + ox, ry + oy, w, h, 0, 0);
  return { name, w, h, canvas: cv };
}

/**
 * The pin: a hash of the CHOSEN PIXELS, not of the coordinates.
 *
 * Hashing the post-trim crop rather than the rect is the point. A pack that
 * re-lays out a sheet moves the coordinates and keeps the sprite — the rect
 * check would scream and the sprite would be fine. A pack that redraws the
 * sprite keeps the coordinates and changes the art — the rect check would say
 * nothing and the art would be wrong. Only the pixels distinguish the two.
 */
export function pinFor(adapter, name) {
  const s = readSprite(adapter, name);
  return createHash('sha256').update(Buffer.from(s.canvas.data)).digest('hex');
}
