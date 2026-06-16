/**
 * Tests for the distributed rate limiter.
 *
 * The Upstash SDK is mocked so tests run in CI without a live Redis instance.
 * Two scenarios are covered:
 *   1. Redis available (production path) — sliding-window enforced globally.
 *   2. Redis absent (local dev / CI fallback) — in-process Map used instead.
 *
 * The "multi-instance bypass" scenario is simulated by creating two separate
 * in-process stores (mimicking two cold-started Vercel instances) and verifying
 * the Redis-backed limiter still blocks the (N+1)th request even though each
 * local store has only seen ceil(total/2) requests.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// ─── Mock @upstash/redis and @upstash/ratelimit ───────────────────────────────

// We intercept module resolution before the module under test loads them.
const mockRedisConstructor = vi.fn();
const mockRatelimitConstructor = vi.fn();

// Shared mutable state to simulate a single Redis backend across "instances"
let sharedCallCount = 0;
let allowLimit = Infinity;

const mockLimit = vi.fn(async (_key: string) => {
  sharedCallCount++;
  const success = sharedCallCount <= allowLimit;
  return {
    success,
    remaining: Math.max(0, allowLimit - sharedCallCount),
    // reset ~60 s from now (in ms, matching Upstash format)
    reset: Date.now() + 60_000,
    limit: allowLimit,
    pending: Promise.resolve(),
  };
});

vi.mock("@upstash/redis", () => ({
  Redis: mockRedisConstructor,
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: Object.assign(
    function (this: unknown) {
      mockRatelimitConstructor();
      (this as Record<string, unknown>).limit = mockLimit;
    },
    {
      slidingWindow: vi.fn((_limit: number, _window: string) => ({
        type: "slidingWindow",
      })),
    },
  ),
}));

// ─── Module under test (imported AFTER mocks are wired up) ───────────────────

// We re-import between suites using dynamic import to reset module-level state.
// Vitest's module cache is cleared via `vi.resetModules()` in beforeEach.

describe("rateLimit – Redis backend (production path)", () => {
  let rateLimit: typeof import("../rate-limit").rateLimit;
  let _resetLocalStoreForTesting: typeof import("../rate-limit")._resetLocalStoreForTesting;

  beforeEach(async () => {
    vi.resetModules();
    sharedCallCount = 0;
    allowLimit = 5;

    // Provide fake credentials so the module picks the Redis path
    process.env.UPSTASH_REDIS_REST_URL = "https://fake.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "fake-token";

    ({ rateLimit, _resetLocalStoreForTesting } = await import("../rate-limit"));
    _resetLocalStoreForTesting();
  });

  afterEach(() => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
    vi.clearAllMocks();
  });

  it("allows requests within the limit", async () => {
    const result = await rateLimit("1.2.3.4:/api/claim", 5, 60_000);
    expect(result.ok).toBe(true);
    expect(result.remaining).toBeGreaterThanOrEqual(0);
  });

  it("blocks the (limit+1)th request", async () => {
    // Exhaust the limit
    for (let i = 0; i < 5; i++) {
      await rateLimit("1.2.3.4:/api/claim", 5, 60_000);
    }
    const blocked = await rateLimit("1.2.3.4:/api/claim", 5, 60_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("simulates the multi-instance bypass: Redis blocks even when each local store is under limit", async () => {
    /**
     * Scenario (issue #498):
     * - Limit is 5 requests per minute for /api/verify-leetcode.
     * - An attacker sends 6 requests distributed across 2 Vercel instances.
     * - Instance A sees 3 requests, Instance B sees 3 requests.
     * - The old in-process Map would allow all 6 (each instance only sees 3 < 5).
     * - The Redis-backed limiter sees all 6 atomically and blocks the 6th.
     *
     * We model "Instance B" by resetting the local fallback store (so it starts
     * fresh), but the shared mockLimit counter continues from where Instance A
     * left off — exactly like a shared Redis backend would behave.
     */
    allowLimit = 5;

    // "Instance A" — 3 requests
    for (let i = 0; i < 3; i++) {
      const r = await rateLimit("attacker:/api/verify-leetcode", 5, 60_000);
      expect(r.ok).toBe(true);
    }

    // "Instance B" — reset local store to simulate a fresh cold start
    _resetLocalStoreForTesting();

    // 3 more requests: the 6th total should be blocked at Redis
    const results = await Promise.all(
      [4, 5, 6].map(() => rateLimit("attacker:/api/verify-leetcode", 5, 60_000)),
    );

    const [r4, r5, r6] = results;
    expect(r4.ok).toBe(true);  // 4th overall — allowed
    expect(r5.ok).toBe(true);  // 5th overall — allowed (hits limit exactly)
    expect(r6.ok).toBe(false); // 6th overall — BLOCKED by Redis
  });

  it("returns a valid reset timestamp in milliseconds", async () => {
    const before = Date.now();
    const result = await rateLimit("1.2.3.4:/api/auth", 10, 60_000);
    expect(result.reset).toBeGreaterThanOrEqual(before);
  });
});

