#!/usr/bin/env node
/**
 * Шаг 2 ТЗ-01: генерация карты района.
 * Собирает из LimeZu-ассетов:
 *  1) атлас земли  -> public/assets/tilesets/limezu/district_ground.png
 *  2) виллу (кроп из 7_Villas) -> public/assets/sprites/limezu/district/villa_building.png
 *  3) карту Tiled JSON -> public/assets/tilemaps/district.tmj
 *
 * Все координаты исходных тайлов верифицированы скриптами разведки
 * (tile-strip.mjs + программная классификация) — см. docs/ASSETS.md.
 * Запускать после scripts/sync-assets.mjs.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodePng, createCanvas, encodePng } from './png-lib.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const SRC = join(ROOT, 'assets-src');
const PUB = join(ROOT, 'packages', 'client', 'public', 'assets');

// ------------------------------------------------------------------ атлас

const CITY = decodePng(join(SRC, 'exteriors/themes/2_City_Terrains_16x16.png'));
const TERR = decodePng(join(SRC, 'exteriors/themes/1_Terrains_and_Fences_16x16.png'));
const FARMT = decodePng(join(SRC, 'farm/16x16/1_Terrains_16x16.png'));

/** Тайлы атласа по порядку. gid = index + 1. Координаты — тайлы 16px в исходнике. */
const ATLAS_TILES = [
  ['grass', TERR, 1, 12],
  ['grassA', TERR, 3, 5],
  ['grassB', TERR, 4, 5],
  ['sideA', CITY, 9, 0],
  ['sideB', CITY, 10, 0],
  ['sideC', CITY, 11, 0],
  ['sideD', CITY, 12, 0],
  ['asphA', CITY, 0, 4],
  ['asphB', CITY, 1, 4],
  ['asphC', CITY, 2, 4],
  ['asphD', CITY, 3, 4],
  ['dashH', CITY, 12, 6],
  ['dashV', CITY, 11, 6],
  ['zebHa1', CITY, 7, 4],
  ['zebHb1', CITY, 8, 4],
  ['zebHa2', CITY, 7, 5],
  ['zebHb2', CITY, 8, 5],
  ['zebVa1', CITY, 5, 6],
  ['zebVb1', CITY, 6, 6],
  ['zebVa2', CITY, 5, 7],
  ['zebVb2', CITY, 6, 7],
  ['dirt', FARMT, 18, 5],
  ['dirtA', FARMT, 19, 5],
];
const GID = Object.fromEntries(ATLAS_TILES.map(([n], i) => [n, i + 1]));

const ATLAS_COLS = 8;
const atlasRows = Math.ceil(ATLAS_TILES.length / ATLAS_COLS);
const atlas = createCanvas(ATLAS_COLS * 16, atlasRows * 16);
ATLAS_TILES.forEach(([, img, tx, ty], i) => {
  atlas.blit(img, tx * 16, ty * 16, 16, 16, (i % ATLAS_COLS) * 16, Math.floor(i / ATLAS_COLS) * 16);
});
const atlasPath = join(PUB, 'tilesets/limezu/district_ground.png');
mkdirSync(dirname(atlasPath), { recursive: true });
writeFileSync(atlasPath, encodePng(atlas));

// ------------------------------------------------------- вилла (Dorm) кропом

