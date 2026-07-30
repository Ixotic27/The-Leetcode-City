import { coordinateRewardSideEffects } from "@/lib/rewardCoordinator";
import { getDailyMissions, getTodayStr, MISSIONS_BY_ID, type Mission } from "@/lib/dailies";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Error thrown by DailyMissionService operations.
 * The `status` field carries an HTTP-like status code for upstream callers.
 */
export class DailyMissionServiceError extends Error {
  /** HTTP-like status code (e.g. 400 for bad input, 500 for server error). */
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "DailyMissionServiceError";
    this.status = status;
  }
}

/**
 * Subset of the developer record used by the daily mission system.
 * Fields may be null when the developer record has not yet been populated.
 */
export type DailyMissionDeveloper = {
  /** Unique developer identifier. */
  id: number;
  github_login?: string | null;
  claimed?: boolean | null;
  contributions?: number | null;
  public_repos?: number | null;
  total_stars?: number | null;
  kudos_count?: number | null;
  dailies_completed?: number | null;
  dailies_streak?: number | null;
  /** Date string (YYYY-MM-DD) of the last completed daily set. */
  last_dailies_date?: string | null;
  /** Date string (YYYY-MM-DD) of the last checkin. */
  last_checkin_date?: string | null;
  points?: number | null;
  easy_solved?: number | null;
  medium_solved?: number | null;
  hard_solved?: number | null;
  contest_rating?: number | null;
  lc_streak?: number | null;
  total_prs?: number | null;
};

/**
 * Aggregated daily mission state for a developer on a given day.
 * Used by the frontend to render mission progress and the claim button.
 */
export type DailyMissionSummary = {
  /** List of missions with current progress. */
  missions: Array<{
    id: string;
    title: string;
    description: string;
    threshold: number;
    desktopOnly: boolean;
    progress: number;
    completed: boolean;
  }>;
  /** How many of the three daily missions are completed. */
  completed_count: number;
  /** True when all three missions are done. */
  all_completed: boolean;
  /** True when the reward has already been claimed today. */
  reward_claimed: boolean;
  dailies_streak: number;
  dailies_completed: number;
  /** True when the developer has purchased the GitHub Star bonus. */
  has_github_star: boolean;
};

/**
 * Payload for the `updateProgress` action.
 * Sent by the client when mission progress is made.
 */
export type DailyMissionProgressPayload = {
  developerId: number;
  missionId: string;
  /** Override the default increment of 1. */
  increment?: number;
  /** Whether the request originated from a mobile client. */
  isMobile?: boolean;
  /** Override today's date string (YYYY-MM-DD); defaults to the server date. */
  today?: string;
};

/**
 * Payload for the `claimReward` action.
 * Sent by the client when the user clicks the claim button.
 */
export type DailyMissionClaimPayload = {
  /** Developer record; must have all fields populated for side-effect coordination. */
  developer: DailyMissionDeveloper;
  isMobile?: boolean;
  today?: string;
};

/**
 * Coordinates daily mission loading, progress updates, and reward claiming.
 * All methods interact with the `daily_mission_progress` and `purchases` Supabase tables.
 */
export class DailyMissionService {
  private readonly admin: SupabaseClient;

  /**
   * Constructs the service, optionally with an injected Supabase client.
   * When omitted the admin client is resolved from the environment.
   */
  constructor(admin?: SupabaseClient) {
    this.admin = admin ?? getSupabaseAdmin();
  }

  /**
   * Returns the full mission summary for a developer on a given day.
   * Automatically tracks checkin progress when `developer.last_checkin_date`
   * differs from `today`.
   *
   * @param developer  - Developer record from the database.
   * @param options.isMobile - Whether to load mobile-specific missions.
   * @param options.today    - Override today's date (YYYY-MM-DD); defaults to server date.
   * @returns Summary of all missions, streak, and whether reward is claimable.
   */
  async loadMissionSummary(
    developer: DailyMissionDeveloper,
    options?: { isMobile?: boolean; today?: string },
  ): Promise<DailyMissionSummary> {
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

  /**
   * Increments progress on a single mission.
   *
   * @param payload - Contains developerId, missionId, optional increment and date overrides.
   * @throws {DailyMissionServiceError} status 400 when missionId is invalid or not assigned today.
   * @throws {DailyMissionServiceError} status 500 on Supabase RPC failure.
   */
  async updateProgress(payload: DailyMissionProgressPayload): Promise<unknown> {
    const today = payload.today ?? getTodayStr();
    const increment =
      typeof payload.increment === "number" && payload.increment > 0 ? payload.increment : 1;

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

  /**
   * Claims the daily reward for a developer.
   * Validates that all three missions are completed before recording the claim.
   * Grants points, XP, and a streak freeze on every 7th completed day.
   *
   * @param payload - Contains the developer record and optional date overrides.
   * @throws {DailyMissionServiceError} status 400 when already claimed or missions incomplete.
   * @throws {DailyMissionServiceError} status 500 on Supabase RPC failure.
   */
  async claimReward(
    payload: DailyMissionClaimPayload,
  ): Promise<{
    ok: boolean;
    streak: number;
    total: number;
    freeze_granted: boolean;
    points_granted: number;
    xp_granted: number;
  }> {
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

    const completedSet = new Set(
      (progressRows ?? [])
        .filter((r) => Boolean(r.completed))
        .map((r) => String(r.mission_id)),
    );
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

    const claimResult = result as {
      already_completed?: boolean;
      streak?: number;
      total?: number;
    };
    if (claimResult.already_completed) {
      throw new DailyMissionServiceError("Already claimed today", 400);
    }

    const pointsGranted = 15;
    const xpGranted = 25;

    let freezeGranted = false;
    if (claimResult.total !== undefined && claimResult.total % 7 === 0) {
      const { data: freezeResult, error: freezeError } = await this.admin.rpc(
        "grant_streak_freeze",
        { p_developer_id: developer.id },
      );
      if (!freezeError) {
        const granted = freezeResult?.[0]?.granted === true;
        if (granted) {
          await this.admin
            .from("streak_freeze_log")
            .upsert(
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

  /**
   * Records progress for a specific mission without throwing on failure.
   * Silently skips missions whose score threshold is not met.
   *
   * @param developerId - Developer ID.
   * @param missionId   - Mission identifier (e.g. "checkin", "fly_score_50").
   * @param extra.score  - For fly-score missions, the actual score achieved.
   * @param extra.isMobile - Whether to resolve against mobile missions.
   * @param extra.today    - Override today's date (YYYY-MM-DD).
   */
  async trackMissionProgress(
    developerId: number,
    missionId: string,
    extra?: { score?: number; isMobile?: boolean; today?: string },
  ): Promise<void> {
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

  private resolveMission(
    developerId: number,
    missionId: string,
    isMobile: boolean,
    today: string,
  ): Mission | null {
    return (
      getDailyMissions(developerId, today, false).find((m) => m.id === missionId) ??
      getDailyMissions(developerId, today, isMobile).find((m) => m.id === missionId)
    ) ?? null;
  }
}
