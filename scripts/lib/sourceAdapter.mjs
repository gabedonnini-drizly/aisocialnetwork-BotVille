/**
 * Loads sources/<pack>.json — the ONLY pack-specific artifact in the
 * system (I-1). Runtime code must never import this module.
 */
import { readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');
const abs = p => (isAbsolute(p) ? p : join(ROOT, p));

export function loadAdapter(manifestPath, srcRoot) {
  const raw = JSON.parse(readFileSync(abs(manifestPath), 'utf8'));
  const root = abs(srcRoot);

  const resolve = name => {
    const r = raw.rects[name];
    if (!r) throw new Error(`unresolved name: ${name} (pack ${raw.pack})`);
    const file = raw.files[r.file];
    if (!file) throw new Error(`name ${name} points at undeclared file alias ${r.file}`);
    return {
      name,
      absPath: join(root, file),
      x: r.x ?? 0,
      y: r.y ?? 0,
      w: r.w ?? null,   // null = whole file
      h: r.h ?? null,
      trim: r.trim === true,
      generated: r.generated ?? null,
    };
  };

  return {
    pack: raw.pack,
    capabilities: raw.capabilities,
    /** Pack-specific emote frame pairs. Belongs here, never in the contract. */
    emoteFrames: raw.emoteFrames ?? {},
    has: name => Object.hasOwn(raw.rects, name),
    names: () => Object.keys(raw.rects),
    unresolved: contractNames => contractNames.filter(n => !Object.hasOwn(raw.rects, n)),
    resolve,
  };
}
