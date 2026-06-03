const DEFAULT_RAID_HISTORY_LIMIT = 20;
const MIN_RAID_HISTORY_LIMIT = 1;
const MAX_RAID_HISTORY_LIMIT = 50;

export function parseRaidHistoryLimit(rawLimit: string | null): number {
  const parsedLimit = Number.parseInt(
    rawLimit ?? String(DEFAULT_RAID_HISTORY_LIMIT),
    10
  );

  if (Number.isNaN(parsedLimit)) {
    return DEFAULT_RAID_HISTORY_LIMIT;
  }

  return Math.max(
    MIN_RAID_HISTORY_LIMIT,
    Math.min(MAX_RAID_HISTORY_LIMIT, parsedLimit)
  );
}
