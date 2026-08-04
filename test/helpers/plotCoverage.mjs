/**
 * Plot integrity, as a pure function of data — so the same three checks run
 * here, in the platform's copy of the sync test, and against synthetic
 * fixtures that fire-proof them.
 *
 * Task 7 authors the plots and is blocked on ⛔ O-1 (whether a plot IS a
 * venue or merely names one). Until it lands there is nothing to iterate
 * over, so these pass VACUOUSLY — which is the right behaviour and a real
 * hazard: a check with no input looks exactly like a check that passed. The
 * fire-proof fixtures in test/vocabulary-sync.test.mjs are what stop this
 * being a self-erasing filter, and `checkPlots` reports the count it saw so
 * a caller can assert on it.
 *
 * @param {object[]} plots — `{ id, at: [x, y], size: [w, h], allowedArchetypes: string[] }`
 * @param {{id: string, sizeTiles: [number, number]}} district
 * @param {Set<string>|string[]} declaredArchetypes
 * @returns {{problems: string[], count: number}}
 */
export function checkPlots(plots, district, declaredArchetypes) {
  const declared = new Set(declaredArchetypes);
  const problems = [];
  const [DW, DH] = district?.sizeTiles ?? [];

  if (plots.length && !(Number.isFinite(DW) && Number.isFinite(DH))) {
    problems.push(`district "${district?.id}" has no sizeTiles — a footprint cannot be checked against it`);
  }

  const boxes = [];
  for (const p of plots) {
    const where = `plot ${p?.id ?? '(unnamed)'}`;
    if (!p?.id) problems.push('a plot has no id');

    // Every plot's archetype allowlist references DECLARED archetypes.
    const allowed = p?.allowedArchetypes;
    if (!Array.isArray(allowed) || allowed.length === 0) {
      problems.push(`${where}: no allowedArchetypes — nothing could ever be built on it`);
    } else {
      for (const name of allowed) {
        if (!declared.has(name)) problems.push(`${where}: allowedArchetypes names "${name}", which is not a declared archetype`);
      }
    }

    // Every plot's footprint fits inside its district's sizeTiles.
    const at = p?.at;
    const size = p?.size;
    if (!Array.isArray(at) || at.length !== 2 || !Array.isArray(size) || size.length !== 2) {
      problems.push(`${where}: needs an [x, y] origin and a [w, h] size to be checkable`);
      continue;
    }
    const [x, y] = at;
    const [w, h] = size;
    if (!(w > 0 && h > 0)) problems.push(`${where}: size ${JSON.stringify(size)} is not a footprint`);
    if (Number.isFinite(DW) && Number.isFinite(DH)
        && (x < 0 || y < 0 || x + w > DW || y + h > DH)) {
      problems.push(`${where}: footprint [${x},${y},${w},${h}] falls outside the district's ${DW}x${DH} tiles`);
    }
    boxes.push({ id: p.id, x, y, w, h });
  }

  // No two plots overlap. Half-open boxes: touching edges are not an overlap.
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      const hit = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
      if (hit) problems.push(`plots ${a.id} and ${b.id} overlap`);
    }
  }

  return { problems, count: plots.length };
}

/**
 * Plots as Task 7 may author them: on the district descriptor (`plots`) or in
 * a sibling `plots.json`. O-1 decides which; reading both means this check
 * does not have to be rewritten when it is ruled.
 *
 * @param {object} districtVenue
 * @param {object|null} siblingPlotsJson
 */
export function collectPlots(districtVenue, siblingPlotsJson = null) {
  return [
    ...(Array.isArray(districtVenue?.plots) ? districtVenue.plots : []),
    ...(Array.isArray(siblingPlotsJson?.plots) ? siblingPlotsJson.plots : []),
  ];
}
