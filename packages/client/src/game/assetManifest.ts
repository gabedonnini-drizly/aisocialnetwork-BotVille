/**
 * Манифест LimeZu-ассетов. ЕДИНСТВЕННЫЙ источник правды о раскладке
 * спрайтшитов: файлы, размеры кадров, ряды направлений, кадры анимаций.
 * Раскладка верифицирована скриптами scripts/inspect-assets.mjs и
 * scripts/png-grid.mjs (см. docs/ASSETS.md) — НЕ менять числа на глаз.
 *
 * Пайплайн: scripts/sync-assets.mjs копирует нужные PNG из assets-src/
 * в public/assets/{sprites,tilesets}/limezu/ — пути ниже указаны
 * относительно public/.
 */

export type Direction = 'right' | 'up' | 'left' | 'down';

/** Порядок направлений в рядах LimeZu: right, up, left, down (по 6 кадров). */
export const DIRECTION_ORDER: Direction[] = ['right', 'up', 'left', 'down'];

export interface AvatarVariantDef {
  /** Значение agent.avatarVariant в БД. Не перенумеровывать! */
  id: number;
  kind: 'human' | 'animal';
  label: string;
  textureKey: string;
  /** Путь под public/ */
  file: string;
  frameWidth: number;
  frameHeight: number;
  /** Сколько колонок в листе (для пересчёта row -> кадр). */
  sheetColumns: number;
  /** Номер ряда кадров (в единицах frameHeight) для каждой анимации. */
  rows: {
    idle: number;
    walk: number;
    /** Только люди: ряд сидения (6 кадров вправо + 6 влево). */
    sit?: number;
    /** Только люди: ряд сна (6 кадров). */
    sleep?: number;
  };
  framesPerDirection: number;
  /** Во сколько раз увеличивать спрайт в сценах (мир рисуется 1:1, 16px тайл). */
  scale: number;
  /**
   * Пустые пиксели между ногами и нижним краем кадра, по направлениям.
   * У животных LimeZu боковые виды нарисованы выше низа кадра (корова 11px,
   * свинья 7px) — без компенсации спрайт «висит» над тенью. Замерено
   * по-кадрово по листам (ТЗ-08). Отсутствует = 0 (люди).
   */
  footGaps?: Record<Direction, number>;
}

/**
 * Люди: листы Premade_Character_NN.png 896x656, кадр 16x32, 56 колонок.
 * Ряды (в единицах 32px): 0 превью, 1 idle (r/u/l/d x6), 2 walk (x6),
 * 3 sleep, 4 sit-1 (6 вправо + 6 влево), 5 sit-2, 6 phone, 7 book.
 */
const HUMAN_SHEET = {
  frameWidth: 16,
  frameHeight: 32,
  sheetColumns: 56,
  rows: { idle: 1, walk: 2, sleep: 3, sit: 4 },
  framesPerDirection: 6,
  scale: 1,
} as const;

function human(id: number, n: number, label: string): AvatarVariantDef {
  const nn = String(n).padStart(2, '0');
  return {
    id,
    kind: 'human',
    label,
    textureKey: `char-premade-${nn}`,
    file: `assets/sprites/limezu/Premade_Character_${nn}.png`,
    ...HUMAN_SHEET,
    rows: { ...HUMAN_SHEET.rows },
  };
}

/**
 * Животные (Modern Farm, Animals_16x16): у каждого вида свой размер кадра
 * и своя раскладка рядов — у пса кадр 48x32 и между рядами анимаций идут
 * 16px полосы-подписи (IDLE/WALK/...), поэтому ряды задаются явно.
 * Направления r/u/l/d по 6 кадров, 24 колонки. Проверено по-кадрово (ТЗ-08).
 */
function animal(
  id: number,
  label: string,
  key: string,
  file: string,
  layout: {
    frameWidth: number;
    frameHeight: number;
    rows: { idle: number; walk: number };
    footGaps: Record<Direction, number>;
  },
): AvatarVariantDef {
  return {
    id,
    kind: 'animal',
    label,
    textureKey: key,
    file: `assets/sprites/limezu/${file}`,
    frameWidth: layout.frameWidth,
    frameHeight: layout.frameHeight,
    sheetColumns: 24,
    rows: layout.rows,
    framesPerDirection: 6,
    scale: 1,
    footGaps: layout.footGaps,
  };
}

/**
 * Варианты внешности агента. id хранится в agents.avatar_variant.
 * 0..11 — люди (12 разных premade), 12..15 — животные.
 * Старые агенты с variant 0..7 автоматически получают людей — маппинг совместим.
 */
export const AVATAR_VARIANTS: AvatarVariantDef[] = [
  human(0, 1, 'Alex'),
  human(1, 2, 'Amelia'),
  human(2, 4, 'Scout'),
  human(3, 6, 'Molly'),
  human(4, 7, 'Denny'),
  human(5, 8, 'Tex'),
  human(6, 9, 'Mr. Grey'),
  human(7, 10, 'Chef Rita'),
  human(8, 14, 'Grandpa Joe'),
  human(9, 15, 'Marco'),
  human(10, 18, 'Pinky'),
  human(11, 19, 'Officer Lu'),
  animal(12, 'Cow', 'animal-cow', 'Cow_16x16.png', {
    frameWidth: 48, frameHeight: 48, rows: { idle: 1, walk: 2 },
    footGaps: { right: 11, up: 0, left: 11, down: 1 },
  }),
  animal(13, 'Pig', 'animal-pig', 'Pig_Pink_16x16.png', {
    frameWidth: 32, frameHeight: 32, rows: { idle: 1, walk: 2 },
    footGaps: { right: 7, up: 1, left: 7, down: 3 },
  }),
  // лист пса: кадр 48x32, ряды с учётом полос-подписей (idle на y=64, walk на y=128)
  animal(14, 'Dog', 'animal-dog', 'Dog_Labrador_Brown_16x16.png', {
    frameWidth: 48, frameHeight: 32, rows: { idle: 2, walk: 4 },
    footGaps: { right: 1, up: 2, left: 1, down: 2 },
  }),
  animal(15, 'Chicken', 'animal-chicken', 'Chicken_White_16x16.png', {
    frameWidth: 16, frameHeight: 16, rows: { idle: 1, walk: 2 },
    footGaps: { right: 1, up: 1, left: 1, down: 1 },
  }),
];

