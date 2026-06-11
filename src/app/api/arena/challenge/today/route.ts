import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

export async function GET() {
  const sb = getSupabaseAdmin();
  const todayStr = new Date().toISOString().split("T")[0];

  // Fetch today's challenges
  const { data: challenges, error } = await sb
    .from("arena_challenges")
    .select(`
      id,
      difficulty,
      challenge_date,
      reward_points,
      reward_xp,
      problem:arena_problems (
        id,
        title,
        description,
        difficulty_rating,
        tags,
        time_limit_ms,
        memory_limit_mb,
        sample_tests
      )
    `)
    .eq("challenge_date", todayStr);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Check if user is logged in to return their solve status
  const clientSupabase = await createServerSupabase();
  const { data: { user } } = await clientSupabase.auth.getUser();

  const submissionStatus: Record<string, string> = {}; // challenge_id -> status ('accepted', etc.)
  if (user) {
    // Get developer record
    const { data: dev } = await sb
      .from("developers")
      .select("id")
      .eq("claimed_by", user.id)
      .single();

    if (dev) {
      // Fetch submissions for today's challenges
      const challengeIds = challenges?.map((c) => c.id) ?? [];
      if (challengeIds.length > 0) {
        const { data: subs } = await sb
          .from("arena_submissions")
          .select("challenge_id, status")
          .eq("user_id", dev.id)
          .in("challenge_id", challengeIds);

        if (subs) {
          for (const sub of subs) {
            if (sub.challenge_id) {
              if (submissionStatus[sub.challenge_id] !== "accepted") {
                submissionStatus[sub.challenge_id] = sub.status;
              }
            }
          }
        }
      }
    }
  }

  const formattedChallenges = challenges?.map((ch) => ({
    id: ch.id,
    difficulty: ch.difficulty,
    challenge_date: ch.challenge_date,
    reward_points: ch.reward_points,
    reward_xp: ch.reward_xp,
    problem: ch.problem,
    status: submissionStatus[ch.id] || "unattempted",
  })) ?? [];

  return NextResponse.json({ challenges: formattedChallenges });
}
export const dynamic = "force-dynamic";
