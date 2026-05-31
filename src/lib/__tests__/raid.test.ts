import {
  calculateAttackScore,
  calculateDefenseScore,
  getRaidTitle,
  getStrengthEstimate,
} from "../raid";

describe("calculateAttackScore", () => {
  it("returns 0 for all-zero inputs", () => {
    const { total } = calculateAttackScore({
      weeklyContributions: 0,
      appStreak: 0,
      weeklyKudosGiven: 0,
    });
    expect(total).toBe(0);
  });

  it("calculates commits×3 + streak×1 + kudos×2", () => {
    const { total } = calculateAttackScore({
      weeklyContributions: 5,
      appStreak: 4,
      weeklyKudosGiven: 3,
    });
    expect(total).toBe(5 * 3 + 4 * 1 + 3 * 2); // 25
  });

  it("adds boost bonus correctly", () => {
    const { total } = calculateAttackScore({
      weeklyContributions: 5,
      appStreak: 0,
      weeklyKudosGiven: 0,
      boostBonus: 10,
    });
    expect(total).toBe(5 * 3 + 10); // 25
  });

  it("EMP shield reduces attack total by 20%", () => {
    const base = calculateAttackScore({
      weeklyContributions: 10,
      appStreak: 0,
      weeklyKudosGiven: 0,
    }).total;

    const withEmp = calculateAttackScore({
      weeklyContributions: 10,
      appStreak: 0,
      weeklyKudosGiven: 0,
      empShieldActive: true,
    }).total;

    expect(withEmp).toBe(Math.floor(base * 0.8));
  });
});

describe("calculateDefenseScore", () => {
  it("returns 0 for all-zero inputs", () => {
    const { total } = calculateDefenseScore({
      weeklyContributions: 0,
      appStreak: 0,
      weeklyKudosReceived: 0,
    });
    expect(total).toBe(0);
  });

  it("calculates commits×3 + streak×1 + kudos×1", () => {
    const { total } = calculateDefenseScore({
      weeklyContributions: 5,
      appStreak: 4,
      weeklyKudosReceived: 3,
    });
    expect(total).toBe(5 * 3 + 4 * 1 + 3 * 1); // 22
  });

  it("sabotage virus reduces defense by 30%", () => {
    const base = calculateDefenseScore({
      weeklyContributions: 10,
      appStreak: 0,
      weeklyKudosReceived: 0,
    }).total;

    const withVirus = calculateDefenseScore({
      weeklyContributions: 10,
      appStreak: 0,
      weeklyKudosReceived: 0,
      sabotageVirusActive: true,
    }).total;

    expect(withVirus).toBe(Math.floor(base * 0.7));
  });

  it("anti-missile gives +50% only on air attacks", () => {
    const base = calculateDefenseScore({
      weeklyContributions: 10,
      appStreak: 0,
      weeklyKudosReceived: 0,
    }).total;

    const vsAir = calculateDefenseScore({
      weeklyContributions: 10,
      appStreak: 0,
      weeklyKudosReceived: 0,
      antiMissileActive: true,
      isAirAttack: true,
    }).total;

    const vsGround = calculateDefenseScore({
      weeklyContributions: 10,
      appStreak: 0,
      weeklyKudosReceived: 0,
      antiMissileActive: true,
      isGroundAttack: true,
    }).total;

    expect(vsAir).toBe(Math.floor(base * 1.5));
    expect(vsGround).toBe(base);
  });

  it("anti-tank gives +50% only on ground attacks", () => {
    const base = calculateDefenseScore({
      weeklyContributions: 10,
      appStreak: 0,
      weeklyKudosReceived: 0,
    }).total;

    const vsGround = calculateDefenseScore({
      weeklyContributions: 10,
      appStreak: 0,
      weeklyKudosReceived: 0,
      antiTankActive: true,
      isGroundAttack: true,
    }).total;

    const vsAir = calculateDefenseScore({
      weeklyContributions: 10,
      appStreak: 0,
      weeklyKudosReceived: 0,
      antiTankActive: true,
      isAirAttack: true,
    }).total;

    expect(vsGround).toBe(Math.floor(base * 1.5));
    expect(vsAir).toBe(base);
  });
});

describe("getRaidTitle", () => {
  it("returns null at 0 XP", () => {
    expect(getRaidTitle(0)).toBeNull();
  });

  it("returns Pickpocket at 100 XP", () => {
    expect(getRaidTitle(100)).toBe("Pickpocket");
  });

  it("returns Burglar at 500 XP", () => {
    expect(getRaidTitle(500)).toBe("Burglar");
  });

  it("returns Heist Master at 2000 XP", () => {
    expect(getRaidTitle(2000)).toBe("Heist Master");
  });

  it("returns Kingpin at 10000 XP", () => {
    expect(getRaidTitle(10000)).toBe("Kingpin");
  });

  it("returns the highest qualifying title below a threshold", () => {
    expect(getRaidTitle(499)).toBe("Pickpocket");
  });
});

describe("getStrengthEstimate", () => {
  it("returns weak for score <= 15", () => {
    expect(getStrengthEstimate(0)).toBe("weak");
    expect(getStrengthEstimate(15)).toBe("weak");
  });

  it("returns medium for score 16–40", () => {
    expect(getStrengthEstimate(16)).toBe("medium");
    expect(getStrengthEstimate(40)).toBe("medium");
  });

  it("returns strong for score > 40", () => {
    expect(getStrengthEstimate(41)).toBe("strong");
    expect(getStrengthEstimate(999)).toBe("strong");
  });
});