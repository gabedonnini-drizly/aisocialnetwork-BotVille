/**
 * Per-row alpha coverage over a character-layer sheet (Task 27 Step 0,
 * D-19 2026-07-30). The 32px rows of every layer sheet are:
 *   r0 preview, r1 idle, r2 walk, r3 sleep, r4 sit-right, r5 sit-left
 * (sheets are 656px tall = 20.5 rows; the half row is empty).
 *
 * Pure: takes a decoded image-like ({w,h,px}) and a row index, returns
 * whether that row has any art. No filesystem access here — the CLI
 * (`scripts/gen-row-coverage.mjs`) owns I/O, same split as
 * `variantManifest.mjs` / `gen-variant-manifest.mjs`.
 */

/** Row index by name, for callers that would rather not hand-count. */
export const ROWS = { preview: 0, idle: 1, walk: 2, sleep: 3, sitRight: 4, sitLeft: 5 };

/**
 * True if any pixel in row `row` (0-indexed, `frameHeight` px tall) has
 * alpha above 8 — the same threshold `spriteReader.mjs`'s empty-crop guard
 * uses, so "coverage" here means the same thing "art exists" means there.
 * A row that falls entirely off the bottom of a shorter-than-expected sheet
 * reads as no coverage rather than throwing — a defect worth excluding on,
 * not a crash.
 */
export function rowHasCoverage(img, row, frameHeight = 32) {
  const y0 = row * frameHeight;
  if (y0 >= img.h) return false;
  const y1 = Math.min(y0 + frameHeight, img.h);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < img.w; x++) {
      if (img.px(x, y)[3] > 8) return true;
    }
  }
  return false;
}

/** Convenience: coverage across several rows at once, `{ [row]: boolean }`. */
export function rowCoverage(img, rows, frameHeight = 32) {
  const out = {};
  for (const r of rows) out[r] = rowHasCoverage(img, r, frameHeight);
  return out;
}
