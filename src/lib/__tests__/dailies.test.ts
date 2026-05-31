import { getDailyMissions, getTodayStr } from "../dailies";

describe("getDailyMissions", () => {
  const DEV_ID = 42;
  const DATE = "2026-05-31";

  it("always returns exactly 3 missions", () => {
    expect(getDailyMissions(DEV_ID, DATE)).toHaveLength(3);
  });

  it("always has checkin as the first mission", () => {
    expect(getDailyMissions(DEV_ID, DATE)[0].id).toBe("checkin");
  });

  it("is deterministic — same inputs always return same missions", () => {
    const a = getDailyMissions(DEV_ID, DATE);
    const b = getDailyMissions(DEV_ID, DATE);
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });

  it("returns different missions for different dates", () => {
    const day1 = getDailyMissions(DEV_ID, "2026-05-01").map((m) => m.id);
    const day2 = getDailyMissions(DEV_ID, "2026-05-02").map((m) => m.id);
    // Not guaranteed to differ on every seed, but statistically almost certain
    // Check across a range of dates
    const sets = Array.from({ length: 10 }, (_, i) =>
      getDailyMissions(DEV_ID, `2026-05-${String(i + 1).padStart(2, "0")}`).map((m) => m.id).join(",")
    );
    const unique = new Set(sets);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("excludes desktopOnly missions when isMobile is true", () => {
    // Run across many dev IDs and dates to ensure no desktopOnly slips through
    const desktopOnly = ["fly_score_50", "fly_score_150"];
    for (let i = 1; i <= 50; i++) {
      const missions = getDailyMissions(i, DATE, true);
      const ids = missions.map((m) => m.id);
      for (const id of desktopOnly) {
        expect(ids).not.toContain(id);
      }
    }
  });

  it("mobile and desktop sets can differ for the same seed", () => {
    let differ = false;
    for (let i = 1; i <= 100; i++) {
      const desktop = getDailyMissions(i, DATE, false).map((m) => m.id).join(",");
      const mobile = getDailyMissions(i, DATE, true).map((m) => m.id).join(",");
      if (desktop !== mobile) { differ = true; break; }
    }
    expect(differ).toBe(true);
  });

  it("returns no duplicate mission IDs", () => {
    const ids = getDailyMissions(DEV_ID, DATE).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("getTodayStr", () => {
  it("returns a string in YYYY-MM-DD format", () => {
    expect(getTodayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});