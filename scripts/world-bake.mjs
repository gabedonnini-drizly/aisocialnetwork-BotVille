#!/usr/bin/env node
/**
 * World bake: contract + adapter + venue descriptors -> ground atlases,
 * prop PNGs, .tmj maps and the published venue vocabulary.
 *
 * Deterministic: same source + same registry = byte-identical output, so
 * CI can assert it by checksum (spec §7.1).
 *
 *   node scripts/world-bake.mjs [pack] [srcRoot]
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng } from './png-lib.mjs';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';
import { buildAtlas } from './lib/atlasBuilder.mjs';
import { bakeProps, writeProps } from './lib/propBaker.mjs';
import { bakeInterior, bakeDistrict } from './lib/venueBaker.mjs';
import { deriveResidenceInstances } from './lib/residences.mjs';
import { validate } from './lib/contractValidator.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');

function write(p, buf) {
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, buf);
}

/**
 * @param {{pack?: string, srcRoot: string, outDir: string, generatedDir: string,
 *          venuesDirs?: string[], town?: {population: number}}} opts
 *
 * outDir and generatedDir are REQUIRED. This function has no idea where the
 * repo is and must not: a default of "write into packages/client" turns every
 * caller — including this module's own tests — into a source-tree mutation.
 * The CLI at the bottom of this file is the only place those paths live.
 */
