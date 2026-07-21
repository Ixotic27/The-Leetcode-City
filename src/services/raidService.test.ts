import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFindRaidAttackerForUser } = vi.hoisted(() => ({
  mockFindRaidAttackerForUser: vi.fn(),
}));

vi.mock("@/lib/raid-attacker", () => ({
  findRaidAttackerForUser: mockFindRaidAttackerForUser,
}));

vi.mock("@/lib/raid", () => ({
  calculateAttackScore: vi.fn(() => ({ total: 10, breakdown: {} })),
  calculateDefenseScore: vi.fn(() => ({ total: 5, breakdown: {} })),
  getRaidTitle: vi.fn(() => null),
  RAID_TAG_DURATION_DAYS: 7,
  XP_WIN_ATTACKER: 50,
  XP_WIN_DEFENDER: 20,
  XP_LOSE_DEFENDER: 10,
}));

vi.mock("@/lib/zones", () => ({
  ITEM_UNLOCK_LEVELS: {},
}));

vi.mock("@/lib/week", () => ({
  getIsoWeekStartDateString: vi.fn(() => "2026-07-01"),
  getUtcDateString: vi.fn(() => "2026-07-01"),
}));

vi.mock("@/lib/achievements", () => ({
  checkAchievements: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/lib/rewardCoordinator", () => ({
  coordinateRewardSideEffects: vi.fn().mockResolvedValue({ newAchievements: [] }),
}));

vi.mock("@/lib/notification-helpers", () => ({
  touchLastActive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/notification-senders/raid", () => ({
  sendRaidAlertNotification: vi.fn(),
}));

vi.mock("@/lib/dailies", () => ({
  trackDailyMission: vi.fn().mockResolvedValue(undefined),
}));

import { RaidService, RaidServiceError } from "./raidService";

describe("RaidService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindRaidAttackerForUser.mockResolvedValue({
      id: 1,
      claimed: true,
      github_login: "attacker",
      avatar_url: null,
      contributions: 10,
      public_repos: 5,
      total_stars: 0,
      kudos_count: 0,
      app_streak: 0,
      raid_xp: 0,
      xp_level: 30,
      current_week_contributions: 10,
      current_week_kudos_given: 0,
      current_week_kudos_received: 0,
      last_raided_at: null,
      active_defenses: [],
      easy_solved: 0,
      medium_solved: 0,
      hard_solved: 0,
      contest_rating: 0,
      lc_streak: 0,
      total_prs: 0,
    });
  });

  it("throws a raid service error when the target cannot be found", async () => {
    const admin = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "developers") {
          return {
            select: vi.fn(() => ({
              ilike: vi.fn(() => ({
                limit: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: null }),
                })),
              })),
            })),
          };
        }

        return {};
      }),
      rpc: vi.fn(),
    };

    const service = new RaidService(admin as never, { id: "user-1" } as never, {
      target_login: "missing",
    } as never, "2026-07-01");

    await expect(service.execute()).rejects.toMatchObject({
      message: "Target not found",
      status: 404,
    } as RaidServiceError);
  });
});
