import { coordinateRewardSideEffects } from "@/lib/rewardCoordinator";
import { getDailyMissions, getTodayStr, MISSIONS_BY_ID, type Mission } from "@/lib/dailies";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

export class DailyMissionServiceError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DailyMissionServiceError";
    this.status = status;
  }
}

export type DailyMissionDeveloper = {
  id: number;
  github_login?: string | null;
  claimed?: boolean | null;
  contributions?: number | null;
  public_repos?: number | null;
  total_stars?: number | null;
  kudos_count?: number | null;
  dailies_completed?: number | null;
  dailies_streak?: number | null;
  last_dailies_date?: string | null;
  last_checkin_date?: string | null;
  points?: number | null;
  easy_solved?: number | null;
  medium_solved?: number | null;
  hard_solved?: number | null;
  contest_rating?: number | null;
  lc_streak?: number | null;
  total_prs?: number | null;
};

export type DailyMissionSummary = {
  missions: Array<{
    id: string;
    title: string;
    description: string;
    threshold: number;
    desktopOnly: boolean;
    progress: number;
    completed: boolean;
  }>;
  completed_count: number;
  all_completed: boolean;
  reward_claimed: boolean;
  dailies_streak: number;
  dailies_completed: number;
  has_github_star: boolean;
};

export type DailyMissionProgressPayload = {
  developerId: number;
  missionId: string;
  increment?: number;
  isMobile?: boolean;
  today?: string;
};

export type DailyMissionClaimPayload = {
  developer: DailyMissionDeveloper;
  isMobile?: boolean;
  today?: string;
};

export class DailyMissionService {
  private readonly admin: SupabaseClient;

  constructor(admin?: SupabaseClient) {
    this.admin = admin ?? getSupabaseAdmin();
  }

  async loadMissionSummary(developer: DailyMissionDeveloper, options?: { isMobile?: boolean; today?: string }): Promise<DailyMissionSummary> {
    const today = options?.today ?? getTodayStr();
    const isMobile = options?.isMobile === true;

    if (developer.last_checkin_date === today) {
      await this.trackMissionProgress(developer.id, "checkin", { isMobile, today });
    }

    const missions = getDailyMissions(developer.id, today, isMobile);
    const { data: progressRows } = await this.admin
      .from("daily_mission_progress")
      .select("mission_id, progress, completed")
      .eq("developer_id", developer.id)
      .eq("mission_date", today);

    const progressMap = new Map((progressRows ?? []).map((r) => [String(r.mission_id), r]));

    const missionData = missions.map((m) => {
      const prog = progressMap.get(m.id);
      return {
        id: m.id,
        title: m.title,
        description: m.description,
        threshold: m.threshold,
        desktopOnly: m.desktopOnly ?? false,
        progress: prog?.progress ?? 0,
        completed: prog?.completed ?? false,
      };
    });

    const completedCount = missionData.filter((m) => m.completed).length;
    const allCompleted = completedCount === 3;
    const alreadyClaimedToday = developer.last_dailies_date === today;

    const { data: starPurchase } = await this.admin
      .from("purchases")
      .select("id")
      .eq("developer_id", developer.id)
      .eq("item_id", "github_star")
      .eq("status", "completed")
      .maybeSingle();

    return {
      missions: missionData,
      completed_count: completedCount,
      all_completed: allCompleted,
      reward_claimed: alreadyClaimedToday,
      dailies_streak: developer.dailies_streak ?? 0,
      dailies_completed: developer.dailies_completed ?? 0,
      has_github_star: !!starPurchase,
    };
  }

  async updateProgress(payload: DailyMissionProgressPayload): Promise<unknown> {
    const today = payload.today ?? getTodayStr();
    const increment = typeof payload.increment === "number" && payload.increment > 0 ? payload.increment : 1;

    if (!payload.missionId || !MISSIONS_BY_ID.has(payload.missionId)) {
      throw new DailyMissionServiceError("Invalid mission_id", 400);
    }

    const mission = this.resolveMission(payload.developerId, payload.missionId, payload.isMobile ?? false, today);
    if (!mission) {
      throw new DailyMissionServiceError("Mission not assigned today", 400);
    }

    const { data, error } = await this.admin.rpc("record_mission_progress", {
      p_developer_id: payload.developerId,
      p_mission_id: payload.missionId,
      p_threshold: mission.threshold,
      p_increment: increment,
    });

    if (error) {
      console.error("[dailies] progress RPC error:", error);
      throw new DailyMissionServiceError("Failed to update progress", 500);
    }

    return data;
  }

