/**
 * Distributed sliding-window rate limiter backed by Upstash Redis.
 *
 * Replaces the previous per-process Map that was trivially bypassed on
 * multi-instance Vercel deployments (issue.
 *
 * Falls back to the in-process Map when UPSTASH_REDIS_REST_URL /
 * UPSTASH_REDIS_REST_TOKEN are absent (local dev without Redis).
 */

// ─── Upstash imports (tree-shaken away when unused) ─────────────────────────
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  reset: number; // Unix timestamp in ms
}

// ─── In-process fallback (local dev / CI) ────────────────────────────────────

interface Entry {
  count: number;
  resetAt: number;
}

const store = new Map<string, Entry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}

function rateLimitLocal(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  cleanup();

  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: Math.max(0, limit - 1), reset: now + windowMs };
  }

  if (entry.count >= limit) {
    return { ok: false, remaining: 0, reset: entry.resetAt };
  }

  entry.count++;
  return {
    ok: true,
    remaining: Math.max(0, limit - entry.count),
    reset: entry.resetAt,
  };
}

// ─── Upstash limiter cache (one Ratelimit instance per window config) ─────────

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// Cache Ratelimit instances keyed by `${limit}:${windowMs}` to avoid
// creating a new instance on every request (each carries its own Redis conn).
const limiterCache = new Map<string, Ratelimit>();

function getLimiter(limit: number, windowMs: number): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;

  const cacheKey = `${limit}:${windowMs}`;
  if (limiterCache.has(cacheKey)) return limiterCache.get(cacheKey)!;

  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(limit, `${windowMs} ms`),
    analytics: false,
    prefix: "lcc_rl", // "LeetCode City Rate Limit"
  });

  limiterCache.set(cacheKey, limiter);
  return limiter;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Check (and consume) one request against a sliding-window counter.
 *
 * Uses Upstash Redis when credentials are present (production).
 * Falls back to an in-process Map for local dev / CI.
 *
 * @param key      Unique identifier – usually `${ip}:${routeGroup}`
 * @param limit    Max requests allowed in `windowMs`
 * @param windowMs Window size in milliseconds
 */
export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  const limiter = getLimiter(limit, windowMs);

  if (!limiter) {
    // No Redis configured → fall back to local store (dev / CI)
    return rateLimitLocal(key, limit, windowMs);
  }

  const { success, remaining, reset } = await limiter.limit(key);

  return {
    ok: success,
    remaining: Math.max(0, remaining),
    // Upstash returns reset as a Unix timestamp in milliseconds
    reset: reset,
  };
}

// ─── Test helpers ─────────────────────────────────────────────────────────────

/** Clears the in-process fallback store. Only for use in tests. */
export function _resetLocalStoreForTesting(): void {
  store.clear();
  lastCleanup = Date.now();
}