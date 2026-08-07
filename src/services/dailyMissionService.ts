import { coordinateRewardSideEffects } from "@/lib/rewardCoordinator";
import { getDailyMissions, getTodayStr, MISSIONS_BY_ID, type Mission } from "@/lib/dailies";
import { rateLimit } from "@/lib/rate-limit";
import { ITEM_NAMES } from "@/lib/zones";
import { touchLastActive } from "@/lib/notification-helpers";
import { sendStreakMilestoneNotification } from "@/lib/notification-senders/streak";
import { sendStreakBrokenNotification } from "@/lib/notification-senders/streak-broken";
import { fetchLeetCodeWeeklySubmissions } from "@/lib/leetcode";
import { getSupabaseAdmin } from "@/lib/supabase";
import { InventoryEconomyService } from "@/services/inventoryEconomyService";
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
  app_streak?: number | null;
  streak_freeze_30d_claimed?: boolean | null;
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

export type DailyCheckinResponse = {
  checked_in: boolean;
  already_today: boolean;
  streak: number;
  longest: number;
  was_frozen: boolean;
  new_achievements: string[];
  unseen_count: number;
  kudos_since_last: number;
  raids_since_last: Array<{ attacker_login: string; success: boolean; created_at: string }>;
  streak_reward: { milestone: number; item_id: string; item_name: string } | null;
  xp: { granted: number; new_total: number; new_level: number } | null;
};

// A12: Streak reward milestones — {milestone: days, pool: item_ids to pick from}
const STREAK_MILESTONES: Array<{ milestone: number; pool: string[] }> = [
  { milestone: 3, pool: ["flag"] },
  { milestone: 7, pool: ["satellite_dish", "antenna_array", "rooftop_garden", "neon_trim"] },
  { milestone: 14, pool: ["neon_outline", "rooftop_fire", "hologram_ring"] },
  { milestone: 30, pool: ["lightning_aura", "pool_party", "crown_item"] },
];

export class DailyMissionService {
  private readonly admin: SupabaseClient;

  constructor(admin?: SupabaseClient) {
    this.admin = admin ?? getSupabaseAdmin();
  }

