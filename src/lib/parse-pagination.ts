/**
 * Safely parses `limit` and `offset` query parameters for paginated endpoints.
 *
 * Behaviour:
 *  - NaN (e.g. "abc", "") → falls back to the supplied default
 *  - limit is clamped to [1, 50]; offset is clamped to [0, ∞)
 *
 * Note: Math.max(1, NaN) === NaN in JS, so we must check isNaN explicitly
 * before clamping — the pattern used by the feed route (Math.min/Math.max
 * without an isNaN guard) silently passes NaN through and is also incorrect.
 */
export function parsePagination(
  rawLimit: string | null,
  rawOffset: string | null,
  defaultLimit = 20
): { limit: number; offset: number } {
  const parsedLimit = parseInt(rawLimit ?? "", 10);
  const limit = Number.isNaN(parsedLimit)
    ? defaultLimit
    : Math.min(50, Math.max(1, parsedLimit));

  const parsedOffset = parseInt(rawOffset ?? "", 10);
  const offset = Number.isNaN(parsedOffset) ? 0 : Math.max(0, parsedOffset);

  return { limit, offset };
}