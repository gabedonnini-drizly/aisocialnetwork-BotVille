#!/usr/bin/env node
/**
 * Step 4 of TZ-01: interior generation (Office, Cafe, Dorm, Library).
 * Builds from the LimeZu assets:
 *  1) wall/floor atlas -> public/assets/tilesets/limezu/interiors_ground.png
 *  2) furniture crops from the themed sheets -> public/assets/sprites/limezu/interior/
 *  3) 4 Tiled JSON maps -> public/assets/tilemaps/<scene>.tmj
 *
 * Crop coordinates were verified via scripts/crop.mjs / tile-strip.mjs.
 * Run after scripts/sync-assets.mjs.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, createCanvas, encodePng } from './png-lib.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'assets-src');
const PUB = join(ROOT, 'packages', 'client', 'public', 'assets');

const RB = decodePng(join(SRC, 'interiors/Room_Builder_16x16.png'));
const BR = decodePng(join(SRC, 'interiors/themes/4_Bedroom_16x16.png'));
const LR = decodePng(join(SRC, 'interiors/themes/2_LivingRoom_16x16.png'));
const CL = decodePng(join(SRC, 'interiors/themes/5_Classroom_and_library_16x16.png'));
const KT = decodePng(join(SRC, 'interiors/themes/12_Kitchen_16x16.png'));

// ------------------------------------------------------------------ atlas
// 16x16 tiles from Room_Builder (coordinates in tiles, verified with strips)

const ATLAS_TILES = [
  ['border', RB, 1, 44],      // dark "void" around the room
  ['wallOfficeA', RB, 1, 21], ['wallOfficeB', RB, 1, 22],  // grey-green wall
  ['wallCafeA', RB, 1, 17], ['wallCafeB', RB, 1, 18],      // cream wall
  ['wallDormA', RB, 1, 11], ['wallDormB', RB, 1, 12],      // wallpaper with diamonds
  ['wallLibA', RB, 1, 37], ['wallLibB', RB, 1, 38],        // wooden panels
  ['floorOffice', RB, 34, 11], // grey-blue checker (carpet)
  ['floorCafe', RB, 42, 11],   // white-pink checkerboard
  ['floorDorm', RB, 39, 24],   // warm parquet in squares
  ['floorLib', RB, 42, 19],    // herringbone parquet
];
const GID = Object.fromEntries(ATLAS_TILES.map(([n], i) => [n, i + 1]));
const ATLAS_COLS = 8;
{
  const rows = Math.ceil(ATLAS_TILES.length / ATLAS_COLS);
  const atlas = createCanvas(ATLAS_COLS * 16, rows * 16);
  ATLAS_TILES.forEach(([, img, tx, ty], i) => {
    atlas.blit(img, tx * 16, ty * 16, 16, 16, (i % ATLAS_COLS) * 16, Math.floor(i / ATLAS_COLS) * 16);
  });
  const p = join(PUB, 'tilesets/limezu/interiors_ground.png');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, encodePng(atlas));
}

// ------------------------------------------------------------ furniture crops

/**
 * [key, sheet, x, y, w, h] — the region is trimmed to opaque pixels.
 * Coordinates re-verified against the CURRENT sheets (TZ-08): the old regions
 * had drifted relative to the pack layouts — chairs were grabbing the corner of
 * the neighboring table, armchairs/board/lectern were getting clipped, the "rug"
 * was taken from a tablecloth. Verification: the components/crop-zone scratchpad
 * scripts (bbox of connected components + zoom).
 */
