#!/usr/bin/env node
/**
 * Agent bake entry points. BOTH call bake() from lib/agentBaker.mjs —
 * one implementation, so batch and event cannot drift (I-6).
 *
 *   node scripts/agent-bake.mjs --roster roster.json
 *   node scripts/agent-bake.mjs --seed aisha_khan --gender female
 *
 * roster.json: [{ "spriteSeed": "aisha_khan", "gender": "female" }, ...]
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from './lib/assetContract.mjs';
import { loadAdapter } from './lib/sourceAdapter.mjs';
import { bake } from './lib/agentBaker.mjs';
import { appearanceRecord } from '../packages/shared/src/appearance/derive.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const DEFAULT_OUT = join(ROOT, 'packages', 'client', 'public', 'assets', 'baked');

/** Event path: one agent, on creation or appearance change. */
export async function bakeOne(ctx, spriteSeed, gender) {
  return bake(ctx, appearanceRecord(spriteSeed, gender));
}

/**
 * Batch path: sweep the roster, bake the missing set. Safe to re-run and
 * safe to run concurrently with the event path.
 */
export async function bakeRoster(ctx, roster, { concurrency = 8 } = {}) {
  const hashes = [];
  let baked = 0, skipped = 0;

  const queue = [...roster];
  const worker = async () => {
    for (let item = queue.shift(); item; item = queue.shift()) {
      const r = await bakeOne(ctx, item.spriteSeed, item.gender);
      hashes.push(r.hash);
      if (r.written) baked++; else skipped++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, roster.length || 1) }, worker));

  return { baked, skipped, hashes };
}

function makeCtx(pack, srcRoot, outDir) {
  return { contract: loadContract(), adapter: loadAdapter(`sources/${pack}.json`, srcRoot), outDir };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const pack = arg('--pack') ?? 'fixture';
  const srcRoot = arg('--src') ?? (pack === 'fixture' ? 'test/fixtures/pack-src' : 'assets-src');
  const ctx = makeCtx(pack, srcRoot, arg('--out') ?? DEFAULT_OUT);

  const rosterFile = arg('--roster');
  if (rosterFile) {
    const roster = JSON.parse(readFileSync(rosterFile, 'utf8'));
    const r = await bakeRoster(ctx, roster);
    console.log(`agent bake: ${r.baked} baked, ${r.skipped} already present, ${new Set(r.hashes).size} distinct appearances for ${roster.length} agents`);

    const { writeFileSync } = await import('node:fs');
    writeFileSync(join(ctx.outDir, 'manifest.json'),
      JSON.stringify({ hashes: [...new Set(r.hashes)].sort() }, null, 2) + '\n');
  } else {
    const seed = arg('--seed');
    if (!seed) { console.error('usage: --roster <file.json> | --seed <username> [--gender <value>]'); process.exit(2); }
    const r = await bakeOne(ctx, seed, arg('--gender') ?? '');
    console.log(`agent bake: ${seed} -> ${r.hash} (${r.written ? 'written' : 'already present'})`);
  }
}
