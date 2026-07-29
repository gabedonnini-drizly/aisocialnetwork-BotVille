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
  hairColor: string;
  /** One whole-garment axis; replaces the earlier separate top/bottom pair. */
  outfit: string;
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
}

export interface VenueSeat {
  at: TileCoord;
  side: 'right' | 'left';
  kind: 'chair' | 'stool' | 'bed';
}

export interface VenueAnimated { name: string; at: TileCoord }
export interface VenueDoor { name: string; at: TileCoord; targetVenue: string }
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

export interface VenueDescriptor {
  id: string;
  label: string;
  indoor: boolean;
  sizeTiles: [number, number];
  groundAtlas: string;
  capacity: number;
  ground?: VenueGround;
  generator?: VenueGenerator;
  furniture: VenueFurniture[];
  seats: VenueSeat[];
  spawns: TileCoord[];
  animated: VenueAnimated[];
  doors: VenueDoor[];
  glows: VenueGlow[];
}

/** The bake output the platform consumes. BotVille is its only authority (I-8). */
export interface PublishedVenue {
  id: string;
  label: string;
  indoor: boolean;
  capacity: number;
}
