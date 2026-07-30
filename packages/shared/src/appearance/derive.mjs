/**
 * Appearance derivation. A PURE function of identity: no DB, no clock, no
 * Math.random() (I-5). This mirrors aisocialnetwork-api/src/utils/agentSeed.js,
 * which already derives city, traits and description seeds from the username
 * with the same FNV-1a hashString(seed, salt).
 *
 * CROSS-REPO CONTRACT: hashString is DEFINED in ../hash.mjs (Plan 1 Task 2)
 * and only re-exported here. That file must stay bit-identical to the api
 * copy — if they diverge, an agent's sprite and profile stop agreeing.
 * test/shared-types.test.ts pins it.
 *
 * Plain .mjs on purpose — imported unchanged by scripts/*.mjs under Node and
 * by the client through Vite. Two copies would be two sources of truth.
 *
 * NOTE THE IMPORT BELOW. It reaches schemaVersion.mjs, NOT types/Assets.ts.
 * Neither bare `node` (scripts/agent-bake.mjs) nor Vite (the client bundle)
 * rewrites a `.js` specifier onto a `.ts` file — only test/ts-resolve.mjs
 * does, and that exists solely inside `node --test`. Importing the constant
 * from the .ts file would make this module load in tests and nowhere else.
 * test/harness-no-hook.test.mjs is the guard.
 *
 * OWNER-PICK NOTE (2026-07-30): HAIR_STYLES and OUTFIT_COLORS name the axis
 * SLOTS (12 and 8 respectively), not the concrete art-pack sheets that will
 * fill them — which pack sheet becomes "buzz" or which outfit sheet renders
 * as '#c0392b' is an owner curation decision still in flight for the sprite
 * bake (Tasks 29-30). Nothing here depends on that mapping: the derivation
 * only ever produces these slot identifiers, never a sheet path. When the
 * concrete pick lands, it is a lookup keyed by these same strings — this file
 * does not change.
 */
import { SCHEMA_VERSION } from '../schemaVersion.mjs';

// hashString lives in ../hash.mjs (Plan 1 Task 2): venueSlots.ts (Plan 3
// Task 37) needs it a whole plan before this file exists, and the api's
// scheduleCoverage.js needs the api's identical copy. Re-exported here so
// every consumer of the appearance seam still finds it on one module.
import { hashString } from '../hash.mjs';
export { hashString };

export function pickFrom(list, seed, salt) {
  return list[hashString(seed, salt) % list.length];
}

// ── palettes ────────────────────────────────────────────────────────────
// Perceptually separated rather than evenly spaced in hue (spec §10.2):
// colour must stay distinguishable under the night tint (DAY_TINT_KEYS
// reaches alpha 0.45) and for colour-vision deficiency. Name labels remain
// the authoritative identifier; colour is an aid, never the only channel.

export const SKIN_TONES = ['#5c3317', '#8d5524', '#c68642', '#e0ac69', '#f1c27d', '#ffdbac'];

/** Silhouette carries more at 16px than hue does — styles differ in volume. */
export const HAIR_STYLES = [
  'buzz', 'short_crop', 'side_part', 'bob', 'long_straight', 'ponytail',
  'bun', 'curly_short', 'curly_long', 'afro', 'mohawk', 'braids',
];

export const HAIR_COLORS = [
  '#1a1a1a', '#4a2c19', '#8b5a2b', '#c98a3b', '#e8c547',
  '#f2f2f2', '#8c8c8c', '#a33b2a', '#d2691e', '#3f5fa8',
];

export const OUTFIT_COLORS = [
  '#c0392b', '#2980b9', '#27ae60', '#f1c40f',
  '#8e44ad', '#e67e22', '#ecf0f1', '#34495e',
];

/**
 * Eyes are a SHEET-SELECTION axis, not a colour: the pack ships one full
 * sheet per eye colour (Eyes_01.png .. Eyes_07.png) and each sheet IS the
 * colour. No hex palette exists for eyes, and the palette-separation test
 * (Task 38) deliberately excludes them.
 */
export const EYE_VARIANTS = ['01', '02', '03', '04', '05', '06', '07'];

/** Accessories must alter SILHOUETTE, not only hue (spec §10.2). */
export const ACCESSORIES = ['none', 'cap', 'beanie', 'backpack', 'satchel'];

export const BUILDS = ['masc', 'fem', 'neutral'];

/**
 * users.gender is VARCHAR(50) with NO check constraint (008_add_gender.js),
 * made non-null by 009 — the column holds arbitrary strings. Map a
 * case-folded, trimmed value onto a Build; anything unrecognised or empty
 * falls to 'neutral'. Never throws, never branches on an unbounded set.
 */
export function normalizeGender(raw) {
  const v = String(raw ?? '').trim().toLowerCase();
  if (['male', 'm', 'man', 'masc', 'masculine', 'boy'].includes(v)) return 'masc';
  if (['female', 'f', 'woman', 'fem', 'feminine', 'girl'].includes(v)) return 'fem';
  return 'neutral';
}

/**
 * @param {string} spriteSeed stable, unique — the username
 * @param {unknown} gender free text from users.gender
 * @returns {{build:string, skinTone:string, eyes:string, hairStyle:string, hairColor:string, outfit:string, accessory:string}}
 */
export function appearanceRecord(spriteSeed, gender) {
  return {
    build:     normalizeGender(gender),                          // not hashed
    skinTone:  pickFrom(SKIN_TONES,     spriteSeed, 'sprite:skin'),
    eyes:      pickFrom(EYE_VARIANTS,   spriteSeed, 'sprite:eyes'),
    hairStyle: pickFrom(HAIR_STYLES,    spriteSeed, 'sprite:hairStyle'),
    hairColor: pickFrom(HAIR_COLORS,    spriteSeed, 'sprite:hairColor'),
    outfit:    pickFrom(OUTFIT_COLORS,  spriteSeed, 'sprite:outfit'),
    accessory: pickFrom(ACCESSORIES,    spriteSeed, 'sprite:accessory'),
  };
}

/** Key order is fixed so JSON.stringify is stable across engines. */
const KEYS = ['build', 'skinTone', 'eyes', 'hairStyle', 'hairColor', 'outfit', 'accessory'];
const canonical = record => JSON.stringify(KEYS.map(k => record[k]));

/**
 * Content address. SCHEMA_VERSION is inside the hash, so bumping it changes
 * every hash and invalidates the cache with no manual purge step (I-7).
 */
export function appearanceHashAt(record, version) {
  return hashString(canonical(record) + version, 'appearance').toString(16).padStart(8, '0');
}

export function appearanceHash(record) {
  return appearanceHashAt(record, SCHEMA_VERSION);
}

export function appearanceSpaceSize() {
  return BUILDS.length * SKIN_TONES.length * EYE_VARIANTS.length * HAIR_STYLES.length
    * HAIR_COLORS.length * OUTFIT_COLORS.length * ACCESSORIES.length;
}
