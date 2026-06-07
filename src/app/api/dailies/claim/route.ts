import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { getDailyMissions, getTodayStr } from "@/lib/dailies";
import { checkAchievements } from "@/lib/achievements";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ok } = rateLimit(`dailies-claim:${user.id}`, 2, 10_000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const admin = getSupabaseAdmin();

  const { data: dev } = await admin
    .from("developers")
    .select("id, github_login, claimed, contributions, public_repos, total_stars, kudos_count, dailies_completed, dailies_streak, last_dailies_date, easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, total_prs")
    .eq("claimed_by", user.id)
    .single();

  const githubLogin = dev?.github_login ?? "";

  if (!dev || !dev.claimed) {
    return NextResponse.json({ error: "Must claim building first" }, { status: 403 });
  }

  const today = getTodayStr();

  // Already claimed today
  if (dev.last_dailies_date === today) {
    return NextResponse.json({ error: "Already claimed today" }, { status: 400 });
  }

  // Read isMobile from request body so the server uses the same mission
  // set the client was assigned (mobile excludes desktopOnly missions)
  let isMobile = false;
  try {
    const body = await request.json();
    isMobile = body?.mobile === true;
  } catch {
    // no body or invalid json — default to desktop
  }

  // Verify all 3 missions are completed
  const missions = getDailyMissions(dev.id, today, isMobile);
  const { data: progressRows } = await admin
    .from("daily_mission_progress")
    .select("mission_id, completed")
    .eq("developer_id", dev.id)
    .eq("mission_date", today);

  const completedSet = new Set(
    (progressRows ?? []).filter((r) => r.completed).map((r) => r.mission_id),
  );

  const allDone = missions.every((m) => completedSet.has(m.id));
  if (!allDone) {
    return NextResponse.json({ error: "Not all missions completed" }, { status: 400 });
  }

  // Complete dailies via RPC (handles streak + total atomically)
  const { data: result, error: rpcError } = await admin.rpc("complete_all_dailies", {
    p_developer_id: dev.id,
  });

  if (rpcError) {
    console.error("[dailies] claim RPC error:", rpcError);
    return NextResponse.json({ error: "Failed to claim" }, { status: 500 });
  }

  const claimResult = result as {
    already_completed: boolean;
    streak: number;
    total: number;
  };

  if (claimResult.already_completed) {
    return NextResponse.json({ error: "Already claimed today" }, { status: 400 });
  }

  const points_granted = 15;
  // Grant XP for completing all dailies
  await admin.rpc("grant_xp", { p_developer_id: dev.id, p_source: "dailies", p_amount: 25 });

  // Grant streak freeze every 7 completions (cap at 2)
  // ── BEFORE (read-then-write race): ─────────────────────────────────────────
  //   SELECT streak_freezes_available → check < 2 in JS → call grant_streak_freeze
  //   Two concurrent requests both read 1, both pass, both increment → value = 3.
  //
  // ── AFTER (atomic): ────────────────────────────────────────────────────────
  //   grant_streak_freeze() now does UPDATE ... WHERE streak_freezes_available < 2
  //   and returns { granted: boolean }. Only the first concurrent caller satisfies
  //   the WHERE clause — the second gets ROW_COUNT = 0 → granted = false.
  //   No JS-level SELECT or < 2 check needed; the RPC is the single source of truth.
  let freezeGranted = false;
  if (claimResult.total % 7 === 0) {
    const { data: freezeResult, error: freezeError } = await admin.rpc(
      "grant_streak_freeze",
      { p_developer_id: dev.id }
    );

    if (freezeError) {
      // Non-fatal — log and continue. The daily claim itself succeeded.
      console.error("[dailies] grant_streak_freeze error:", freezeError.message);
    } else {
      // freezeResult is an array of rows: [{ granted: boolean }]
      const granted = freezeResult?.[0]?.granted === true;

      if (granted) {
        // Only insert the log row when the RPC actually incremented.
        // The UNIQUE(developer_id, action, granted_date) constraint on
        // streak_freeze_log (migration 058) prevents duplicate rows even
        // if two concurrent grants both reach here (belt-and-suspenders).
        await admin.from("streak_freeze_log").upsert(
          {
            developer_id: dev.id,
            action: "granted_dailies",
            granted_date: today,
          },
          { onConflict: "developer_id,action,granted_date", ignoreDuplicates: true }
        );
        freezeGranted = true;
      }
    }
  }

  // Insert activity feed event
  await admin.from("activity_feed").insert({
    event_type: "dailies_completed",
    actor_id: dev.id,
    metadata: {
      login: githubLogin,
      streak: claimResult.streak,
      total: claimResult.total,
    },
  });

  // Check dailies achievements
  await checkAchievements(
    dev.id,
    {
      contributions: dev.contributions ?? 0,
      public_repos: dev.public_repos ?? 0,
      total_stars: dev.total_stars ?? 0,
      referral_count: 0,
      kudos_count: dev.kudos_count ?? 0,
      gifts_sent: 0,
      gifts_received: 0,
      dailies_completed: claimResult.total,
      easy_solved: dev.easy_solved ?? 0,
      medium_solved: dev.medium_solved ?? 0,
      hard_solved: dev.hard_solved ?? 0,
      contest_rating: dev.contest_rating ?? 0,
      lc_streak: dev.lc_streak ?? 0,
      total_prs: dev.total_prs ?? 0,
    },
    githubLogin,
  );

  return NextResponse.json({
    ok: true,
    streak: claimResult.streak,
    total: claimResult.total,
    freeze_granted: freezeGranted,
    points_granted: points_granted,
  });
}