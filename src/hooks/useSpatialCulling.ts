
import { useMemo, useRef } from "react";
import { SpatialGrid, type Viewport2D } from "@/lib/spatialGrid";
import type { CityBuilding } from "@/lib/github";

/**
 * Builds a spatial grid from allBuildings (rebuilt only when buildings change),
 * then returns only buildings visible inside the current camera viewport.
 *
 * @param allBuildings  Full list of buildings from Supabase
 * @param viewport      Current XZ viewport derived from camera frustum
 * @param padding       Extra world-units buffer beyond viewport edges (prevents pop-in)
 */
export function useSpatialCulling(
  allBuildings: CityBuilding[],
  viewport: Viewport2D,
  padding = 400
): CityBuilding[] {
  const gridRef = useRef<SpatialGrid | null>(null);

  const grid = useMemo(() => {
    const g = new SpatialGrid(600);
    for (const b of allBuildings) g.insert(b);
    gridRef.current = g;
    return g;
  }, [allBuildings]);

  return useMemo(
    () => grid.query(viewport, padding),
    [grid, viewport, padding]
  );
}