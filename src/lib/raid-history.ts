export const RAID_HISTORY_DEFAULT_LIMIT = 20;
export const RAID_HISTORY_MAX_LIMIT = 50;

export function parseRaidHistoryPagination(searchParams: URLSearchParams) {
  const rawLimit = Number.parseInt(
    searchParams.get("limit") ?? String(RAID_HISTORY_DEFAULT_LIMIT),
    10,
  );
  const rawOffset = Number.parseInt(searchParams.get("offset") ?? "0", 10);

  const limit = Number.isFinite(rawLimit)
    ? Math.min(RAID_HISTORY_MAX_LIMIT, Math.max(1, rawLimit))
    : RAID_HISTORY_DEFAULT_LIMIT;
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

  return { limit, offset };
}
