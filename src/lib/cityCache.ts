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

/**
 * Returns the current city cache if it exists and has not expired.
 * Cache expires after MAX_AGE_MS (5 minutes).
 *
 * @returns The cached CityCache object, or null if cache is absent or expired.
 */
export function getCityCache(): CityCache | null {
  if (!cache) return null;
  if (Date.now() - cache.timestamp > MAX_AGE_MS) {
    cache = null;
    return null;
  }
  return cache;
}

/**
 * Stores city data in the module-level cache singleton.
 * Automatically stamps the entry with the current timestamp.
 *
 * @param data - City data to cache (timestamp is added automatically).
 */
export function setCityCache(data: Omit<CityCache, "timestamp">) {
  cache = { ...data, timestamp: Date.now() };
}

/**
 * Clears the city cache singleton, forcing the next read to fetch fresh data.
 * Primarily useful in tests to reset state between test cases.
 */
export function clearCityCache() {
  cache = null;
}
