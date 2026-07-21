import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./achievements", () => ({
  checkAchievements: vi.fn(),
}));

import { coordinateRewardSideEffects } from "./rewardCoordinator";
import * as achievementsModule from "./achievements";

describe("coordinateRewardSideEffects", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("grants xp, writes the feed event, and checks achievements in one coordinated path", async () => {
    const checkAchievementsMock = vi.mocked(achievementsModule.checkAchievements);
    checkAchievementsMock.mockResolvedValue(["ach-1"]);

    const rpc = vi.fn().mockResolvedValue({ data: { granted: 10 }, error: null });
    const activityFeedInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    const admin = {
      rpc,
      from: vi.fn().mockReturnValue({ insert: activityFeedInsert }),
    } as never;

    const result = await coordinateRewardSideEffects(admin, {
      developerId: 42,
      actorLogin: "octocat",
      stats: {
        contributions: 3,
        public_repos: 1,
        total_stars: 0,
        referral_count: 0,
        kudos_count: 0,
        gifts_sent: 0,
        gifts_received: 0,
        app_streak: 5,
      },
      xpGrants: [{ source: "checkin", amount: 10 }],
      feedEvent: {
        event_type: "streak_checkin",
        metadata: { streak: 5 },
      },
    });

    expect(rpc).toHaveBeenCalledWith("grant_xp_atomic", {
      p_developer_id: 42,
      p_source: "checkin",
      p_amount: 10,
    });
    expect(activityFeedInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "streak_checkin",
        actor_id: 42,
        metadata: { streak: 5 },
      }),
    );
    expect(checkAchievementsMock).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ app_streak: 5 }),
      "octocat",
    );
    expect(result.newAchievements).toEqual(["ach-1"]);
  });
});