describe("rateLimit – local in-process fallback (no Redis configured)", () => {
  let rateLimit: typeof import("../rate-limit").rateLimit;
  let _resetLocalStoreForTesting: typeof import("../rate-limit")._resetLocalStoreForTesting;

  beforeEach(async () => {
    vi.resetModules();
    sharedCallCount = 0;

    // Ensure no Upstash env vars → fallback path
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    ({ rateLimit, _resetLocalStoreForTesting } = await import("../rate-limit"));
    _resetLocalStoreForTesting();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("never reports a negative remaining value", async () => {
    const result = await rateLimit("fallback-clamp-test", 0, 60_000);
    expect(result.remaining).toBe(0);
  });

  it("reports zero remaining after consuming the final allowed request", async () => {
    const result = await rateLimit("fallback-final-test", 1, 60_000);
    expect(result).toMatchObject({ ok: true, remaining: 0 });
  });

  it("blocks once the limit is exceeded", async () => {
    await rateLimit("fallback-block-test", 2, 60_000);
    await rateLimit("fallback-block-test", 2, 60_000);
    const third = await rateLimit("fallback-block-test", 2, 60_000);
    expect(third.ok).toBe(false);
  });

  it("does not share state between different keys", async () => {
    await rateLimit("key-a", 1, 60_000);
    const keyB = await rateLimit("key-b", 1, 60_000);
    expect(keyB.ok).toBe(true);
  });
});

describe("getClientIp IP extraction (via middleware logic — unit)", () => {
  /**
   * The IP extraction logic is pure and testable without spinning up Next.js.
   * We replicate the exact function from middleware.ts here so it can be tested
   * in isolation. If the function is ever exported from middleware, this can
   * import it directly.
   */
  function getClientIp(headers: Record<string, string | undefined>): string {
    const forwarded = headers["x-forwarded-for"];
    if (forwarded) {
      const ips = forwarded.split(",").map((s) => s.trim()).filter(Boolean);
      if (ips.length > 0) return ips[ips.length - 1];
    }
    return headers["x-real-ip"] ?? "unknown";
  }

  it("returns the LAST entry from x-forwarded-for (Vercel-appended real IP)", () => {
    const ip = getClientIp({
      "x-forwarded-for": "spoofed-ip, proxy-ip, 203.0.113.5",
    });
    expect(ip).toBe("203.0.113.5");
  });

  it("rejects a spoofed single-entry x-forwarded-for correctly", () => {
    // Attacker sends X-Forwarded-For: 1.1.1.1
    // Vercel prepends the real IP, so the header becomes: "1.1.1.1, 203.0.113.5"
    // We read the last entry: 203.0.113.5 — correct.
    const ip = getClientIp({
      "x-forwarded-for": "1.1.1.1, 203.0.113.5",
    });
    expect(ip).toBe("203.0.113.5");
  });

  it("falls back to x-real-ip when x-forwarded-for is absent", () => {
    const ip = getClientIp({ "x-real-ip": "198.51.100.7" });
    expect(ip).toBe("198.51.100.7");
  });

  it("returns 'unknown' when no IP headers are present", () => {
    const ip = getClientIp({});
    expect(ip).toBe("unknown");
  });

  it("handles an empty x-forwarded-for string gracefully", () => {
    const ip = getClientIp({ "x-forwarded-for": "   " });
    expect(ip).toBe("unknown");
  });
});