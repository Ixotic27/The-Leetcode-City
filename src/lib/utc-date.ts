/**
 * Utility functions for generating UTC date strings.
 * These helpers ensure consistent date calculations without timezone or DST issues.
 */
/**
 * Returns the current UTC date and the previous UTC date.
 *
 * Uses a single Date instance to ensure both values are derived
 * from the same moment, preventing inconsistencies around midnight
 * and daylight saving time (DST) transitions.
 *
 * @returns An object containing:
 * - `today`: The current UTC date in YYYY-MM-DD format.
 * - `yesterday`: The previous UTC date in YYYY-MM-DD format.
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