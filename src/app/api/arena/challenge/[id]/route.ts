import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedDeveloper } from "@/lib/arena";

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  // Authenticate user (supporting extension API key or browser cookie)
  const dev = await getAuthenticatedDeveloper(request);
  if (!dev) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const challengeId = params.id;

  // Fetch the challenge
  const { data: challenge, error } = await sb
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
        sample_tests,
        hidden_tests
      )
    `)
    .eq("id", challengeId)
    .maybeSingle();

  if (error || !challenge) {
    return NextResponse.json({ error: "Challenge not found" }, { status: 404 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const prob = challenge.problem as any;
  if (!prob) {
    return NextResponse.json({ error: "Associated problem not found" }, { status: 404 });
  }

  const responsePayload = {
    id: challenge.id,
    difficulty: challenge.difficulty,
    challenge_date: challenge.challenge_date,
    reward_points: challenge.reward_points,
    reward_xp: challenge.reward_xp,
    problem: {
      id: prob.id,
      title: prob.title,
      description: prob.description,
      difficulty_rating: prob.difficulty_rating,
      tags: prob.tags,
      time_limit_ms: prob.time_limit_ms,
      memory_limit_mb: prob.memory_limit_mb,
      sample_tests: prob.sample_tests,
      hidden_tests: prob.hidden_tests || []
    }
  };

  return NextResponse.json(responsePayload);
}

export const dynamic = "force-dynamic";
