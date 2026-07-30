#!/usr/bin/env node
/**
 * Records what the LEGACY pipeline produces, so the data-driven bake can be
 * proven byte-identical to it (Task 20).
 *
 * Runs whichever copy of the old scripts exists: scripts/ before Plan 2 has
 * retired them, test/golden/legacy/ after. That is what lets this task run at
 * any point in the sequence, whenever the art lands.
 *
 *   node scripts/capture-golden-baseline.mjs
 *
 * Refuses to write a partial baseline: if the legacy scripts are missing, or
 * assets-src/ is absent, or fewer images turn up than there are contract
 * names, it exits non-zero and writes nothing.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..');
const PUB = join(ROOT, 'packages', 'client', 'public', 'assets');
const GOLDEN = join(ROOT, 'test', 'golden');

/** Legacy script locations, in the order we look for them. */
const legacy = name => [
  join(ROOT, 'test', 'golden', 'legacy', `build-${name}.mjs`),
  join(ROOT, 'scripts', `build-${name}.mjs`),
].find(existsSync);

const district = legacy('district');
const interiors = legacy('interiors');
if (!district || !interiors) {
  console.error('error: neither test/golden/legacy/ nor scripts/ has the legacy build scripts');
  process.exit(1);
}
if (!existsSync(join(ROOT, 'assets-src'))) {
  console.error('error: assets-src/ is absent — this task needs the licensed packs (Step 1)');
  process.exit(1);
}

const run = (f, ...args) => execFileSync(process.execPath, [f, ...args], { cwd: ROOT, stdio: 'inherit' });
// Explicit pack arguments, never a bare call: after Plan 2 Task 19a the
// script DEFAULTS to the fixture pack, and a bare invocation here would
// silently copy fixture character sheets into a baseline that claims to
// describe the real art.
run(join(ROOT, 'scripts', 'sync-assets.mjs'), 'limezu', 'assets-src');

const contract = loadContract();

// Legacy-compat bridge, capture-only. Both frozen scripts reference a batch
// of standalone single-file props (district signage/street furniture/cars/
// fences, interior office singles) that they never generate themselves —
// build-district.mjs's IMG() helper just records an object pointing at
// `sprites/limezu/<group>/<name>.png`; build-interiors.mjs reads some of them
// back for real width/height. The pre-19a sync-assets.mjs placed all of these
// with a hardcoded FILES/PROPS/OFFICE_SINGLES list; Plan 2's derived rewrite
// correctly dropped that list (these names are now baked contract props, not
// runtime sheets — sync-assets.mjs only ever copies contract.runtimeSheets
// and contract.animatedObjects), which orphaned this frozen assumption. It
// was never exercised until this task ran the frozen scripts against a real
// pack for the first time. Bridged here, not in sync-assets.mjs, so the
// active/derived pipeline's scope stays exactly what its own header says.
// Every contract prop the adapter resolves to a bare whole-file rect (no
// crop rect, no `generated` stamp — those two are what the legacy scripts
// compute themselves, e.g. villa_building's crop and library_building's
// bookSign stamp) is copied raw, byte-identical to what old sync-assets.mjs
// would have copied, because it is resolved through the same pinned adapter
// every other sprite is.
{
  const adapter = loadAdapter(join(ROOT, 'sources', 'limezu.json'), join(ROOT, 'assets-src'));
  for (const [group, names] of Object.entries(contract.props)) {
    for (const name of Object.keys(names)) {
      const r = adapter.resolve(name);
      if (r.w != null || r.h != null || r.generated) continue; // legacy script computes this one itself
      const dest = join(PUB, 'sprites', 'limezu', group, `${name}.png`);
      mkdirSync(dirname(dest), { recursive: true });
      copyFileSync(r.absPath, dest);
    }
  }
}

run(district);
run(interiors);

const images = {};
(function walk(d) {
  for (const e of readdirSync(d).sort()) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith('.png')) images[relative(PUB, p).split('\\').join('/')] =
      createHash('sha256').update(readFileSync(p)).digest('hex');
  }
})(PUB);

// The bake must produce one image per contract name, plus the two atlases.
const expected = Object.values(contract.props).reduce((n, g) => n + Object.keys(g).length, 0)
  + Object.keys(contract.groundAtlases).length;
const generated = Object.keys(images).filter(p => /^(tilesets|sprites)\/limezu\//.test(p)).length;
if (generated < expected) {
  console.error(`error: captured ${generated} generated images, expected at least ${expected} — refusing to write a partial baseline`);
  process.exit(1);
}

mkdirSync(join(GOLDEN, 'tmj'), { recursive: true });
for (const f of readdirSync(join(PUB, 'tilemaps')).filter(f => f.endsWith('.tmj'))) {
  cpSync(join(PUB, 'tilemaps', f), join(GOLDEN, 'tmj', f));
}

writeFileSync(join(GOLDEN, 'baseline.json'), JSON.stringify({
  // No timestamp: the baseline must be byte-stable so re-capturing a clean
  // tree produces no diff, and any diff is a real one.
  node: process.version.replace(/\.\d+$/, '.x'),
  pack: 'limezu',
  images: Object.fromEntries(Object.keys(images).sort().map(k => [k, images[k]])),
}, null, 2) + '\n');

console.log(`golden baseline: ${Object.keys(images).length} images (${generated} generated), ${readdirSync(join(GOLDEN, 'tmj')).length} tilemaps`);
