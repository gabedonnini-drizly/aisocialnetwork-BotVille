#!/usr/bin/env node
/**
 * CI gate (I-2). Usage:
 *   node scripts/validate-contract.mjs [pack] [srcRoot]
 * Defaults to the fixture pack so it runs with no licensed art present.
 */
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';
import { validate } from './lib/contractValidator.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const abs = p => (isAbsolute(p) ? p : join(ROOT, p));
const pack = process.argv[2] ?? 'fixture';
const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');

const venuesDir = join(ROOT, 'venues');
// A venue is a directory containing venue.json — filter on that, not on the
// entry name alone. `_`-prefixed entries are not venues (venues/_archetypes/
// holds archetype files, Plan 2 Task 14a, each a single <name>.json, not
// <id>/venue.json), and stray files like .DS_Store must not crash the gate.
const venues = existsSync(venuesDir)
  ? readdirSync(venuesDir)
      .filter(id => !id.startsWith('_'))
      .filter(id => existsSync(join(venuesDir, id, 'venue.json')))
      .map(id => JSON.parse(readFileSync(join(venuesDir, id, 'venue.json'), 'utf8')))
  : [];

const checkPixels = existsSync(abs(srcRoot));
if (!checkPixels) console.warn(`! ${srcRoot} not present — running name resolution only`);

// Pins live on the adapter's rects (the `pin` field, Task 9). Only meaningful
// with pixels on disk: without them there is nothing to hash.
const pins = checkPixels
  ? Object.fromEntries(Object.entries(
      JSON.parse(readFileSync(join(ROOT, 'sources', `${pack}.json`), 'utf8')).rects,
    ).map(([n, r]) => [n, r.pin ?? null]))
  : null;

const { errors, warnings } = validate(loadContract(), loadAdapter(`sources/${pack}.json`, srcRoot), { checkPixels, venues, pins });

for (const w of warnings) console.warn(`warn: ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`error: ${e}`);
  console.error(`\ncontract validation FAILED: ${errors.length} error(s) in pack "${pack}"`);
  process.exit(1);
}
console.log(`contract validation OK: pack "${pack}", ${venues.length} venue(s), pixels ${checkPixels ? 'checked' : 'skipped'}`);
