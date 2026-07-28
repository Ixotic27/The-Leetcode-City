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
 * Retrieve the current in-memory city cache, if it exists and has not expired.
 *
 * The cache is considered stale after {@link MAX_AGE_MS} milliseconds (5 minutes)
 * from the time it was last populated. A stale cache is cleared automatically
 * before returning so subsequent writes start fresh.
 *
 * @returns The cached {@link CityCache} object, or `null` if the cache is empty
 *          or has expired.
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
 * Populate the in-memory city cache with fresh data.
 *
 * Automatically stamps the entry with the current time so that
 * {@link getCityCache} can enforce the 5-minute TTL. Any previously
 * cached value is overwritten.
 *
 * @param data - All {@link CityCache} fields except `timestamp`, which is
 *               set internally to `Date.now()`.
 */
export function setCityCache(data: Omit<CityCache, "timestamp">) {
  cache = { ...data, timestamp: Date.now() };
}

/**
 * Immediately invalidate the in-memory city cache.
 *
 * After this call, {@link getCityCache} will return `null` until
 * {@link setCityCache} is called again. Useful when data is known to be
 * stale (e.g. after a mutation) without waiting for the TTL to expire.
 */
export function clearCityCache() {
  cache = null;
}
