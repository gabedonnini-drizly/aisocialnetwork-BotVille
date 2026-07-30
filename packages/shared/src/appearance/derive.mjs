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
 */
import { SCHEMA_VERSION } from '../schemaVersion.mjs';

// hashString lives in ../hash.mjs (Plan 1 Task 2): venueSlots.ts (Plan 3
// Task 37) needs it a whole plan before this file exists, and the api's
// scheduleCoverage.js needs the api's identical copy. Re-exported here so
// every consumer of the appearance seam still finds it on one module.
import { hashString } from '../hash.mjs';
export { hashString };

/**
 * (D-19, 2026-07-30) COMMITTED GENERATED DATA — never hand-transcribed.
 * `scripts/gen-variant-manifest.mjs` (which calls the pure
 * `buildVariantManifest` in `scripts/lib/variantManifest.mjs`) derives these
 * from the pack's own file names (Task 26 Step 3a) and writes them to
 * `sources/<pack>.variants.json` / `.variants.outfit.json`. Task 27 Step 0
 * regenerates the real pack's copy with any coverage-failing hair variant
 * automatically excluded. `derive.mjs` imports the SHIPPING pack's
 * manifest — swapping the import is how a pack change re-rolls every
 * derived appearance (owner-accepted, D-19).
 *
 * Shape: `{ styles: string[], variantsByStyle: Record<string, string[]> }` —
 * both `styles` and every value in `variantsByStyle` are sorted.
 *
 * No art on disk required to import THESE (Task 26 stays "no art needed" for
 * every consumer of derive.mjs): they are grouped from the FILENAME index the
 * art-pack QA pass already captured 2026-07-29, not from the pixels
 * themselves. Task 27 Step 0 later regenerates them WITH coverage-based
 * exclusion, which does need the real pixels — that reopening is
 * real-pack-gated, this initial commit is not.
 */
import HAIR_MANIFEST from '../../../../sources/limezu.variants.json' with { type: 'json' };
import OUTFIT_MANIFEST from '../../../../sources/limezu.variants.outfit.json' with { type: 'json' };
export { HAIR_MANIFEST, OUTFIT_MANIFEST };

export function pickFrom(list, seed, salt) {
  return list[hashString(seed, salt) % list.length];
}

/**
 * (D-19, 2026-07-30) The two-stage pack-derived pick shared by hair and
 * outfit: a style, then that style's OWN built-in variant — never a flat
 * pick over every file (that would weight styles with more variants more
 * heavily) and never an algorithmic recolor (there is no hex axis here at
 * all any more). `manifest` is a committed, generated
 * `{ styles: string[], variantsByStyle: Record<string, string[]> }` — see
 * `scripts/lib/variantManifest.mjs` and Task 27 Step 0 for how a variant
 * can be dropped from it automatically.
 */
export function pickStyleAndVariant(manifest, seed, styleSalt, variantSalt) {
  const style = pickFrom(manifest.styles, seed, styleSalt);
  const variant = pickFrom(manifest.variantsByStyle[style], seed, variantSalt);
  return { style, variant };
}

// ── palettes ────────────────────────────────────────────────────────────
// Perceptually separated rather than evenly spaced in hue (spec §10.2):
// colour must stay distinguishable under the night tint (DAY_TINT_KEYS
// reaches alpha 0.45) and for colour-vision deficiency. Name labels remain
// the authoritative identifier; colour is an aid, never the only channel.
//
// (D-19, 2026-07-30) Hair and outfit are NOT here any more. There is no
// HAIR_STYLES name list, no HAIR_COLORS hex array and no OUTFIT_COLORS hex
// array — style comes from the pack's own distinct hairstyle/outfit
// directories and colour comes from the pack's own sibling variant file.
// The only axes still spelled out as an in-repo array are the ones D-19
// leaves untouched: skin tone (a body-layer tint), eyes (a sheet-selection
// axis with no tint at all) and accessories (silhouette, not colour).

// (Task 38, 2026-07-30) '#f1c27d' nudged to '#f1cf7b' (G 194->207, B 125->123):
// it sat only dE 8.0 from '#e0ac69' in daylight (dE 4.8 under the night tint,
// spec §10.2's alpha-0.45-over-#0a0a2e overlay) — below the 12/7 perceptual
// separation floor test/palette-separation.test.mjs asserts. This nudge was
// chosen because it clears the daylight/night/CVD margins for every pair in
// the ramp with the smallest change tried; other perturbations may also
// clear the same margins and were not exhaustively searched. Every other
// adjacent pair already cleared them without a nudge.
export const SKIN_TONES = ['#5c3317', '#8d5524', '#c68642', '#e0ac69', '#f1cf7b', '#ffdbac'];

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
 * @returns {{build:string, skinTone:string, eyes:string, hairStyle:string, hairVariant:string, outfit:string, outfitVariant:string, accessory:string}}
 */
export function appearanceRecord(spriteSeed, gender) {
  const hair = pickStyleAndVariant(HAIR_MANIFEST, spriteSeed, 'sprite:hairStyle', 'sprite:hairVariant');
  const outfit = pickStyleAndVariant(OUTFIT_MANIFEST, spriteSeed, 'sprite:outfitStyle', 'sprite:outfitVariant');
  return {
    build:         normalizeGender(gender),                       // not hashed
    skinTone:      pickFrom(SKIN_TONES,   spriteSeed, 'sprite:skin'),
    eyes:          pickFrom(EYE_VARIANTS, spriteSeed, 'sprite:eyes'),
    hairStyle:     hair.style,
    hairVariant:   hair.variant,     // (D-19) the pack's own colour variant — not a hex value
    outfit:        outfit.style,
    outfitVariant: outfit.variant,   // (D-19) new field: outfit is two-stage now, same as hair
    accessory:     pickFrom(ACCESSORIES, spriteSeed, 'sprite:accessory'),
  };
}

/** Key order is fixed so JSON.stringify is stable across engines. */
const KEYS = ['build', 'skinTone', 'eyes', 'hairStyle', 'hairVariant', 'outfit', 'outfitVariant', 'accessory'];
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

/**
 * (D-19, 2026-07-30) Hair/outfit counts come from the manifests' own
 * `.length` — never a hardcoded product — so this number tracks whatever
 * the committed manifest says today, including any automatic exclusions
 * from Task 27 Step 0.
 */
export function appearanceSpaceSize() {
  const hairCount = Object.values(HAIR_MANIFEST.variantsByStyle).reduce((n, v) => n + v.length, 0);
  const outfitCount = Object.values(OUTFIT_MANIFEST.variantsByStyle).reduce((n, v) => n + v.length, 0);
  return BUILDS.length * SKIN_TONES.length * EYE_VARIANTS.length * hairCount * outfitCount * ACCESSORIES.length;
}
