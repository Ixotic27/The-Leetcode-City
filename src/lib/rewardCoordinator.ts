import { checkAchievements } from "./achievements";

export interface RewardXPGrant {
  source: string;
  amount: number;
}

export interface RewardFeedEvent {
  event_type: string;
  metadata: Record<string, unknown>;
  actor_id?: number;
  target_id?: number | null;
  event_date?: string;
  upsert?: boolean;
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

export interface RewardStats {
  contributions?: number;
  public_repos?: number;
  total_stars?: number;
  referral_count?: number;
  kudos_count?: number;
  gifts_sent?: number;
  gifts_received?: number;
  app_streak?: number;
  kudos_streak?: number;
  raid_xp?: number;
  purchases?: number;
  dailies_completed?: number;
  easy_solved?: number;
  medium_solved?: number;
  hard_solved?: number;
  contest_rating?: number;
  lc_streak?: number;
  total_prs?: number;
}

export interface RewardCoordinationInput {
  developerId: number;
  actorLogin?: string;
  stats?: RewardStats;
  xpGrants?: RewardXPGrant[];
  feedEvent?: RewardFeedEvent;
}

export interface RewardCoordinationResult {
  newAchievements: string[];
  xpResults: Array<{ source: string; amount: number; success: boolean; error?: unknown }>;
  feedInserted: boolean;
}

type RewardAdminClient = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data?: unknown; error?: { message?: string; code?: string } | null }>;
  from: (table: string) => {
    insert?: (values: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>;
    upsert?: (values: Record<string, unknown>, options?: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>;
  };
};

export async function coordinateRewardSideEffects(
  admin: RewardAdminClient,
  input: RewardCoordinationInput,
): Promise<RewardCoordinationResult> {
  const xpResults: RewardCoordinationResult["xpResults"] = [];

  for (const grant of input.xpGrants ?? []) {
    if (grant.amount <= 0) continue;

    try {
      const { error } = await admin.rpc("grant_xp_atomic", {
        p_developer_id: input.developerId,
        p_source: grant.source,
        p_amount: grant.amount,
      });
      xpResults.push({ source: grant.source, amount: grant.amount, success: !error, error });
    } catch (error) {
      xpResults.push({ source: grant.source, amount: grant.amount, success: false, error });
    }
  }

  let newAchievements: string[] = [];
  if (input.stats) {
    try {
      newAchievements = await checkAchievements(input.developerId, input.stats as never, input.actorLogin);
    } catch (error) {
      console.error("[rewardCoordinator] achievements check failed", error);
    }
  }

  let feedInserted = false;
  if (input.feedEvent) {
    const payload = {
      event_type: input.feedEvent.event_type,
      actor_id: input.feedEvent.actor_id ?? input.developerId,
      target_id: input.feedEvent.target_id ?? null,
      metadata: input.feedEvent.metadata,
      ...(input.feedEvent.event_date ? { event_date: input.feedEvent.event_date } : {}),
    };

    try {
      if (input.feedEvent.upsert) {
        await admin.from("activity_feed").upsert?.(payload, {
          onConflict: input.feedEvent.onConflict ?? "actor_id,event_type,event_date",
          ignoreDuplicates: input.feedEvent.ignoreDuplicates ?? true,
        });
      } else {
        await admin.from("activity_feed").insert?.(payload);
      }
      feedInserted = true;
    } catch (error) {
      console.error("[rewardCoordinator] feed event insert failed", error);
    }
  }

  return { newAchievements, xpResults, feedInserted };
}