export function getVariant(avatarVariant: number): AvatarVariantDef {
  return AVATAR_VARIANTS[
    ((avatarVariant % AVATAR_VARIANTS.length) + AVATAR_VARIANTS.length) % AVATAR_VARIANTS.length
  ];
}

/** Номер первого кадра анимации: ряд + направление -> кадр в спрайтшите. */
export function animStartFrame(
  v: AvatarVariantDef,
  anim: 'idle' | 'walk',
  dir: Direction,
): number {
  return v.rows[anim] * v.sheetColumns + DIRECTION_ORDER.indexOf(dir) * v.framesPerDirection;
}

/** Кадры sit для людей: 6 кадров вправо (side=right) или влево. */
export function sitFrames(v: AvatarVariantDef, side: 'right' | 'left'): number[] {
  if (v.rows.sit === undefined) return [];
  const start = v.rows.sit * v.sheetColumns + (side === 'left' ? v.framesPerDirection : 0);
  return Array.from({ length: v.framesPerDirection }, (_, i) => start + i);
}

/** Кадры sleep для людей (первые 6 кадров ряда, дальше в листе — кровати). */
export function sleepFrames(v: AvatarVariantDef): number[] {
  if (v.rows.sleep === undefined) return [];
  const start = v.rows.sleep * v.sheetColumns;
  return Array.from({ length: v.framesPerDirection }, (_, i) => start + i);
}

/** Единая схема ключей анимаций Phaser. */
export function animKey(
  v: AvatarVariantDef,
  anim: 'idle' | 'walk' | 'sit-right' | 'sit-left' | 'sleep',
  dir?: Direction,
): string {
  return dir ? `${v.textureKey}-${anim}-${dir}` : `${v.textureKey}-${anim}`;
}

/**
 * Эмоции/статусы: UI_thinking_emotes_animation_16x16.png (160x160).
 * Как ДВЕ текстуры из одного файла:
 *  - emote-think: кадры 16x32 (10 колонок, 5 рядов) — ряд 0 это анимация
 *    «думает»: точки вырастают в пузырь (кадры 0..9);
 *  - emote-icons: кадры 16x16 (10 колонок, 10 рядов) — ряды 4..9 это пары
 *    кадров иконок (двухкадровая пульсация).
 */
export const EMOTES = {
  file: 'assets/sprites/limezu/UI_thinking_emotes_animation_16x16.png',
  think: {
    textureKey: 'emote-think',
    frameWidth: 16,
    frameHeight: 32,
    /** Появление пузыря (кадры 4-5 в листе — клевер, 6-9 — служебная подпись) */
    appearFrames: [0, 1, 2, 3],
    /** Зацикленное «думание»: лёгкая пульсация пустого пузыря */
    loopFrames: [2, 3],
    frameRate: 6,
  },
  icons: {
    textureKey: 'emote-icons',
    frameWidth: 16,
    frameHeight: 16,
    /** Пары кадров по статусам агента (row*10+col). */
    byStatus: {
      work: [44, 45], // кирка
      task_running: [40, 41], // "!"
      task_done: [64, 65], // звёздочка
      chat_npc: [66, 67], // нота
      rest: [56, 57], // Z-z-z
      error: [50, 51], // красный "!"
    } as Record<string, [number, number]>,
    frameRate: 2,
  },
} as const;

/** Пиксельные UI-элементы (рамки, кнопки) — на будущее для React-оверлея. */
export const UI_SHEET = {
  file: 'assets/sprites/limezu/UI_16x16.png',
  frameWidth: 16,
  frameHeight: 16,
} as const;

/**
 * Анимированные объекты интерьеров (LimeZu animated). Ключ = имя объекта
 * в слое animated карт интерьеров. Кадры идут подряд с нулевого.
 */
export interface AnimatedObjectDef {
  file: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  frameRate: number;
}

export const ANIMATED_OBJECTS: Record<string, AnimatedObjectDef> = {
  coffee_steam: { file: 'assets/sprites/limezu/animated_coffee.png', frameWidth: 16, frameHeight: 32, frames: 6, frameRate: 4 },
  cake_fridge: { file: 'assets/sprites/limezu/animated_cake_fridge.png', frameWidth: 32, frameHeight: 48, frames: 14, frameRate: 3 },
  tv_news: { file: 'assets/sprites/limezu/animated_TV_reportage.png', frameWidth: 32, frameHeight: 32, frames: 36, frameRate: 5 },
  office_screen: { file: 'assets/sprites/limezu/animated_office_screen.png', frameWidth: 32, frameHeight: 32, frames: 6, frameRate: 3 },
  cuckoo_clock: { file: 'assets/sprites/limezu/animated_cuckoo_clock.png', frameWidth: 16, frameHeight: 32, frames: 10, frameRate: 4 },
};
