
import type { CityBuilding } from "@/lib/github";
 
export interface Viewport2D {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
}
 
/**
 * Uniform spatial grid for fast XZ-plane building queries.
 * Uses position[0] (X) and position[2] (Z) matching CityBuilding layout.
 */
export class SpatialGrid {
  private cells = new Map<string, CityBuilding[]>();
  private readonly cellSize: number;
 
  constructor(cellSize = 600) {
    this.cellSize = cellSize;
  }
 
  private key(cx: number, cz: number): string {
    return `${cx}|${cz}`;
  }
 
  insert(b: CityBuilding): void {
    const cx = Math.floor(b.position[0] / this.cellSize);
    const cz = Math.floor(b.position[2] / this.cellSize);
    const k = this.key(cx, cz);
    if (!this.cells.has(k)) this.cells.set(k, []);
    this.cells.get(k)!.push(b);
  }
 
  query(vp: Viewport2D, padding = 400): CityBuilding[] {
    const minCX = Math.floor((vp.minX - padding) / this.cellSize);
    const minCZ = Math.floor((vp.minZ - padding) / this.cellSize);
    const maxCX = Math.floor((vp.maxX + padding) / this.cellSize);
    const maxCZ = Math.floor((vp.maxZ + padding) / this.cellSize);
 
    const out: CityBuilding[] = [];
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cz = minCZ; cz <= maxCZ; cz++) {
        const cell = this.cells.get(this.key(cx, cz));
        if (cell) out.push(...cell);
      }
    }
    return out;
  }
 
  clear(): void {
    this.cells.clear();
  }
}