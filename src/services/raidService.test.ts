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

  it("resolves scouting_satellite consumable even if the attacker does not own any quantity of it", async () => {
    const mockDefender = {
      id: 2,
      github_login: "defender",
      claimed: true,
      contributions: 5,
    };

    const admin = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === "developers") {
          const chain = {
            select: vi.fn(() => chain),
            ilike: vi.fn(() => chain),
            limit: vi.fn(() => chain),
            maybeSingle: vi.fn().mockResolvedValue({ data: mockDefender }),
            single: vi.fn().mockResolvedValue({ data: mockDefender }),
            update: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            then: (resolve: any) => resolve({ data: mockDefender }),
          };
          return chain;
        }
        if (table === "developer_consumables") {
          const chain = {
            eq: vi.fn(() => chain),
            gt: vi.fn(() => chain),
            single: vi.fn().mockResolvedValue({ data: null, error: { message: "Not found" } }),
            then: (resolve: any) => resolve({ data: [] }),
          };
          return {
            select: vi.fn(() => chain),
          };
        }
        if (table === "developer_customizations") {
          const chain = {
            eq: vi.fn(() => chain),
            maybeSingle: vi.fn().mockResolvedValue({ data: null }),
            then: (resolve: any) => resolve({ data: null }),
          };
          return {
            select: vi.fn(() => chain),
          };
        }
        if (table === "purchases") {
          const chain = {
            eq: vi.fn(() => chain),
            is: vi.fn(() => chain),
            in: vi.fn().mockResolvedValue({ data: [] }),
            then: (resolve: any) => resolve({ data: [] }),
          };
          return {
            select: vi.fn(() => chain),
          };
        }
        if (table === "raid_tags") {
          const chain = {
            update: vi.fn(() => chain),
            eq: vi.fn(() => chain),
            insert: vi.fn().mockResolvedValue({ data: null }),
            then: (resolve: any) => resolve({ data: null }),
          };
          return chain;
        }
        if (table === "activity_feed") {
          const chain = {
            insert: vi.fn().mockResolvedValue({ data: null }),
            then: (resolve: any) => resolve({ data: null }),
          };
          return chain;
        }
        return {};
      }),
      rpc: vi.fn().mockResolvedValue({
        data: [{ ok: true, raid_id: "raid-uuid-123" }],
        error: null,
      }),
    };

    const service = new RaidService(
      admin as never,
      { id: "user-1" } as never,
      {
        target_login: "defender",
        offensive_item_id: "scouting_satellite",
      } as never,
      "2026-07-01"
    );

    const result = await service.execute();
    expect(result.status).toBe(200);
    expect(result.body.raid_id).toBe("raid-uuid-123");
    expect(admin.rpc).toHaveBeenCalledWith("execute_raid", expect.objectContaining({
      p_consumable_item_id: "scouting_satellite"
    }));
  });
});
