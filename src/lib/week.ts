/**
 * Helpers for deriving stable ISO-8601 week and UTC day keys.
 *
 * Every function here operates in UTC, so the values produced are identical
 * regardless of the server's local timezone. That matters because these
 * strings are stored and compared as database keys — the raid system uses
 * them for weekly raid cooldowns, weekly consumable-use limits, and
 * `last_reset_week` comparisons.
 */

/**
 * Returns the Monday 00:00:00.000 UTC that starts the ISO-8601 week
 * containing `referenceDate`.
 *
 * Behaviour:
 *  - Sunday maps back to the *previous* Monday. ISO weeks run Mon–Sun, but
 *    `getUTCDay()` reports Sunday as 0, so it is special-cased to 6 rather
 *    than being treated as the start of a new week.
 *  - Month and year boundaries roll over correctly, because `setUTCDate`
 *    normalises out-of-range day numbers (see the 2026-12-31 → 2026-12-28
 *    case in `__tests__/week.test.ts`, Issue #766).
 *  - `referenceDate` is copied before mutation, so the caller's Date is
 *    never modified.
 *
 * @param referenceDate - Any date inside the target week. Defaults to now.
 * @returns A new `Date` at Monday 00:00:00.000 UTC of that week.
 */
export function getIsoWeekStart(referenceDate = new Date()): Date {
  const weekStart = new Date(referenceDate);
  const dayOfWeek = weekStart.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
  weekStart.setUTCHours(0, 0, 0, 0);

  return weekStart;
}

/**
 * Returns the start of the ISO-8601 week as a `YYYY-MM-DD` string.
 *
 * Convenience wrapper over {@link getIsoWeekStart} for use as a stable
 * database key — two dates in the same ISO week always produce the same
 * string, which is what the weekly raid and reset queries compare on.
 *
 * @param referenceDate - Any date inside the target week. Defaults to now.
 * @returns That week's Monday formatted as `YYYY-MM-DD` (UTC).
 */
export function getIsoWeekStartDateString(referenceDate = new Date()): string {
  return getIsoWeekStart(referenceDate).toISOString().slice(0, 10);
}

/**
 * Formats a date as its `YYYY-MM-DD` UTC calendar day.
 *
 * Used to normalise timestamps read back from the database (which arrive as
 * ISO strings) before comparing them against a week or day key.
 *
 * Note: the value is passed straight to the `Date` constructor, so an
 * unparseable string yields an Invalid Date and `toISOString()` then throws
 * a `RangeError`. Callers are expected to pass a value they know is a valid
 * date, such as a timestamp column.
 *
 * @param referenceDate - A `Date`, or any string the `Date` constructor accepts.
 * @returns The UTC calendar date as `YYYY-MM-DD`.
 */
export function getUtcDateString(referenceDate: Date | string): string {
  return new Date(referenceDate).toISOString().slice(0, 10);
}