  async checkIn(userId: string): Promise<DailyCheckinResponse> {
    const developer = await this.loadCheckinDeveloper(userId);
    if (!developer) {
      throw new DailyMissionServiceError(
        "Your LeetCode stats are still being synced. Please check back in a few minutes!",
        403,
      );
    }

    if (!developer.claimed) {
      throw new DailyMissionServiceError("Must claim building first", 403);
    }

    const githubLogin = developer.github_login ?? "";

    const { data: result, error: rpcError } = await this.admin.rpc("perform_checkin", {
      p_developer_id: developer.id,
    });

    if (rpcError) {
      console.error("perform_checkin RPC error:", rpcError);
      throw new DailyMissionServiceError("Check-in failed", 500);
    }

    const checkinResult = result as {
      checked_in: boolean;
      already_today?: boolean;
      streak: number;
      longest: number;
      was_frozen?: boolean;
      error?: string;
    };

    if (checkinResult.error) {
      throw new DailyMissionServiceError(checkinResult.error, 400);
    }

    if (checkinResult.checked_in) {
      const { ok: successOk } = await rateLimit(`checkin:success:${userId}`, 1, 10_000);
      if (!successOk) {
        throw new DailyMissionServiceError("Check-in already processed", 429);
      }
    }

    await touchLastActive(developer.id);
    await this.trackMissionProgress(developer.id, "checkin");

    const previousStreak = developer.app_streak ?? 0;
    if (
      checkinResult.checked_in &&
      checkinResult.streak === 1 &&
      previousStreak >= 7 &&
      !checkinResult.was_frozen
    ) {
      const today = getTodayStr();
      sendStreakBrokenNotification(developer.id, githubLogin, previousStreak, today);
    }

    let newAchievements: string[] = [];
    let streakReward: { milestone: number; item_id: string; item_name: string } | null = null;
    let xpResult: { granted: number; new_total: number; new_level: number } | null = null;

    const today = getTodayStr();

    if (checkinResult.checked_in) {
      const { error: xpLogError } = await this.admin
        .from("checkin_xp_log")
        .insert({ developer_id: developer.id, granted_date: today })
        .select("id")
        .maybeSingle();

      if (!xpLogError) {
        const { data: xpData } = await this.admin.rpc("grant_xp_atomic", {
          p_developer_id: developer.id,
          p_source: "checkin",
          p_amount: 10,
        });
        if (xpData) xpResult = xpData as { granted: number; new_total: number; new_level: number };

        const eventDate = getTodayStr();
        const coordinationResult = await coordinateRewardSideEffects(this.admin as never, {
          developerId: developer.id,
          actorLogin: githubLogin,
          stats: {
            contributions: developer.contributions ?? 0,
            public_repos: developer.public_repos ?? 0,
            total_stars: developer.total_stars ?? 0,
            referral_count: 0,
            kudos_count: developer.kudos_count ?? 0,
            gifts_sent: 0,
            gifts_received: 0,
            app_streak: checkinResult.streak,
            easy_solved: developer.easy_solved ?? 0,
            medium_solved: developer.medium_solved ?? 0,
            hard_solved: developer.hard_solved ?? 0,
            contest_rating: developer.contest_rating ?? 0,
            lc_streak: developer.lc_streak ?? 0,
            total_prs: developer.total_prs ?? 0,
          },
          xpGrants: [],
          feedEvent: {
            event_type: "streak_checkin",
            metadata: {
              login: githubLogin,
              streak: checkinResult.streak,
              was_frozen: checkinResult.was_frozen ?? false,
              reward: null,
            },
            actor_id: developer.id,
            event_date: eventDate,
            upsert: true,
            onConflict: "actor_id,event_type,event_date",
            ignoreDuplicates: true,
          },
        });
        newAchievements = coordinationResult.newAchievements;
      } else if (!xpLogError.code?.includes("23505")) {
        console.error("[checkin] checkin_xp_log insert error:", xpLogError);
      }
    }

    if (checkinResult.checked_in) {
      if (checkinResult.streak >= 30 && !developer.streak_freeze_30d_claimed) {
        await this.admin.rpc("grant_streak_freeze", { p_developer_id: developer.id });
        await this.admin.from("developers").update({ streak_freeze_30d_claimed: true }).eq("id", developer.id);
        await this.admin.from("streak_freeze_log").upsert(
          { developer_id: developer.id, action: "granted_milestone", granted_date: today },
          { onConflict: "developer_id,action,granted_date", ignoreDuplicates: true },
        );
      }

      streakReward = await this.grantStreakReward(developer.id, checkinResult.streak);

      if ([7, 30, 100, 365].includes(checkinResult.streak)) {
        sendStreakMilestoneNotification(
          developer.id,
          githubLogin,
          checkinResult.streak,
          checkinResult.longest,
          streakReward?.item_name,
        );
      }

      if (streakReward) {
        const eventDate = getTodayStr();
        await this.admin.from("activity_feed").update({
          metadata: {
            login: githubLogin,
            streak: checkinResult.streak,
            was_frozen: checkinResult.was_frozen ?? false,
            reward: streakReward.item_id,
          },
        })
          .eq("actor_id", developer.id)
          .eq("event_type", "streak_checkin")
          .eq("event_date", eventDate);
      }
    }

    const weeklyContribs = await fetchWeeklyContributions(githubLogin);
    if (weeklyContribs !== null) {
      await this.admin.from("developers").update({ current_week_contributions: weeklyContribs }).eq("id", developer.id);
    }

    const { count: unseenCount } = await this.admin
      .from("developer_achievements")
      .select("achievement_id", { count: "exact", head: true })
      .eq("developer_id", developer.id)
      .eq("seen", false);

    const { data: recentKudos } = await this.admin
      .from("developer_kudos")
      .select("giver_id, given_date")
      .eq("receiver_id", developer.id)
      .order("given_date", { ascending: false })
      .limit(10);

    let raidsSinceLast: Array<{ attacker_login: string; success: boolean; created_at: string }> = [];
    try {
      const lastCheckin = developer.last_checkin_date as string | null;
      const { data: recentRaids } = await this.admin
        .from("raids")
        .select("attacker_id, success, created_at, attacker:developers!raids_attacker_id_fkey(github_login)")
        .eq("defender_id", developer.id)
        .gt("created_at", lastCheckin ?? "1970-01-01")
        .order("created_at", { ascending: false })
        .limit(5);

      raidsSinceLast = (recentRaids ?? []).map((raid) => ({
        attacker_login:
          (raid.attacker as unknown as { github_login: string })?.github_login ?? "unknown",
        success: raid.success,
        created_at: raid.created_at,
      }));
    } catch (error) {
      console.warn("[dailyMissionService] non-critical raids query error:", error);
    }

    return {
      checked_in: checkinResult.checked_in,
      already_today: checkinResult.already_today ?? false,
      streak: checkinResult.streak,
      longest: checkinResult.longest,
      was_frozen: checkinResult.was_frozen ?? false,
      new_achievements: newAchievements,
      unseen_count: unseenCount ?? 0,
      kudos_since_last: recentKudos?.length ?? 0,
      raids_since_last: raidsSinceLast,
      streak_reward: streakReward,
      xp: xpResult,
    };
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

  private async loadCheckinDeveloper(userId: string): Promise<DailyMissionDeveloper | null> {
    const { data: devData } = await this.admin
      .from("developers")
      .select(
        "id, github_login, claimed, contributions, public_repos, total_stars, kudos_count, app_streak, streak_freeze_30d_claimed, last_checkin_date",
      )
      .eq("claimed_by", userId)
      .single();

    let developer: DailyMissionDeveloper | null = devData;

    try {
      const { data: v2Data, error: v2Err } = await this.admin
        .from("developers")
        .select("easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, total_prs")
        .eq("claimed_by", userId)
        .maybeSingle();
      if (!v2Err && developer && v2Data) {
        developer = { ...developer, ...v2Data };
      }
    } catch (error) {
      console.error("[dailyMissionService] schema query failed:", error);
    }

    return developer;
  }

  private async grantStreakReward(
    developerId: number,
    streak: number,
  ): Promise<{ milestone: number; item_id: string; item_name: string } | null> {
    for (const tier of [...STREAK_MILESTONES].reverse()) {
      if (streak < tier.milestone) continue;

      const { data: existing } = await this.admin
        .from("streak_rewards")
        .select("id")
        .eq("developer_id", developerId)
        .eq("milestone", tier.milestone)
        .maybeSingle();
      if (existing) continue;

      const { data: ownedRows } = await this.admin
        .from("purchases")
        .select("item_id")
        .eq("developer_id", developerId)
        .eq("status", "completed");
      const ownedSet = new Set((ownedRows ?? []).map((row: { item_id: string }) => row.item_id));

      const unowned = tier.pool.filter((id) => !ownedSet.has(id));
      const itemId =
        unowned.length > 0
          ? unowned[Math.floor(Math.random() * unowned.length)]
          : tier.pool[Math.floor(Math.random() * tier.pool.length)];

      const { data: rewardInserted } = await this.admin
        .from("streak_rewards")
        .upsert(
          { developer_id: developerId, milestone: tier.milestone, item_id: itemId },
          { onConflict: "developer_id,milestone", ignoreDuplicates: true },
        )
        .select("id")
        .maybeSingle();

      if (!rewardInserted) continue;

      const service = new InventoryEconomyService(this.admin);
      await service.grantRewardItem({
        developerId,
        itemId,
        providerTxId: `streak_reward_${tier.milestone}_${developerId}`,
        supabaseClient: this.admin,
      });

      return {
        milestone: tier.milestone,
        item_id: itemId,
        item_name: ITEM_NAMES[itemId] ?? itemId,
      };
    }

    return null;
  }
}

// Lightweight LeetCode fetch: only current week contributions
async function fetchWeeklyContributions(login: string): Promise<number | null> {
  return fetchLeetCodeWeeklySubmissions(login);
}
