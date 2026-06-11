import { describe, it, expect, vi, afterEach } from "vitest";
import { getUtcDateStrings } from "../utc-date";

afterEach(() => {
  vi.useRealTimers();
});

function mockUtcDate(isoString: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoString));
}

describe("getUtcDateStrings", () => {
  // ── today ────────────────────────────────────────────────────────────────────

  it("returns today as a YYYY-MM-DD UTC string", () => {
    mockUtcDate("2025-06-04T14:30:00.000Z");
    const { today } = getUtcDateStrings();
    expect(today).toBe("2025-06-04");
  });

  it("today reflects UTC date, not wall-clock local date", () => {
    // 23:30 UTC on June 4 — in UTC+1 this would be June 5 locally
    mockUtcDate("2025-06-04T23:30:00.000Z");
    const { today } = getUtcDateStrings();
    expect(today).toBe("2025-06-04");
  });

  // ── yesterday — normal cases ─────────────────────────────────────────────────

  it("yesterday is one UTC calendar day before today (mid-month)", () => {
    mockUtcDate("2025-06-04T12:00:00.000Z");
    const { today, yesterday } = getUtcDateStrings();
    expect(today).toBe("2025-06-04");
    expect(yesterday).toBe("2025-06-03");
  });

  it("yesterday rolls back across a month boundary", () => {
    mockUtcDate("2025-06-01T00:00:01.000Z");
    const { today, yesterday } = getUtcDateStrings();
    expect(today).toBe("2025-06-01");
    expect(yesterday).toBe("2025-05-31");
  });

  it("yesterday rolls back across a year boundary", () => {
    mockUtcDate("2025-01-01T00:00:00.001Z");
    const { today, yesterday } = getUtcDateStrings();
    expect(today).toBe("2025-01-01");
    expect(yesterday).toBe("2024-12-31");
  });

  // ── yesterday — leap year ────────────────────────────────────────────────────

  it("yesterday is Feb 29 when today is Mar 1 of a leap year", () => {
    mockUtcDate("2024-03-01T06:00:00.000Z");
    const { today, yesterday } = getUtcDateStrings();
    expect(today).toBe("2024-03-01");
    expect(yesterday).toBe("2024-02-29");
  });

  it("yesterday is Feb 28 when today is Mar 1 of a non-leap year", () => {
    mockUtcDate("2025-03-01T06:00:00.000Z");
    const { today, yesterday } = getUtcDateStrings();
    expect(today).toBe("2025-03-01");
    expect(yesterday).toBe("2025-02-28");
  });

  // ── yesterday — DST boundary robustness ─────────────────────────────────────

  it("yesterday is correct at the US DST spring-forward boundary (clocks skip 02:00→03:00 ET)", () => {
    // 2025-03-09T07:00:00Z = 02:00 ET just before spring-forward
    // 86_400_000ms subtraction from this timestamp gives 2025-03-08T07:00:00Z — correct
    // BUT if TZ is America/New_York, a naive local-date subtraction can give 2025-03-08 (correct by luck)
    // The UTC component approach is deterministic regardless of server TZ.
    mockUtcDate("2025-03-09T07:00:00.000Z");
    const { today, yesterday } = getUtcDateStrings();
    expect(today).toBe("2025-03-09");
    expect(yesterday).toBe("2025-03-08");
  });

  it("yesterday is correct at the US DST fall-back boundary (clocks repeat 01:00 ET)", () => {
    // 2025-11-02T06:00:00Z = 01:00 ET during fall-back hour
    // 86_400_000ms back = 2025-11-01T06:00:00Z — that's 25 hours before in wall-clock ET,
    // but still the correct UTC calendar day.
    mockUtcDate("2025-11-02T06:00:00.000Z");
    const { today, yesterday } = getUtcDateStrings();
    expect(today).toBe("2025-11-02");
    expect(yesterday).toBe("2025-11-01");
  });

  // ── atomicity — same Date instance ───────────────────────────────────────────

  it("today and yesterday always differ by exactly one calendar day", () => {
    mockUtcDate("2025-06-04T23:59:59.999Z");
    const { today, yesterday } = getUtcDateStrings();
    const diff =
      new Date(today).getTime() - new Date(yesterday).getTime();
    // Exactly 86_400_000 ms (one UTC day)
    expect(diff).toBe(86_400_000);
  });

  it("today and yesterday are never equal to each other", () => {
    mockUtcDate("2025-06-04T00:00:00.000Z");
    const { today, yesterday } = getUtcDateStrings();
    expect(today).not.toBe(yesterday);
  });

  // ── format ───────────────────────────────────────────────────────────────────

  it("both strings match YYYY-MM-DD format", () => {
    mockUtcDate("2025-06-04T10:00:00.000Z");
    const { today, yesterday } = getUtcDateStrings();
    const iso = /^\d{4}-\d{2}-\d{2}$/;
    expect(today).toMatch(iso);
    expect(yesterday).toMatch(iso);
  });
});