#!/usr/bin/env node
/**
 * Task 27 Step 0 (BLOCKING, D-19 2026-07-30): pixel-measures sleep-row (r3)
 * coverage across EVERY hair variant, and sit-row (r4/r5) coverage across
 * every layer in use — bodies, eyes, all hairstyles, all outfits, and every
 * accessory file — on the real pack. There is no curated subset (D-19
 * supersedes D-16's owner-pick-12/8): every hair/outfit variant is sampled,
 * and any that fails is reported for automatic exclusion, never a hand
 * swap. `scripts/gen-variant-manifest.mjs --exclude <files>` is the step
 * that actually regenerates the committed hair/outfit manifests from this
 * script's findings; this script only measures and reports.
 *
 * Row map (32px rows, sheets are 656px tall = 20.5 rows, the half empty):
 *   r0 preview, r1 idle, r2 walk, r3 sleep, r4 sit-right, r5 sit-left
 *
 * Gate rules:
 *   - hair variant fails  -> excluded  if it lacks r3 OR r4 OR r5 coverage
 *     (a sleep frame is body+hair only, D-17 — hair is the one non-body
 *     layer a sleep frame actually shows, so hair alone is r3-gated).
 *   - outfit variant fails -> excluded if it lacks r4 OR r5 coverage.
 *     Outfits have NO sleep-row art anywhere in the pack by design (D-17) —
 *     that is expected, not a per-variant defect, so r3 is not a gate for
 *     outfits.
 *   - bodies / eyes / accessories have no generated variant manifest to
 *     exclude FROM (body is not yet per-record-variant selected — the
 *     composer always reads the pack's single aliased default body sheet;
 *     eyes ARE per-record-variant selected, via resolveVariantFile, same as
 *     hair/outfit, but from a fixed 7-entry enum rather than a generated
 *     manifest, so there is nothing to exclude a failing eye sheet FROM;
 *     accessory is likewise a small fixed enum, not pack-file-derived) —
 *     they are measured and reported for docs/ASSETS.md only, per D-17's
 *     "vanish at bedtime, accepted" decision for the no-sleep-art accessory
 *     families.
 *
 * Usage: node scripts/gen-row-coverage.mjs [assetsRoot=assets-src] [--json]
 */
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng } from './png-lib.mjs';
import { ROWS, rowHasCoverage } from './lib/rowCoverage.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const FRAME_HEIGHT = 32;

function charGenRoot(assetsRoot) {
  return join(ROOT, assetsRoot, 'interiors', '2_Characters', 'Character_Generator');
}

function listPngs(dir) {
  return readdirSync(dir).filter(f => f.endsWith('.png')).sort();
}

function measureDir(dir, rows) {
  return listPngs(dir).map(file => {
    const img = decodePng(join(dir, file));
    const coverage = {};
    for (const r of rows) coverage[r] = rowHasCoverage(img, r, FRAME_HEIGHT);
    return { file, w: img.w, h: img.h, coverage };
  });
}

/** Accessory_<NN>_<Family>_<VV>.png -> Family; anything else has no family. */
export function accessoryFamily(filename) {
  const m = /^Accessory_\d+_(.+)_\d+\.png$/.exec(filename);
  return m ? m[1] : null;
}

export function measurePack(assetsRoot) {
  const root = charGenRoot(assetsRoot);
  const hair = measureDir(join(root, 'Hairstyles', '16x16'), [ROWS.sleep, ROWS.sitRight, ROWS.sitLeft]);
  const outfit = measureDir(join(root, 'Outfits', '16x16'), [ROWS.sitRight, ROWS.sitLeft]);
  const eyes = measureDir(join(root, 'Eyes', '16x16'), [ROWS.sitRight, ROWS.sitLeft]);
  const body = measureDir(join(root, 'Bodies', '16x16'), [ROWS.sitRight, ROWS.sitLeft]);
  const accessory = measureDir(join(root, 'Accessories', '16x16'), [ROWS.sleep, ROWS.sitRight, ROWS.sitLeft]);

  const hairExcluded = hair.filter(h =>
    !h.coverage[ROWS.sleep] || !h.coverage[ROWS.sitRight] || !h.coverage[ROWS.sitLeft])
    .map(h => ({ file: h.file, reason: [
      !h.coverage[ROWS.sleep] && 'no sleep-row (r3) art',
      !h.coverage[ROWS.sitRight] && 'no sit-right-row (r4) art',
      !h.coverage[ROWS.sitLeft] && 'no sit-left-row (r5) art',
    ].filter(Boolean).join('; ') }));

  const outfitExcluded = outfit.filter(o => !o.coverage[ROWS.sitRight] || !o.coverage[ROWS.sitLeft])
    .map(o => ({ file: o.file, reason: [
      !o.coverage[ROWS.sitRight] && 'no sit-right-row (r4) art',
      !o.coverage[ROWS.sitLeft] && 'no sit-left-row (r5) art',
    ].filter(Boolean).join('; ') }));

  const bodyFail = body.filter(b => !b.coverage[ROWS.sitRight] || !b.coverage[ROWS.sitLeft]);
  const eyesFail = eyes.filter(e => !e.coverage[ROWS.sitRight] || !e.coverage[ROWS.sitLeft]);

  // Per-family accessory sleep-row (r3) coverage — every file in a family
  // agrees or the family-level claim in docs/ASSETS.md would be wrong.
  const familyRows = new Map();
  for (const a of accessory) {
    const fam = accessoryFamily(a.file);
    if (!fam) continue;
    if (!familyRows.has(fam)) familyRows.set(fam, []);
    familyRows.get(fam).push(a);
  }
  const accessoryFamilies = [...familyRows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([fam, files]) => {
    const sleepStates = new Set(files.map(f => f.coverage[ROWS.sleep]));
    const sitFail = files.filter(f => !f.coverage[ROWS.sitRight] || !f.coverage[ROWS.sitLeft]);
    return {
      family: fam,
      files: files.length,
      hasSleepArt: sleepStates.has(true) && !sleepStates.has(false) ? true
        : sleepStates.has(false) && !sleepStates.has(true) ? false
        : 'mixed',
      sitFail: sitFail.map(f => f.file),
    };
  });

  return {
    hair: { total: hair.length, excluded: hairExcluded },
    outfit: { total: outfit.length, excluded: outfitExcluded },
    body: { total: body.length, fail: bodyFail.map(b => b.file) },
    eyes: { total: eyes.length, fail: eyesFail.map(e => e.file) },
    accessoryFamilies,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const assetsRoot = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'assets-src';
  const asJson = process.argv.includes('--json');
  const report = measurePack(assetsRoot);

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`hair: ${report.hair.total} sampled (r3+r4+r5), ${report.hair.excluded.length} excluded`);
    for (const h of report.hair.excluded) console.log(`  - ${h.file}: ${h.reason}`);
    console.log(`outfit: ${report.outfit.total} sampled (r4+r5), ${report.outfit.excluded.length} excluded`);
    for (const o of report.outfit.excluded) console.log(`  - ${o.file}: ${o.reason}`);
    console.log(`body: ${report.body.total} sampled (r4+r5), ${report.body.fail.length} sit-row failures`);
    console.log(`eyes: ${report.eyes.total} sampled (r4+r5), ${report.eyes.fail.length} sit-row failures`);
    console.log(`accessories: ${report.accessoryFamilies.length} families`);
    for (const f of report.accessoryFamilies) {
      console.log(`  - ${f.family} (${f.files} files): sleep-art=${f.hasSleepArt}, sit-row failures=${f.sitFail.length}`);
    }
  }
}
