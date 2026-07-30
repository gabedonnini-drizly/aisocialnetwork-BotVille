/**
 * Types shared by the world bake, the agent bake and the Phaser runtime.
 * No logic, no I/O — a schema change here is a compile error, not a
 * runtime surprise (spec §4.3).
 */

/**
 * Re-exported, never redeclared — the definition is in schemaVersion.mjs so
 * that appearance/derive.mjs can reach it without a resolve hook (I-7).
 */
export { SCHEMA_VERSION } from '../schemaVersion.mjs';

// ── The immutable platform↔city boundary (spec §3.1) ────────────────────
// Four fields. They do not change when a venue is added, a pack is
// swapped, or the roster grows. Do not extend this interface.

export interface AgentPresence {
  /** platform agent uuid */
  id: string;
  displayName: string;
  /** stable, unique — the username. The only seed appearance derives from. */
  spriteSeed: string;
  /** null = absent; an id absent from the registry = unknown */
  venueId: string | null;
}

/** Exactly three states. The client never invents a fourth (I-3). */
export type PresenceState =
  | { kind: 'somewhere'; venueId: string }
  | { kind: 'absent' }
  | { kind: 'unknown' };

// ── Appearance ──────────────────────────────────────────────────────────

/** Silhouette family. Normalised from free-text `users.gender`; never branched on raw values. */
export type Build = 'masc' | 'fem' | 'neutral';

export interface AppearanceRecord {
  build: Build;
  skinTone: string;
  /** Sheet-selection axis: '01'..'07' — each Eyes_NN.png sheet IS the colour. */
  eyes: string;
  hairStyle: string;
  /** The style's own colour-variant file id (D-19): a pack variant, not a tint. */
  hairVariant: string;
  /** One whole-garment axis; replaces the earlier separate top/bottom pair. */
  outfit: string;
  /** The outfit style's own colour-variant file id (D-19). */
  outfitVariant: string;
  accessory: string;
}

// ── Venues ──────────────────────────────────────────────────────────────

export type TileCoord = [number, number];

export interface VenueFurniture {
  name: string;
  /** tile coordinates; fractional is legal and used throughout the existing maps */
  at: TileCoord;
  /** default true — set false for wall-mounted or walk-through props */
  collide?: boolean;
  /**
   * District-only rendering fields (Task 16/17, pre-dating this interface):
   * which layer the sprite draws on. Interior furniture omits this — it has
   * one implicit layer.
   */
  layer?: 'buildings' | 'props-above' | 'props-below';
  /** District building markers carry a human label for the map/door UI. */
  label?: string;
  /** District building markers that are also door targets carry this too. */
  targetVenue?: string;
  /** Free-form sub-kind, e.g. `street_lamp`'s `"lamp"` (drives glow wiring). */
  type?: string;
  /** Freeform authoring note (placement rationale) — never read by the bake. */
  note?: string;
}

export interface VenueSeat {
  at: TileCoord;
  side: 'right' | 'left';
  kind: 'chair' | 'stool' | 'bed';
}

export interface VenueAnimated { name: string; at: TileCoord }
export interface VenueDoor {
  name: string;
  at: TileCoord;
  targetVenue: string;
  /** District doors carry the doorway's pixel hit-box; interior doors omit it. */
  sizePx?: [number, number];
}
export interface VenueGlow { kind: 'lamp' | 'window' | 'sign' | 'headlight'; at: [number, number] }

/**
 * Ground for a simple rectangular room. Outdoor venues use `generator`
 * instead — a 48x46 procedural grid is not honest to express tile-by-tile.
 */
export interface VenueGround { wallA: string; wallB: string; floor: string }

export interface VenueGenerator {
  name: 'cityGrid';
  /** PRNG seed. Order of consumption is part of the contract — see Task 16. */
  seed: number;
  params: Record<string, unknown>;
}

/** The district's seeded scatter groups (Task 17) — bushes, fence runs, crop rows. */
export interface VenueScatterGroup {
  at?: TileCoord[];
  pick?: string[];
  prefix?: string;
  rows?: number;
  startTile?: TileCoord;
  step?: number;
  alternate?: string[];
  layer?: 'buildings' | 'props-above' | 'props-below';
}

/** The district's night-only sprites (sleeping animals, etc.), pixel-positioned. */
export interface VenueNightObject { name: string; atPx: [number, number] }

// ── Affordances (2026-07-29 addendum §I.1) ──────────────────────────────

/** What a venue IS to an agent's life. `home` marks a residence instance. */
export type VenueRole = 'home' | 'work' | 'hangout';

/**
 * One opening window, whole hours. Wrap-around follows the schedule
 * convention (addendum §I.1): split at midnight, so a venue open 22:00–02:00
 * carries TWO entries — { open: 22, close: 24 } and { open: 0, close: 2 }.
 * That rule is why the field is a list; the addendum's single-object example
 * is the common one-window case, rendered here as a one-entry list.
 */
export interface VenueHoursWindow { open: number; close: number }

export interface VenueDescriptor {
  id: string;
  label: string;
  indoor: boolean;
  sizeTiles: [number, number];
  groundAtlas: string;
  capacity: number;
  /** Which archetype stamped this venue. Hand-authored venues are their own archetype; omitted = `id`. */
  archetype?: string;
  /** Addendum §I.1: what the venue is to an agent's life. */
  roles: VenueRole[];
  /** Addendum §I.1: the activities it supports. Schedule slots query this, never ids. */
  affords: string[];
  /** Addendum §I.1 / D-12: opening windows. Outside them the venue is not a placement candidate. */
  hours: VenueHoursWindow[];
  ground?: VenueGround;
  generator?: VenueGenerator;
  furniture: VenueFurniture[];
  /** District-only seeded scatter groups (Task 17). */
  scatter?: Record<string, VenueScatterGroup>;
  seats: VenueSeat[];
  spawns: TileCoord[];
  animated: VenueAnimated[];
  doors: VenueDoor[];
  glows: VenueGlow[];
  /** District-only: sprites shown only during the night phase (Task 17). */
  night?: VenueNightObject[];
}

/**
 * The bake output the platform consumes. BotVille is its only authority (I-8).
 * Carries the addendum §I.1 affordance fields — they are the whole point of
 * the file: the platform's schedule writer places agents by querying them.
 */
export interface PublishedVenue {
  id: string;
  label: string;
  indoor: boolean;
  capacity: number;
  archetype: string;
  roles: VenueRole[];
  affords: string[];
  hours: VenueHoursWindow[];
}
