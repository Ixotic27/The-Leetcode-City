import { AchievementEvaluatorService } from "../AchievementEvaluatorService";

describe("AchievementEvaluatorService Pipeline Testing Suite", () => {
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      developerStats: { findUnique: jest.fn() },
      developerAchievements: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
      activityFeed: { create: jest.fn() },
      $transaction: jest.fn((cb) => cb(mockDb))
    };
  });

  it("should successfully trigger a new achievement award when threshold is reached", async () => {
    mockDb.developerStats.findUnique.mockResolvedValue({
      developerId: "dev_user_99",
      contributions: 15,
      repositories: 1,
      stars: 0
    });
    mockDb.developerAchievements.findMany.mockResolvedValue([]);
    mockDb.developerAchievements.findFirst.mockResolvedValue(null);

    await AchievementEvaluatorService.evaluateProgress("dev_user_99", mockDb);

    expect(mockDb.developerAchievements.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ achievementId: "ach_contrib_10" })
    }));
    expect(mockDb.activityFeed.create).toHaveBeenCalled();
  });

  it("should fully intercept and prevent duplicate unlock operations if already awarded", async () => {
    mockDb.developerStats.findUnique.mockResolvedValue({
      developerId: "dev_user_99",
      contributions: 15
    });
    mockDb.developerAchievements.findMany.mockResolvedValue([
      { achievementId: "ach_contrib_10" }
    ]);

    await AchievementEvaluatorService.evaluateProgress("dev_user_99", mockDb);

    expect(mockDb.developerAchievements.create).not.toHaveBeenCalled();
  });
});