const VILLAS = decodePng(join(SRC, 'exteriors/themes/7_Villas_16x16.png'));
{
  // Синяя вилла: регион до x=300, чтобы не зацепить красный домик справа
  const rx = 152, ry = 216, rw = 148, rh = 232;
  let minX = rw, minY = rh, maxX = -1, maxY = -1;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (VILLAS.px(rx + x, ry + y)[3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const w = maxX - minX + 1, h = maxY - minY + 1;
  const cv = createCanvas(w, h);
  cv.blit(VILLAS, rx + minX, ry + minY, w, h, 0, 0);
  const p = join(PUB, 'sprites/limezu/district/villa_building.png');
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, encodePng(cv));
  console.log(`villa_building.png: ${w}x${h}`);
}

// -------------------------------------------- библиотека: вывеска «BOOKS»

// В паке нет книжной вывески — штампуем стилизованную плашку в стиле
// MARKET (белая доска, тёмные буквы) на кромку стены здания.
{
  const FONT = {
    B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
    O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
    K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
    S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  };
  const TEXT = 'BOOKS';
  const lib = decodePng(join(SRC, 'exteriors/themes/4_Generic_Building_Singles_16x16/ME_Singles_Generic_Building_16x16_Hardware_Store.png'));
  const cv = createCanvas(lib.w, lib.h);
  cv.blit(lib, 0, 0, lib.w, lib.h, 0, 0);
  const textW = TEXT.length * 6 - 1;
  const plateW = textW + 8, plateH = 13;
  const px0 = Math.floor((lib.w - plateW) / 2), py0 = 85;
  const BORDER = [42, 42, 62, 255], PLATE = [233, 230, 238, 255], INK = [52, 52, 84, 255];
  for (let y = 0; y < plateH; y++) {
    for (let x = 0; x < plateW; x++) {
      const edge = x === 0 || y === 0 || x === plateW - 1 || y === plateH - 1;
      cv.set(px0 + x, py0 + y, edge ? BORDER : PLATE);
    }
  }
  TEXT.split('').forEach((ch, i) => {
    const glyph = FONT[ch];
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 5; x++)
        if (glyph[y][x] === '#') cv.set(px0 + 4 + i * 6 + x, py0 + 3 + y, INK);
  });
  const p = join(PUB, 'sprites/limezu/district/library_building.png');
  writeFileSync(p, encodePng(cv));
  console.log(`library_building.png: вывеска "${TEXT}"`);
}

// ------------------------------------------------------------------- карта

const W = 48, H = 46, T = 16;

// Дороги/тротуары в тайлах
const VR = { x0: 22, x1: 24 };            // вертикальная дорога
const HR = { y0: 21, y1: 23 };            // горизонтальная дорога
const VSW = [[20, 21], [25, 26]];         // вертикальные тротуары (пары колонок)
const HSW = [[19, 20], [24, 25]];         // горизонтальные тротуары (пары рядов)

// Ферма
const PEN = { x0: 36, y0: 2, x1: 47, y1: 18 }; // загон (по клеткам, включительно)
const GATE = { x0: 40, x1: 42 };               // проём в нижнем заборе

// Детерминированный PRNG, чтобы карта была воспроизводимой
let seed = 20260703;
const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const inVRoad = (x) => x >= VR.x0 && x <= VR.x1;
const inHRoad = (y) => y >= HR.y0 && y <= HR.y1;
const inVSw = (x) => VSW.some(([a, b]) => x >= a && x <= b);
const inHSw = (y) => HSW.some(([a, b]) => y >= a && y <= b);

// --- слой ground
const ground = new Array(W * H).fill(0);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    let g;
    if (inVRoad(x) || inHRoad(y)) {
      g = 0; // под дорогой ничего не видно — оставим пусто, дорога в слое roads
    } else if (inVSw(x) || inHSw(y)) {
      g = pick([GID.sideA, GID.sideA, GID.sideB, GID.sideC, GID.sideD]);
    } else if (x >= PEN.x0 && x <= PEN.x1 && y >= PEN.y0 && y <= PEN.y1) {
      g = pick([GID.dirt, GID.dirt, GID.dirtA]);
    } else {
      // вариантные тайлы травы из пака темнее базового — оставляем один базовый
      g = GID.grass;
    }
    ground[y * W + x] = g;
  }
}
// дорожки к дверям (вилла и библиотека)
const paveRect = (x0, y0, x1, y1) => {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++)
      ground[y * W + x] = pick([GID.sideA, GID.sideA, GID.sideB, GID.sideC]);
};
paveRect(8, 41, 9, 42);   // от двери виллы вниз
paveRect(10, 41, 19, 42); // и на восток к тротуару
paveRect(32, 36, 33, 37); // от двери библиотеки вниз
paveRect(27, 36, 31, 37); // и на запад к тротуару

// --- слой roads
const roads = new Array(W * H).fill(0);
const asphalt = () => pick([GID.asphA, GID.asphA, GID.asphB, GID.asphC, GID.asphD]);
for (let y = 0; y < H; y++)
  for (let x = 0; x < W; x++)
    if (inVRoad(x) || inHRoad(y)) roads[y * W + x] = asphalt();
