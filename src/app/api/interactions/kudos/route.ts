import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { checkAchievements } from "@/lib/achievements";
import { touchLastActive } from "@/lib/notification-helpers";
import { trackDailyMission } from "@/lib/dailies";
import { getUtcDateStrings } from "@/lib/utc-date";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { receiver_login } = await request.json();
  if (!receiver_login || typeof receiver_login !== "string") {
    return NextResponse.json({ error: "Missing receiver_login" }, { status: 400 });
  }

  const { ok } = rateLimit(`kudos:${user.id}`, 1, 1000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const admin = getSupabaseAdmin();

  const { data: giver } = await admin
    .from("developers")
    .select("id, github_login, claimed, contributions, public_repos, total_stars, kudos_count, kudos_streak, last_kudos_given_date, easy_solved, medium_solved, hard_solved, contest_rating, lc_streak, total_prs")
    .eq("claimed_by", user.id)
    .single();

  const githubLogin = giver?.github_login ?? "";

  if (!giver || !giver.claimed) {
    return NextResponse.json({ error: "Must claim building first" }, { status: 403 });
  }

  const { data: receiver } = await admin
    .from("developers")
    .select("id, claimed, github_login")
    .eq("github_login", receiver_login.toLowerCase())
    .single();

  if (!receiver) {
    return NextResponse.json({ error: "Receiver not found" }, { status: 404 });
  }

  if (giver.id === receiver.id) {
    return NextResponse.json({ error: "Cannot give kudos to yourself" }, { status: 400 });
  }

  const { today, yesterday } = getUtcDateStrings();

  const { data: rpcResult, error: rpcError } = await admin.rpc("insert_kudos_atomic", {
    p_giver_id: giver.id,
    p_receiver_id: receiver.id,
    p_given_date: today,
  });

  if (rpcError) {
    return NextResponse.json({ error: "Failed to give kudos" }, { status: 500 });
  }

  if (!rpcResult.success) {
    return NextResponse.json({ error: rpcResult.error }, { status: 429 });
  }

  await touchLastActive(giver.id);
  await trackDailyMission(giver.id, "give_kudos");
  await trackDailyMission(giver.id, "give_kudos_3");

  await admin.rpc("increment_kudos_count", { target_dev_id: receiver.id });

    await admin.rpc("grant_xp_atomic", { p_developer_id: giver.id, p_source: "kudos_given", p_amount: 3 });
    await admin.rpc("grant_xp_atomic", { p_developer_id: receiver.id, p_source: "kudos_received", p_amount: 1 });

  await admin.from("activity_feed").insert({
    event_type: "kudos_given",
    actor_id: giver.id,
    target_id: receiver.id,
    metadata: {
      giver_login: githubLogin,
      receiver_login: receiver.github_login,
    },
  });

  const lastKudosDate = giver.last_kudos_given_date as string | null;
  let newKudosStreak = giver.kudos_streak ?? 0;

  if (lastKudosDate === today) {
  } else if (lastKudosDate === yesterday) {
    newKudosStreak += 1;
  } else {
    newKudosStreak = 1;
  }

  await admin
    .from("developers")
    .update({ kudos_streak: newKudosStreak, last_kudos_given_date: today })
    .eq("id", giver.id);

  try {
    await admin.rpc("increment_kudos_week", {
      p_giver_id: giver.id,
      p_receiver_id: receiver.id,
    });
  } catch (err) {
    console.warn("[app/api/interactions/kudos/route.ts] non-critical error:", err);
  }

  await checkAchievements(giver.id, {
    contributions: giver.contributions ?? 0,
    public_repos: giver.public_repos ?? 0,
    total_stars: giver.total_stars ?? 0,
    referral_count: 0,
    kudos_count: giver.kudos_count ?? 0,
    gifts_sent: 0,
    gifts_received: 0,
    kudos_streak: newKudosStreak,
    easy_solved: giver.easy_solved ?? 0,
    medium_solved: giver.medium_solved ?? 0,
    hard_solved: giver.hard_solved ?? 0,
    contest_rating: giver.contest_rating ?? 0,
    lc_streak: giver.lc_streak ?? 0,
    total_prs: giver.total_prs ?? 0,
  }, githubLogin);

  return NextResponse.json({ ok: true });
}