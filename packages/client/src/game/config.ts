/**
 * Config constants for the game side. No magic numbers in scenes —
 * map sizes, speeds and the camera are tuned here.
 */

import type { VenueDescriptor } from '@botville/shared';

export const TILE_SIZE = 16;

/** TZ-16: how often to ask the server "who is where" + the server hour, ms. */
export const LOCATION_POLL_MS = 15_000;

/**
 * TZ-16: location (the server's truth) -> the scene that draws it.
 * That mapping is the venue registry's, not this file's: see `sceneForLocation`
 * and `sceneTargetFor` in venueRegistry.ts, and CLIENT_INTERNAL_LOCATIONS for
 * the farm pen, which lives on a district map and has no scene of its own.
 */

/** Leaving cosmetics (TZ-16): if the agent takes longer than this to reach the door — they vanish. */
export const LEAVE_WALK_TIMEOUT_MS = 9_000;

/**
 * A district map's geometry, READ FROM ITS VENUE rather than declared here.
 *
 * It used to be a `DISTRICT` constant holding 'district', 'district_ground'
 * and 48x46 — one district's dimensions, written down twice (the bake already
 * knows them) and impossible for a second district to be. Every value below
 * comes from the descriptor the bake wrote, and the map key IS the venue id
 * because that is what PreloaderScene loads the .tmj under.
 */
export interface DistrictGeometry {
  mapKey: string;
  tilesetName: string;
  widthTiles: number;
  heightTiles: number;
  widthPx: number;
  heightPx: number;
}

export function districtGeometry(venue: VenueDescriptor): DistrictGeometry {
  const [widthTiles, heightTiles] = venue.sizeTiles;
  return {
    mapKey: venue.id,
    tilesetName: venue.groundAtlas,
    widthTiles,
    heightTiles,
    widthPx: widthTiles * TILE_SIZE,
    heightPx: heightTiles * TILE_SIZE,
  };
}

export const WALK_SPEED = 48; // px/sec (16px tile, speed ~3 tiles/sec)

/**
 * Zoom ladder: clean multiples only. Non-integer zoom on 16px art produces
 * shimmer and uneven pixel size (spec §10.1) — the old step of 1.3 from
 * initialZoom 1.8 landed exactly there. The controls move rung by rung.
 */
export const ZOOM_LADDER: readonly number[] = [0.5, 1, 2, 3, 4] as const;

export const CAMERA = {
  initialZoom: 2,
  minZoom: ZOOM_LADDER[0],
  maxZoom: ZOOM_LADDER[ZOOM_LADDER.length - 1],
} as const;

/** The nearest rung of the ladder — for pinch and any arbitrary zoom. */
export function snapZoom(z: number): number {
  return ZOOM_LADDER.reduce((best, r) => (Math.abs(r - z) < Math.abs(best - z) ? r : best), ZOOM_LADDER[0]);
}

/** Exactly one rung up (+1) or down (-1), clamped at the ends. */
export function nextZoom(current: number, direction: 1 | -1): number {
  const i = ZOOM_LADDER.indexOf(snapZoom(current));
  return ZOOM_LADDER[Math.min(ZOOM_LADDER.length - 1, Math.max(0, i + direction))];
}

/** Camera drag controls (TZ-09, cameraControls.ts). */
export const CAMERA_DRAG = {
  /** Pointer movement below the threshold — click/tap, above — pan; screen px. */
  tapPx: 5,
  /** After a pinch — ignore taps so lifting a finger doesn't open an agent; ms. */
  pinchTapGuardMs: 150,
  /** Pan inertia: decay constant (sec) and start/stop threshold (px/sec). */
  inertiaTauSec: 0.25,
  inertiaMinSpeed: 60,
} as const;

/** Agent wandering: radius for picking a random point, px. */
export const WANDER_RADIUS = 120;

/** Depth of agent name labels — above props-above (tree crowns etc.). */
export const NAME_LABEL_DEPTH = 5000;

/** Game time: 1 real minute = 1 game hour. */
export const TIME = {
  msPerGameHour: 60_000,
  startHour: 10,
} as const;

/**
 * Key points of the district tint: hour -> overlay color/alpha.
 * Between points — linear lerp (wrapping around midnight): night holds
 * from 20:00 to 5:00, then dawn passes through pink to a transparent day.
 */
export const DAY_TINT_KEYS: ReadonlyArray<{ h: number; color: number; alpha: number }> = [
  { h: 5, color: 0x0a0a2e, alpha: 0.45 },    // end of night
  { h: 6.5, color: 0xff7799, alpha: 0.2 },   // dawn: pink
  { h: 8, color: 0xffbb99, alpha: 0 },       // morning: transparent
  { h: 17, color: 0xffbb99, alpha: 0 },      // day
  { h: 18.5, color: 0xff7328, alpha: 0.3 }, // sunset: orange peak
  { h: 20, color: 0x0a0a2e, alpha: 0.45 },   // night
];

/** Tint depth: above the map and agents, below glows and name labels. */
export const TINT_OVERLAY_DEPTH = 4000;

/** Night light: the glow activity window and fade smoothness (game hours). */
export const NIGHT_LIGHT = {
  start: 19,
  end: 6,
  fadeHours: 0.5,
} as const;

/** Glow sprite depth: above the tint, below name labels. */
export const GLOW_DEPTH = 4200;

/** Radial glow texture: generated once into a RenderTexture. */
export const GLOW_TEXTURE = { key: 'glow-radial', size: 64 } as const;

/** Kinds of light sources (radius in world px, alpha — maximum at night). */
export const GLOW_KINDS = {
  lamp: { color: 0xffcc88, radius: 36, alpha: 0.8 },
  window: { color: 0xffbb55, radius: 15, alpha: 0.55 },
  sign: { color: 0xffee99, radius: 22, alpha: 0.65 },
  headlight: { color: 0xffffcc, radius: 14, alpha: 0.85 },
} as const;
export type GlowKind = keyof typeof GLOW_KINDS;

/**
 * Agents' night routine (client-side cosmetics, no LLM).
 * Since TZ-16, WHERE an agent goes at night is decided by the server (world/agentLife.ts,
 * a mirror of these hours); the client keeps animals sleeping in the pen and dorm beds.
 */
export const NIGHT_SCHEDULE = {
  /** From this hour idle agents go to sleep. */
  sleepStart: 22,
  /** Wake-up window: everyone wakes at their own random hour from [wakeStart, wakeEnd). */
  wakeStart: 7,
  wakeEnd: 9,
  /** An agent woken by a click stays awake this many game hours. */
  snoozeHours: 2,
} as const;

/** Fade transition between scenes, ms. */
export const SCENE_FADE_MS = 300;

/** Camera focus on an agent when clicked in the HUD panel. */
export const CAMERA_FOCUS = { panMs: 600, zoom: 2 } as const;

/** Ambience: a car driving down the road every 30-45 sec. */
export const AMBIENT_CAR = {
  minIntervalSec: 30,
  maxIntervalSec: 45,
  /** The first car comes earlier so the scene feels alive right away. */
  firstDelaySec: 8,
  speed: 90, // px/sec
  /** Top of the car sprite: eastbound lane / southbound column. */
  rightLaneY: 344,
  downLaneX: 344,
} as const;

export const INTERIOR_TILESET = 'interiors_ground';
