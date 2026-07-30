/**
 * AppearanceRecord -> character sheet + portrait.
 *
 * Two strategies, chosen by the PACK, not by the record (spec §7.3):
 *   capabilities.characterLayers === true  -> stack separable parts.
 *       Full silhouette variation.
 *   capabilities.characterLayers === false -> palette-remap a premade base.
 *       Colour variation only; silhouette comes from the base sheet, so
 *       effective variety is bases x palettes. Nothing breaks; variety drops.
 *
 * The LimeZu packs DO ship separable 16x32 layers (Bodies/Eyes/Hairstyles/
 * Outfits/Accessories — verified 2026-07-29, recorded in docs/ASSETS.md), so
 * the layered path is the shipping path; remap survives as the fallback.
 */
import { dirname, basename, join } from 'node:path';
import { createCanvas } from '../png-lib.mjs';
import { readSprite, asSource } from './spriteReader.mjs';
import { hashString } from '../../packages/shared/src/hash.mjs';

export function hexToRgba(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), 255];
}

/** Nearest-colour swap over an explicit from/to palette. Transparent stays transparent. */
export function remapPalette(canvas, from, to) {
  const out = createCanvas(canvas.w, canvas.h);
  canvas.data.copy(out.data);
  for (let i = 0; i < out.data.length; i += 4) {
    if (out.data[i + 3] === 0) continue;
    for (let k = 0; k < from.length; k++) {
      if (out.data[i] === from[k][0] && out.data[i + 1] === from[k][1] && out.data[i + 2] === from[k][2]) {
        out.data[i] = to[k][0]; out.data[i + 1] = to[k][1]; out.data[i + 2] = to[k][2];
        break;
      }
    }
  }
  return out;
}

/** Tint every opaque pixel of a layer toward a colour, preserving its shading. */
function tintLayer(src, [r, g, b]) {
  const out = createCanvas(src.w, src.h);
  for (let y = 0; y < src.h; y++) {
    for (let x = 0; x < src.w; x++) {
      const p = src.px(x, y);
      if (p[3] === 0) continue;
      // luminance of the source drives the shade; the palette drives the hue
      const l = (p[0] * 0.299 + p[1] * 0.587 + p[2] * 0.114) / 255;
      out.set(x, y, [Math.round(r * l), Math.round(g * l), Math.round(b * l), p[3]]);
    }
  }
  return out;
}

/**
 * (D-19, 2026-07-30) Resolves the concrete sibling sheet for a variant
 * layer. `adapter.resolve(key)` already gives the DEFAULT (index-0)
 * file's absolute path — `Hairstyle_01_01.png`, `Outfit_01_01.png`,
 * `Eyes_01.png` — and this substitutes the record's own style/variant into
 * that same filename shape, in the same directory (siblings live next to
 * their index-0 file by pack convention). Two-stage layers (hair, outfit)
 * pass a style AND a variant (`_01_01` -> `_14_03`); the single-stage eyes
 * layer passes `style: null` and only a variant (`_01` -> `_04`) — "one
 * mechanism for all variant layers" (task header), generalized over
 * however many numeric segments the filename carries, not a separate
 * function per layer. The fixture pack's per-variant sheets (Task 27
 * dependency flag #2, `gen-fixture-pack.mjs`) give this something real to
 * resolve in tests; a pack with no numbered siblings at this position (the
 * `927px-wide body` test's single `layer.png`) simply no-ops — the regex
 * finds nothing to substitute and the path comes back unchanged.
 *
 * This works entirely off `adapter.resolve()` — already Plan 1's public
 * surface — so it needs no new fields exposed on the adapter itself; only
 * `readSprite`'s optional third argument (spriteReader.mjs) is new, and
 * that argument is additive: every existing two-argument call, including
 * `pinFor`, is unaffected, so pins keep pinning the DEFAULT file.
 */
function resolveVariantFile(adapter, key, style, variant) {
  const r = adapter.resolve(key);
  const dir = dirname(r.absPath);
  const base = basename(r.absPath);
  const newBase = style == null
    ? base.replace(/_\d+(?=\.\w+$)/, `_${variant}`)
    : base.replace(/_\d+_\d+(?=\.\w+$)/, `_${style}_${variant}`);
  return join(dir, newBase);
}

/**
 * (D-19, 2026-07-30) The remap fallback's OWN small tint set — not an
 * AppearanceRecord axis, not exported from derive.mjs. Once colour comes
 * from the pack's own hair/outfit files (the shipping, layered path), those
 * two record fields hold style/variant IDs, not hex — so a hypothetical
 * non-layered pack has nothing left to recolour hair/outfit WITH. This
 * exists only to keep the degenerate `characterLayers: false` fallback
 * visually varied; the record's own `hairStyle`/`outfit` (style, still
 * seed-derived) picks which fallback tint, so the fallback stays
 * deterministic without adding a real axis back.
 */
const FALLBACK_TINTS = ['#4a2c19', '#8b5a2b', '#c98a3b', '#2c3e50', '#8e44ad', '#27ae60'];
const fallbackTint = key => FALLBACK_TINTS[hashString(key, 'composer:fallbackTint') % FALLBACK_TINTS.length];

