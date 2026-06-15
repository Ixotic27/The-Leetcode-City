import { Redis } from "@upstash/redis";

interface Entry {
  count: number;
  resetAt: number;
}

const memStore = new Map<string, Entry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of memStore) {
    if (now > entry.resetAt) memStore.delete(key);
  }
}

let redisClient: Redis | null = null;
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
if (redisUrl && redisToken) {
  redisClient = new Redis({ url: redisUrl, token: redisToken });
}

export async function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ ok: boolean; remaining: number; reset: number }> {
  if (redisClient) {
    const windowKey = `rl:${key}`;
    const resetAt = Date.now() + windowMs;
    const count = await redisClient.incr(windowKey);
    if (count === 1) {
      await redisClient.expire(windowKey, Math.ceil(windowMs / 1000));
    }
    if (count > limit) {
      return { ok: false, remaining: 0, reset: resetAt };
    }
    return { ok: true, remaining: Math.max(0, limit - count), reset: resetAt };
  }

  cleanup();
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now > entry.resetAt) {
    memStore.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, remaining: Math.max(0, limit - 1), reset: now + windowMs };
  }
  if (entry.count >= limit) {
    return { ok: false, remaining: 0, reset: entry.resetAt };
  }
  entry.count++;
  return { ok: true, remaining: Math.max(0, limit - entry.count), reset: entry.resetAt };
}
