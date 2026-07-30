/**
 * Content-addressed, idempotent agent bake.
 *
 * ONE implementation. Batch and event both call bake() — that is why the
 * two paths cannot drift, the usual failure mode of a batch+streaming
 * pipeline (I-6).
 *
 * Writes are atomic (temp file + rename) so a concurrent reader never
 * observes a half-written PNG. The temp name includes the pid and a
 * counter so parallel bakes of the SAME hash cannot collide on it.
 */
import { existsSync, mkdirSync } from 'node:fs';
import { rename, writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { encodePng } from '../png-lib.mjs';
import { composeSheet, composePortrait } from './appearanceComposer.mjs';
import { appearanceHash } from '../../packages/shared/src/appearance/derive.mjs';

export const bakedPath = (outDir, hash) => join(outDir, `${hash}.png`);
export const portraitPath = (outDir, hash) => join(outDir, `${hash}-portrait.png`);

let tmpCounter = 0;

async function writeAtomic(finalPath, buf) {
  const tmp = `${finalPath}.${process.pid}.${tmpCounter++}.tmp`;
  await writeFile(tmp, buf);
  try {
    await rename(tmp, finalPath);          // atomic on the same filesystem
  } catch (e) {
    await unlink(tmp).catch(() => {});
    throw e;
  }
}

/**
 * @param {{contract: object, adapter: object, outDir: string}} ctx
 * @param {object} record an AppearanceRecord
 * @returns {Promise<{hash: string, written: boolean, sheet: string, portrait: string}>}
 */
export async function bake(ctx, record) {
  const hash = appearanceHash(record);
  const sheet = bakedPath(ctx.outDir, hash);
  const portrait = portraitPath(ctx.outDir, hash);

  if (existsSync(sheet) && existsSync(portrait)) {
    return { hash, written: false, sheet, portrait };
  }

  mkdirSync(ctx.outDir, { recursive: true });
  const sheetPng = encodePng(composeSheet(ctx.contract, ctx.adapter, record));
  const portraitPng = encodePng(composePortrait(ctx.contract, ctx.adapter, record));

  await Promise.all([writeAtomic(sheet, sheetPng), writeAtomic(portrait, portraitPng)]);
  return { hash, written: true, sheet, portrait };
}
