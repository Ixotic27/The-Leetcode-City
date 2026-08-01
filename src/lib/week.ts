/**
 * Returns the UTC start date (Monday) of the ISO week for the given date.
 *
 * @param referenceDate - Date used to determine the ISO week.
 * @returns The start of the ISO week in UTC.
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
 * Returns the ISO week start date as a YYYY-MM-DD string.
 *
 * @param referenceDate - Date used to determine the ISO week.
 * @returns ISO week start date in YYYY-MM-DD format.
 */

export function getIsoWeekStartDateString(referenceDate = new Date()): string {
  return getIsoWeekStart(referenceDate).toISOString().slice(0, 10);
}

/**
 * Converts a date into a UTC YYYY-MM-DD string.
 *
 * @param referenceDate - Date or date string to convert.
 * @returns UTC date formatted as YYYY-MM-DD.
 */

export function getUtcDateString(referenceDate: Date | string): string {
  return new Date(referenceDate).toISOString().slice(0, 10);
}
