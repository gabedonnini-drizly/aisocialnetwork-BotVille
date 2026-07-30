#!/usr/bin/env node
/**
 * CLI: derive the committed hair/outfit variant manifests from a pack's own
 * file NAMES (D-19, 2026-07-30). Grouping only touches filenames — no pixel
 * read, no PNG decode — which is why this stays runnable without the real
 * licensed art present (see `filenamesFor` below for the one case that
 * still needs the real files on disk, and why it is safe even so).
 *
 * Usage: node scripts/gen-variant-manifest.mjs --pack <limezu|fixture>
 *
 * Writes sources/<pack>.variants.json (hair, `/^Hairstyle_(\d+)_(\d+)\.png$/`)
 * and sources/<pack>.variants.outfit.json (outfit,
 * `/^Outfit_(\d+)_(\d+)\.png$/`). Both are COMMITTED, generated, and never
 * hand-edited — regenerate by re-running this CLI, never by editing the
 * JSON (Task 26 Step 3a).
 */
import { readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildVariantManifest } from './lib/variantManifest.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

const HAIR_PATTERN = /^Hairstyle_(\d+)_(\d+)\.png$/;
const OUTFIT_PATTERN = /^Outfit_(\d+)_(\d+)\.png$/;

/**
 * Real pack (`--pack limezu`): filenames come from the pack's own directory
 * listing under `assets-src/` (gitignored — the licensed art itself is never
 * read here, only its file NAMES via `readdirSync`, which touches no pixel
 * data). The manifest this writes is safe to commit: it names only numeric
 * style/variant ids ('01', '02', ...), never a vendor string or file path
 * (Global Constraints — no vendor name in committed code).
 */
function realPackFilenames(sub) {
  const dir = join(ROOT, 'assets-src', 'interiors', '2_Characters', 'Character_Generator', sub, '16x16');
  return readdirSync(dir);
}

/**
 * Synthetic pack (`--pack fixture`): Task 8's `test/fixtures/pack-src`
 * generator does not (yet) emit per-style/variant character files — it
 * writes one monolithic sheet per character part. This small, deterministic,
 * inline filename list — same `<Style>_<NN>_<MM>.png` naming the real pack
 * uses — lets `test/appearance-composer.test.mjs` (Task 27) exercise the
 * identical two-stage resolution mechanism with no real pack on disk at
 * all. It is synthetic test scaffolding, not pack-derived data; only its
 * *shape* (several styles, uneven variant counts per style) is fixed on
 * purpose, to prove the pick is style-then-variant-within-style rather
 * than a flat pick over every file.
 */
const FIXTURE_HAIR_FILES = [
  'Hairstyle_01_01.png', 'Hairstyle_01_02.png', 'Hairstyle_01_03.png',
  'Hairstyle_02_01.png', 'Hairstyle_02_02.png',
  'Hairstyle_03_01.png', 'Hairstyle_03_02.png', 'Hairstyle_03_03.png', 'Hairstyle_03_04.png',
];
const FIXTURE_OUTFIT_FILES = [
  'Outfit_01_01.png', 'Outfit_01_02.png',
  'Outfit_02_01.png', 'Outfit_02_02.png', 'Outfit_02_03.png',
  'Outfit_03_01.png',
];

export function filenamesFor(pack, kind) {
  if (pack === 'fixture') return kind === 'hair' ? FIXTURE_HAIR_FILES : FIXTURE_OUTFIT_FILES;
  return realPackFilenames(kind === 'hair' ? 'Hairstyles' : 'Outfits');
}

/**
 * (D-19, 2026-07-30, Task 27 Step 0) `exclude` names files to drop BEFORE
 * grouping — the automatic-exclusion mechanism the amended plan requires:
 * a variant that fails sleep/sit-row coverage (`scripts/gen-row-coverage.mjs`)
 * is excluded from the committed manifest by never being counted in the
 * first place, never by hand-editing the generated JSON. `exclude.hair` /
 * `exclude.outfit` are Sets of exact filenames (e.g. `Hairstyle_14_03.png`).
 */
export function generate(pack, exclude = {}) {
  const hairFiles = filenamesFor(pack, 'hair').filter(f => !exclude.hair?.has(f));
  const outfitFiles = filenamesFor(pack, 'outfit').filter(f => !exclude.outfit?.has(f));
  const hair = buildVariantManifest(hairFiles, HAIR_PATTERN);
  const outfit = buildVariantManifest(outfitFiles, OUTFIT_PATTERN);
  mkdirSync(join(ROOT, 'sources'), { recursive: true });
  writeFileSync(join(ROOT, 'sources', `${pack}.variants.json`), JSON.stringify(hair, null, 2) + '\n');
  writeFileSync(join(ROOT, 'sources', `${pack}.variants.outfit.json`), JSON.stringify(outfit, null, 2) + '\n');
  return { hair, outfit };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--pack');
  const pack = i >= 0 ? process.argv[i + 1] : 'fixture';
  const excludeArg = name => {
    const j = process.argv.indexOf(name);
    return j >= 0 ? new Set(process.argv[j + 1].split(',').filter(Boolean)) : undefined;
  };
  const exclude = { hair: excludeArg('--exclude-hair'), outfit: excludeArg('--exclude-outfit') };
  const { hair, outfit } = generate(pack, exclude);
  const hairCount = Object.values(hair.variantsByStyle).reduce((n, v) => n + v.length, 0);
  const outfitCount = Object.values(outfit.variantsByStyle).reduce((n, v) => n + v.length, 0);
  console.log(
    `${pack}: ${hair.styles.length} hair styles / ${hairCount} files, ` +
    `${outfit.styles.length} outfit styles / ${outfitCount} files -> ` +
    `sources/${pack}.variants{,.outfit}.json` +
    (exclude.hair?.size || exclude.outfit?.size
      ? ` (excluded ${exclude.hair?.size ?? 0} hair / ${exclude.outfit?.size ?? 0} outfit variant(s), Task 27 Step 0)`
      : ''));
}
