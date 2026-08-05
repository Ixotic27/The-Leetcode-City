/**
 * UTC calendar-date helpers for The Leetcode City.
 *
 * All day boundaries are computed in UTC so client local timezones and DST
 * transitions cannot shift "today" / "yesterday" relative to server-side
 * daily stats and streaks.
 */

/**
 * Returns the current UTC calendar date as a YYYY-MM-DD string pair.
 *
 * Uses a single Date instantiation so `today` and `yesterday` are
 * guaranteed to be derived from the same moment — they can never
 * drift relative to each other if a request straddles midnight.
 *
 * @returns `{ today, yesterday }` as `YYYY-MM-DD` strings. Yesterday is
 *   derived by decrementing the UTC date component via `Date.UTC` (not
 *   `Date.now() - 86_400_000`), so results are immune to DST transitions
 *   and millisecond-boundary drift on non-UTC servers.
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
