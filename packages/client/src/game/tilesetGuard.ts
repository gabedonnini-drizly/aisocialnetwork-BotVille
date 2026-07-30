/**
 * I-12: on a fresh clone the licensed art packs (assets/tilesets/pack,
 * assets/sprites/pack — see .gitignore) are absent, so every tileset PNG
 * 404s and Phaser's Tilemap#addTilesetImage returns null instead of a
 * Tileset. Scenes must still render the venue's LAYOUT — walls, doors,
 * agents, name labels — instead of crashing on
 * Tilemap#createLayer(layerName, null, ...).
 *
 * Pure type guard, no Phaser import: node --test can cover the decision even
 * though the actual createLayer() call needs a live Phaser.Tilemaps.Tileset
 * (that Phaser-side behavior is covered by `npm run build` plus the owner's
 * localhost art-free checkpoint, not here).
 */
export function hasGroundArt<T>(tileset: T | null | undefined): tileset is T {
  return tileset !== null && tileset !== undefined;
}
