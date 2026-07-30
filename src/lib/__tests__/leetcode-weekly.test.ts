/**
 * Tests for fetchLeetCodeWeeklySubmissions and fetchLeetCodeAboutMe (Issue #1136 & #533).
 */
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import {
  fetchLeetCodeWeeklySubmissions,
  fetchLeetCodeAboutMe,
  LeetCodeFetchError,
} from "../leetcode";

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
    expect(result).toEqual({ data: 5, error: null });
  });

  it("returns a genuine 0 when the user has no recent submissions", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(calendarResponse({ [tenDaysAgoTs]: 99 })),
    );
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toEqual({ data: 0, error: null });
  });

  it("returns HTTP_ERROR when the API responds with a non-OK status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toEqual({ data: null, error: LeetCodeFetchError.HTTP_ERROR });
  });

  it("returns data: null, error: null when the calendar payload is missing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ data: { matchedUser: null } }),
      }),
    );
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toEqual({ data: null, error: null });
  });

  it("returns NETWORK_ERROR when fetch throws (network error)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toEqual({ data: null, error: LeetCodeFetchError.NETWORK_ERROR });
  });

  it("returns PARSE_ERROR when JSON parsing throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Invalid JSON");
        },
      }),
    );
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toEqual({ data: null, error: LeetCodeFetchError.PARSE_ERROR });
  });

  it("returns PARSE_ERROR when inner submissionCalendar string parsing throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: {
            matchedUser: {
              userCalendar: { submissionCalendar: "invalid-json" },
            },
          },
        }),
      }),
    );
    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(result).toEqual({ data: null, error: LeetCodeFetchError.PARSE_ERROR });
  });

  it("returns error when a year-boundary window has one failed year request", async () => {
    vi.setSystemTime(new Date("2026-01-02T12:00:00.000Z"));
    const jan1Ts = Math.floor(new Date("2026-01-01T00:00:00.000Z").getTime() / 1000);

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(calendarResponse({ [jan1Ts]: 3 }))
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchLeetCodeWeeklySubmissions("alice");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: null, error: LeetCodeFetchError.HTTP_ERROR });
  });
});

describe("fetchLeetCodeAboutMe", () => {
  it("returns aboutMe text on success", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          data: { matchedUser: { profile: { aboutMe: "LCC-12345" } } },
        }),
      }),
    );
    const result = await fetchLeetCodeAboutMe("alice");
    expect(result).toEqual({ data: "LCC-12345", error: null });
  });

  it("returns HTTP_ERROR when HTTP status is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({}) }),
    );
    const result = await fetchLeetCodeAboutMe("alice");
    expect(result).toEqual({ data: null, error: LeetCodeFetchError.HTTP_ERROR });
  });

  it("returns NETWORK_ERROR when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Network failure")));
    const result = await fetchLeetCodeAboutMe("alice");
    expect(result).toEqual({ data: null, error: LeetCodeFetchError.NETWORK_ERROR });
  });

  it("returns PARSE_ERROR when response JSON parsing fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Bad JSON");
        },
      }),
    );
    const result = await fetchLeetCodeAboutMe("alice");
    expect(result).toEqual({ data: null, error: LeetCodeFetchError.PARSE_ERROR });
  });
});
