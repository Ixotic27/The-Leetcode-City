import type { CityBuilding, CityDecoration, CityPlaza } from "../github";

export interface WorldBounds {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface DistrictIsland {
  id: string;
  center: [number, number];
  width: number;
  depth: number;
  bounds: WorldBounds;
}

interface WorldContent {
  buildings: CityBuilding[];
  plazas: CityPlaza[];
  decorations: CityDecoration[];
  extraPoints?: [number, number, number][];
}

const SHORE_CLEARANCE = 80;

/** Terrain encloses occupied footprints; isolated landmarks get their own islets. */
export function buildDistrictIslands({ buildings, plazas, decorations, extraPoints = [] }: WorldContent): DistrictIsland[] {
  const groups = new Map<string, WorldBounds>();
  const include = (id: string, x: number, z: number, width: number, depth: number) => {
    if (![x, z, width, depth].every(Number.isFinite)) return;
    const bounds = groups.get(id) ?? { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity };
    bounds.minX = Math.min(bounds.minX, x - width / 2);
    bounds.maxX = Math.max(bounds.maxX, x + width / 2);
    bounds.minZ = Math.min(bounds.minZ, z - depth / 2);
    bounds.maxZ = Math.max(bounds.maxZ, z + depth / 2);
    groups.set(id, bounds);
  };

  for (const building of buildings) {
    include(building.district ?? "downtown", building.position[0], building.position[2], building.width, building.depth);
  }
  for (const plaza of plazas) {
    include(plaza.district ?? "downtown", plaza.position[0], plaza.position[2], plaza.size, plaza.size);
  }

  const addScenery = (position: [number, number, number], width: number, depth: number, id: string) => {
    let closest = id;
    let distance = 280;
    for (const [group, bounds] of groups) {
      const dx = Math.max(bounds.minX - position[0], 0, position[0] - bounds.maxX);
      const dz = Math.max(bounds.minZ - position[2], 0, position[2] - bounds.maxZ);
      const nextDistance = Math.hypot(dx, dz);
      if (nextDistance < distance) {
        closest = group;
        distance = nextDistance;
      }
    }
    include(closest, position[0], position[2], width, depth);
  };

  decorations.forEach((decoration, index) => {
    const [width, depth] = decoration.size ?? [80, 80];
    const cosine = Math.abs(Math.cos(decoration.rotation));
    const sine = Math.abs(Math.sin(decoration.rotation));
    addScenery(decoration.position, width * cosine + depth * sine, width * sine + depth * cosine, `scenery-${index}`);
  });
  extraPoints.forEach((position, index) => addScenery(position, 160, 160, `landmark-${index}`));

  return Array.from(groups, ([id, occupied]) => {
    const bounds = {
      minX: occupied.minX - SHORE_CLEARANCE,
      maxX: occupied.maxX + SHORE_CLEARANCE,
      minZ: occupied.minZ - SHORE_CLEARANCE,
      maxZ: occupied.maxZ + SHORE_CLEARANCE,
    };
    return {
      id,
      center: [(bounds.minX + bounds.maxX) / 2, (bounds.minZ + bounds.maxZ) / 2] as [number, number],
      width: bounds.maxX - bounds.minX,
      depth: bounds.maxZ - bounds.minZ,
      bounds,
    };
  });
}
