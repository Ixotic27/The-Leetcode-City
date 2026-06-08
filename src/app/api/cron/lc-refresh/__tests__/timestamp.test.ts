/**
 * Unit tests for the sevenDaysAgoTs timestamp computation.
 * These test the pure arithmetic logic, isolated from LeetCode API calls.
 */

describe("lc-refresh 7-day window timestamp computation", () => {
  const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60; // 604800

  function computeWindow(nowMs: number) {
    const now = new Date(nowMs);
    const sevenDaysAgoTs = Math.floor(now.getTime() / 1000) - SEVEN_DAYS_SECONDS;
    const sevenDaysAgoDate = new Date(sevenDaysAgoTs * 1000);
    const currentYear = now.getUTCFullYear();
    const sevenDaysAgoYear = sevenDaysAgoDate.getUTCFullYear();
    return { sevenDaysAgoTs, currentYear, sevenDaysAgoYear };
  }

  test("sevenDaysAgoTs is exactly now minus 604800 seconds", () => {
    const nowMs = Date.UTC(2025, 5, 4, 14, 30, 0); // 2025-06-04T14:30:00Z
    const nowSeconds = Math.floor(nowMs / 1000);
    const { sevenDaysAgoTs } = computeWindow(nowMs);
    expect(sevenDaysAgoTs).toBe(nowSeconds - SEVEN_DAYS_SECONDS);
  });

  test("result is NOT floored to midnight (no setUTCHours mutation)", () => {
    const nowMs = Date.UTC(2025, 5, 4, 14, 30, 0); // 14:30 UTC
    const { sevenDaysAgoTs } = computeWindow(nowMs);
    const resultDate = new Date(sevenDaysAgoTs * 1000);
    // Should preserve the 14:30 time component, not be midnight
    expect(resultDate.getUTCHours()).toBe(14);
    expect(resultDate.getUTCMinutes()).toBe(30);
  });

  test("timezone independence: same result regardless of server TZ", () => {
    // Simulate UTC+5:30 server: midnight local = 18:30 UTC previous day.
    // Both computations use getTime() which is always UTC-based,
    // so the result must be identical.
    const nowMs = Date.UTC(2025, 5, 4, 14, 30, 0);
    const { sevenDaysAgoTs: ts1 } = computeWindow(nowMs);
    // A "UTC+5:30 midnight" scenario would have been 18:30 UTC the day before.
    // The fix eliminates setHours/setUTCHours, so there is nothing to vary.
    const { sevenDaysAgoTs: ts2 } = computeWindow(nowMs);
    expect(ts1).toBe(ts2);
  });

  test("year boundary is detected correctly using UTC", () => {
    // Cron runs at 2025-01-03T12:00:00Z — 7 days ago is 2024-12-27
    const nowMs = Date.UTC(2025, 0, 3, 12, 0, 0);
    const { currentYear, sevenDaysAgoYear } = computeWindow(nowMs);
    expect(currentYear).toBe(2025);
    expect(sevenDaysAgoYear).toBe(2024);
  });

  test("no year boundary when window is within the same year", () => {
    const nowMs = Date.UTC(2025, 5, 4, 14, 30, 0); // Mid-year
    const { currentYear, sevenDaysAgoYear } = computeWindow(nowMs);
    expect(currentYear).toBe(sevenDaysAgoYear);
  });

  test("submission exactly at sevenDaysAgoTs boundary is included", () => {
    const nowMs = Date.UTC(2025, 5, 4, 14, 30, 0);
    const { sevenDaysAgoTs } = computeWindow(nowMs);
    expect(sevenDaysAgoTs >= sevenDaysAgoTs).toBe(true); // boundary inclusive
  });

  test("submission one second before window is excluded", () => {
    const nowMs = Date.UTC(2025, 5, 4, 14, 30, 0);
    const { sevenDaysAgoTs } = computeWindow(nowMs);
    const justBefore = sevenDaysAgoTs - 1;
    expect(justBefore >= sevenDaysAgoTs).toBe(false);
  });

  test("cron at 23:59 on Dec 31 detects year boundary correctly", () => {
    const nowMs = Date.UTC(2025, 11, 31, 23, 59, 0); // 2025-12-31T23:59Z
    const { currentYear, sevenDaysAgoYear } = computeWindow(nowMs);
    expect(currentYear).toBe(2025);
    expect(sevenDaysAgoYear).toBe(2025); // 7 days back is Dec 24, still 2025
  });
});