const FURNITURE = [
  // bedroom: beds (vertical, striped) and small items
  ['bed_green', BR, 128, 320, 32, 56],
  ['bed_blue', BR, 160, 320, 32, 56],
  ['bed_teal', BR, 192, 320, 32, 56],
  ['nightstand', BR, 224, 296, 16, 21],
  ['rug_pink', BR, 7, 349, 36, 34],
  // table+chair triples: in the sheet these are "dining sets"; the clean chairs
  // without the attached table corner are the second (facing left, x=34) and third (facing right, x=81)
  ['chair_blue_r', BR, 81, 192, 14, 32],
  ['chair_blue_l', BR, 34, 192, 14, 32],
  ['chair_red_r', BR, 81, 224, 14, 32],
  ['chair_red_l', BR, 34, 224, 14, 32],
  ['chair_yellow_r', BR, 81, 256, 14, 32],
  ['chair_yellow_l', BR, 34, 256, 14, 32],
  ['table_plain', BR, 48, 208, 32, 40],
  // living room: armchairs in profile (wide seat + backrest column, down to the legs;
  // below them in the sheet is a strip of floor and the next row — don't take those).
  // For the dorm the BROWN pair was taken (row 582): the grey one on warm parquet
  // read as a concrete slab (TZ-08 v2 acceptance). _r faces right = backrest on the left
  ['armchair_grey_r', LR, 145, 582, 22, 42],
  ['armchair_grey_l', LR, 121, 582, 22, 42],
  ['armchair_blue_r', LR, 145, 518, 22, 42],
  ['armchair_blue_l', LR, 121, 518, 22, 42],
  ['lamp_red', LR, 206, 150, 17, 36],
  ['plant_palm', LR, 214, 0, 28, 50],
  // classroom/library: shelving, lectern, globe, chalkboard
  ['bookshelf_a', CL, 0, 360, 48, 50],
  ['bookshelf_b', CL, 0, 424, 48, 50],
  ['bookshelf_narrow', CL, 195, 354, 13, 62],
  ['lectern', CL, 230, 282, 20, 34],
  ['globe', CL, 208, 16, 16, 24],
  ['chalkboard', CL, 160, 78, 28, 34],
  // kitchen: counter, stool, doormat
  ['counter_wide', KT, 192, 268, 52, 22],
  ['stool', KT, 1, 177, 14, 15],
  ['doormat', KT, 105, 432, 30, 38],
];

