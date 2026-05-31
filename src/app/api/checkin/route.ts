import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { checkAchievements } from "@/lib/achievements";
import { ITEM_NAMES } from "@/lib/zones";
import { touchLastActive } from "@/lib/notification-helpers";
import { sendStreakMilestoneNotification } from "@/lib/notification-senders/streak";
import { sendStreakBrokenNotification } from "@/lib/notification-senders/streak-broken";
import { trackDailyMission } from "@/lib/dailies";
import { fetchLeetCodeWeeklySubmissions } from "@/lib/leetcode";
import type { SupabaseClient } from "@supabase/supabase-js";

// A12: Streak reward milestones — {milestone: days, pool: item_ids to pick from}
const STREAK_MILESTONES = [
  { milestone: 3, pool: ["flag"] },
  { milestone: 7, pool: ["satellite_dish", "antenna_array", "rooftop_garden", "neon_trim"] },
  { milestone: 14, pool: ["neon_outline", "rooftop_fire", "hologram_ring"] },
  { milestone: 30, pool: ["lightning_aura", "pool_party", "crown_item"] },
];

async function grantStreakReward(
  sb: SupabaseClient,
  developerId: number,
  streak: number,
): Promise<{ milestone: number; item_id: string; item_name: string } | null> {
  // Find highest unclaimed milestone the user qualifies for
  for (const tier of [...STREAK_MILESTONES].reverse()) {
    if (streak < tier.milestone) continue;

    // Check if already claimed
    const { data: existing } = await sb
      .from("streak_rewards")
      .select("id")
      .eq("developer_id", developerId)
      .eq("milestone", tier.milestone)
      .maybeSingle();
    if (existing) continue;

    // Pick a random item from pool that user doesn't own yet
    const { data: ownedRows } = await sb
      .from("purchases")
      .select("item_id")
      .eq("developer_id", developerId)
      .eq("status", "completed");
    const ownedSet = new Set((ownedRows ?? []).map((r: { item_id: string }) => r.item_id));

    const unowned = tier.pool.filter((id) => !ownedSet.has(id));
    const itemId = unowned.length > 0
      ? unowned[Math.floor(Math.random() * unowned.length)]
      : tier.pool[Math.floor(Math.random() * tier.pool.length)]; // fallback: grant anyway

    // Record the reward first — upsert guards against concurrent duplicate grants.
    // If another request already inserted this milestone, do nothing and skip.
    const { data: rewardInserted } = await sb
      .from("streak_rewards")
      .upsert(
        { developer_id: developerId, milestone: tier.milestone, item_id: itemId },
        { onConflict: "developer_id,milestone", ignoreDuplicates: true }
      )
      .select("id")
      .maybeSingle();

    // Only grant the item if we actually inserted the reward row (not a duplicate)
    if (!rewardInserted) continue;

    // Grant the item
    await sb.from("purchases").upsert({
      developer_id: developerId,
      item_id: itemId,
      provider: "free",
      provider_tx_id: `streak_reward_${tier.milestone}_${developerId}`,
      amount_cents: 0,
      currency: "usd",
      status: "completed",
    }, { onConflict: "provider_tx_id", ignoreDuplicates: true });

    return {
      milestone: tier.milestone,
      item_id: itemId,
      item_name: ITEM_NAMES[itemId] ?? itemId,
    };
  }

  return null;
}

