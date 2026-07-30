/**
 * Packs an ordered tile list into a ground atlas.
 * ORDER DEFINES GID. Reordering contract.groundAtlases[id].tiles silently
 * corrupts every .tmj that references the atlas — so the gid map is
 * returned here rather than recomputed by callers.
 */
import { createCanvas } from '../png-lib.mjs';
import { readSprite, asSource } from './spriteReader.mjs';

export function buildAtlas(contract, adapter, atlasId) {
  const def = contract.groundAtlases[atlasId];
  if (!def) throw new Error(`unknown ground atlas: ${atlasId}`);
  const T = contract.tileSize;
  const columns = def.columns;
  const rows = Math.ceil(def.tiles.length / columns);

  const canvas = createCanvas(columns * T, rows * T);
  const gid = {};

  def.tiles.forEach((name, i) => {
    const s = readSprite(adapter, name);
    if (s.w !== T || s.h !== T) throw new Error(`tile ${name} is ${s.w}x${s.h}, atlas needs ${T}x${T}`);
    canvas.blit(asSource(s.canvas), 0, 0, T, T, (i % columns) * T, Math.floor(i / columns) * T);
    gid[name] = i + 1;
  });

  return { id: atlasId, canvas, columns, rows, tileCount: def.tiles.length, gid };
}
