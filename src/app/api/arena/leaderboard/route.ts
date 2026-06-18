import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

function getRankTitle(rating: number, index: number): { title: string; badge: string; rarity: string } {
  if (index <= 10) return { title: "The Sentinel", badge: "badge_legendary", rarity: "legendary" };
  if (rating >= 2200) return { title: "The Grandmaster", badge: "badge_diamond", rarity: "epic" };
  if (rating >= 1800) return { title: "The Architect", badge: "badge_platinum", rarity: "epic" };
  if (rating >= 1500) return { title: "The Builder", badge: "badge_gold", rarity: "rare" };
  if (rating >= 1200) return { title: "The Script Kiddie", badge: "badge_silver", rarity: "rare" };
  return { title: "The Apprentice", badge: "badge_bronze", rarity: "common" };
}

export async function GET(request: NextRequest) {
  const sb = getSupabaseAdmin();
  const { searchParams } = new URL(request.url);
  const rawLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const rawOffset = parseInt(searchParams.get("offset") ?? "", 10);
  const limit = Number.isNaN(rawLimit) ? 100 : Math.min(100, Math.max(1, rawLimit));
  const offset = Number.isNaN(rawOffset) ? 0 : Math.max(0, rawOffset);

  // Query ratings table, ordering by ELO rating desc
  const { data: leaderboard, error } = await sb
    .from("arena_ratings")
    .select(`
      rating,
      problems_solved,
      current_streak,
      best_streak,
      last_solved_at,
      developer:developers!inner (
        github_login,
        lc_username,
        name,
        avatar_url,
        xp_level
      )
    `)
    .order("rating", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Format the response and inject dynamic rank titles
  const formattedLeaderboard = (leaderboard || []).map((row: any, i: number) => {
    const rankIndex = offset + i + 1;
    const rankInfo = getRankTitle(row.rating, rankIndex);
    return {
      rank: rankIndex,
      rating: row.rating,
      problems_solved: row.problems_solved,
      current_streak: row.current_streak,
      best_streak: row.best_streak,
      last_solved_at: row.last_solved_at,
      github_login: row.developer.github_login,
      lc_username: row.developer.lc_username || row.developer.github_login,
      name: row.developer.name || row.developer.github_login,
      avatar_url: row.developer.avatar_url,
      xp_level: row.developer.xp_level,
      rank_title: rankInfo.title,
      rank_badge: rankInfo.badge,
      rank_rarity: rankInfo.rarity
    };
  });

  return NextResponse.json({ leaderboard: formattedLeaderboard });
}

export const dynamic = "force-dynamic";
