import { AchievementEvaluatorService } from "../AchievementEvaluatorService";
import { db } from "../../config/database";

jest.mock("../../config/database", () => ({
  db: {
    developerStats: { findUnique: jest.fn() },
    developerAchievements: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
    activityFeed: { create: jest.fn() },
    $transaction: jest.fn((cb) => cb(db))
  }
}));

describe("AchievementEvaluatorService Pipeline Testing Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should successfully trigger a new achievement award when threshold is reached", async () => {
    (db.developerStats.findUnique as jest.Mock).mockResolvedValue({
      developerId: "dev_user_99",
      contributions: 15,
      repositories: 1,
      stars: 0
    });
    (db.developerAchievements.findMany as jest.Mock).mockResolvedValue([]);
    (db.developerAchievements.findFirst as jest.Mock).mockResolvedValue(null);

    await AchievementEvaluatorService.evaluateProgress("dev_user_99");

    expect(db.developerAchievements.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ achievementId: "ach_contrib_10" })
    }));
    expect(db.activityFeed.create).toHaveBeenCalled();
  });

  it("should fully intercept and prevent duplicate unlock operations if already awarded", async () => {
    (db.developerStats.findUnique as jest.Mock).mockResolvedValue({
      developerId: "dev_user_99",
      contributions: 15
    });
    (db.developerAchievements.findMany as jest.Mock).mockResolvedValue([
      { achievementId: "ach_contrib_10" }
    ]);

    await AchievementEvaluatorService.evaluateProgress("dev_user_99");

    expect(db.developerAchievements.create).not.toHaveBeenCalled();
  });
});