const trimmed = {};
for (const [key, img, rx, ry, rw, rh] of FURNITURE) {
  let minX = rw, minY = rh, maxX = -1, maxY = -1;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (img.px(rx + x, ry + y)[3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) { console.error(`EMPTY crop: ${key}`); continue; }
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const cv = createCanvas(w, h);
  cv.blit(img, rx + minX, ry + minY, w, h, 0, 0);
  const p = join(PUB, 'sprites/limezu/interior', `${key}.png`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, encodePng(cv));
  trimmed[key] = { w, h };
}
console.log('furniture:', Object.entries(trimmed).map(([k, s]) => `${k} ${s.w}x${s.h}`).join(', '));

// Standalone office PNGs (placed by sync-assets.mjs): read the sizes from the files,
// otherwise the map object gets a bogus 16x16 and depth/collision lie.
for (const key of ['workstation_single', 'workstation_double', 'whiteboard', 'printer',
  'coffee_machine', 'plant_pot', 'plant_small']) {
  const img = decodePng(join(PUB, 'sprites/limezu/interior', `${key}.png`));
  trimmed[key] = { w: img.w, h: img.h };
}

// ------------------------------------------------------------------ maps

const W = 20, H = 15, T = 16;
const DOOR = { x0: 9, x1: 10 }; // opening in the bottom wall

function buildRoom({ sceneKey, wallA, wallB, floor, furniture, seats, animated, spawn }) {
  let objId = 1;
  const ground = new Array(W * H).fill(0);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let g;
      if (y === 0) g = GID[wallA];
      else if (y === 1) g = GID[wallB];
      else if (x === 0 || x === W - 1 || y === H - 1) g = GID.border;
      else g = GID[floor];
      ground[y * W + x] = g;
    }
  }
  // doorway: floor instead of the border
  for (let x = DOOR.x0; x <= DOOR.x1; x++) ground[(H - 1) * W + x] = GID[floor];

  const layers = { furniture: [], seats: [], doors: [], collision: [], spawns: [], animated: [] };
  const obj = (layer, name, x, y, w, h, props = {}, point = false) => {
    layers[layer].push({
      id: objId++, name, type: '', x, y, width: w, height: h,
      rotation: 0, visible: true, point,
      properties: Object.entries(props).map(([k, v]) => ({
        name: k,
        type: typeof v === 'number' ? 'float' : typeof v === 'boolean' ? 'bool' : 'string',
        value: v,
      })),
    });
  };

  // furniture: [key, tx, ty, collide?]
  for (const [key, tx, ty, collide = true] of furniture) {
    const size = trimmed[key] ?? { w: 16, h: 16 };
    obj('furniture', key, tx * T, ty * T, size.w, size.h);
    if (collide) obj('collision', 'c', tx * T + 1, ty * T + Math.max(0, size.h - 18), size.w - 2, Math.min(size.h, 18));
  }
  // seats: [tx, ty, side, kind]
  seats.forEach(([tx, ty, side, kind = 'chair'], i) => {
    obj('seats', `seat_${i}`, tx * T, ty * T, 0, 0, { side, kind }, true);
  });
  // animated objects: [animKey, tx, ty]
  for (const [animKey, tx, ty] of animated) {
    obj('animated', animKey, tx * T, ty * T, 0, 0, {}, true);
  }
  // door: doormat inside the room + exit zone, both centered on the gap in the wall
  // (previously the doormat was pinned to DOOR.x0*T-3 and sat shifted left — TZ-09)
  const doorCenterX = ((DOOR.x0 + DOOR.x1 + 1) / 2) * T;
  const matY = (H - 1) * T - trimmed.doormat.h - 2;
  obj('furniture', 'doormat', Math.round(doorCenterX - trimmed.doormat.w / 2), matY,
    trimmed.doormat.w, trimmed.doormat.h, { doormat: true });
  obj('doors', 'exit', doorCenterX - 1.5 * T, matY - 4, 3 * T, trimmed.doormat.h + 8, { targetScene: 'DistrictScene' });
  // walls/bounds — collision
  obj('collision', 'c', 0, 0, W * T, 2 * T);
  obj('collision', 'c', 0, (H - 1) * T, DOOR.x0 * T, T);
  obj('collision', 'c', (DOOR.x1 + 1) * T, (H - 1) * T, (W - DOOR.x1 - 1) * T, T);
  obj('collision', 'c', 0, 0, T, H * T);
  obj('collision', 'c', (W - 1) * T, 0, T, H * T);
  // spawn near the door
  obj('spawns', 'spawn_0', spawn[0] * T, spawn[1] * T, 0, 0, {}, true);

  const map = {
    type: 'map', version: '1.10', tiledversion: '1.10.2',
    orientation: 'orthogonal', renderorder: 'right-down',
    width: W, height: H, tilewidth: T, tileheight: T,
    infinite: false, compressionlevel: -1,
    nextlayerid: 9, nextobjectid: objId, properties: [],
    tilesets: [{
      firstgid: 1, name: 'interiors_ground',
      image: '../tilesets/limezu/interiors_ground.png',
      imagewidth: ATLAS_COLS * 16,
      imageheight: Math.ceil(ATLAS_TILES.length / ATLAS_COLS) * 16,
      tilewidth: T, tileheight: T, tilecount: ATLAS_TILES.length,
      columns: ATLAS_COLS, margin: 0, spacing: 0,
    }],
    layers: [
      { id: 1, name: 'ground', type: 'tilelayer', width: W, height: H, x: 0, y: 0, opacity: 1, visible: true, data: ground },
      { id: 2, name: 'furniture', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: layers.furniture },
      { id: 3, name: 'seats', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: layers.seats },
      { id: 4, name: 'animated', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: layers.animated },
      { id: 5, name: 'doors', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: layers.doors },
      { id: 6, name: 'spawns', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: layers.spawns },
      { id: 7, name: 'collision', type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true, draworder: 'topdown', objects: layers.collision },
    ],
  };
  const p = join(PUB, 'tilemaps', `${sceneKey}.tmj`);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(map));
  console.log(`${sceneKey}.tmj: furniture ${layers.furniture.length}, seats ${layers.seats.length}, animated ${layers.animated.length}`);
}

// ---------------------------------------------------------------- scenes

buildRoom({
  sceneKey: 'office',
  wallA: 'wallOfficeA', wallB: 'wallOfficeB', floor: 'floorOffice',
  furniture: [
    ['workstation_single', 2, 1.2],
    ['workstation_double', 6.5, 1.2],
    ['workstation_single', 12, 1.2],
    ['whiteboard', 15.5, 0.2, false],
    ['printer', 17.5, 1.6],
    ['coffee_machine', 1.2, 5.5],
    ['plant_pot', 18, 5],
    ['plant_small', 1.2, 12],
    ['table_plain', 7, 6.5],
    ['table_plain', 10, 6.5],
    ['chair_blue_r', 5.4, 6.8, false],
    ['chair_blue_r', 5.4, 8.3, false],
    ['chair_blue_l', 13.2, 6.8, false],
    ['chair_blue_l', 13.2, 8.3, false],
    ['plant_palm', 17.5, 10.5],
  ],
  seats: [
    [6.2, 8.6, 'right'], [6.2, 10.1, 'right'],
    [14, 8.6, 'left'], [14, 10.1, 'left'],
  ],
  animated: [
    ['office_screen', 4.5, 0.3],
    ['coffee_steam', 1.5, 4.6],
  ],
  spawn: [9.8, 12.5],
});

