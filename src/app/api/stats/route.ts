import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * Public aggregate statistics for the LeetCode City.
 * No authentication required.
 */
export async function GET() {
  const sb = getSupabaseAdmin();

  const { data: stats, error: statsError } = await sb
    .from("city_stats")
    .select("total_developers, total_contributions")
    .eq("id", 1)
    .single();

  if (statsError) {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }

// Explicit null guard to prevent unexpected behavior with null last_active_at values
  const { count: activeToday } = await sb
    .from("developers")
    .select("id", { count: "exact", head: true })
    .not("last_active_at", "is", null)
    .gte("last_active_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

  return NextResponse.json(
    {
      total_developers: stats?.total_developers ?? 0,
      total_contributions: stats?.total_contributions ?? 0,
      active_today: activeToday ?? 0,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300, stale-while-revalidate=600",
      },
    }
  );
}
