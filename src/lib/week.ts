export function getIsoWeekStart(referenceDate = new Date()): Date {
  const weekStart = new Date(referenceDate);
  const dayOfWeek = weekStart.getUTCDay();
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

  weekStart.setUTCDate(weekStart.getUTCDate() - daysSinceMonday);
  weekStart.setUTCHours(0, 0, 0, 0);

  return weekStart;
}

export function getIsoWeekStartDateString(referenceDate = new Date()): string {
  return getIsoWeekStart(referenceDate).toISOString().slice(0, 10);
}

export function getUtcDateString(referenceDate: Date | string): string {
  return new Date(referenceDate).toISOString().slice(0, 10);
}