  async claimReward(payload: DailyMissionClaimPayload): Promise<{ ok: boolean; streak: number; total: number; freeze_granted: boolean; points_granted: number; xp_granted: number }> {
    const today = payload.today ?? getTodayStr();
    const developer = payload.developer;

    if (developer.last_dailies_date === today) {
      throw new DailyMissionServiceError("Already claimed today", 400);
    }

    const missions = getDailyMissions(developer.id, today, payload.isMobile === true);
    const { data: progressRows } = await this.admin
      .from("daily_mission_progress")
      .select("mission_id, completed")
      .eq("developer_id", developer.id)
      .eq("mission_date", today);

    const completedSet = new Set((progressRows ?? []).filter((r) => Boolean(r.completed)).map((r) => String(r.mission_id)));
    const allDone = missions.every((m) => completedSet.has(m.id));

    if (!allDone) {
      throw new DailyMissionServiceError("Not all missions completed", 400);
    }

    const { data: result, error: rpcError } = await this.admin.rpc("complete_all_dailies", {
      p_developer_id: developer.id,
    });

    if (rpcError) {
      console.error("[dailies] claim RPC error:", rpcError);
      throw new DailyMissionServiceError("Failed to claim", 500);
    }

    const claimResult = result as { already_completed?: boolean; streak?: number; total?: number };
    if (claimResult.already_completed) {
      throw new DailyMissionServiceError("Already claimed today", 400);
    }

    const pointsGranted = 15;
    const xpGranted = 25;

    let freezeGranted = false;
    if (claimResult.total !== undefined && claimResult.total % 7 === 0) {
      const { data: freezeResult, error: freezeError } = await this.admin.rpc("grant_streak_freeze", { p_developer_id: developer.id });
      if (!freezeError) {
        const granted = freezeResult?.[0]?.granted === true;
        if (granted) {
          await this.admin.from("streak_freeze_log").upsert(
            {
              developer_id: developer.id,
              action: "granted_dailies",
              granted_date: today,
            },
            { onConflict: "developer_id,action,granted_date", ignoreDuplicates: true },
          );
          freezeGranted = true;
        }
      } else {
        console.error("[dailies] grant_streak_freeze error:", freezeError.message);
      }
    }

    // Coordinate reward side effects: XP grant + achievement check + feed event
    await coordinateRewardSideEffects(this.admin as never, {
      developerId: developer.id,
      actorLogin: developer.github_login ?? "",
      stats: {
        contributions: developer.contributions ?? 0,
        public_repos: developer.public_repos ?? 0,
        total_stars: developer.total_stars ?? 0,
        referral_count: 0,
        kudos_count: developer.kudos_count ?? 0,
        gifts_sent: 0,
        gifts_received: 0,
        dailies_completed: claimResult.total ?? 0,
        easy_solved: developer.easy_solved ?? 0,
        medium_solved: developer.medium_solved ?? 0,
        hard_solved: developer.hard_solved ?? 0,
        contest_rating: developer.contest_rating ?? 0,
        lc_streak: developer.lc_streak ?? 0,
        total_prs: developer.total_prs ?? 0,
      },
      xpGrants: [{ source: "dailies", amount: xpGranted }],
      feedEvent: {
        event_type: "dailies_completed",
        metadata: {
          login: developer.github_login ?? "",
          streak: claimResult.streak ?? 0,
          total: claimResult.total ?? 0,
        },
        actor_id: developer.id,
      },
    });

    return {
      ok: true,
      streak: claimResult.streak ?? 0,
      total: claimResult.total ?? 0,
      freeze_granted: freezeGranted,
      points_granted: pointsGranted,
      xp_granted: xpGranted,
    };
  }

  async trackMissionProgress(developerId: number, missionId: string, extra?: { score?: number; isMobile?: boolean; today?: string }): Promise<void> {
    try {
      const today = extra?.today ?? getTodayStr();
      const mission = this.resolveMission(developerId, missionId, extra?.isMobile ?? false, today);
      if (!mission) return;

      if (missionId === "fly_score_50" && (extra?.score ?? 0) < 50) return;
      if (missionId === "fly_score_150" && (extra?.score ?? 0) < 150) return;

      await this.admin.rpc("record_mission_progress", {
        p_developer_id: developerId,
        p_mission_id: missionId,
        p_threshold: mission.threshold,
        p_increment: 1,
      });
    } catch (err) {
      console.error("[dailies] trackDailyMission error:", err);
    }
  }

  private resolveMission(developerId: number, missionId: string, isMobile: boolean, today: string): Mission | null {
    return (
      getDailyMissions(developerId, today, false).find((m) => m.id === missionId) ??
      getDailyMissions(developerId, today, isMobile).find((m) => m.id === missionId)
    ) ?? null;
  }
}
