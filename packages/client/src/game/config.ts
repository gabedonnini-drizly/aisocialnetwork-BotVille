/**
 * Конфиг-константы игровой части. Никаких магических чисел в сценах —
 * размеры карты, скорости и камера настраиваются здесь.
 */
import type { AgentLocation } from '@botville/shared';

export const TILE_SIZE = 16;

/** ТЗ-16: как часто спрашивать сервер «кто где» + серверный час, мс. */
export const LOCATION_POLL_MS = 15_000;

/**
 * ТЗ-16: локация (правда сервера) -> сцена, которая её рисует.
 * 'farm' — загон/двор фермы, живёт на карте района.
 */
export const LOCATION_SCENES: Record<AgentLocation, string> = {
  district: 'DistrictScene',
  farm: 'DistrictScene',
  office: 'OfficeScene',
  cafe: 'CafeScene',
  library: 'LibraryScene',
  dorm: 'DormScene',
} as const;

/** Косметика ухода (ТЗ-16): дольше этого агент к двери не идёт — исчезает. */
export const LEAVE_WALK_TIMEOUT_MS = 9_000;

/** Карта района (должно совпадать с scripts/build-district.mjs). */
export const DISTRICT = {
  mapKey: 'district',
  tilesetName: 'district_ground',
  widthTiles: 48,
  heightTiles: 46,
  get widthPx() { return this.widthTiles * TILE_SIZE; },
  get heightPx() { return this.heightTiles * TILE_SIZE; },
} as const;

export const WALK_SPEED = 48; // px/сек (16px тайл, скорость ~3 тайла/сек)

export const CAMERA = {
  initialZoom: 1.8,
  minZoom: 0.6,
  maxZoom: 4,
  zoomStep: 1.3,
} as const;

/** Драг-управление камерой (ТЗ-09, cameraControls.ts). */
export const CAMERA_DRAG = {
  /** Сдвиг указателя меньше порога — клик/tap, больше — пан; px экрана. */
  tapPx: 5,
  /** После pinch — игнор tap, чтобы отпускание пальца не открыло агента; мс. */
  pinchTapGuardMs: 150,
  /** Инерция пана: постоянная затухания (сек) и порог старта/остановки (px/сек). */
  inertiaTauSec: 0.25,
  inertiaMinSpeed: 60,
} as const;

/** Блуждание агентов: радиус выбора случайной точки, px. */
export const WANDER_RADIUS = 120;

/** Depth плашек имён агентов — поверх props-above (кроны деревьев и т.п.). */
export const NAME_LABEL_DEPTH = 5000;

/** Игровое время: 1 реальная минута = 1 игровой час. */
export const TIME = {
  msPerGameHour: 60_000,
  startHour: 10,
} as const;

/**
 * Ключевые точки тонировки района: час -> цвет/альфа overlay.
 * Между точками — линейный лерп (по кругу через полночь): ночь держится
 * с 20:00 до 5:00, дальше рассвет через розовый к прозрачному дню.
 */
export const DAY_TINT_KEYS: ReadonlyArray<{ h: number; color: number; alpha: number }> = [
  { h: 5, color: 0x0a0a2e, alpha: 0.45 },    // конец ночи
  { h: 6.5, color: 0xff7799, alpha: 0.2 },   // рассвет: розовый
  { h: 8, color: 0xffbb99, alpha: 0 },       // утро: прозрачный
  { h: 17, color: 0xffbb99, alpha: 0 },      // день
  { h: 18.5, color: 0xff7328, alpha: 0.3 }, // закат: оранжевый пик
  { h: 20, color: 0x0a0a2e, alpha: 0.45 },   // ночь
];

/** Depth тонировки: поверх карты и агентов, ниже глоу и плашек имён. */
export const TINT_OVERLAY_DEPTH = 4000;

/** Ночной свет: окно активности глоу и плавность включения (игровые часы). */
export const NIGHT_LIGHT = {
  start: 19,
  end: 6,
  fadeHours: 0.5,
} as const;

/** Depth глоу-спрайтов: поверх тонировки, ниже плашек имён. */
export const GLOW_DEPTH = 4200;

/** Радиальная глоу-текстура: генерится один раз в RenderTexture. */
export const GLOW_TEXTURE = { key: 'glow-radial', size: 64 } as const;

