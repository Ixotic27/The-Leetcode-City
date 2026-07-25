import type {
  CityBuilding,
  CityPlaza,
  CityDecoration,
  DistrictZone,
  CityRiver,
  CityBridge,
  CityCanal,
} from "@/lib/github";

interface CityCache {
  buildings: CityBuilding[];
  plazas: CityPlaza[];
  decorations: CityDecoration[];
  districtZones: DistrictZone[];
  river: CityRiver | null;
  bridges: CityBridge[];
  canals?: CityCanal[];
  stats: { total_developers: number; total_contributions: number };
  timestamp: number;
}

// Module-level singleton — survives Next.js client-side navigation
let cache: CityCache | null = null;

const MAX_AGE_MS = 5 * 60 * 1000; // 5 minutes

/** Returns the cached city data if present and not expired, otherwise null. */
export function getCityCache(): CityCache | null {
  if (!cache) return null;
  if (Date.now() - cache.timestamp > MAX_AGE_MS) {
    cache = null;
    return null;
  }
  return cache;
}

/** Stores city data in the module-level cache with a fresh timestamp. */
export function setCityCache(data: Omit<CityCache, "timestamp">) {
  cache = { ...data, timestamp: Date.now() };
}

/** Invalidates the module-level cache. */
export function clearCityCache() {
  cache = null;
}