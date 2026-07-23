import { describe, it, expect, vi, afterEach } from "vitest";
import { getTodaySeed, getSeedForDate, seedToDate } from "../fly-seed";

afterEach(() => {
  vi.useRealTimers();
});

function mockUtcDate(isoString: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(isoString));
}

describe("fly-seed utilities", () => {
  describe("getSeedForDate & getTodaySeed", () => {
    it("returns correct seed format on a standard day", () => {
      mockUtcDate("2026-07-22T11:00:00.000Z");
      const seed = getTodaySeed();
      // July 22 is the 203rd day of 2026 (non-leap year: 31+28+31+30+31+30+22 = 203)
      expect(seed).toBe("2026-203");
    });

    it("returns correct seed on Jan 1st", () => {
      mockUtcDate("2026-01-01T00:00:00.001Z");
      expect(getTodaySeed()).toBe("2026-1");
    });

    it("returns correct seed on Dec 31st of non-leap year", () => {
      mockUtcDate("2025-12-31T23:59:59.999Z");
      expect(getTodaySeed()).toBe("2025-365");
    });

    it("returns correct seed on Dec 31st of leap year", () => {
      mockUtcDate("2024-12-31T23:59:59.999Z");
      expect(getTodaySeed()).toBe("2024-366");
    });

    it("is timezone-independent using UTC time", () => {
      // 23:30 UTC on June 4 -> should calculate seed based on UTC date June 4 (day 155),
      // even if local timezone is ahead (e.g. UTC+9 making it June 5 locally)
      const date = new Date("2025-06-04T23:30:00.000Z");
      const seed = getSeedForDate(date);
      expect(seed).toBe("2025-155");
    });
  });

  describe("seedToDate", () => {
    it("converts Jan 1st seed to UTC Date object", () => {
      const date = seedToDate("2026-1");
      expect(date.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });

    it("converts mid-year seed to correct UTC Date object", () => {
      const date = seedToDate("2026-203");
      expect(date.toISOString()).toBe("2026-07-22T00:00:00.000Z");
    });

    it("converts Dec 31st seed of leap year to correct UTC Date", () => {
      const date = seedToDate("2024-366");
      expect(date.toISOString()).toBe("2024-12-31T00:00:00.000Z");
    });
  });
});
