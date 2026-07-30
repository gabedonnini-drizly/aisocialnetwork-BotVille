/**
 * The committed snapshot of the name lists the contract replaces.
 * Reading a file, not re-parsing source, so these keep working after
 * Task 19 and Task 24 delete the originals.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from './siblingRepo.mjs';

const snapshot = JSON.parse(
  readFileSync(join(REPO_ROOT, 'test', 'golden', 'legacy-names.json'), 'utf8'));

export const legacyAtlasTiles = () => snapshot.atlasTiles;
export const legacyPropNames = () => snapshot.propNames;
