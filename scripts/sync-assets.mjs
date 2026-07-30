#!/usr/bin/env node
/**
 * Copies the sheets the RUNTIME loads whole into public/assets/.
 *
 * Everything else the client shows is a bake output (scripts/world-bake.mjs),
 * read straight from assets-src/ through the adapter. What survives here is
 * the short list of sheets Phaser loads as images: the premade character
 * sheets AppearanceResolver falls back to, the emote sheet, the UI sheet.
 *
 * This script used to carry 59 hardcoded LimeZu paths — a curation decision
 * ("these sheets matter") expressed as code, duplicating the adapter's files
 * block and free to disagree with it. The list is now derived: the contract
 * names the sheets, the adapter resolves each to a file (I-1).
 *
 *   node scripts/sync-assets.mjs [pack] [srcRoot]
 */
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');

export function syncAssets({ pack = 'fixture', srcRoot, outDir, throwOnMissing = true } = {}) {
  if (!outDir) throw new Error('syncAssets: outDir is required');

  const contract = loadContract();
  const adapter = loadAdapter(`sources/${pack}.json`, srcRoot);

  const copied = [];
  const missing = [];

  for (const name of contract.runtimeSheets) {
    const { absPath } = adapter.resolve(name);
    // Destination keeps the source filename: assetManifest.ts references these
    // by file, not by contract name, and the vendor segment is already gone.
    const dest = join(outDir, 'sprites', 'pack', basename(absPath));
    if (!existsSync(absPath)) { missing.push(`${name} -> ${absPath}`); continue; }
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(absPath, dest);
    copied.push(name);
  }

  if (missing.length && throwOnMissing) {
    for (const m of missing) console.error(`error: missing runtime sheet ${m}`);
    throw new Error(`sync-assets: ${missing.length} runtime sheet(s) missing from ${srcRoot}`);
  }
  return { copied, missing };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const pack = process.argv[2] ?? 'fixture';
  const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');
  const { copied } = syncAssets({
    pack, srcRoot, outDir: join(ROOT, 'packages', 'client', 'public', 'assets'),
  });
  console.log(`sync-assets: ${copied.length} runtime sheet(s) copied from pack "${pack}"`);
}
