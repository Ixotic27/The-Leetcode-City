import { getSupabaseAdmin } from "../config/supabase";

interface DeveloperStats {
  developer_id: string;
  contributions: number;
  repositories: number;
  stars: number;
  referrals: number;
  kudos: number;
}

interface AchievementDefinition {
  id: string;
  category: keyof Omit<DeveloperStats, "developer_id">;
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

  public static async evaluateProgress(developerId: string): Promise<void> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return;

    try {
      const { data: devStats, error: statsError } = await supabase
        .from("developer_stats")
        .select("*")
        .eq("developer_id", developerId)
        .single();

      if (statsError || !devStats) return;

      const { data: unlockedAchievements, error: achError } = await supabase
        .from("developer_achievements")
        .select("achievement_id")
        .eq("developer_id", developerId);

      if (achError || !unlockedAchievements) return;

      const unlockedSet = new Set(unlockedAchievements.map((a: Record<string, unknown>) => String(a.achievement_id)));

      for (const ach of this.achievementDefinitions) {
        if (unlockedSet.has(ach.id)) continue;

        const currentProgress = (devStats as Record<string, unknown>)[ach.category];
        const progressNumber = typeof currentProgress === "number" ? currentProgress : 0;

        if (progressNumber >= ach.threshold) {
          const { error: insertError } = await supabase
            .from("developer_achievements")
            .upsert(
              { developer_id: developerId, achievement_id: ach.id, unlocked_at: new Date().toISOString() },
              { onConflict: "developer_id,achievement_id" }
            );

          if (!insertError) {
            await supabase
              .from("activity_feed")
              .insert({
                developer_id: developerId,
                type: "ACHIEVEMENT_UNLOCKED",
                message: `🎉 Milestone Achieved! Unlocked achievement: ${ach.title}!`,
                created_at: new Date().toISOString()
              });
          }
        }
      }
    } catch (error) {
      console.error(`[AchievementEvaluator Error] Failed evaluation pipeline loop for user ${developerId}:`, error);
    }
  }
}