/**
 * Which record field colours which part. `build` selects the body sheet
 * variant rather than a colour. Eyes, hair and outfit are all
 * SHEET-SELECTION axes now, never a tint (D-19, 2026-07-30): each concrete
 * sheet `resolveVariantFile` resolves already IS the colour, so none of
 * them map to a PART_COLOR entry. `body`/`skinTone` is the only recolored
 * part left in the layered path.
 */
const PART_COLOR = { body: 'skinTone', eyes: null, hair: null, outfit: null, accessory: null };

export function composeSheet(contract, adapter, record) {
  const layered = adapter.capabilities.characterLayers === true;
  const parts = contract.characters.parts;

  const base = readSprite(adapter, `char_${parts[0]}`);
  // readSprite resolves THROUGH the adapter's rect, so the real pack's
  // char_body arrives already cropped from its raw 927px to the 896px shared
  // canvas (56 whole frames — Plan 1 Task 7). Flooring to whole frames is a
  // guard for packs whose resolved sheets are still not frame-aligned; on
  // the real pack it is a no-op (896 = 56*16).
  const fw = contract.characters.frameWidth;
  const fh = contract.characters.frameHeight;
  const sheetW = Math.floor(base.w / fw) * fw;
  const sheetH = Math.floor(base.h / fh) * fh;
  const out = createCanvas(sheetW, sheetH);

  if (!layered) {
    // Palette-remap path: one base sheet, recoloured. Skin tone is still a
    // real record axis (D-19 keeps it). Hair/outfit no longer carry a hex
    // value (D-19), so the degenerate fallback recolours with its OWN small
    // tint set, keyed off the still-seed-derived style id — composer-local,
    // never promoted back into AppearanceRecord. Document, don't "fix".
    const from = [hexToRgba('#ffdbac'), hexToRgba('#1a1a1a'), hexToRgba('#ecf0f1'), hexToRgba('#2c3e50')];
    const to = [
      hexToRgba(record.skinTone),
      hexToRgba(fallbackTint(record.hairStyle)),
      hexToRgba(fallbackTint(record.outfit)),
      hexToRgba(fallbackTint(record.outfit)),
    ];
    out.blit(asSource(base.canvas), 0, 0, sheetW, sheetH, 0, 0);
    return remapPalette(out, from, to);
  }

  // Layered path: stack body -> eyes -> hair -> outfit -> accessory.
  // Variant layers (eyes, hair, outfit — D-19, 2026-07-30) resolve their
  // concrete sibling sheet via resolveVariantFile above. The fixture pack
  // ships real per-variant sheets for exactly these three (Task 27
  // dependency flag #2), so resolution is exercised for real there too, not
  // just on the real pack.
  //
  // Sleep row (r3): on the real pack, outfit and eye sheets have NO art in
  // that row (Step 0) — a composed sleep frame is body+hair by pack design,
  // and that is the shipped decision (the bed's blanket covers the body).
  // Do not special-case it here: blitting an empty row is the correct
  // behavior, not a bug. The Math.min blit clamp below also harmlessly clips
  // the padding columns of the four 927px-wide party-cone accessory sheets.
  for (const part of parts) {
    if (part === 'accessory' && record.accessory === 'none') continue;
    const key = `char_${part}`;
    const file = part === 'hair' ? resolveVariantFile(adapter, key, record.hairStyle, record.hairVariant)
               : part === 'outfit' ? resolveVariantFile(adapter, key, record.outfit, record.outfitVariant)
               : part === 'eyes' ? resolveVariantFile(adapter, key, null, record.eyes)
               : null;
    const layer = readSprite(adapter, key, file ? { file } : undefined);
    const colorKey = PART_COLOR[part];
    const src = colorKey ? asSource(tintLayer(asSource(layer.canvas), hexToRgba(record[colorKey])))
                         : asSource(layer.canvas);
    out.blit(src, 0, 0, Math.min(layer.w, out.w), Math.min(layer.h, out.h), 0, 0);
  }
  return out;
}

/**
 * 32x32 head-and-shoulders, composed from the SAME record as the sprite —
 * so build, skin tone and hair (style and variant) agree across surfaces
 * (spec §6.3). The two depictions may look different; they must not
 * contradict.
 */
export function composePortrait(contract, adapter, record) {
  const sheet = composeSheet(contract, adapter, record);
  const fw = contract.characters.frameWidth;
  const fh = contract.characters.frameHeight;

  // frame 0 of the idle row, facing 'down' — the last direction in the order
  const dirIndex = contract.characters.directionOrder.indexOf('down');
  const fpd = contract.characters.anims.idle.framesPerDirection;
  const sx = (dirIndex * fpd) * fw;
  const sy = fh;                      // row 1 is idle (row 0 is the preview strip)

  const out = createCanvas(32, 32);
  const src = asSource(sheet);
  // 2x nearest-neighbour of the top 16x16 of the frame
  for (let y = 0; y < 16; y++) {
    for (let x = 0; x < 16; x++) {
      const p = src.px(sx + x, sy + y);
      if (p[3] === 0) continue;
      out.set(x * 2, y * 2, p); out.set(x * 2 + 1, y * 2, p);
      out.set(x * 2, y * 2 + 1, p); out.set(x * 2 + 1, y * 2 + 1, p);
    }
  }
  return out;
}
