import { TILE_SIZE } from './config.js';

/**
 * A simple A* over the tile grid (4 directions). The map is small (48x46),
 * so a synchronous search takes a fraction of a millisecond.
 */
export class Pathfinder {
  private walkable: boolean[];
  /**
   * Explicit fields, not parameter properties: `node --test` strips types but
   * cannot generate the assignment (ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX), and
   * the golden district baseline builds a real grid under node. Same reason
   * InteriorScene declares its `venue` field the long way.
   */
  private readonly width: number;
  private readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.walkable = new Array(width * height).fill(true);
  }

  block(tx: number, ty: number) {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return;
    this.walkable[ty * this.width + tx] = false;
  }

  /** Block every tile that intersects the given px rectangle. */
  blockRect(x: number, y: number, w: number, h: number) {
    const x0 = Math.floor(x / TILE_SIZE), y0 = Math.floor(y / TILE_SIZE);
    const x1 = Math.ceil((x + w) / TILE_SIZE) - 1, y1 = Math.ceil((y + h) / TILE_SIZE) - 1;
    for (let ty = y0; ty <= y1; ty++)
      for (let tx = x0; tx <= x1; tx++) this.block(tx, ty);
  }

  isWalkable(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.width || ty >= this.height) return false;
    return this.walkable[ty * this.width + tx];
  }

  isWalkablePx(x: number, y: number): boolean {
    return this.isWalkable(Math.floor(x / TILE_SIZE), Math.floor(y / TILE_SIZE));
  }

  /** A random walkable point (px) within a radius of the given one. */
  randomWalkableNear(px: number, py: number, radius: number): { x: number; y: number } {
    for (let i = 0; i < 24; i++) {
      const x = px + (Math.random() - 0.5) * 2 * radius;
      const y = py + (Math.random() - 0.5) * 2 * radius;
      if (this.isWalkablePx(x, y)) return { x, y };
    }
    return { x: px, y: py };
  }

  /**
   * Path between px points; returns px points at tile centers (excluding the start).
   * If no path is found — an empty array.
   */
  findPath(fromX: number, fromY: number, toX: number, toY: number): { x: number; y: number }[] {
    const sx = Math.floor(fromX / TILE_SIZE), sy = Math.floor(fromY / TILE_SIZE);
    let ex = Math.floor(toX / TILE_SIZE), ey = Math.floor(toY / TILE_SIZE);
    if (!this.isWalkable(ex, ey)) {
      const near = this.nearestWalkable(ex, ey);
      if (!near) return [];
      [ex, ey] = near;
    }
    if (!this.isWalkable(sx, sy)) {
      // the agent is stuck inside a collision — let them step out to the nearest free tile
      const near = this.nearestWalkable(sx, sy);
      if (!near) return [];
      const [nx, ny] = near;
      const rest = this.findPath(
        nx * TILE_SIZE + TILE_SIZE / 2, ny * TILE_SIZE + TILE_SIZE / 2, toX, toY,
      );
      return [{ x: nx * TILE_SIZE + TILE_SIZE / 2, y: ny * TILE_SIZE + TILE_SIZE / 2 }, ...rest];
    }

    const W = this.width, H = this.height;
    const open: number[] = [sy * W + sx];
    const came = new Int32Array(W * H).fill(-1);
    const gScore = new Float32Array(W * H).fill(Infinity);
    const fScore = new Float32Array(W * H).fill(Infinity);
    const closed = new Uint8Array(W * H);
    const hCost = (x: number, y: number) => Math.abs(x - ex) + Math.abs(y - ey);
    gScore[sy * W + sx] = 0;
    fScore[sy * W + sx] = hCost(sx, sy);

    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i;
      const cur = open.splice(bi, 1)[0];
      const cx = cur % W, cy = Math.floor(cur / W);
      if (cx === ex && cy === ey) {
        const path: { x: number; y: number }[] = [];
        let n = cur;
        while (n !== sy * W + sx) {
          path.unshift({
            x: (n % W) * TILE_SIZE + TILE_SIZE / 2,
            y: Math.floor(n / W) * TILE_SIZE + TILE_SIZE / 2,
          });
          n = came[n];
        }
        // the final point is the exact px destination
        if (path.length) path[path.length - 1] = { x: ex * TILE_SIZE + TILE_SIZE / 2, y: ey * TILE_SIZE + TILE_SIZE / 2 };
        return path;
      }
      closed[cur] = 1;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
        const nx = cx + dx, ny = cy + dy;
        if (!this.isWalkable(nx, ny)) continue;
        const ni = ny * W + nx;
        if (closed[ni]) continue;
        const g = gScore[cur] + 1;
        if (g < gScore[ni]) {
          came[ni] = cur;
          gScore[ni] = g;
          fScore[ni] = g + hCost(nx, ny);
          if (!open.includes(ni)) open.push(ni);
        }
      }
    }
    return [];
  }

  private nearestWalkable(tx: number, ty: number): [number, number] | null {
    for (let r = 1; r < 8; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (this.isWalkable(tx + dx, ty + dy)) return [tx + dx, ty + dy];
        }
      }
    }
    return null;
  }
}
