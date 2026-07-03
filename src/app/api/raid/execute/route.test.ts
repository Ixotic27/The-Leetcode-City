import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockGetUser,
  mockFindRaidAttackerForUser,
  mockCheckAchievements,
  mockTouchLastActive,
  mockTrackDailyMission,
  mockSendRaidAlertNotification,
  mockRpc,
  mockFrom,
} = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockFindRaidAttackerForUser: vi.fn(),
  mockCheckAchievements: vi.fn(),
  mockTouchLastActive: vi.fn(),
  mockTrackDailyMission: vi.fn(),
  mockSendRaidAlertNotification: vi.fn(),
  mockRpc: vi.fn(),
  mockFrom: vi.fn(),
}));

let remainingQuantity = 1;
let executeRaidCalls = 0;

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/achievements", () => ({
  checkAchievements: mockCheckAchievements,
}));

vi.mock("@/lib/notification-helpers", () => ({
  touchLastActive: mockTouchLastActive,
}));

vi.mock("@/lib/notification-senders/raid", () => ({
  sendRaidAlertNotification: mockSendRaidAlertNotification,
}));

vi.mock("@/lib/dailies", () => ({
  trackDailyMission: mockTrackDailyMission,
}));

vi.mock("@/lib/raid-attacker", () => ({
  findRaidAttackerForUser: mockFindRaidAttackerForUser,
}));

vi.mock("@/lib/week", () => ({
  getIsoWeekStart: vi.fn(() => new Date("2026-07-01T00:00:00.000Z")),
  getIsoWeekStartDateString: vi.fn(() => "2026-07-01"),
  getUtcDateString: vi.fn(() => "2026-07-01"),
}));

import { POST } from "./route";

describe("POST /api/raid/execute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    remainingQuantity = 1;
    executeRaidCalls = 0;
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mockCheckAchievements.mockResolvedValue([]);
    mockTouchLastActive.mockResolvedValue(undefined);
    mockTrackDailyMission.mockResolvedValue(undefined);
    mockSendRaidAlertNotification.mockResolvedValue(undefined);
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
      active_defenses: [],
      easy_solved: 0,
      medium_solved: 0,
      hard_solved: 0,
      contest_rating: 0,
      lc_streak: 0,
      total_prs: 0,
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") {
        const developerQuery = {
          ilike: () => ({
            limit: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 2,
                  claimed: true,
                  github_login: "defender",
                  avatar_url: null,
                  contributions: 5,
                  public_repos: 2,
                  total_stars: 0,
                  kudos_count: 0,
                  app_streak: 0,
                  raid_xp: 0,
                  xp_level: 10,
                  current_week_contributions: 5,
                  current_week_kudos_given: 0,
                  current_week_kudos_received: 0,
                  active_defenses: [],
                  easy_solved: 0,
                  medium_solved: 0,
                  hard_solved: 0,
                  contest_rating: 0,
                  lc_streak: 0,
                  total_prs: 0,
                },
              }),
            }),
          }),
          eq: () => ({
            maybeSingle: async () => ({ data: { raid_xp: 50 } }),
          }),
        };

        return {
          select: () => developerQuery,
        };
      }

      if (table === "developer_customizations") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null }),
              }),
            }),
          }),
        };
      }

      if (table === "purchases") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({ data: [] }),
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }

      if (table === "developer_consumables") {
        const consumablesQuery = {
          eq: () => consumablesQuery,
          gt: () => ({
            then: (resolve: (value: { data: Array<{ item_id: string; weekly_uses: number; last_reset_week: string }> }) => void) => {
              resolve({ data: [] });
              return Promise.resolve();
            },
          }),
          single: async () => ({
            data: {
              id: "inv-1",
              quantity: 1,
              weekly_uses: 0,
              last_reset_week: "2026-07-01",
            },
          }),
        };

        return {
          select: () => consumablesQuery,
        };
      }

      if (table === "raid_tags") {
        return {
          update: () => ({
            eq: () => ({
              eq: async () => ({ error: null }),
            }),
          }),
          insert: async () => ({ error: null }),
        };
      }

      if (table === "activity_feed") {
        return {
          insert: async () => ({ error: null }),
        };
      }

      return {} as object;
    });

    mockRpc.mockImplementation(async (fn: string) => {
      if (fn === "execute_raid") {
        executeRaidCalls += 1;
        if (remainingQuantity <= 0) {
          return {
            data: [{ ok: false, error_code: "consumable", raid_id: null }],
            error: null,
          };
        }

        remainingQuantity -= 1;
        return {
          data: [{ ok: true, error_code: null, raid_id: "raid-1" }],
          error: null,
        };
      }

      if (fn === "increment_raid_xp" || fn === "grant_xp_atomic" || fn === "increment_relic_progress") {
        return { data: null, error: null };
      }

      return { data: null, error: null };
    });
  });

  it("allows only one concurrent raid to consume the last consumable", async () => {
    const requestBody = JSON.stringify({
      target_login: "defender",
      offensive_item_id: "emp_device",
    });

    const requestA = new Request("http://localhost/api/raid/execute", {
      method: "POST",
      body: requestBody,
    });
    const requestB = new Request("http://localhost/api/raid/execute", {
      method: "POST",
      body: requestBody,
    });

    const [responseA, responseB] = await Promise.all([POST(requestA), POST(requestB)]);

    const statuses = [responseA.status, responseB.status].sort();
    expect(statuses).toEqual([200, 429]);

    expect(remainingQuantity).toBe(0);
    expect(executeRaidCalls).toBe(2);
  });

  it("does not consume a consumable when execute_raid blocks the raid", async () => {
    mockRpc.mockImplementation(async (fn: string) => {
      if (fn === "execute_raid") {
        return {
          data: [{ ok: false, error_code: "consumable", raid_id: null }],
          error: null,
        };
      }

      return { data: null, error: null };
    });

    const response = await POST(
      new Request("http://localhost/api/raid/execute", {
        method: "POST",
        body: JSON.stringify({
          target_login: "defender",
          offensive_item_id: "emp_device",
        }),
      })
    );

    expect(response.status).toBe(429);
    expect(remainingQuantity).toBe(1);
  });
});
