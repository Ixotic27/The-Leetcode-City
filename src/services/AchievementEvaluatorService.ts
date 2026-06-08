// Self-contained transaction-safe Achievement Evaluator Service
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
  private static achievementDefinitions: AchievementDefinition[] = [
    { id: "ach_contrib_10", category: "contributions", threshold: 10, title: "Code Contributor" },
    { id: "ach_contrib_50", category: "contributions", threshold: 50, title: "Elite Committer" },
    { id: "ach_repo_5", category: "repositories", threshold: 5, title: "Repo Architect" },
    { id: "ach_stars_25", category: "stars", threshold: 25, title: "Rising Star" },
    { id: "ach_stars_100", category: "stars", threshold: 100, title: "Stargazer Celebrity" },
    { id: "ach_referrals_5", category: "referrals", threshold: 5, title: "Networker" },
    { id: "ach_kudos_10", category: "kudos", threshold: 10, title: "Community Pillar" }
  ];

  public static async evaluateProgress(developerId: string, dbClient: any): Promise<void> {
    if (!dbClient) return;
    try {
      const devStats = await dbClient.developerStats.findUnique({
        where: { developerId }
      });

      if (!devStats) return;

      const unlockedAchievements = await dbClient.developerAchievements.findMany({
        where: { developerId },
        select: { achievementId: true }
      });

      const unlockedSet = new Set(unlockedAchievements.map((a: any) => a.achievementId));

      for (const ach of this.achievementDefinitions) {
        if (unlockedSet.has(ach.id)) continue;

        const currentProgress = (devStats as any)[ach.category] || 0;

        if (currentProgress >= ach.threshold) {
          await dbClient.$transaction(async (tx: any) => {
            const exists = await tx.developerAchievements.findFirst({
              where: { developerId, achievementId: ach.id }
            });

            if (exists) return;

            await tx.developerAchievements.create({
              data: {
                developerId,
                achievementId: ach.id,
                unlockedAt: new Date()
              }
            });

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
      console.error(`[AchievementEvaluator Error] Failed evaluation for user ${developerId}:`, error);
    }
  }
}
