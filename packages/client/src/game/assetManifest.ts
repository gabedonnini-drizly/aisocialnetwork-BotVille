/**
 * Manifest of LimeZu assets. The SINGLE source of truth for spritesheet
 * layout: files, frame sizes, direction rows, animation frames.
 * The layout has been verified by scripts/inspect-assets.mjs and
 * scripts/png-grid.mjs (see docs/ASSETS.md) — do NOT change numbers by eye.
 *
 * Pipeline: scripts/sync-assets.mjs and scripts/world-bake.mjs copy/bake the
 * needed PNGs from assets-src/ into public/assets/{sprites,tilesets}/pack/ —
 * the paths below are relative to public/.
 */

export type Direction = 'right' | 'up' | 'left' | 'down';

/** Order of directions in LimeZu rows: right, up, left, down (6 frames each). */
export const DIRECTION_ORDER: Direction[] = ['right', 'up', 'left', 'down'];

export interface AvatarVariantDef {
  /** Value of agent.avatarVariant in the DB. Do not renumber! */
  id: number;
  kind: 'human' | 'animal';
  label: string;
  textureKey: string;
  /** Path under public/ */
  file: string;
  frameWidth: number;
  frameHeight: number;
  /** How many columns the sheet has (to convert row -> frame). */
  sheetColumns: number;
  /** Frame row number (in frameHeight units) for each animation. */
  rows: {
    idle: number;
    walk: number;
    /** Humans only: sitting row (6 frames facing right + 6 facing left). */
    sit?: number;
    /** Humans only: sleeping row (6 frames). */
    sleep?: number;
  };
  framesPerDirection: number;
  /** Scale factor for the sprite in scenes (the world is drawn 1:1, 16px tiles). */
  scale: number;
  /**
   * Empty pixels between the feet and the bottom edge of the frame, per direction.
   * LimeZu animals' side views are drawn above the bottom of the frame (cow 11px,
   * pig 7px) — without compensation the sprite "hovers" above its shadow. Measured
   * frame by frame on the sheets (TZ-08). Absent = 0 (humans).
   */
  footGaps?: Record<Direction, number>;
}

/**
 * Humans: Premade_Character_NN.png sheets, 896x656, 16x32 frame, 56 columns.
 * Rows (in 32px units): 0 preview, 1 idle (r/u/l/d x6), 2 walk (x6),
 * 3 sleep, 4 sit-1 (6 right + 6 left), 5 sit-2, 6 phone, 7 book.
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
    file: `assets/sprites/pack/Premade_Character_${nn}.png`,
    ...HUMAN_SHEET,
    rows: { ...HUMAN_SHEET.rows },
  };
}

/**
 * Animals (Modern Farm, Animals_16x16): each species has its own frame size
 * and its own row layout — the dog's frame is 48x32 and its animation rows are
 * separated by 16px caption strips (IDLE/WALK/...), so rows are given explicitly.
 * Directions r/u/l/d, 6 frames each, 24 columns. Verified frame by frame (TZ-08).
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
    file: `assets/sprites/pack/${file}`,
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
 * Agent appearance variants. id is stored in agents.avatar_variant.
 * 0..11 — humans (12 different premades), 12..15 — animals.
 * Old agents with variant 0..7 automatically get humans — the mapping is compatible.
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
  // the dog's sheet: 48x32 frame, rows account for caption strips (idle at y=64, walk at y=128)
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

/** First frame number of an animation: row + direction -> frame in the spritesheet. */
export function animStartFrame(
  v: AvatarVariantDef,
  anim: 'idle' | 'walk',
  dir: Direction,
): number {
  return v.rows[anim] * v.sheetColumns + DIRECTION_ORDER.indexOf(dir) * v.framesPerDirection;
}

/** Sit frames for humans: 6 frames facing right (side=right) or left. */
export function sitFrames(v: AvatarVariantDef, side: 'right' | 'left'): number[] {
  if (v.rows.sit === undefined) return [];
  const start = v.rows.sit * v.sheetColumns + (side === 'left' ? v.framesPerDirection : 0);
  return Array.from({ length: v.framesPerDirection }, (_, i) => start + i);
}

/** Sleep frames for humans (first 6 frames of the row; the rest of the sheet is beds). */
export function sleepFrames(v: AvatarVariantDef): number[] {
  if (v.rows.sleep === undefined) return [];
  const start = v.rows.sleep * v.sheetColumns;
  return Array.from({ length: v.framesPerDirection }, (_, i) => start + i);
}

/** Unified scheme for Phaser animation keys. */
export function animKey(
  v: AvatarVariantDef,
  anim: 'idle' | 'walk' | 'sit-right' | 'sit-left' | 'sleep',
  dir?: Direction,
): string {
  return dir ? `${v.textureKey}-${anim}-${dir}` : `${v.textureKey}-${anim}`;
}

/**
 * Emotes/statuses: UI_thinking_emotes_animation_16x16.png (160x160).
 * Loaded as TWO textures from one file:
 *  - emote-think: 16x32 frames (10 columns, 5 rows) — row 0 is the
 *    "thinking" animation: dots grow into a bubble (frames 0..9);
 *  - emote-icons: 16x16 frames (10 columns, 10 rows) — rows 4..9 are pairs
 *    of icon frames (two-frame pulsing).
 */
export const EMOTES = {
  file: 'assets/sprites/pack/UI_thinking_emotes_animation_16x16.png',
  think: {
    textureKey: 'emote-think',
    frameWidth: 16,
    frameHeight: 32,
    /** Bubble appearing (frames 4-5 in the sheet are a clover, 6-9 — a caption strip) */
    appearFrames: [0, 1, 2, 3],
    /** Looped "thinking": a gentle pulse of the empty bubble */
    loopFrames: [2, 3],
    frameRate: 6,
  },
  icons: {
    textureKey: 'emote-icons',
    frameWidth: 16,
    frameHeight: 16,
    /**
     * The frame pairs per agent status are PACK-specific and live in
     * sources/<pack>.json (I-1). They are read from assets.generated.ts.
     */
    frameRate: 2,
  },
} as const;

/** Pixel-art UI elements (frames, buttons) — for a future React overlay. */
export const UI_SHEET = {
  file: 'assets/sprites/pack/UI_16x16.png',
  frameWidth: 16,
  frameHeight: 16,
} as const;

/**
 * Animated interior objects (LimeZu animated). Key = object name
 * in the animated layer of interior maps. Frames run consecutively from zero.
 */
export interface AnimatedObjectDef {
  file: string;
  frameWidth: number;
  frameHeight: number;
  frames: number;
  frameRate: number;
}

// sync-assets.mjs copies these under their CONTRACT name, not the (legacy,
// vendor-specific) source filename — see scripts/sync-assets.mjs.
export const ANIMATED_OBJECTS: Record<string, AnimatedObjectDef> = {
  coffee_steam: { file: 'assets/sprites/pack/coffee_steam.png', frameWidth: 16, frameHeight: 32, frames: 6, frameRate: 4 },
  cake_fridge: { file: 'assets/sprites/pack/cake_fridge.png', frameWidth: 32, frameHeight: 48, frames: 14, frameRate: 3 },
  tv_news: { file: 'assets/sprites/pack/tv_news.png', frameWidth: 32, frameHeight: 32, frames: 36, frameRate: 5 },
  office_screen: { file: 'assets/sprites/pack/office_screen.png', frameWidth: 32, frameHeight: 32, frames: 6, frameRate: 3 },
  cuckoo_clock: { file: 'assets/sprites/pack/cuckoo_clock.png', frameWidth: 16, frameHeight: 32, frames: 10, frameRate: 4 },
};
