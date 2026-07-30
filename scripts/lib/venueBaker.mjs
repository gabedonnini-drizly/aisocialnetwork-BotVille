/**
 * Venue descriptor -> Tiled .tmj.
 * Object sizes are read from the BAKED bitmaps, never hand-authored, and
 * collision is derived from furniture footprints — so a moved prop can no
 * longer leave a stale collision box behind (spec §5.3).
 */

const T = 16;

/** Tiled object factory with a monotonic id, matching the old scripts' shape. */
function objectFactory() {
  let nextId = 1;
  return {
    get nextId() { return nextId; },
    make(name, x, y, w, h, props = {}, extra = {}) {
      return {
        id: nextId++,
        name,
        type: extra.type ?? '',
        x, y, width: w, height: h,
        rotation: 0,
        visible: true,
        point: !!extra.point,
        properties: Object.entries(props).map(([k, v]) => ({
          name: k,
          type: typeof v === 'number' ? 'float' : typeof v === 'boolean' ? 'bool' : 'string',
          value: v,
        })),
      };
    },
  };
}

function tileLayer(id, name, w, h, data) {
  return { id, name, type: 'tilelayer', width: w, height: h, x: 0, y: 0, opacity: 1, visible: true, data };
}
function objLayer(id, name, objects) {
  return { id, name, type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects };
}

/** The doorway gap in the bottom wall, shared by every interior. */
const DOOR = { x0: 9, x1: 10 };

export function bakeInterior(contract, v, { atlas, propSizes }) {
  const [W, H] = v.sizeTiles;
  const f = objectFactory();
  const size = name => propSizes.get(name) ?? { w: T, h: T };

  // ── ground ────────────────────────────────────────────────────────────
  const ground = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let g;
      if (y === 0) g = atlas.gid[v.ground.wallA];
      else if (y === 1) g = atlas.gid[v.ground.wallB];
      else if (x === 0 || x === W - 1 || y === H - 1) g = atlas.gid.border;
      else g = atlas.gid[v.ground.floor];
      ground[y * W + x] = g;
    }
  }
  for (let x = DOOR.x0; x <= DOOR.x1; x++) ground[(H - 1) * W + x] = atlas.gid[v.ground.floor];

  // ── furniture + derived collision ─────────────────────────────────────
  const furniture = [];
  const collision = [];
  for (const item of v.furniture) {
    const s = size(item.name);
    const [tx, ty] = item.at;
    furniture.push(f.make(item.name, tx * T, ty * T, s.w, s.h));
    if (item.collide !== false) {
      // footprint = the bottom band of the sprite, inset 1px each side
      collision.push(f.make('c', tx * T + 1, ty * T + Math.max(0, s.h - 18), s.w - 2, Math.min(s.h, 18)));
    }
  }

  // ── seats ─────────────────────────────────────────────────────────────
  const seats = v.seats.map((s, i) =>
    f.make(`seat_${i}`, s.at[0] * T, s.at[1] * T, 0, 0, { side: s.side, kind: s.kind }, { point: true }));

  // ── animated ──────────────────────────────────────────────────────────
  const animated = v.animated.map(a => f.make(a.name, a.at[0] * T, a.at[1] * T, 0, 0, {}, { point: true }));

  // ── doormat + exit zone, both centred on the wall gap ─────────────────
  const mat = size('doormat');
  const doorCenterX = ((DOOR.x0 + DOOR.x1 + 1) / 2) * T;
  const matY = (H - 1) * T - mat.h - 2;
  furniture.push(f.make('doormat', Math.round(doorCenterX - mat.w / 2), matY, mat.w, mat.h, { doormat: true }));

  const doors = v.doors.map(d =>
    f.make(d.name, doorCenterX - 1.5 * T, matY - 4, 3 * T, mat.h + 8, { targetVenue: d.targetVenue }));

  // ── structural collision: walls, side borders, doorway gap ────────────
  collision.push(f.make('c', 0, 0, W * T, 2 * T));
  collision.push(f.make('c', 0, (H - 1) * T, DOOR.x0 * T, T));
  collision.push(f.make('c', (DOOR.x1 + 1) * T, (H - 1) * T, (W - DOOR.x1 - 1) * T, T));
  collision.push(f.make('c', 0, 0, T, H * T));
  collision.push(f.make('c', (W - 1) * T, 0, T, H * T));

  const spawns = v.spawns.map((s, i) => f.make(`spawn_${i}`, s[0] * T, s[1] * T, 0, 0, {}, { point: true }));

  return {
    type: 'map', version: '1.10', tiledversion: '1.10.2',
    orientation: 'orthogonal', renderorder: 'right-down',
    width: W, height: H, tilewidth: T, tileheight: T,
    infinite: false, compressionlevel: -1,
    nextlayerid: 9, nextobjectid: f.nextId, properties: [],
    tilesets: [{
      firstgid: 1,
      name: atlas.id,
      image: `../tilesets/pack/${atlas.id}.png`,
      imagewidth: atlas.canvas.w,
      imageheight: atlas.canvas.h,
      tilewidth: T, tileheight: T,
      tilecount: atlas.tileCount,
      columns: atlas.columns,
      margin: 0, spacing: 0,
    }],
    layers: [
      tileLayer(1, 'ground', W, H, ground),
      objLayer(2, 'furniture', furniture),
      objLayer(3, 'seats', seats),
      objLayer(4, 'animated', animated),
      objLayer(5, 'doors', doors),
      objLayer(6, 'spawns', spawns),
      objLayer(7, 'collision', collision),
    ],
  };
}
