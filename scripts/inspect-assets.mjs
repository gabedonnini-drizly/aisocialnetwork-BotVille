#!/usr/bin/env node
/**
 * Step 0 of TZ-01: reconnaissance of the LimeZu spritesheet formats.
 * Reads PNG dimensions (IHDR) with no dependencies and prints a table:
 * premade characters, farm animals, emotes, UI, room builders.
 * The results are recorded by hand in packages/client/src/game/assetManifest.ts.
 *
 * Run: node scripts/inspect-assets.mjs
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'assets-src');

function pngSize(file) {
  const buf = readFileSync(file);
  if (buf.readUInt32BE(12) !== 0x49484452) throw new Error(`not a PNG: ${file}`);
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
}

function report(title, dir, { filter = () => true, frame } = {}) {
  console.log(`\n=== ${title} (${relative(ROOT, dir)}) ===`);
  if (!existsSync(dir)) { console.log('  !! MISSING'); return; }
  const entries = statSync(dir).isDirectory()
    ? readdirSync(dir).filter(f => f.endsWith('.png') && filter(f)).map(f => join(dir, f))
    : [dir];
  for (const file of entries.sort()) {
    const { w, h } = pngSize(file);
    let grid = '';
    if (frame) grid = `  -> ${w / frame[0]} x ${h / frame[1]} frames of ${frame[0]}x${frame[1]}`;
    console.log(`  ${relative(SRC, file).padEnd(70)} ${String(w).padStart(5)} x ${h}${grid}`);
  }
}

// Premade characters: we expect 896x656 sheets (per the TZ), frames presumably 16x32
report('Premade characters', join(SRC, 'interiors', 'characters-premade'), { frame: [16, 32] });

// Farm animals — one folder per kind: Cows, Pigs...
const animalsRoot = join(SRC, 'farm', '16x16', 'Animals_16x16');
for (const kind of readdirSync(animalsRoot).filter(d => statSync(join(animalsRoot, d)).isDirectory())) {
  report(`Animals / ${kind}`, join(animalsRoot, kind), { frame: [16, 16] });
}

// Animation guide for the farm characters (to cross-check the rows)
report('Farm characters + guide', join(SRC, 'farm', '16x16', 'Characters_16x16'));

// Emotes and UI
report('UI', join(SRC, 'interiors', 'ui'), { frame: [16, 16] });

// Room builders
report('Room Builder (interiors)', join(SRC, 'interiors', 'Room_Builder_16x16.png'));
report('Room Builder (office)', join(SRC, 'office', 'room-builder'));

// Tilesets that will go into the district map
const themes = join(SRC, 'exteriors', 'themes');
report('Exterior themes (needed for district)', themes, {
  filter: f => /^(1_|2_|3_|4_|7_|9_|10_|16_|17_|24_)/.test(f) && !f.includes('Singles'),
});

// Farm: the main tileset
report('Farm tilesets', join(SRC, 'farm', '16x16'), { filter: f => /^[0-9]_/.test(f) });

// Interior tilesets for the 4 scenes
report('Interior themes', join(SRC, 'interiors', 'themes'), {
  filter: f => /^(1_|2_|4_|5_|12_|16_|22_|24_)/.test(f),
});

// Animated interior/exterior objects
report('Animated interiors', join(SRC, 'interiors', 'animated'));
report('Animated exteriors', join(SRC, 'exteriors', 'animated'));
