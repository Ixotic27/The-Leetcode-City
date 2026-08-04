/**
 * Tests for fetchLeetCodeWeeklySubmissions (Issue #533).
 *
 * The contract: return a number on success (including a genuine 0 when the
 * developer made no submissions this week), and null on any failure so callers
 * preserve the existing contribution count instead of resetting it to 0.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fetchLeetCodeWeeklySubmissions } from "../leetcode";

const FIXED_NOW = "2025-06-04T12:00:00.000Z";

// Build a submissionCalendar response covering the last few days.
function calendarResponse(entries: Record<number, number>) {
  return {
    ok: true,
    json: async () => ({
      data: {
        matchedUser: {
          userCalendar: { submissionCalendar: JSON.stringify(entries) },
        },
      },
    }),
  };
}

// Midnight-UTC timestamps relative to FIXED_NOW.
const todayMidnightTs = Math.floor(new Date("2025-06-04T00:00:00.000Z").getTime() / 1000);
const twoDaysAgoTs = todayMidnightTs - 2 * 86400;
const tenDaysAgoTs = todayMidnightTs - 10 * 86400;

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FIXED_NOW));
});

describe("fetchLeetCodeWeeklySubmissions", () => {
  it("sums only submissions within the last 7 days", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        calendarResponse({ [twoDaysAgoTs]: 5, [tenDaysAgoTs]: 99 }),
      ),
    );
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toBe(5);
  });

  it("returns a genuine 0 when the user has no recent submissions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(calendarResponse({ [tenDaysAgoTs]: 99 })),
    );
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toBe(0);
  });

  it("returns null (not 0) when the API responds with a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toBeNull();
  });

  it("returns null (not 0) when the calendar payload is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { matchedUser: null } }),
      }),
    );
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toBeNull();
  });

  it("returns null (not 0) when fetch throws (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toBeNull();
  });

  it("returns null when a year-boundary window has one failed year request", async () => {
    // Early January: the 7-day window straddles the year boundary, so two
    // year requests are made. The first (current year) succeeds but the
    // second (previous year) fails. The current-year calendar alone is an
    // undercount of the window, so the function must return null rather than
    // overwrite the stored count with a partial total.
    vi.setSystemTime(new Date("2026-01-02T12:00:00.000Z"));
    const jan1Ts = Math.floor(new Date("2026-01-01T00:00:00.000Z").getTime() / 1000);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(calendarResponse({ [jan1Ts]: 3 })) // current year ok
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }); // prior year fails
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(fetchMock).toHaveBeenCalledTimes(2); // current year then prior year (which fails)
    expect(result).toBeNull();
  });
});
