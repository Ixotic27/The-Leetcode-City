export interface BuildingData {
  id: string;
  x: number;        // world-space X position
  y: number;        // world-space Y position (or Z if isometric)
  [key: string]: unknown;
}

export interface Viewport {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Uniform spatial grid for O(1) average-case building lookup.
 * cellSize should roughly match the average spacing between buildings.
 */
export class SpatialGrid<T extends BuildingData> {
  private cells = new Map<string, T[]>();
  private cellSize: number;

  constructor(cellSize = 500) {
    this.cellSize = cellSize;
  }

  private cellKey(cx: number, cy: number): string {
    return `${cx}|${cy}`;
  }

  insert(item: T): void {
    const cx = Math.floor(item.x / this.cellSize);
    const cy = Math.floor(item.y / this.cellSize);
    const key = this.cellKey(cx, cy);
    if (!this.cells.has(key)) this.cells.set(key, []);
    this.cells.get(key)!.push(item);
  }

  /** Returns all items whose cell overlaps the given viewport (with optional padding). */
  query(viewport: Viewport, padding = 0): T[] {
    const minCX = Math.floor((viewport.minX - padding) / this.cellSize);
    const minCY = Math.floor((viewport.minY - padding) / this.cellSize);
    const maxCX = Math.floor((viewport.maxX + padding) / this.cellSize);
    const maxCY = Math.floor((viewport.maxY + padding) / this.cellSize);

    const results: T[] = [];
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const cell = this.cells.get(this.cellKey(cx, cy));
        if (cell) results.push(...cell);
      }
    }
    return results;
  }

  clear(): void {
    this.cells.clear();
  }
}