// осевые пунктиры (кроме перекрёстка и зебр)
for (let x = 0; x < W; x += 2)
  if (!(x >= VR.x0 - 3 && x <= VR.x1 + 3)) roads[22 * W + x] = GID.dashH;
for (let y = 0; y < H; y += 2)
  if (!(y >= HR.y0 - 3 && y <= HR.y1 + 3)) roads[y * W + 23] = GID.dashV;
// зебры через вертикальную дорогу (горизонтальные полосы), на линиях тротуаров
for (const [ya, yb] of HSW) {
  for (let i = 0; i < 3; i++) {
    const x = VR.x0 + i;
    roads[ya * W + x] = i % 2 === 0 ? GID.zebHa1 : GID.zebHb1;
    roads[yb * W + x] = i % 2 === 0 ? GID.zebHa2 : GID.zebHb2;
  }
}
// зебры через горизонтальную дорогу (вертикальные полосы)
for (const [xa, xb] of VSW) {
  for (let y = HR.y0; y <= HR.y1; y++) {
    const odd = (y - HR.y0) % 2 === 1;
    roads[y * W + xa] = odd ? GID.zebVa2 : GID.zebVa1;
    roads[y * W + xb] = odd ? GID.zebVb2 : GID.zebVb1;
  }
}

// ---------------------------------------------------------------- объекты

let objId = 1;
const obj = (layerArr, name, x, y, w, h, props = {}, extra = {}) => {
  layerArr.push({
    id: objId++,
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
  });
};

const buildings = [];
const propsBelow = [];
const propsAbove = [];
const doors = [];
const spawns = [];
const collision = [];
const glows = [];
const nightObjs = [];

/**
 * Точка ночного света (слой glows): name = вид источника из GLOW_KINDS
 * клиента ('lamp' | 'window' | 'sign'). Координаты в px мира.
 */
const glow = (kind, x, y) => obj(glows, kind, x, y, 0, 0, {}, { point: true, type: kind });

// текстура-ключ = имя объекта; сцена создаёт image по имени
const IMG = (arr, tex, tx, ty, w, h, props = {}) => obj(arr, tex, tx * T, ty * T, w, h, props);

// --- здания (координаты в тайлах, размеры в px из PNG)
IMG(buildings, 'office_building', 4, 0, 192, 304, { targetScene: 'OfficeScene', label: 'Office' });
IMG(buildings, 'cafe_building', 29, 7, 112, 192, { targetScene: 'CafeScene', label: 'Café' });
IMG(buildings, 'villa_building', 5, 27, 152, 224, { targetScene: 'DormScene', label: 'Dorm' });
IMG(buildings, 'library_building', 30, 27, 128, 144, { targetScene: 'LibraryScene', label: 'Library' });
IMG(buildings, 'barn', 37, 2, 128, 160, { label: 'Farm' });

// --- двери (зоны клика, px)
obj(doors, 'office_door', 144, 288, 48, 16, { targetScene: 'OfficeScene' });
obj(doors, 'cafe_door', 496, 288, 48, 16, { targetScene: 'CafeScene' });
obj(doors, 'villa_door', 120, 640, 48, 16, { targetScene: 'DormScene' });
obj(doors, 'library_door', 512, 560, 48, 16, { targetScene: 'LibraryScene' });

// --- спавны (px, точки на тротуарах)
[[336, 316], [430, 316], [336, 410], [430, 410], [180, 318], [560, 410], [336, 200], [420, 520]]
  .forEach(([x, y], i) => obj(spawns, `spawn_${i}`, x, y, 0, 0, {}, { point: true }));

// --- ферма: забор по периметру загона с воротами
const fence = (part, tx, ty) => {
  IMG(propsAbove, `fence_${part}`, tx, ty, 16, 16);
  collisionRect(tx * T, ty * T + 6, 16, 10);
};
function collisionRect(x, y, w, h) { obj(collision, 'c', x, y, w, h); }

for (let x = PEN.x0 + 1; x < PEN.x1; x++) {
  fence('top_middle', x, PEN.y0);
  if (x < GATE.x0 || x > GATE.x1) fence('bottom_middle', x, PEN.y1);
}
for (let y = PEN.y0 + 1; y < PEN.y1; y++) {
  fence('middle_left', PEN.x0, y);
  fence('middle_right', PEN.x1, y);
}
fence('top_left', PEN.x0, PEN.y0);
fence('top_right', PEN.x1, PEN.y0);
fence('bottom_left', PEN.x0, PEN.y1);
fence('bottom_right', PEN.x1, PEN.y1);