// Lightweight LeetCode fetch: only current week contributions
async function fetchWeeklyContributions(login: string): Promise<number | null> {
  return fetchLeetCodeWeeklySubmissions(login);
}

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Per-user rate limit: 1 req/5s
  const { ok } = rateLimit(`checkin:${user.id}`, 1, 5000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const sb = getSupabaseAdmin();

  // Fetch developer (must be claimed)
  const { data: dev } = await sb
    .from("developers")
    .select("id, github_login, claimed, contributions, public_repos, total_stars, kudos_count, app_streak, streak_freeze_30d_claimed, last_checkin_date")
    .eq("claimed_by", user.id)
    .single();

  const githubLogin = dev?.github_login ?? "";

  if (!dev || !dev.claimed) {
    return NextResponse.json({ error: "Must claim building first" }, { status: 403 });
  }

  // Perform check-in via RPC
  const { data: result, error: rpcError } = await sb.rpc("perform_checkin", {
    p_developer_id: dev.id,
  });

  if (rpcError) {
    console.error("perform_checkin RPC error:", rpcError);
    return NextResponse.json({ error: "Check-in failed" }, { status: 500 });
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
    return NextResponse.json({ error: checkinResult.error }, { status: 400 });
  }

  // Track activity
  await touchLastActive(dev.id);
  await trackDailyMission(dev.id, "checkin");

  // Detect streak broken: previous streak was >= 7, now reset to 1, and freeze didn't save them
  const previousStreak = dev.app_streak ?? 0;
  if (
    checkinResult.checked_in &&
    checkinResult.streak === 1 &&
    previousStreak >= 7 &&
    !checkinResult.was_frozen
  ) {
    const today = new Date().toISOString().split("T")[0];
    sendStreakBrokenNotification(dev.id, githubLogin, previousStreak, today);
  }

  let newAchievements: string[] = [];
  let streakReward: { milestone: number; item_id: string; item_name: string } | null = null;
  let xpResult: { granted: number; new_total: number; new_level: number } | null = null;

  // Grant XP for check-in
  if (checkinResult.checked_in) {
    const { data: xpData } = await sb.rpc("grant_xp", { p_developer_id: dev.id, p_source: "checkin", p_amount: 10 });
    if (xpData) xpResult = xpData as { granted: number; new_total: number; new_level: number };
  }

  if (checkinResult.checked_in) {
    // Check achievements with updated streak
    const referralCount = 0; // Not fetched here, achievements will check existing unlocks
    const giftsSent = 0;
    const giftsReceived = 0;

    newAchievements = await checkAchievements(dev.id, {
      contributions: dev.contributions,
      public_repos: dev.public_repos,
      total_stars: dev.total_stars,
      referral_count: referralCount,
      kudos_count: dev.kudos_count ?? 0,
      gifts_sent: giftsSent,
      gifts_received: giftsReceived,
      app_streak: checkinResult.streak,
    }, githubLogin);

    // Grant 1 free freeze at 30-day streak milestone
    if (checkinResult.streak >= 30 && !dev.streak_freeze_30d_claimed) {
      await sb.rpc("grant_streak_freeze", { p_developer_id: dev.id });
      await sb
        .from("developers")
        .update({ streak_freeze_30d_claimed: true })
        .eq("id", dev.id);
      await sb.from("streak_freeze_log").insert({
        developer_id: dev.id,
        action: "granted_milestone",
      });
    }

    // A12: Streak rewards - grant free items at milestones
    streakReward = await grantStreakReward(sb, dev.id, checkinResult.streak);

    // Streak milestone notifications (7, 30, 100, 365)
    if ([7, 30, 100, 365].includes(checkinResult.streak)) {
      sendStreakMilestoneNotification(
        dev.id,
        githubLogin,
        checkinResult.streak,
        checkinResult.longest,
        streakReward?.item_name,
      );
    }

    // Insert feed event
    await sb.from("activity_feed").insert({
      event_type: "streak_checkin",
      actor_id: dev.id,
      metadata: {
        login: githubLogin,
        streak: checkinResult.streak,
        was_frozen: checkinResult.was_frozen ?? false,
        reward: streakReward?.item_id ?? null,
      },
    });
  }

  // Refresh weekly contributions from LeetCode
  const weeklyContribs = await fetchWeeklyContributions(githubLogin);
  if (weeklyContribs !== null) {
    await sb.from("developers")
      .update({ current_week_contributions: weeklyContribs })
      .eq("id", dev.id);
  }

  // Count unseen achievements
  const { count: unseenCount } = await sb
    .from("developer_achievements")
    .select("achievement_id", { count: "exact", head: true })
    .eq("developer_id", dev.id)
    .eq("seen", false);

  // Fetch kudos received since last check-in
  const { data: recentKudos } = await sb
    .from("developer_kudos")
    .select("giver_id, given_date")
    .eq("receiver_id", dev.id)
    .order("given_date", { ascending: false })
    .limit(10);

  // Fetch raids targeting this dev since last checkin (raids table may not exist yet)
  let raidsSinceLast: { attacker_login: string; success: boolean; created_at: string }[] = [];
  try {
    const lastCheckin = dev.last_checkin_date as string | null;
    const { data: recentRaids } = await sb
      .from("raids")
      .select("attacker_id, success, created_at, attacker:developers!raids_attacker_id_fkey(github_login)")
      .eq("defender_id", dev.id)
      .gt("created_at", lastCheckin ?? "1970-01-01")
      .order("created_at", { ascending: false })
      .limit(5);

    raidsSinceLast = (recentRaids ?? []).map((r) => ({
      attacker_login: (r.attacker as unknown as { github_login: string })?.github_login ?? "unknown",
      success: r.success,
      created_at: r.created_at,
    }));
  } catch (err) {
    console.warn("[app/api/checkin/route.ts] non-critical error:", err);
  }
  return NextResponse.json({
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
  });
}
