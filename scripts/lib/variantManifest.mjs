/**
 * Pack file index -> sorted style/variant manifest (D-19, 2026-07-30).
 *
 * Hair and outfit axes derive from EVERY pack variant, not a curated
 * subset (D-19 supersedes D-16's owner-pick-12/8). This groups a flat
 * filename list by the pack's own `<Style>_<NN>_<MM>.png` naming, sorts
 * both levels, and is deliberately re-runnable: regenerating from an
 * unchanged (even reshuffled) file list reproduces byte-identical JSON.
 * No hand-transcribed style or variant list anywhere downstream of this —
 * `test/variant-manifest.test.mjs` pins the stability claim directly.
 *
 * Pure: takes a filename list, returns data. Never touches the filesystem
 * itself — the CLI (`scripts/gen-variant-manifest.mjs`) owns I/O so this
 * function stays trivially testable and reusable from either loader.
 */
export function buildVariantManifest(filenames, pattern) {
  const byStyle = new Map();
  for (const name of filenames) {
    const m = pattern.exec(name);
    if (!m) continue;
    const [, style, variant] = m;
    if (!byStyle.has(style)) byStyle.set(style, []);
    byStyle.get(style).push(variant);
  }
  const styles = [...byStyle.keys()].sort();
  const variantsByStyle = {};
  for (const style of styles) variantsByStyle[style] = [...byStyle.get(style)].sort();
  return { styles, variantsByStyle };
}
