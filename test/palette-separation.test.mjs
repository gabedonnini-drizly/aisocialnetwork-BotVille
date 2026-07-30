import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SKIN_TONES,
} from '../packages/shared/src/appearance/derive.mjs';
// HAIR_COLORS / OUTFIT_COLORS are gone (D-19, 2026-07-30): hair and outfit
// colour now comes from the pack's own variant files, not a hex axis this
// test could compare. SKIN_TONES is the one recolor axis D-19 leaves live
// (the composer still tints the body layer by it), so it is the one
// palette this task still separates.

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));

/** sRGB -> CIE Lab, so distance means something perceptually. */
function lab([r, g, b]) {
  const f = v => { v /= 255; return v > 0.04045 ? ((v + 0.055) / 1.055) ** 2.4 : v / 12.92; };
  const [R, G, B] = [f(r), f(g), f(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const g2 = t => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * g2(Y) - 16, 500 * (g2(X) - g2(Y)), 200 * (g2(Y) - g2(Z))];
}
const dE = (a, b) => Math.hypot(...lab(a).map((v, i) => v - lab(b)[i]));

/** The night overlay: #0a0a2e at alpha 0.45 (DAY_TINT_KEYS). */
const night = ([r, g, b]) => [r, g, b].map((c, i) =>
  Math.round(c * 0.55 + [0x0a, 0x0a, 0x2e][i] * 0.45));

/** Deuteranopia (Brettel-style approximation) — the most common CVD. */
const deuter = ([r, g, b]) => [
  Math.round(0.625 * r + 0.375 * g),
  Math.round(0.700 * r + 0.300 * g),
  Math.round(0.300 * g + 0.700 * b),
];

// Eyes are deliberately absent: EYE_VARIANTS is a sheet-selection axis
// (each Eyes_NN.png sheet is its own colour) — there is no hex palette to
// separate, so the separation tests do not include eyes. Hair and outfit
// are absent for the same reason as of D-19, 2026-07-30 — their colour is
// now a pack variant file too, not a hex value in this repo.
const PALETTES = { SKIN_TONES };

function worstPair(list, transform) {
  let worst = Infinity, pair = null;
  for (let i = 0; i < list.length; i++)
    for (let j = i + 1; j < list.length; j++) {
      const d = dE(transform(rgb(list[i])), transform(rgb(list[j])));
      if (d < worst) { worst = d; pair = [list[i], list[j]]; }
    }
  return { worst, pair };
}

test('every palette is perceptually separated in daylight', () => {
  for (const [name, list] of Object.entries(PALETTES)) {
    const { worst, pair } = worstPair(list, x => x);
    assert.ok(worst >= 12, `${name}: ${pair?.join(' vs ')} are only dE ${worst.toFixed(1)} apart`);
  }
});

test('every palette survives the night tint (alpha 0.45)', () => {
  for (const [name, list] of Object.entries(PALETTES)) {
    const { worst, pair } = worstPair(list, night);
    assert.ok(worst >= 7, `${name} at night: ${pair?.join(' vs ')} are only dE ${worst.toFixed(1)} apart`);
  }
});

test('every palette survives deuteranopia', () => {
  for (const [name, list] of Object.entries(PALETTES)) {
    const { worst, pair } = worstPair(list, deuter);
    assert.ok(worst >= 6, `${name} under CVD: ${pair?.join(' vs ')} are only dE ${worst.toFixed(1)} apart`);
  }
});

// (D-19, 2026-07-30) The "palettes are not evenly spaced in hue" test is
// GONE, not repointed at SKIN_TONES: it asserted OUTFIT_COLORS wasn't a
// mechanical rainbow (an anti-pattern for a palette meant to span the wheel).
// SKIN_TONES is deliberately the opposite shape — a narrow-hue LIGHTNESS
// ramp (all ~24-36° hue; separation Task 26's own comment already says is
// perceptual, i.e. Lab-distance-driven, not hue-spread-driven). Applying
// the same "hue gaps aren't even" check to it would fail on a palette that
// was never designed to spread across hues in the first place — the wrong
// test for what SKIN_TONES is. The three dE tests above still hold
// SKIN_TONES to the real requirement (daylight/night/CVD separation).
