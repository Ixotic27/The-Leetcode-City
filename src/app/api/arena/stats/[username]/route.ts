import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

import { getAuthenticatedDeveloper } from "@/lib/arena";

function getRankTitle(rating: number, rank: number): { title: string; badge: string; rarity: string } {
  if (rank > 0 && rank <= 10) return { title: "The Sentinel", badge: "badge_legendary", rarity: "legendary" };
  if (rating >= 2200) return { title: "The Grandmaster", badge: "badge_diamond", rarity: "epic" };
  if (rating >= 1800) return { title: "The Architect", badge: "badge_platinum", rarity: "epic" };
  if (rating >= 1500) return { title: "The Builder", badge: "badge_gold", rarity: "rare" };
  if (rating >= 1200) return { title: "The Script Kiddie", badge: "badge_silver", rarity: "rare" };
  return { title: "The Apprentice", badge: "badge_bronze", rarity: "common" };
}

export async function GET(
  request: NextRequest,
  props: { params: Promise<{ username: string }> }
) {
  const params = await props.params;
  const username = params.username.toLowerCase();
  const sb = getSupabaseAdmin();

  // 1. Fetch developer by username
  type DevStats = { id: number; name: string | null; github_login: string; avatar_url: string | null; xp_level: number };
  let dev: DevStats | null = null;
  let devError: { message: string; code?: string } | null = null;

  // Check if authenticated user is fetching their own stats
  const authHeader = request.headers.get("Authorization");
  if (authHeader) {
    const token = authHeader.replace("Bearer ", "");
    try {
      const { data: { user } } = await sb.auth.getUser(token);
      if (user) {
        const { data: authedDev, error: authedError } = await sb
          .from("developers")
          .select("id, name, github_login, avatar_url, xp_level")
          .eq("claimed_by", user.id)
          .maybeSingle();
        
        if (authedDev) {
          const metaUser = (user.user_metadata?.user_name ?? user.user_metadata?.preferred_username ?? "").toLowerCase();
          if (username === "me" || username === authedDev.github_login.toLowerCase() || username === metaUser) {
            dev = authedDev;
          }
        }
      }
    } catch (e) {
      console.error("[app/api/arena/stats/[username]/route.ts] auth getUser failure:", e);
    }
  }

  // Support VS Code extension apiKey or cookie session via getAuthenticatedDeveloper if username === "me"
  if (!dev && username === "me") {
    const authedDev = await getAuthenticatedDeveloper(request);
    if (authedDev) {
      const { data: fullDev } = await sb
        .from("developers")
        .select("id, name, github_login, avatar_url, xp_level")
        .eq("id", authedDev.id)
        .maybeSingle();
      if (fullDev) {
        dev = fullDev;
      }
    }
  }

  // Fallback to query by github_login if not resolved via auth
  if (!dev) {
    const { data: queryDev, error: queryError } = await sb
      .from("developers")
      .select("id, name, github_login, avatar_url, xp_level")
      .eq("github_login", username)
      .maybeSingle();
    dev = queryDev;
    devError = queryError;
  }

  if (devError || !dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  // 2. Fetch rating info
  const { data: ratingRecord, error: ratingError } = await sb
    .from("arena_ratings")
    .select("*")
    .eq("user_id", dev.id)
    .maybeSingle();

  const rating = ratingRecord?.rating ?? 1200;
  
  // Calculate leaderboard rank
  let rank = 0;
  if (ratingRecord) {
    const { count, error: countError } = await sb
      .from("arena_ratings")
      .select("user_id", { count: "exact", head: true })
      .gt("rating", rating);
    if (!countError && count !== null) {
      rank = count + 1;
    }
  }

  const rankInfo = getRankTitle(rating, rank);

  // 3. Fetch recent submissions
  const { data: submissions, error: subError } = await sb
    .from("arena_submissions")
    .select(`
      id,
      language,
      status,
      tests_passed,
      tests_total,
      execution_time_ms,
      submitted_at,
      problem:arena_problems (
        id,
        title,
        difficulty
      )
    `)
    .eq("user_id", dev.id)
    .order("submitted_at", { ascending: false })
    .limit(10);

  const formattedStats = {
    developer: {
      id: dev.id,
      name: dev.name || dev.github_login,
      github_login: dev.github_login,
      avatar_url: dev.avatar_url,
      xp_level: dev.xp_level
    },
    stats: {
      rating,
      rank: rank || null,
      problems_solved: ratingRecord?.problems_solved ?? 0,
      problems_attempted: ratingRecord?.problems_attempted ?? 0,
      current_streak: ratingRecord?.current_streak ?? 0,
      best_streak: ratingRecord?.best_streak ?? 0,
      last_solved_at: ratingRecord?.last_solved_at ?? null,
      rank_title: rankInfo.title,
      rank_badge: rankInfo.badge,
      rank_rarity: rankInfo.rarity
    },
    recent_submissions: (submissions || []).map((sub: Record<string, unknown>) => ({
      id: sub.id,
      language: sub.language,
      status: sub.status,
      tests_passed: sub.tests_passed,
      tests_total: sub.tests_total,
      execution_time_ms: sub.execution_time_ms,
      submitted_at: sub.submitted_at,
      problem: sub.problem
    }))
  };

  return NextResponse.json(formattedStats);
}

export const dynamic = "force-dynamic";
