import {
  RAID_HISTORY_DEFAULT_LIMIT,
  RAID_HISTORY_MAX_LIMIT,
  parseRaidHistoryPagination,
} from "../raid-history";

describe("parseRaidHistoryPagination", () => {
  it("uses default pagination when query params are missing", () => {
    const result = parseRaidHistoryPagination(new URLSearchParams());

    expect(result).toEqual({ limit: RAID_HISTORY_DEFAULT_LIMIT, offset: 0 });
  });

  it("defaults invalid limit values instead of returning NaN", () => {
    const result = parseRaidHistoryPagination(new URLSearchParams("limit=abc&offset=abc"));

    expect(result).toEqual({ limit: RAID_HISTORY_DEFAULT_LIMIT, offset: 0 });
  });

  it("clamps negative limit and offset values to safe lower bounds", () => {
    const result = parseRaidHistoryPagination(new URLSearchParams("limit=-5&offset=-10"));

    expect(result).toEqual({ limit: 1, offset: 0 });
  });

  it("clamps large limits to the maximum supported page size", () => {
    const result = parseRaidHistoryPagination(new URLSearchParams("limit=500&offset=12"));

    expect(result).toEqual({ limit: RAID_HISTORY_MAX_LIMIT, offset: 12 });
  });
});