export function worldBake({ pack = 'fixture', srcRoot, outDir, generatedDir, venuesDirs, town } = {}) {
  if (!outDir) throw new Error('worldBake: outDir is required');
  if (!generatedDir) throw new Error('worldBake: generatedDir is required');

  const contract = loadContract();
  const adapter = loadAdapter(`sources/${pack}.json`, srcRoot);

  // `_`-prefixed entries are archetypes (venues/_archetypes/), not venues.
  // Dotfiles (.DS_Store and friends) are not venues either — skip, don't throw.
  const dirs = venuesDirs ?? [join(ROOT, 'venues')];
  const authored = dirs.flatMap(dir => readdirSync(dir)
    .filter(id => !id.startsWith('_') && !id.startsWith('.'))
    .map(id => JSON.parse(readFileSync(join(dir, id, 'venue.json'), 'utf8'))));

  // Residence instances (addendum §I.2/I.3): derived from the town snapshot,
  // stamped from the archetype, baked exactly like an authored venue.
  const townSnapshot = town ?? JSON.parse(readFileSync(join(ROOT, 'town', 'town.json'), 'utf8'));
  const houseArchetype = JSON.parse(readFileSync(join(ROOT, 'venues', '_archetypes', 'house.json'), 'utf8'));
  const instances = deriveResidenceInstances(townSnapshot, houseArchetype);

  const venues = [...authored, ...instances].sort((a, b) => a.id.localeCompare(b.id));

  const dupes = venues.map(v => v.id).filter((id, i, all) => all.indexOf(id) !== i);
  if (dupes.length) throw new Error(`duplicate venue id across venue directories: ${[...new Set(dupes)].join(', ')}`);

  // I-2: an unresolved name fails the BUILD, never renders as a missing texture.
  const { errors } = validate(contract, adapter, { checkPixels: true, venues });
  if (errors.length) {
    for (const e of errors) console.error(`error: ${e}`);
    throw new Error(`world bake refused: ${errors.length} contract error(s)`);
  }

  // ── atlases ───────────────────────────────────────────────────────────
  const atlases = {};
  for (const id of Object.keys(contract.groundAtlases)) {
    const at = buildAtlas(contract, adapter, id);
    atlases[id] = at;
    write(join(outDir, 'tilesets', 'pack', `${id}.png`), encodePng(at.canvas));
  }

  // ── props ─────────────────────────────────────────────────────────────
  const propSizes = new Map();
  let propCount = 0;
  for (const group of Object.keys(contract.props)) {
    const baked = bakeProps(contract, adapter, group);
    propCount += writeProps(baked, join(outDir, 'sprites', 'pack', group)).length;
    for (const [name, s] of baked) propSizes.set(name, s);
  }

  // ── venues ────────────────────────────────────────────────────────────
  for (const v of venues) {
    const atlas = atlases[v.groundAtlas];
    const tmj = v.indoor
      ? bakeInterior(contract, v, { atlas, propSizes })
      : bakeDistrict(contract, v, { atlas, propSizes });
    write(join(outDir, 'tilemaps', `${v.id}.tmj`), JSON.stringify(tmj));
  }

  // ── published vocabulary (I-8): BotVille is the only authority ─────────
  // The affordance fields (addendum §I.1) are the payload: the platform's
  // schedule writer places agents by querying roles/affords/hours, never ids.
  const published = venues.map(v => ({
    id: v.id,
    label: v.label,
    indoor: v.indoor,
    capacity: v.capacity,
    archetype: v.archetype ?? v.id,
    roles: v.roles,
    affords: v.affords,
    hours: v.hours,
  }));
  const publishedJson = JSON.stringify(published, null, 2) + '\n';
  write(join(outDir, 'venues.json'), publishedJson);

  // The client cannot read venues/ at runtime, so the registry is generated
  // into a TypeScript module Vite bundles statically — Plan 3 Task 21's
  // venueRegistry.ts imports it. This write is why generatedDir exists.
  const generated = `// GENERATED by scripts/world-bake.mjs — do not edit.
import type { VenueDescriptor } from '@botville/shared';

export const VENUES: VenueDescriptor[] = ${JSON.stringify(venues, null, 2)};
`;
  write(join(generatedDir, 'venues.generated.ts'), generated);

  // The prop lists PreloaderScene walks, and the emote frame pairs it looks
  // up — pack-specific (I-1), so they come from the adapter, not from code.
  //
  // This file's contents depend on which pack was last baked: EMOTE_FRAMES
  // comes from adapter.emoteFrames, so baking with the default fixture pack
  // overwrites committed real values with the fixture's synthetic ones, and
  // status icons then render the wrong frames in production. The pack name
  // is embedded in the header so a reviewer can see it in a diff, and
  // test/asset-index.test.ts asserts it matches what is actually intended
  // to ship (Task 39 re-bakes with limezu before release).
  const assetIndex = `// GENERATED by scripts/world-bake.mjs from pack "${adapter.pack}" — do not edit.
export const DISTRICT_PROPS: string[] = ${JSON.stringify(Object.keys(contract.props.district))};
export const INTERIOR_PROPS: string[] = ${JSON.stringify(Object.keys(contract.props.interior))};
export const ANIMATED_OBJECT_KEYS: string[] = ${JSON.stringify(Object.keys(contract.animatedObjects))};
/** Frame pairs for the status icons. Pack-specific — they live in the adapter (I-1). */
export const EMOTE_FRAMES: Record<string, [number, number]> = ${JSON.stringify(
    Object.fromEntries(contract.emotes.icons.statuses.map(s => [s, adapter.emoteFrames[s]])), null, 2)};
`;
  write(join(generatedDir, 'assets.generated.ts'), assetIndex);

  // The canonical schema travels with the artifact (Conventions table).
  write(join(outDir, 'venues.schema.json'), readFileSync(join(ROOT, 'schemas', 'venues.schema.json')));

  // A lock beside the artifact, so the platform can prove its copy is intact
  // WITHOUT needing this repo on disk. The sibling-repo comparison in Task 33
  // is the stronger check; this one is the check that still works in CI.
  write(join(outDir, 'venues.lock.json'), JSON.stringify({
    sha256: createHash('sha256').update(publishedJson).digest('hex'),
    count: published.length,
    schemaVersion: contract.schemaVersion,
  }, null, 2) + '\n');

  return { atlases: Object.keys(atlases).length, props: propCount, venues: venues.length, outDir, generatedDir };
}

// ── CLI: the ONE place that knows where this repo keeps things ────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const pack = process.argv[2] ?? 'fixture';
  const srcRoot = process.argv[3] ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');
  const r = worldBake({
    pack,
    srcRoot,
    outDir: join(ROOT, 'packages', 'client', 'public', 'assets'),
    generatedDir: join(ROOT, 'packages', 'client', 'src', 'game'),
  });
  console.log(`world bake OK: ${r.atlases} atlases, ${r.props} props, ${r.venues} venues -> ${r.outDir}`);
}
