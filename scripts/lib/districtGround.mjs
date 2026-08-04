/**
 * The district's procedural ground and roads layers
 * (was build-district.mjs:142-207).
 *
 * THE PRNG CONSUMPTION ORDER IS PART OF THE CONTRACT. The stream is drawn
 * in exactly this sequence: ground rows (row-major), then the four paved
 * paths, then the road asphalt (row-major). The caller continues the same
 * stream for scatter picks. Reordering any of it repaints the whole map.
 */

/**
 * @returns {{ground: number[], roads: number[], rnd: () => number}}
 */
export function cityGrid(params, seed, gid, [W, H]) {
  const { vRoad, hRoad, vSidewalks, hSidewalks, pen, gate: _gate, paths } = params;
  const [PX0, PY0, PX1, PY1] = pen;

  // LCG, verbatim from build-district.mjs:143-145
  let s = seed >>> 0;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
  const pick = arr => arr[Math.floor(rnd() * arr.length)];

  const inVRoad = x => x >= vRoad[0] && x <= vRoad[1];
  const inHRoad = y => y >= hRoad[0] && y <= hRoad[1];
  const inVSw = x => vSidewalks.some(([a, b]) => x >= a && x <= b);
  const inHSw = y => hSidewalks.some(([a, b]) => y >= a && y <= b);

  // ── ground ────────────────────────────────────────────────────────────
  const ground = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let g;
      if (inVRoad(x) || inHRoad(y)) {
        g = 0;                                   // the roads layer covers it
      } else if (inVSw(x) || inHSw(y)) {
        g = pick([gid.sideA, gid.sideA, gid.sideB, gid.sideC, gid.sideD]);
      } else if (x >= PX0 && x <= PX1 && y >= PY0 && y <= PY1) {
        g = pick([gid.dirt, gid.dirt, gid.dirtA]);
      } else {
        // the pack's grass variants are darker than the base — keep one tile
        g = gid.grass;
      }
      ground[y * W + x] = g;
    }
  }

  // paved paths to the villa and library doors
  for (const [x0, y0, x1, y1] of paths) {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++)
        ground[y * W + x] = pick([gid.sideA, gid.sideA, gid.sideB, gid.sideC]);
  }

  // ── roads ─────────────────────────────────────────────────────────────
  const roads = new Array(W * H).fill(0);
  const asphalt = () => pick([gid.asphA, gid.asphA, gid.asphB, gid.asphC, gid.asphD]);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (inVRoad(x) || inHRoad(y)) roads[y * W + x] = asphalt();

  // Centre lines, skipping the junction and the crossings.
  //
  // The centre of each carriageway is DERIVED from the road params, not
  // written down: these were the literals 22 and 23, which happen to be the
  // middles of hRoad [21,23] and vRoad [22,24] and silently would not be if
  // either road moved. D-88 promises the district's shape is config-driven;
  // a hardcoded centre line is that promise being false.
  const centreRow = Math.floor((hRoad[0] + hRoad[1]) / 2);
  const centreCol = Math.floor((vRoad[0] + vRoad[1]) / 2);
  for (let x = 0; x < W; x += 2)
    if (!(x >= vRoad[0] - 3 && x <= vRoad[1] + 3)) roads[centreRow * W + x] = gid.dashH;
  for (let y = 0; y < H; y += 2)
    if (!(y >= hRoad[0] - 3 && y <= hRoad[1] + 3)) roads[y * W + centreCol] = gid.dashV;

  // crossings over the vertical road (horizontal stripes), on the sidewalk lines
  for (const [ya, yb] of hSidewalks) {
    for (let i = 0; i < 3; i++) {
      const x = vRoad[0] + i;
      roads[ya * W + x] = i % 2 === 0 ? gid.zebHa1 : gid.zebHb1;
      roads[yb * W + x] = i % 2 === 0 ? gid.zebHa2 : gid.zebHb2;
    }
  }
  // crossings over the horizontal road (vertical stripes)
  for (const [xa, xb] of vSidewalks) {
    for (let y = hRoad[0]; y <= hRoad[1]; y++) {
      const odd = (y - hRoad[0]) % 2 === 1;
      roads[y * W + xa] = odd ? gid.zebVa2 : gid.zebVa1;
      roads[y * W + xb] = odd ? gid.zebVb2 : gid.zebVb1;
    }
  }

  return { ground, roads, rnd };
}
