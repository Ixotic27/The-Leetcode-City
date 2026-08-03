/**
 * UTC date string utilities for the LeetCode City.
 *
 * Provides a reliable way to compute today's and yesterday's UTC date strings
 * without being affected by server-side DST transitions or request-boundary drift.
 */

/**
 * Returns the current UTC calendar date as a YYYY-MM-DD string.
 * Uses a single Date instantiation so `today` and `yesterday` are
 * guaranteed to be derived from the same moment — they can never
 * drift relative to each other if a request straddles midnight.
 *
 * @returns An object containing `today` and `yesterday` as YYYY-MM-DD strings.
 * @example
 * // On 2026-08-03 at 23:59 UTC returns { today: "2026-08-03", yesterday: "2026-08-02" }
 */
export function getUtcDateStrings(): { today: string; yesterday: string } {
  const now = new Date();

  const today = now.toISOString().split("T")[0];

  // Derive yesterday by decrementing the UTC date component directly.
  // This is immune to DST transitions and millisecond-boundary drift:
  //   - Date.now() - 86_400_000 assumes every day is exactly 86,400 s,
  //     which is false during DST transitions on non-UTC servers.
  //   - Date.UTC handles month/year/leap-year rollover automatically.
  const yesterdayDate = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() - 1
    )
  );
  const yesterday = yesterdayDate.toISOString().split("T")[0];

  return { today, yesterday };
}