buildRoom({
  sceneKey: 'cafe',
  wallA: 'wallCafeA', wallB: 'wallCafeB', floor: 'floorCafe',
  furniture: [
    ['counter_wide', 2, 3.6],
    ['counter_wide', 5.25, 3.6],
    ['coffee_machine', 2.4, 2],
    ['stool', 3, 5.6, false],
    ['stool', 5, 5.6, false],
    ['stool', 7, 5.6, false],
    ['table_plain', 3, 8.5],
    ['chair_red_r', 1.4, 8.8, false],
    ['chair_red_l', 6.2, 8.8, false],
    ['table_plain', 13, 8.5],
    ['chair_red_r', 11.4, 8.8, false],
    ['chair_red_l', 16.2, 8.8, false],
    // bottom table left of the doorway: the doormat (x145-175) and entrance stay fully clear;
    // shift is exactly 3.5 tiles — with less, the left chair (+3.2 tiles from the table)
    // lands on the doormat (owner's note after TZ-09)
    ['table_plain', 4.5, 11],
    ['chair_yellow_r', 2.9, 11.3, false],
    ['chair_yellow_l', 7.7, 11.3, false],
    ['plant_palm', 17.5, 1.4],
    ['plant_pot', 1.2, 12],
  ],
  seats: [
    [3.5, 6.6, 'right', 'stool'], [5.5, 6.6, 'left', 'stool'], [7.5, 6.6, 'right', 'stool'],
    [2.2, 10.6, 'right'], [7, 10.6, 'left'],
    [12.2, 10.6, 'right'], [17, 10.6, 'left'],
    [3.7, 13.1, 'right'], [8.5, 13.1, 'left'],
  ],
  animated: [
    ['cake_fridge', 10.5, 1.6],
    ['coffee_steam', 4.8, 2.6],
  ],
  spawn: [9.8, 12.8],
});

buildRoom({
  sceneKey: 'dorm',
  wallA: 'wallDormA', wallB: 'wallDormB', floor: 'floorDorm',
  furniture: [
    ['bed_green', 2, 1.6],
    ['bed_blue', 6, 1.6],
    ['bed_teal', 12, 1.6],
    ['bed_green', 16, 1.6],
    ['nightstand', 4.3, 2.4],
    ['nightstand', 14.3, 2.4],
    ['rug_pink', 8, 8.4, false],
    // armchair bottom (42px from ty) on the seat line — a seated agent draws
    // on top of the seat, the backrest rises above the head
    ['armchair_grey_r', 6, 7.25],
    ['armchair_grey_l', 12.2, 7.25],
    ['plant_palm', 1.2, 8],
    ['lamp_red', 18, 7.6],
    ['plant_pot', 18, 12],
  ],
  seats: [
    [2.8, 3.4, 'right', 'bed'], [6.8, 3.4, 'right', 'bed'],
    [12.8, 3.4, 'left', 'bed'], [16.8, 3.4, 'left', 'bed'],
    [6.9, 9.9, 'right'], [13, 9.9, 'left'],
  ],
  animated: [
    ['tv_news', 9, 0.4],
  ],
  spawn: [9.8, 12.8],
});

buildRoom({
  sceneKey: 'library',
  wallA: 'wallLibA', wallB: 'wallLibB', floor: 'floorLib',
  furniture: [
    ['bookshelf_a', 1, 0.7],
    ['bookshelf_b', 4, 0.7],
    ['bookshelf_a', 7, 0.7],
    ['bookshelf_narrow', 10, 0.4],
    ['bookshelf_b', 11.5, 0.7],
    ['bookshelf_a', 14.5, 0.7],
    ['chalkboard', 17.6, 0.4, false],
    ['lectern', 9.4, 4],
    ['globe', 1.4, 5],
    ['lamp_red', 18, 4.6],
    ['table_plain', 4, 7.5],
    ['chair_yellow_r', 2.4, 7.8, false],
    ['chair_yellow_l', 7.2, 7.8, false],
    ['table_plain', 13, 7.5],
    ['chair_blue_r', 11.4, 7.8, false],
    ['chair_blue_l', 16.2, 7.8, false],
    ['plant_palm', 1.2, 10.5],
    ['plant_pot', 18, 12],
  ],
  seats: [
    [3.2, 9.6, 'right'], [8, 9.6, 'left'],
    [12.2, 9.6, 'right'], [17, 9.6, 'left'],
  ],
  animated: [
    ['cuckoo_clock', 13, 0.3],
  ],
  spawn: [9.8, 12.8],
});
