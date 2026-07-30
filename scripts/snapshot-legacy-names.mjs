#!/usr/bin/env node
/**
 * Extracts the asset name lists from the code this plan replaces, into a
 * committed snapshot the contract is reconciled against.
 *
 * Extraction, not transcription: a name typed twice by hand proves nothing.
 * The snapshot outlives its sources (Task 19 retires the build scripts,
 * Task 24 deletes the config.ts lists), which is why it is committed.
 *
 * Re-record deliberately, never incidentally:
 *   UPDATE_GOLDEN=1 node scripts/snapshot-legacy-names.mjs
 * Without the flag it verifies and exits non-zero on any difference.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const OUT = join(ROOT, 'test', 'golden', 'legacy-names.json');

const find = (...rel) => rel.map(r => join(ROOT, r)).find(existsSync);

/** `['name', SHEET, tx, ty]` tuples from an ATLAS_TILES array literal. */
function atlasTiles(file) {
  const src = readFileSync(file, 'utf8');
  const block = src.match(/const ATLAS_TILES\s*=\s*\[([\s\S]*?)\n\];/);
  if (!block) throw new Error(`no ATLAS_TILES in ${file}`);
  return [...block[1].matchAll(/\[\s*'([^']+)'/g)].map(m => m[1]);
}

/** A `const NAME = [ 'a', 'b' ] as const;` string array from config.ts. */
function stringList(src, name) {
  const block = src.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*as const;`));
  if (!block) throw new Error(`no ${name} in config.ts`);
  return [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
}

const districtScript = find('test/golden/legacy/build-district.mjs', 'scripts/build-district.mjs');
const interiorsScript = find('test/golden/legacy/build-interiors.mjs', 'scripts/build-interiors.mjs');
const configTs = find('packages/client/src/game/config.ts');

// Debug: print values
if (process.env.DEBUG_SNAPSHOT) {
  console.log('ROOT:', ROOT);
  console.log('OUT:', OUT, '(exists:', existsSync(OUT), ')');
  console.log('districtScript:', districtScript);
  console.log('interiorsScript:', interiorsScript);
  console.log('configTs:', configTs);
}

// Task 24: if the build scripts are gone, the config lists have been deleted
// The snapshot outlives its sources, so skip if it already exists
if (!districtScript || !interiorsScript) {
  if (existsSync(OUT)) { console.log('legacy sources gone; snapshot already recorded — nothing to do'); process.exit(0); }
  console.error('error: legacy sources are gone and no snapshot exists');
  process.exit(1);
}

if (!configTs) {
  if (existsSync(OUT)) { console.log('legacy sources gone; snapshot already recorded — nothing to do'); process.exit(0); }
  console.error('error: legacy sources are gone and no snapshot exists');
  process.exit(1);
}

const config = readFileSync(configTs, 'utf8');

// Task 24: if the config lists have been deleted, snapshot is already recorded
// Just skip verification since the snapshot is the source of truth
const hasDistrictImages = /const DISTRICT_IMAGES\s*=/.test(config);
const hasInteriorImages = /const INTERIOR_IMAGES\s*=/.test(config);
if (!hasDistrictImages || !hasInteriorImages) {
  if (existsSync(OUT)) {
    console.log('legacy constants deleted; snapshot already recorded — nothing to do');
    process.exit(0);
  }
  console.error('error: legacy constants are deleted and no snapshot exists');
  process.exit(1);
}

const snapshot = {
  source: {
    district_ground: districtScript.replace(`${ROOT}/`, ''),
    interiors_ground: interiorsScript.replace(`${ROOT}/`, ''),
    props: configTs.replace(`${ROOT}/`, ''),
  },
  atlasTiles: {
    district_ground: atlasTiles(districtScript),
    interiors_ground: atlasTiles(interiorsScript),
  },
  propNames: {
    district: stringList(config, 'DISTRICT_IMAGES'),
    interior: stringList(config, 'INTERIOR_IMAGES'),
  },
};

const next = JSON.stringify(snapshot, null, 2) + '\n';
if (process.env.UPDATE_GOLDEN === '1' || !existsSync(OUT)) {
  writeFileSync(OUT, next);
  console.log(`legacy names snapshot: ${snapshot.atlasTiles.district_ground.length}+${snapshot.atlasTiles.interiors_ground.length} tiles, ${snapshot.propNames.district.length}+${snapshot.propNames.interior.length} props -> ${OUT.replace(`${ROOT}/`, '')}`);
} else if (readFileSync(OUT, 'utf8') !== next) {
  console.error('error: legacy sources changed since the snapshot was recorded.');
  console.error('       Review the diff, then re-record with UPDATE_GOLDEN=1.');
  process.exit(1);
} else {
  console.log('legacy names snapshot: unchanged');
}
