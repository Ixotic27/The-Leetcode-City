/**
 * ISO 8601 week utilities for the LeetCode City calendar system.
 */

/**
 * Returns the Monday-based start of the ISO week for a given date.
 *
 * @param referenceDate - The date to compute the week start for (defaults to now)
 * @returns A Date set to 00:00:00 UTC on the Monday of the ISO week
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
 * Returns the Monday-based start of the ISO week as a YYYY-MM-DD string.
 *
 * @param referenceDate - The date to compute the week start for (defaults to now)
 * @returns A string in YYYY-MM-DD format representing the Monday of the ISO week
 */
export function getIsoWeekStartDateString(referenceDate = new Date()): string {
  return getIsoWeekStart(referenceDate).toISOString().slice(0, 10);
}

/**
 * Returns the UTC date portion of a Date or ISO string as YYYY-MM-DD.
 *
 * @param referenceDate - A Date object or an ISO-8601 string
 * @returns A string in YYYY-MM-DD format
 */
export function getUtcDateString(referenceDate: Date | string): string {
  return new Date(referenceDate).toISOString().slice(0, 10);
}
