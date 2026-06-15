import {
  xpForLevel,
  xpDeltaForLevel,
  levelFromXp,
  tierFromLevel,
  levelProgress,
  calculateLeetcodeXp,
  mergeBaseXp,
  xpForAchievementTier,
} from "../xp";

describe("xpForLevel", () => {
  it("returns 0 for level 1", () => {
    expect(xpForLevel(1)).toBe(0);
  });

  it("returns 0 for level 0 and below", () => {
    expect(xpForLevel(0)).toBe(0);
  });

  it("increases monotonically", () => {
    for (let i = 1; i < 25; i++) {
      expect(xpForLevel(i + 1)).toBeGreaterThan(xpForLevel(i));
    }
  });
});

describe("levelFromXp", () => {
  it("returns 1 for 0 XP", () => {
    expect(levelFromXp(0)).toBe(1);
  });

  it("round-trips with xpForLevel for all levels 1–25", () => {
    for (let level = 1; level <= 25; level++) {
      expect(levelFromXp(xpForLevel(level))).toBe(level);
    }
  });

  it("does not advance level on XP just below threshold", () => {
    const xpNeeded = xpForLevel(5);
    expect(levelFromXp(xpNeeded - 1)).toBe(4);
  });
});

describe("xpDeltaForLevel", () => {
  it("equals xpForLevel(n+1) - xpForLevel(n)", () => {
    for (let i = 1; i <= 10; i++) {
      expect(xpDeltaForLevel(i)).toBe(xpForLevel(i + 1) - xpForLevel(i));
    }
  });

  it("is always positive", () => {
    for (let i = 1; i <= 24; i++) {
      expect(xpDeltaForLevel(i)).toBeGreaterThan(0);
    }
  });
});

describe("tierFromLevel", () => {
  it("returns novice at level 1", () => {
    expect(tierFromLevel(1).id).toBe("novice");
  });

  it("returns apprentice at level 5", () => {
    expect(tierFromLevel(5).id).toBe("apprentice");
  });

  it("returns specialist at level 9", () => {
    expect(tierFromLevel(9).id).toBe("specialist");
  });

  it("returns expert at level 14", () => {
    expect(tierFromLevel(14).id).toBe("expert");
  });

  it("returns knight at level 19", () => {
    expect(tierFromLevel(19).id).toBe("knight");
  });

  it("returns guardian at level 24", () => {
    expect(tierFromLevel(24).id).toBe("guardian");
  });
});

describe("levelProgress", () => {
  it("returns 0 at exact level boundary", () => {
    expect(levelProgress(xpForLevel(5))).toBe(0);
  });

  it("returns a value between 0 and 1 mid-level", () => {
    const mid = Math.floor((xpForLevel(5) + xpForLevel(6)) / 2);
    const progress = levelProgress(mid);
    expect(progress).toBeGreaterThan(0);
    expect(progress).toBeLessThan(1);
  });

  it("returns 0 at 0 XP", () => {
    expect(levelProgress(0)).toBe(0);
  });
});

describe("calculateLeetcodeXp", () => {
  it("returns 0 for all-zero inputs", () => {
    expect(
      calculateLeetcodeXp({
        easy_solved: 0,
        medium_solved: 0,
        hard_solved: 0,
        contest_rating: 0,
        lc_streak: 0,
      })
    ).toBe(0);
  });

  it("does not award solved XP for invalid negative solved counts", () => {
    expect(
      calculateLeetcodeXp({
        easy_solved: -1,
        medium_solved: -2,
        hard_solved: -3,
        contest_rating: 0,
        lc_streak: 0,
      })
    ).toBe(0);
  });

  it("hard problems contribute more XP than easy", () => {
    const easy = calculateLeetcodeXp({ easy_solved: 10, medium_solved: 0, hard_solved: 0, contest_rating: 0, lc_streak: 0 });
    const hard = calculateLeetcodeXp({ easy_solved: 0, medium_solved: 0, hard_solved: 10, contest_rating: 0, lc_streak: 0 });
    expect(hard).toBeGreaterThan(easy);
  });

  it("contest rating below 1400 contributes 0 rating XP", () => {
    const withRating = calculateLeetcodeXp({ easy_solved: 0, medium_solved: 0, hard_solved: 0, contest_rating: 1399, lc_streak: 0 });
    const noRating = calculateLeetcodeXp({ easy_solved: 0, medium_solved: 0, hard_solved: 0, contest_rating: 0, lc_streak: 0 });
    expect(withRating).toBe(noRating);
  });

  it("streak contributes positively", () => {
    const withStreak = calculateLeetcodeXp({ easy_solved: 0, medium_solved: 0, hard_solved: 0, contest_rating: 0, lc_streak: 10 });
    expect(withStreak).toBeGreaterThan(0);
  });
});

describe("mergeBaseXp", () => {
  it("preserves earned XP when base XP increases (re-verification)", () => {
    // xp_github=1000, xp_total=1300 → earned=300; new base=1500 → 1800
    expect(mergeBaseXp(1300, 1000, 1500)).toBe(1800);
  });

  it("does not reset total to the new base XP", () => {
    expect(mergeBaseXp(1300, 1000, 1500)).not.toBe(1500);
  });

  it("returns the new base XP for a first-time verification (null prev)", () => {
    expect(mergeBaseXp(null, null, 1500)).toBe(1500);
    expect(mergeBaseXp(undefined, undefined, 1500)).toBe(1500);
  });

  it("treats no earned XP as base-only total", () => {
    // earned = 1000 - 1000 = 0 → total = new base
    expect(mergeBaseXp(1000, 1000, 1500)).toBe(1500);
  });

  it("preserves earned XP when base XP drops", () => {
    // earned = 300; reduced base 800 → 1100
    expect(mergeBaseXp(1300, 1000, 800)).toBe(1100);
  });

  it("treats missing/null XP values as zero", () => {
    expect(mergeBaseXp(undefined, 1000, 500)).toBe(500); // earned clamps to 0
    expect(mergeBaseXp(1300, undefined, 500)).toBe(1800); // earned = 1300
  });

  it("never produces negative XP when prev total is below prev base", () => {
    expect(mergeBaseXp(500, 1000, 300)).toBe(300); // earned clamped to 0
  });
});

describe("xpForAchievementTier", () => {
  it("returns correct XP for each tier", () => {
    expect(xpForAchievementTier("bronze")).toBe(10);
    expect(xpForAchievementTier("silver")).toBe(25);
    expect(xpForAchievementTier("gold")).toBe(50);
    expect(xpForAchievementTier("diamond")).toBe(100);
  });

  it("returns 0 for unknown tier", () => {
    expect(xpForAchievementTier("unknown")).toBe(0);
  });
});
