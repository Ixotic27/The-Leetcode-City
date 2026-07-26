/**
 * Rate limit configuration driven by environment variables.
 * Allows ops team to tune limits without code changes.
 */
import { envInt, envBool } from "./env";

/** Enable Redis-backed rate limiting (requires UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN). */
export const RATE_LIMIT_USE_REDIS = envBool("RATE_LIMIT_USE_REDIS", true);

/** Max entries in the in-process fallback Map before cleanup runs. */
export const RATE_LIMIT_LOCAL_MAX_SIZE = envInt("RATE_LIMIT_LOCAL_MAX_SIZE", 10_000);

/** Per-route limit configurations. Extend as needed. */
export const RATE_LIMITS = {
  checkin:           { limit: envInt("RL_CHECKIN_LIMIT", 3),       windowMs: envInt("RL_CHECKIN_WINDOW_MS", 30_000) },
  checkinSuccess:     { limit: envInt("RL_CHECKIN_SUCCESS_LIMIT", 1), windowMs: envInt("RL_CHECKIN_SUCCESS_WINDOW_MS", 10_000) },
  checkout:           { limit: envInt("RL_CHECKOUT_LIMIT", 1),       windowMs: envInt("RL_CHECKOUT_WINDOW_MS", 10_000) },
  dailiesClaim:       { limit: envInt("RL_DAILIES_CLAIM_LIMIT", 2), windowMs: envInt("RL_DAILIES_CLAIM_WINDOW_MS", 10_000) },
  dailiesProgress:    { limit: envInt("RL_DAILIES_PROGRESS_LIMIT", 5), windowMs: envInt("RL_DAILIES_PROGRESS_WINDOW_MS", 10_000) },
  districtChange:     { limit: envInt("RL_DISTRICT_CHANGE_LIMIT", 2), windowMs: envInt("RL_DISTRICT_CHANGE_WINDOW_MS", 60_000) },
  flyScores:          { limit: envInt("RL_FLY_SCORES_LIMIT", 1),    windowMs: envInt("RL_FLY_SCORES_WINDOW_MS", 15_000) },
  kudos:             { limit: envInt("RL_KUDOS_LIMIT", 1),         windowMs: envInt("RL_KUDOS_WINDOW_MS", 1_000) },
  visit:             { limit: envInt("RL_VISIT_LIMIT", 2),          windowMs: envInt("RL_VISIT_WINDOW_MS", 1_000) },
  rabbit:             { limit: envInt("RL_RABBIT_LIMIT", 2),        windowMs: envInt("RL_RABBIT_WINDOW_MS", 1_000) },
} as const;
