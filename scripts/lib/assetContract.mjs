/**
 * Loads and shallow-validates contract/assets.contract.json.
 * The contract names things and their shape; it never names a file or a
 * coordinate (I-1). Anything pack-specific belongs in sources/<pack>.json.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..', '..');

export function loadContract(path = join(ROOT, 'contract', 'assets.contract.json')) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));

  if (raw.schemaVersion !== 1) throw new Error(`unsupported contract schemaVersion ${raw.schemaVersion}`);
  if (raw.tileSize !== 16) throw new Error(`unsupported tileSize ${raw.tileSize}`);
  for (const [id, atlas] of Object.entries(raw.groundAtlases)) {
    if (!Array.isArray(atlas.tiles) || atlas.tiles.length === 0) throw new Error(`atlas ${id} has no tiles`);
    if (new Set(atlas.tiles).size !== atlas.tiles.length) throw new Error(`atlas ${id} has duplicate tiles`);
  }

  return {
    ...raw,
    /** Every name the active adapter must resolve. Order is stable. */
    allNames() {
      const names = [];
      for (const atlas of Object.values(raw.groundAtlases)) names.push(...atlas.tiles);
      for (const group of Object.values(raw.props)) names.push(...Object.keys(group));
      names.push(...Object.keys(raw.animatedObjects));
      names.push('emote_sheet', 'ui_sheet');
      for (const part of raw.characters.parts) names.push(`char_${part}`);
      return names;
    },
    /** gid for a tile name in a given atlas. gid = index + 1, per the .tmj convention. */
    gidOf(atlasId, tileName) {
      const i = raw.groundAtlases[atlasId].tiles.indexOf(tileName);
      if (i < 0) throw new Error(`tile ${tileName} not in atlas ${atlasId}`);
      return i + 1;
    },
  };
}