/** Виды источников света (radius в px мира, alpha — максимум ночью). */
export const GLOW_KINDS = {
  lamp: { color: 0xffcc88, radius: 36, alpha: 0.8 },
  window: { color: 0xffbb55, radius: 15, alpha: 0.55 },
  sign: { color: 0xffee99, radius: 22, alpha: 0.65 },
  headlight: { color: 0xffffcc, radius: 14, alpha: 0.85 },
} as const;
export type GlowKind = keyof typeof GLOW_KINDS;

/**
 * Ночной распорядок агентов (клиентская косметика, без LLM).
 * С ТЗ-16 КУДА агент уходит ночью решает сервер (world/agentLife.ts, зеркало
 * этих часов); клиенту остаётся сон животных в загоне и кровати в дорме.
 */
export const NIGHT_SCHEDULE = {
  /** С этого часа idle-агенты уходят спать. */
  sleepStart: 22,
  /** Окно пробуждения: каждый просыпается в свой случайный час из [wakeStart, wakeEnd). */
  wakeStart: 7,
  wakeEnd: 9,
  /** Разбуженный кликом агент бодрствует столько игровых часов. */
  snoozeHours: 2,
} as const;

/** Fade-переход между сценами, мс. */
export const SCENE_FADE_MS = 300;

/** Фокус камеры на агенте по клику в HUD-панели. */
export const CAMERA_FOCUS = { panMs: 600, zoom: 2.4 } as const;

/** Амбиент: машина, проезжающая по дороге раз в 30-45 сек. */
export const AMBIENT_CAR = {
  minIntervalSec: 30,
  maxIntervalSec: 45,
  /** Первая машина — раньше, чтобы сцена сразу жила. */
  firstDelaySec: 8,
  speed: 90, // px/сек
  /** Верх спрайта машины: полоса восточного хода / колонна южного. */
  rightLaneY: 344,
  downLaneX: 344,
} as const;

/** Интерьеры: сцена -> ключ карты (тайлмапы генерирует scripts/build-interiors.mjs). */
export const INTERIORS = {
  OfficeScene: 'office',
  CafeScene: 'cafe',
  DormScene: 'dorm',
  LibraryScene: 'library',
} as const;

export const INTERIOR_TILESET = 'interiors_ground';

/** Камера интерьера: комната 20x15 тайлов. */
export const INTERIOR_CAMERA_ZOOM = 2.4;

/** Ключи изображений мебели: имя = файл assets/sprites/limezu/interior/<имя>.png */
export const INTERIOR_IMAGES = [
  'bed_green', 'bed_blue', 'bed_teal', 'nightstand', 'rug_pink',
  'chair_blue_r', 'chair_blue_l', 'chair_red_r', 'chair_red_l',
  'chair_yellow_r', 'chair_yellow_l', 'table_plain',
  'armchair_grey_r', 'armchair_grey_l', 'armchair_blue_r', 'armchair_blue_l',
  'lamp_red', 'plant_palm',
  'bookshelf_a', 'bookshelf_b', 'bookshelf_narrow', 'lectern', 'globe', 'chalkboard',
  'counter_wide', 'stool', 'doormat',
  'plant_small', 'plant_pot', 'office_chair_right', 'office_chair_left',
  'whiteboard', 'printer', 'workstation_single', 'workstation_double', 'coffee_machine',
] as const;

/** Ключи изображений района: имя = файл assets/sprites/limezu/district/<имя>.png */
export const DISTRICT_IMAGES = [
  'office_building', 'cafe_building', 'villa_building', 'library_building', 'barn',
  'tree_oak_big', 'tree_oak_med', 'tree_birch',
  'street_lamp', 'bench', 'trash_can', 'hydrant',
  'car_right_1', 'car_left_1', 'car_right_2', 'car_down_1', 'car_down_2',
  'bush_1', 'bush_2',
  'crop_cabbage', 'crop_berry', 'soil_left', 'soil_mid', 'soil_right',
  'fence_top_left', 'fence_top_middle', 'fence_top_right',
  'fence_middle_left', 'fence_middle_right',
  'fence_bottom_left', 'fence_bottom_middle', 'fence_bottom_right',
] as const;