// грядки в загоне (левый край, под сараем)
for (let i = 0; i < 3; i++) {
  const ty = 13 + i * 2;
  IMG(propsBelow, 'soil_left', 37, ty, 16, 32);
  IMG(propsBelow, 'soil_mid', 38, ty, 16, 32);
  IMG(propsBelow, 'soil_right', 39, ty, 16, 32);
  for (let c = 0; c < 3; c++) IMG(propsBelow, i % 2 === 0 ? 'crop_cabbage' : 'crop_berry', 37 + c, ty, 16, 16);
}

// --- деревья (кроны рисуются поверх агентов за счёт Y-sort)
const TREES = [
  ['tree_oak_big', 0, 1], ['tree_oak_big', 17, 12], ['tree_oak_med', 1, 13],
  ['tree_oak_big', 28, 0], ['tree_birch', 33, 3],
  ['tree_oak_med', 0, 26], ['tree_birch', 16, 27], ['tree_oak_big', 15, 33],
  ['tree_oak_big', 40, 27], ['tree_oak_med', 44, 31], ['tree_oak_big', 39, 36],
  ['tree_birch', 44, 40], ['tree_oak_med', 28, 40], ['tree_oak_big', 2, 40],
];
const TREE_SIZE = { tree_oak_big: [80, 96], tree_oak_med: [64, 80], tree_birch: [48, 64] };
for (const [tex, tx, ty] of TREES) {
  const [w, h] = TREE_SIZE[tex];
  IMG(propsAbove, tex, tx, ty, w, h);
  // коллизия — только ствол
  collisionRect(tx * T + w / 2 - 12, ty * T + h - 20, 24, 16);
}

// --- фонари вдоль тротуаров (type=lamp — по нему клиент вешает ночной глоу)
const LAMPS = [[6, 18], [15, 18], [30, 18], [40, 18], [6, 26], [15, 26], [33, 26], [44, 26], [19, 5], [19, 32], [27, 12], [27, 38]];
// голова фонаря в спрайте 32x64 (плафон свисает вправо от столба)
const LAMP_HEAD = { dx: 21, dy: 14 };
for (const [tx, ty] of LAMPS) {
  obj(propsAbove, 'street_lamp', tx * T, ty * T, 32, 64, {}, { type: 'lamp' });
  collisionRect(tx * T + 8, ty * T + 48, 16, 14);
  glow('lamp', tx * T + LAMP_HEAD.dx, ty * T + LAMP_HEAD.dy);
}

// --- ночные окна и вывески зданий (локальные px внутри PNG + офсет здания)
const BUILDING_GLOWS = [
  // офис LIME CORP: (64,0), 192x304
  { at: [64, 0], sign: [[125, 146]], windows: [[30, 170], [90, 170], [30, 202], [90, 202], [30, 234], [90, 234], [30, 266], [90, 266], [150, 180], [150, 240]] },
  // кафе MARKET: (464,112), 112x192
  { at: [464, 112], sign: [[56, 130]], windows: [[25, 158], [87, 158]] },
  // вилла (Dorm): (80,432), 152x224
  { at: [80, 432], sign: [], windows: [[36, 108], [100, 108], [46, 166], [112, 166]] },
  // библиотека BOOKS: (480,432), 128x144
  { at: [480, 432], sign: [[64, 91]], windows: [[20, 128], [64, 128], [108, 128]] },
];
for (const { at: [bx, by], sign, windows } of BUILDING_GLOWS) {
  for (const [x, y] of sign) glow('sign', bx + x, by + y);
  for (const [x, y] of windows) glow('window', bx + x, by + y);
}

