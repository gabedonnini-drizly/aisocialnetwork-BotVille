#!/usr/bin/env node
/**
 * Fills and verifies the `pin` on every rect in sources/<pack>.json.
 *
 *   node scripts/pin.mjs [pack] [srcRoot]
 *
 * Needs the pack's pixels on disk (for limezu that is Plan 6 Task 3).
 * A missing pin is filled; a pin that no longer matches is an ERROR —
 * the pack changed under a chosen crop, and that must be a decision,
 * never a silent update.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAdapter } from './lib/sourceAdapter.mjs';
import { pinFor } from './lib/spriteReader.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const pack = process.argv[2] ?? 'fixture';
const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');

const path = join(ROOT, 'sources', `${pack}.json`);
const raw = JSON.parse(readFileSync(path, 'utf8'));
const adapter = loadAdapter(`sources/${pack}.json`, srcRoot);

let filled = 0;
const changed = [];
for (const [name, r] of Object.entries(raw.rects)) {
  const pin = pinFor(adapter, name);
  if (!r.pin) { r.pin = pin; filled++; }
  else if (r.pin !== pin) changed.push(name);
}

if (changed.length) {
  console.error(`error: ${changed.length} crop(s) no longer match their pin:`);
  for (const n of changed) console.error(`  ${n}`);
  console.error('\nThe pack changed under a chosen crop. Re-review those sprites (npm run contact),');
  console.error('then clear the stale pins deliberately and re-run.');
  process.exit(1);
}

writeFileSync(path, JSON.stringify(raw, null, 2) + '\n');
console.log(`pinned ${filled} new crop(s); ${Object.keys(raw.rects).length} total, all match`);
