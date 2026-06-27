import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

type ScoreRow = {
  user_id: string;
  best_ms: number;
  attempts: number;
  updated_at: string;
};

type DevLoginRow = {
  user_id: string;
  github_login: string;
};

// GET /api/arcade/leaderboard?game=10s_classic&limit=10
export async function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get("game") ?? "10s_classic";
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10), 50);

  const sb = getSupabaseAdmin();
  let data: ScoreRow[] = [];
  try {
    const { data: dbData, error } = await sb
      .from("arcade_scores")
      .select("user_id, best_ms, attempts, updated_at")
      .eq("game", game)
      .order("best_ms", { ascending: true })
      .limit(limit);

    if (error) {
      throw error;
    }
    data = dbData ?? [];
  } catch (e) {
    console.warn("Could not query arcade_scores leaderboard:", e);
  }

  // Fetch logins for the user_ids
  const userIds = data.map((r) => r.user_id);
  let loginMap: Record<string, string> = {};

  if (userIds.length > 0) {
    try {
      const { data: devRows } = await sb
        .from("developers")
        .select("user_id, github_login")
        .in("user_id", userIds);

      const devs = (devRows ?? []) as DevLoginRow[];
      if (devs.length > 0) {
        loginMap = Object.fromEntries(devs.map((d) => [d.user_id, d.github_login]));
      }
    } catch (e) {
      console.warn("Could not query developers for leaderboard logins:", e);
    }
  }

  const leaderboard = data.map((row, i) => ({
    rank: i + 1,
    login: loginMap[row.user_id] ?? "anonymous",
    best_ms: row.best_ms,
    attempts: row.attempts,
  }));

  return NextResponse.json({ leaderboard }, {
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}
