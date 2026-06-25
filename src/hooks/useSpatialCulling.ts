 
import { useMemo, useRef,useEffect } from "react";
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
  padding = 800
): CityBuilding[] {
  const gridRef = useRef<SpatialGrid | null>(null);
 
  // Rebuild grid only when the buildings array changes
 const grid = useMemo(() => {
    const g = new SpatialGrid(600);
    for (const b of allBuildings) g.insert(b);
    return g;
  }, [allBuildings]); // <--- useMemo cleanly ends here

  useEffect(() => {
    gridRef.current = grid;
  }, [grid]);
 
  // Query is cheap — runs on every viewport change
  return useMemo(
    () => grid.query(viewport, padding),
    [grid, viewport, padding]
  );
}
 