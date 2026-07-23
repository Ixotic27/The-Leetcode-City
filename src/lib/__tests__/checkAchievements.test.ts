import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockFrom, mockRpc, mockSendAchievementNotification } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockRpc: vi.fn(),
  mockSendAchievementNotification: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/notification-senders/achievement", () => ({
  sendAchievementNotification: mockSendAchievementNotification,
}));

import { checkAchievements } from "../achievements";

const ALL_ACHIEVEMENTS = [
  { id: "first_push", category: "commits", threshold: 1, tier: "bronze", name: "First Push", reward_type: "unlock_item", reward_item_id: "flag" },
  { id: "committed", category: "commits", threshold: 100, tier: "bronze", name: "Committed", reward_type: "unlock_item", reward_item_id: "custom_color" },
  { id: "builder", category: "repos", threshold: 5, tier: "bronze", name: "Builder", reward_type: "unlock_item", reward_item_id: "antenna_array" },
];

const BASE_STATS = {
  contributions: 0,
  public_repos: 0,
  total_stars: 0,
  referral_count: 0,
  kudos_count: 0,
  gifts_sent: 0,
  gifts_received: 0,
};

function setupMockFrom({
  allAchievements = ALL_ACHIEVEMENTS,
  alreadyUnlocked = [] as string[],
} = {}) {
  const inserted: { table: string; rows: unknown }[] = [];

  mockFrom.mockImplementation((table: string) => {
    if (table === "achievements") {
      return {
        select: () => Promise.resolve({ data: allAchievements }),
      };
    }
    if (table === "developer_achievements") {
      return {
        select: () => ({
          eq: () =>
            Promise.resolve({
              data: alreadyUnlocked.map((id) => ({ achievement_id: id })),
            }),
        }),
        upsert: (rows: unknown) => {
          inserted.push({ table: "developer_achievements", rows });
          return Promise.resolve({ data: null, error: null });
        },
      };
    }
    if (table === "purchases") {
      return {
        upsert: (rows: unknown) => {
          inserted.push({ table: "purchases", rows });
          return Promise.resolve({ data: null, error: null });
        },
      };
    }
    if (table === "activity_feed") {
      return {
        insert: (row: unknown) => {
          inserted.push({ table: "activity_feed", rows: row });
          return Promise.resolve({ data: null, error: null });
        },
      };
    }
    throw new Error(`Unexpected table in test: ${table}`);
  });

  return inserted;
}

describe("checkAchievements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: { granted: 10 }, error: null });
    mockSendAchievementNotification.mockResolvedValue(undefined);
  });

  it("unlocks an achievement when a stat crosses its threshold", async () => {
    const inserted = setupMockFrom();

    const unlocked = await checkAchievements(
      1,
      { ...BASE_STATS, contributions: 1 },
      "priya-12340"
    );

    expect(unlocked).toEqual(["first_push"]);
    const devAchievementInsert = inserted.find(
      (i) => i.table === "developer_achievements"
    );
    expect(devAchievementInsert?.rows).toEqual([
      { developer_id: 1, achievement_id: "first_push" },
    ]);
  });

  it("does not re-unlock an achievement the developer already has", async () => {
    setupMockFrom({ alreadyUnlocked: ["first_push"] });

    const unlocked = await checkAchievements(
      1,
      { ...BASE_STATS, contributions: 1 },
      "priya-12340"
    );

    expect(unlocked).toEqual([]);
  });

  it("unlocks multiple achievements at once and logs one aggregated feed entry", async () => {
    const inserted = setupMockFrom();

    const unlocked = await checkAchievements(
      1,
      { ...BASE_STATS, contributions: 100, public_repos: 5 },
      "priya-12340"
    );

    expect(unlocked.sort()).toEqual(["builder", "committed", "first_push"].sort());
    const feedInsert = inserted.find((i) => i.table === "activity_feed");
    expect(feedInsert?.rows).toMatchObject({
      event_type: "achievement_unlocked",
      metadata: { count: 3 },
    });
  });

  it("returns an empty array when no thresholds are met", async () => {
    setupMockFrom();

    const unlocked = await checkAchievements(1, BASE_STATS, "priya-12340");

    expect(unlocked).toEqual([]);
  });
});