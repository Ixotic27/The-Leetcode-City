import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendAchievementNotification } from "../notification-senders/achievement";
import { sendNotificationAsync } from "../notifications";

// Mock the notifications module
vi.mock("../notifications", () => ({
  sendNotificationAsync: vi.fn(),
}));

describe("sendAchievementNotification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should generate correct dedupKey for a single notable achievement", () => {
    sendAchievementNotification(42, "test_user", [
      { id: "gold_ach", name: "Gold Achievement", tier: "gold" },
      { id: "bronze_ach", name: "Bronze Achievement", tier: "bronze" }, // filtered out
    ]);

    expect(sendNotificationAsync).toHaveBeenCalledTimes(1);
    expect(sendNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupKey: "achievement:42:gold_ach",
        title: "Achievement Unlocked: Gold Achievement (gold)",
      }),
    );
  });

  it("should generate correct dedupKey using pipe delimiter for batch notable achievements", () => {
    sendAchievementNotification(42, "test_user", [
      { id: "gold_ach", name: "Gold Achievement", tier: "gold" },
      { id: "diamond_ach", name: "Diamond Achievement", tier: "diamond" },
      { id: "silver_ach", name: "Silver Achievement", tier: "silver" }, // filtered out
    ]);

    expect(sendNotificationAsync).toHaveBeenCalledTimes(1);
    expect(sendNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        dedupKey: "achievement_batch:42:diamond_ach|gold_ach",
        title: "2 Achievements Unlocked!",
      }),
    );
  });
});
