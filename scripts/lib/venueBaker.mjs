/**
 * Venue descriptor -> Tiled .tmj.
 * Object sizes are read from the BAKED bitmaps, never hand-authored, and
 * collision is derived from furniture footprints — so a moved prop can no
 * longer leave a stale collision box behind (spec §5.3).
 */
import { cityGrid } from './districtGround.mjs';

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

/** Named ground generators. Outdoor venues reference one by name. */
const GROUND_GENERATORS = { cityGrid };

export function bakeDistrict(contract, v, { atlas, propSizes }) {
  const [W, H] = v.sizeTiles;
  const f = objectFactory();
  const size = name => propSizes.get(name) ?? { w: T, h: T };

  const gen = GROUND_GENERATORS[v.generator.name];
  if (!gen) throw new Error(`venue ${v.id}: unknown ground generator ${v.generator.name}`);
  // rnd continues here — scatter picks draw from the same stream, in order
  const { ground, roads, rnd } = gen(v.generator.params, v.generator.seed, atlas.gid, v.sizeTiles);

  const layers = { 'props-below': [], buildings: [], 'props-above': [], doors: [], spawns: [], collision: [], glows: [], night: [] };
  const collide = (x, y, w, h) => layers.collision.push(f.make('c', x, y, w, h));

  // ── hand-placed props ─────────────────────────────────────────────────
  for (const item of v.furniture) {
    const s = size(item.name);
    const [tx, ty] = item.at;
    const props = {};
    if (item.label) props.label = item.label;
    if (item.targetVenue) props.targetVenue = item.targetVenue;
    layers[item.layer].push(f.make(item.name, tx * T, ty * T, s.w, s.h, props, { type: item.type }));

    if (item.layer === 'buildings') {
      collide(tx * T, ty * T, s.w, s.h);
    } else if (item.name.startsWith('tree_')) {
      collide(tx * T + s.w / 2 - 12, ty * T + s.h - 20, 24, 16);   // trunk only
    } else if (item.name === 'street_lamp') {
      collide(tx * T + 8, ty * T + 48, 16, 14);
    } else if (item.name === 'bench') {
      collide(tx * T, ty * T + 8, 32, 20);
    } else if (item.name === 'trash_can') {
      collide(tx * T + 8, ty * T + 12, 16, 16);
    } else if (item.name === 'hydrant') {
      collide(tx * T + 2, ty * T + 20, 12, 10);
    } else if (item.name.startsWith('car_')) {
      collide(tx * T, Math.round(ty + 0.4) * T, 64, item.name === 'car_left_1' ? 28 : 24);
    }
  }

  // ── fence ring with the gate gap ──────────────────────────────────────
  const [PX0, PY0, PX1, PY1] = v.generator.params.pen;
  const [G0, G1] = v.generator.params.gate;
  const fence = (part, tx, ty) => {
    const s = size(`fence_${part}`);
    layers['props-above'].push(f.make(`fence_${part}`, tx * T, ty * T, s.w, s.h));
    collide(tx * T, ty * T + 6, 16, 10);
  };
  for (let x = PX0 + 1; x < PX1; x++) {
    fence('top_middle', x, PY0);
    if (x < G0 || x > G1) fence('bottom_middle', x, PY1);
  }
  for (let y = PY0 + 1; y < PY1; y++) {
    fence('middle_left', PX0, y);
    fence('middle_right', PX1, y);
  }
  fence('top_left', PX0, PY0);
  fence('top_right', PX1, PY0);
  fence('bottom_left', PX0, PY1);
  fence('bottom_right', PX1, PY1);

  // ── crop rows ─────────────────────────────────────────────────────────
  const crops = v.scatter.crops;
  for (let i = 0; i < crops.rows; i++) {
    const ty = crops.startTile[1] + i * crops.step;
    const tx0 = crops.startTile[0];
    for (const [dx, part] of [[0, 'soil_left'], [1, 'soil_mid'], [2, 'soil_right']]) {
      const s = size(part);
      layers[crops.layer].push(f.make(part, (tx0 + dx) * T, ty * T, s.w, s.h));
    }
    const crop = crops.alternate[i % crops.alternate.length];
    for (let cx = 0; cx < 3; cx++) {
      const s = size(crop);
      layers[crops.layer].push(f.make(crop, (tx0 + cx) * T, ty * T, s.w, s.h));
    }
  }

  // ── bushes: seeded picks, continuing the ground stream ────────────────
  const bushes = v.scatter.bushes;
  for (const [tx, ty] of bushes.at) {
    const name = rnd() < 0.5 ? bushes.pick[0] : bushes.pick[1];
    const s = size(name);
    layers[bushes.layer].push(f.make(name, tx * T, ty * T, s.w, s.h));
    collide(tx * T + 2, ty * T + 6, 12, 10);
  }

  // ── doors, spawns, glows, night ───────────────────────────────────────
  for (const d of v.doors) {
    const [w, h] = d.sizePx;
    layers.doors.push(f.make(d.name, d.at[0] * T, d.at[1] * T, w, h, { targetVenue: d.targetVenue }));
  }
  v.spawns.forEach((s, i) =>
    layers.spawns.push(f.make(`spawn_${i}`, s[0] * T, s[1] * T, 0, 0, {}, { point: true })));
  for (const g of v.glows) {
    layers.glows.push(f.make(g.kind, g.at[0], g.at[1], 0, 0, {}, { point: true, type: g.kind }));
  }
  for (const n of v.night) {
    layers.night.push(f.make(n.name, n.atPx[0], n.atPx[1], 0, 0, {}, { point: true }));
  }

  // ── map bounds ────────────────────────────────────────────────────────
  collide(-16, 0, 16, H * T);
  collide(W * T, 0, 16, H * T);
  collide(0, -16, W * T, 16);
  collide(0, H * T, W * T, 16);

  return {
    type: 'map', version: '1.10', tiledversion: '1.10.2',
    orientation: 'orthogonal', renderorder: 'right-down',
    width: W, height: H, tilewidth: T, tileheight: T,
    infinite: false, compressionlevel: -1,
    nextlayerid: 12, nextobjectid: f.nextId, properties: [],
    tilesets: [{
      firstgid: 1, name: atlas.id,
      image: `../tilesets/pack/${atlas.id}.png`,
      imagewidth: atlas.canvas.w, imageheight: atlas.canvas.h,
      tilewidth: T, tileheight: T,
      tilecount: atlas.tileCount, columns: atlas.columns,
      margin: 0, spacing: 0,
    }],
    layers: [
      tileLayer(1, 'ground', W, H, ground),
      tileLayer(2, 'roads', W, H, roads),
      objLayer(3, 'props-below', layers['props-below']),
      objLayer(4, 'buildings', layers.buildings),
      objLayer(5, 'props-above', layers['props-above']),
      objLayer(6, 'doors', layers.doors),
      objLayer(7, 'spawns', layers.spawns),
      objLayer(8, 'collision', layers.collision),
      objLayer(9, 'glows', layers.glows),
      objLayer(10, 'night', layers.night),
    ],
  };
}
