import {
  getIsoWeekStart,
  getIsoWeekStartDateString,
  getUtcDateString,
} from "../week";

describe("week utilities", () => {
  it("returns Monday 00:00 UTC for a midweek date without mutating input", () => {
    const reference = new Date("2026-05-27T15:30:00.000Z");
    const originalTime = reference.getTime();

    const weekStart = getIsoWeekStart(reference);

    expect(reference.getTime()).toBe(originalTime);
    expect(weekStart.toISOString()).toBe("2026-05-25T00:00:00.000Z");
  });

  it("maps Sunday to the previous Monday", () => {
    const weekStart = getIsoWeekStart(new Date("2026-05-31T12:00:00.000Z"));

    expect(weekStart.toISOString()).toBe("2026-05-25T00:00:00.000Z");
  });

  it("builds stable UTC date keys for week and reset comparisons", () => {
    expect(getIsoWeekStartDateString(new Date("2026-05-27T15:30:00.000Z"))).toBe("2026-05-25");
    expect(getUtcDateString("2026-05-25T18:45:00.000Z")).toBe("2026-05-25");
  });
});
