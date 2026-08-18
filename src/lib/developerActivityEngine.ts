import { checkAchievements } from "./achievements";
import { touchLastActive } from "./notification-helpers";

// ─── Types ──────────────────────────────────────────────────────────────

export interface ActivityXPGrant {
  source: string;
  amount: number;
}

export interface ActivityFeedEvent {
  eventType: string;
  metadata: Record<string, unknown>;
  actorId?: number;
  targetId?: number | null;
  eventDate?: string;
  upsert?: boolean;
  onConflict?: string;
  ignoreDuplicates?: boolean;
}

export interface ActivityStats {
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

export interface DeveloperActivityInput {
  /** Developer performing the action. */
  developerId: number;
  /** GitHub login (used for feed event metadata and achievement checks). */
  actorLogin?: string;
  /** Developer stats for achievement evaluation. If omitted, achievement checks are skipped. */
  stats?: ActivityStats;
  /** XP grants to execute (each becomes an idempotent grant_xp_atomic call). */
  xpGrants?: ActivityXPGrant[];
  /** Activity feed event to insert after XP grants. */
  feedEvent?: ActivityFeedEvent;
}

export interface DeveloperActivityResult {
  newAchievements: string[];
  xpResults: Array<{ source: string; amount: number; success: boolean; error?: unknown }>;
  feedInserted: boolean;
}

type ActivityAdminClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data?: unknown; error?: { message?: string; code?: string } | null }>;
  from: (table: string) => {
    insert?: (values: Record<string, unknown>) => Promise<{ data?: unknown; error?: unknown }>;
    upsert?: (
      values: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => Promise<{ data?: unknown; error?: unknown }>;
  };
};

// ─── Core Engine ────────────────────────────────────────────────────────

/**
 * Process common post-action side effects for a developer activity.
 *
 * Runs the following pipeline in order:
 * 1. **Last-active update** — fire-and-forget `last_active_at` touch.
 * 2. **XP grants** — each grant calls `grant_xp_atomic` (idempotent).
 * 3. **Activity feed event** — insert (or upsert) a single feed row.
 * 4. **Achievement check** — if `stats` are provided, evaluate and unlock any
 *    newly-earned achievements (with notifications).
 *
 * Domain-specific side effects (daily missions, raid tags, kudos streaks, etc.)
 * remain the caller's responsibility and should be executed alongside or after
 * this call. The engine purposefully avoids coupling to any single domain.
 *
 * All side-effect failures are caught and logged — they never throw — so the
 * caller's response is never disrupted by a background side-effect failure.
 *
 * @example
 * ```ts
 * await processDeveloperActivity(admin, {
 *   developerId: giver.id,
 *   actorLogin: giver.github_login,
 *   stats: { kudos_count: giver.kudos_count, ... },
 *   xpGrants: [
 *     { source: "kudos_given", amount: 3 },
 *     { source: "kudos_received", amount: 1 },
 *   ],
 *   feedEvent: {
 *     eventType: "kudos_given",
 *     metadata: { giver_login, receiver_login },
 *     targetId: receiver.id,
 *   },
 * });
 * ```
 */
export async function processDeveloperActivity(
  admin: ActivityAdminClient,
  input: DeveloperActivityInput,
): Promise<DeveloperActivityResult> {
  // 1. Fire-and-forget last-active update
  touchLastActive(input.developerId);

  // 2. Grant XP (each grant is idempotent via grant_xp_atomic)
  const xpResults: DeveloperActivityResult["xpResults"] = [];
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

  // 3. Insert activity feed event
  let feedInserted = false;
  if (input.feedEvent) {
    const payload = {
      event_type: input.feedEvent.eventType,
      actor_id: input.feedEvent.actorId ?? input.developerId,
      target_id: input.feedEvent.targetId ?? null,
      metadata: input.feedEvent.metadata,
      ...(input.feedEvent.eventDate ? { event_date: input.feedEvent.eventDate } : {}),
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
      console.error("[developerActivityEngine] activity_feed insert failed", error);
    }
  }

  // 4. Check achievements (skipped if stats not provided)
  let newAchievements: string[] = [];
  if (input.stats) {
    try {
      newAchievements = await checkAchievements(
        input.developerId,
        input.stats as never,
        input.actorLogin,
      );
    } catch (error) {
      console.error("[developerActivityEngine] achievements check failed", error);
    }
  }

  return { newAchievements, xpResults, feedInserted };
}
