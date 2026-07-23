/**
 * Calculates a timezone-agnostic seed based on UTC date.
 * Formatted as `${year}-${dayOfYear}` (e.g. "2026-203").
 */
export function getSeedForDate(date: Date): string {
  const year = date.getUTCFullYear();
  const start = new Date(Date.UTC(year, 0, 0));
  const diff = date.getTime() - start.getTime();
  const dayOfYear = Math.floor(diff / 86400000);
  return `${year}-${dayOfYear}`;
}

/**
 * Returns the seed for the current UTC date.
 */
export function getTodaySeed(): string {
  return getSeedForDate(new Date());
}

/**
 * Parses a UTC seed back into a UTC Date object representing 00:00:00 UTC of that day.
 */
export function seedToDate(seed: string): Date {
  const [year, day] = seed.split("-").map(Number);
  const d = new Date(Date.UTC(year, 0, 1));
  d.setUTCDate(day);
  return d;
}