// --- скамейки, урны, гидрант, кусты
IMG(propsAbove, 'bench', 33, 19, 32, 32); collisionRect(33 * T, 19 * T + 8, 32, 20);
IMG(propsAbove, 'bench', 12, 24, 32, 32); collisionRect(12 * T, 24 * T + 8, 32, 20);
IMG(propsAbove, 'bench', 42, 33, 32, 32); collisionRect(42 * T, 33 * T + 8, 32, 20);
IMG(propsAbove, 'trash_can', 36, 19, 32, 32); collisionRect(36 * T + 8, 19 * T + 12, 16, 16);
IMG(propsAbove, 'trash_can', 17, 24, 32, 32); collisionRect(17 * T + 8, 24 * T + 12, 16, 16);
IMG(propsAbove, 'hydrant', 17, 18, 16, 32); collisionRect(17 * T + 2, 18 * T + 20, 12, 10);
const BUSHES = [[3, 19], [10, 19], [28, 19], [38, 19], [3, 25], [16, 26], [29, 26], [35, 26], [46, 20]];
for (const [tx, ty] of BUSHES) {
  IMG(propsAbove, rnd() < 0.5 ? 'bush_1' : 'bush_2', tx, ty, 16, 16);
  collisionRect(tx * T + 2, ty * T + 6, 12, 10);
}

// --- припаркованные машины (на краю дорог)
IMG(propsAbove, 'car_right_1', 8, 22.6, 64, 48, {});
collisionRect(8 * T, 23 * T, 64, 24);
// красная — припаркована у северного бордюра (полукузовом на тротуаре)
IMG(propsAbove, 'car_left_1', 33, 19.1, 64, 48, {});
collisionRect(33 * T, 20 * T, 64, 28);
IMG(propsAbove, 'car_right_1', 42, 22.6, 64, 48, {});
collisionRect(42 * T, 23 * T, 64, 24);

// --- точки сна животных в загоне (свободная зона: правее грядок, ниже сарая)
[[656, 220], [700, 232], [672, 258], [726, 262]].forEach(([x, y]) =>
  obj(nightObjs, 'animal_sleep', x, y, 0, 0, {}, { point: true }));

// --- коллизии зданий
collisionRect(4 * T, 0, 192, 304);          // офис
collisionRect(29 * T, 7 * T, 112, 192);     // кафе
collisionRect(5 * T, 27 * T, 152, 224);     // вилла
collisionRect(30 * T, 27 * T, 128, 144);    // библиотека
collisionRect(37 * T, 2 * T, 128, 160);     // сарай
// границы карты
collisionRect(-16, 0, 16, H * T);
collisionRect(W * T, 0, 16, H * T);
collisionRect(0, -16, W * T, 16);
collisionRect(0, H * T, W * T, 16);

// ------------------------------------------------------------------- TMJ

const tileLayer = (name, data, id) => ({
  id, name, type: 'tilelayer', width: W, height: H,
  x: 0, y: 0, opacity: 1, visible: true, data,
});
const objLayer = (name, objects, id) => ({
  id, name, type: 'objectgroup', x: 0, y: 0, opacity: 1, visible: true,
  draworder: 'topdown', objects,
});

const map = {
  type: 'map',
  version: '1.10',
  tiledversion: '1.10.2',
  orientation: 'orthogonal',
  renderorder: 'right-down',
  width: W, height: H,
  tilewidth: T, tileheight: T,
  infinite: false,
  compressionlevel: -1,
  nextlayerid: 12,
  nextobjectid: objId,
  properties: [],
  tilesets: [{
    firstgid: 1,
    name: 'district_ground',
    image: '../tilesets/limezu/district_ground.png',
    imagewidth: atlas.w,
    imageheight: atlas.h,
    tilewidth: T, tileheight: T,
    tilecount: ATLAS_TILES.length,
    columns: ATLAS_COLS,
    margin: 0, spacing: 0,
  }],
  layers: [
    tileLayer('ground', ground, 1),
    tileLayer('roads', roads, 2),
    objLayer('props-below', propsBelow, 3),
    objLayer('buildings', buildings, 4),
    objLayer('props-above', propsAbove, 5),
    objLayer('doors', doors, 6),
    objLayer('spawns', spawns, 7),
    objLayer('collision', collision, 8),
    objLayer('glows', glows, 9),
    objLayer('night', nightObjs, 10),
  ],
};

const mapPath = join(PUB, 'tilemaps/district.tmj');
mkdirSync(dirname(mapPath), { recursive: true });
writeFileSync(mapPath, JSON.stringify(map));
console.log(`district.tmj: ${W}x${H}, атлас ${ATLAS_TILES.length} тайлов, объектов: ${objId - 1}`);
