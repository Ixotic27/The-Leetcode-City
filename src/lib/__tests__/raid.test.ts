import {
  calculateAttackScore,
  calculateDefenseScore,
  getRaidConsumableToastMessage,
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

  it("calculates vehicle bonuses correctly", () => {
    const { total: totalTank, breakdown } = calculateAttackScore({
      weeklyContributions: 0,
      appStreak: 0,
      weeklyKudosGiven: 0,
      vehicle: "vehicle_tank",
    });
    expect(totalTank).toBe(10);
    expect(breakdown.vehicle_bonus).toBe(10);

    const { total: totalUFO } = calculateAttackScore({
      weeklyContributions: 0,
      appStreak: 0,
      weeklyKudosGiven: 0,
      vehicle: "raid_ufo",
    });
    expect(totalUFO).toBe(35);
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

describe("getRaidConsumableToastMessage", () => {
  it("returns null when no consumable was used", () => {
    expect(
      getRaidConsumableToastMessage({
        raid_id: "raid-1",
        success: true,
        attack_score: 10,
        defense_score: 5,
        attack_breakdown: { commits: 0, streak: 0, kudos: 0 },
        defense_breakdown: { commits: 0, streak: 0, kudos: 0 },
        attacker: { login: "a", avatar: null, position: [0, 0, 0], height: 20 },
        defender: { login: "b", avatar: null, position: [0, 0, 0], height: 20 },
        xp_earned: 50,
        new_raid_xp: 50,
        new_title: null,
        new_achievements: [],
        vehicle: "airplane",
        tag_style: "default",
      }),
    ).toBeNull();
  });

  it("returns a generic success message without boost value", () => {
    expect(
      getRaidConsumableToastMessage({
        raid_id: "raid-2",
        success: true,
        attack_score: 10,
        defense_score: 5,
        attack_breakdown: { commits: 0, streak: 0, kudos: 0, boost_item: "emp_device" },
        defense_breakdown: { commits: 0, streak: 0, kudos: 0 },
        attacker: { login: "a", avatar: null, position: [0, 0, 0], height: 20 },
        defender: { login: "b", avatar: null, position: [0, 0, 0], height: 20 },
        xp_earned: 50,
        new_raid_xp: 50,
        new_title: null,
        new_achievements: [],
        vehicle: "airplane",
        tag_style: "default",
      }),
    ).toBe("EMP Offense Device activated successfully.");
  });

  it("includes the effect when a boost value is returned", () => {
    expect(
      getRaidConsumableToastMessage({
        raid_id: "raid-3",
        success: true,
        attack_score: 25,
        defense_score: 5,
        attack_breakdown: { commits: 0, streak: 0, kudos: 0, boost_item: "raid_boost_large", boost: 25 },
        defense_breakdown: { commits: 0, streak: 0, kudos: 0 },
        attacker: { login: "a", avatar: null, position: [0, 0, 0], height: 20 },
        defender: { login: "b", avatar: null, position: [0, 0, 0], height: 20 },
        xp_earned: 50,
        new_raid_xp: 50,
        new_title: null,
        new_achievements: [],
        vehicle: "airplane",
        tag_style: "default",
      }),
    ).toBe("EMP Device activated! +25 raid power.");
  });
});