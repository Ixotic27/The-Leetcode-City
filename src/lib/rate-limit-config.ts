/**
 * Configuration module for rate limiter window durations and limits.
 * Reads settings from environment variables with safe numeric fallback defaults.
 */

/**
 * Parses a string value into a positive integer, returning `defaultValue` if invalid or <= 0.
 */
export function parseEnvPositiveInt(
  val: string | undefined,
  defaultValue: number,
): number {
  if (!val) return defaultValue;
  const parsed = parseInt(val, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
}

export interface RateLimitConfig {
  windowMs: number;
  defaultApiMax: number;
  defaultPageMax: number;
  webhooksMax: number;
  routeLimits: [prefix: string, maxRequests: number, windowMs: number][];
}

/**
 * Resolves the full rate limiting configuration from process environment variables.
 */
export function getRateLimitConfig(): RateLimitConfig {
  const windowMs = parseEnvPositiveInt(
    process.env.RATE_LIMIT_WINDOW_MS,
    60_000,
  );

  const defaultApiMax = parseEnvPositiveInt(
    process.env.RATE_LIMIT_MAX_REQUESTS || process.env.RATE_LIMIT_DEFAULT_API_MAX,
    60,
  );

  const defaultPageMax = parseEnvPositiveInt(
    process.env.RATE_LIMIT_DEFAULT_PAGE_MAX,
    120,
  );

  const webhooksMax = parseEnvPositiveInt(
    process.env.RATE_LIMIT_WEBHOOKS_MAX,
    1000,
  );

  const routeLimits: [string, number, number][] = [
    [
      "/api/customizations/upload",
      parseEnvPositiveInt(process.env.RATE_LIMIT_CUSTOMIZATIONS_UPLOAD_MAX, 5),
      windowMs,
    ],
    [
      "/api/customizations",
      parseEnvPositiveInt(process.env.RATE_LIMIT_CUSTOMIZATIONS_MAX, 10),
      windowMs,
    ],
    [
      "/api/sky-ads/track",
      parseEnvPositiveInt(process.env.RATE_LIMIT_SKY_ADS_TRACK_MAX, 30),
      windowMs,
    ],
    [
      "/api/sky-ads",
      parseEnvPositiveInt(process.env.RATE_LIMIT_SKY_ADS_MAX, 30),
      windowMs,
    ],
    [
      "/api/arena/submit",
      parseEnvPositiveInt(process.env.RATE_LIMIT_ARENA_SUBMIT_MAX, 10),
      windowMs,
    ],
    [
      "/api/arena",
      parseEnvPositiveInt(process.env.RATE_LIMIT_ARENA_MAX, 30),
      windowMs,
    ],
    [
      "/api/raid",
      parseEnvPositiveInt(process.env.RATE_LIMIT_RAID_MAX, 15),
      windowMs,
    ],
    [
      "/api/checkin",
      parseEnvPositiveInt(process.env.RATE_LIMIT_CHECKIN_MAX, 10),
      windowMs,
    ],
    [
      "/api/heartbeats",
      parseEnvPositiveInt(process.env.RATE_LIMIT_HEARTBEATS_MAX, 60),
      windowMs,
    ],
    [
      "/api/interactions/kudos",
      parseEnvPositiveInt(process.env.RATE_LIMIT_INTERACTIONS_KUDOS_MAX, 20),
      windowMs,
    ],
    [
      "/api/interactions/visit",
      parseEnvPositiveInt(process.env.RATE_LIMIT_INTERACTIONS_VISIT_MAX, 50),
      windowMs,
    ],
    [
      "/api/interactions",
      parseEnvPositiveInt(process.env.RATE_LIMIT_INTERACTIONS_MAX, 60),
      windowMs,
    ],
    [
      "/api/achievements",
      parseEnvPositiveInt(process.env.RATE_LIMIT_ACHIEVEMENTS_MAX, 30),
      windowMs,
    ],
    [
      "/api/loadout",
      parseEnvPositiveInt(process.env.RATE_LIMIT_LOADOUT_MAX, 10),
      windowMs,
    ],
    [
      "/api/feed",
      parseEnvPositiveInt(process.env.RATE_LIMIT_FEED_MAX, 30),
      windowMs,
    ],
    [
      "/api/checkout/status",
      parseEnvPositiveInt(process.env.RATE_LIMIT_CHECKOUT_STATUS_MAX, 40),
      windowMs,
    ],
    [
      "/api/checkout",
      parseEnvPositiveInt(process.env.RATE_LIMIT_CHECKOUT_MAX, 6),
      windowMs,
    ],
    [
      "/api/claim",
      parseEnvPositiveInt(process.env.RATE_LIMIT_CLAIM_MAX, 5),
      windowMs,
    ],
    [
      "/api/city",
      parseEnvPositiveInt(process.env.RATE_LIMIT_CITY_MAX, 30),
      windowMs,
    ],
    [
      "/api/dev/",
      parseEnvPositiveInt(process.env.RATE_LIMIT_DEV_MAX, 60),
      windowMs,
    ],
    [
      "/api/items",
      parseEnvPositiveInt(process.env.RATE_LIMIT_ITEMS_MAX, 30),
      windowMs,
    ],
    [
      "/api/auth",
      parseEnvPositiveInt(process.env.RATE_LIMIT_AUTH_MAX, 10),
      windowMs,
    ],
  ];

  return {
    windowMs,
    defaultApiMax,
    defaultPageMax,
    webhooksMax,
    routeLimits,
  };
}
