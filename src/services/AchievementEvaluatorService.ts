import { db } from "../config/database";

interface DeveloperStats {
  developerId: string;
  contributions: number;
  repositories: number;
  stars: number;
  referrals: number;
  kudos: number;
}

interface AchievementDefinition {
  id: string;
  category: keyof Omit<DeveloperStats, "developerId">;
  threshold: number;
  title: string;
}

export class AchievementEvaluatorService {
  // Declarative achievement milestone definition schema map
  private static achievementDefinitions: AchievementDefinition[] = [
    { id: "ach_contrib_10", category: "contributions", threshold: 10, title: "Code Contributor" },
    { id: "ach_contrib_50", category: "contributions", threshold: 50, title: "Elite Committer" },
    { id: "ach_repo_5", category: "repositories", threshold: 5, title: "Repo Architect" },
    { id: "ach_stars_25", category: "stars", threshold: 25, title: "Rising Star" },
    { id: "ach_stars_100", category: "stars", threshold: 100, title: "Stargazer Celebrity" },
    { id: "ach_referrals_5", category: "referrals", threshold: 5, title: "Networker" },
    { id: "ach_kudos_10", category: "kudos", threshold: 10, title: "Community Pillar" }
  ];

  /**
   * Scans developer metrics and unlocks achievements atomically using database transactions.
   */
  public static async evaluateProgress(developerId: string): Promise<void> {
    try {
      // 1. Fetch current live statistics metrics
      const devStats = await db.developerStats.findUnique({
        where: { developerId }
      });

      if (!devStats) return;

      // 2. Load existing unlocked items to bypass duplicate processing runs
      const unlockedAchievements = await db.developerAchievements.findMany({
        where: { developerId },
        select: { achievementId: true }
      });

      const unlockedSet = new Set(unlockedAchievements.map(a => a.achievementId));

      // 3. Evaluate each milestone definition threshold rule
      for (const ach of this.achievementDefinitions) {
        if (unlockedSet.has(ach.id)) continue;

        const currentProgress = (devStats as any)[ach.category] || 0;

        if (currentProgress >= ach.threshold) {
          // 4. Execute atomic isolated write transaction block
          await db.$transaction(async (tx) => {
            const exists = await tx.developerAchievements.findFirst({
              where: { developerId, achievementId: ach.id }
            });

            if (exists) return;

            // Unlock and insert the milestone reward token mapping log
            await tx.developerAchievements.create({
              data: {
                developerId,
                achievementId: ach.id,
                unlockedAt: new Date()
              }
            });

            // Simultaneously publish the event directly to the public live stream feed
            await tx.activityFeed.create({
              data: {
                developerId,
                type: "ACHIEVEMENT_UNLOCKED",
                message: `🎉 Milestone Achieved! Unlocked achievement: ${ach.title}!`,
                createdAt: new Date()
              }
            });
          });
        }
      }
    } catch (error) {
      console.error(`[AchievementEvaluator Error] Failed evaluation pipeline loop for user ${developerId}:`, error);
    }
  }
}
