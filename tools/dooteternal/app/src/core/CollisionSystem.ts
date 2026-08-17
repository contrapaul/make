import type { LevelData } from './LevelLoader';

/**
 * Circle-vs-grid collision. The player is a circle of PLAYER.radius on the XZ
 * plane; every solid cell is a 1 m axis-aligned box. Resolution pushes the
 * circle out along the shortest escape, which handles wall corners without the
 * catching that axis-at-a-time sliding produces.
 */
export class CollisionSystem {
  constructor(private readonly level: LevelData) {}

  /** Out-of-bounds counts as solid, so the player can never leave the grid. */
  isSolid(cellX: number, cellY: number): boolean {
    const row = this.level.walls[cellY];
    if (!row) return true;

    const cell = row[cellX];
    if (cell === undefined) return true;

    return cell !== 0;
  }

  /** Nudges (x, z) out of any solid cell it overlaps. Mutates nothing. */
  resolve(x: number, z: number, radius: number): { x: number; z: number } {
    let outX = x;
    let outZ = z;

    const minCellX = Math.floor(x - radius);
    const maxCellX = Math.floor(x + radius);
    const minCellY = Math.floor(z - radius);
    const maxCellY = Math.floor(z + radius);

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        if (!this.isSolid(cellX, cellY)) continue;

        const nearestX = Math.min(Math.max(outX, cellX), cellX + 1);
        const nearestZ = Math.min(Math.max(outZ, cellY), cellY + 1);
        const offsetX = outX - nearestX;
        const offsetZ = outZ - nearestZ;
        const distanceSq = offsetX * offsetX + offsetZ * offsetZ;

        if (distanceSq >= radius * radius) continue;

        if (distanceSq > 1e-8) {
          const distance = Math.sqrt(distanceSq);
          const push = radius - distance;
          outX += (offsetX / distance) * push;
          outZ += (offsetZ / distance) * push;
        } else {
          // Centre is inside the box: leave by the closest face.
          const toLeft = outX - cellX;
          const toRight = cellX + 1 - outX;
          const toTop = outZ - cellY;
          const toBottom = cellY + 1 - outZ;
          const shortest = Math.min(toLeft, toRight, toTop, toBottom);

          if (shortest === toLeft) outX = cellX - radius;
          else if (shortest === toRight) outX = cellX + 1 + radius;
          else if (shortest === toTop) outZ = cellY - radius;
          else outZ = cellY + 1 + radius;
        }
      }
    }

    return { x: outX, z: outZ };
  }
}
