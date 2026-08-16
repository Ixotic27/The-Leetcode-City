import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { logApiError, newReqId } from "@/lib/api-logger";

/**
 * Public aggregate statistics for the LeetCode City.
 * Returns total developers, claimed buildings, total problem solves,
 * and tallest building metrics. No authentication required.
 */
export async function GET() {
  const reqId = newReqId();
  try {
    const sb = getSupabaseAdmin();

    const [totalResult, claimedResult, tallestResult, solveResult] = await Promise.all([
      sb.from("developers").select("id", { count: "exact", head: true }),
      sb.from("developers").select("id", { count: "exact", head: true }).eq("claimed", true),
      sb
        .from("developers")
        .select("github_login, easy_solved, medium_solved, hard_solved")
        .order("hard_solved", { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from("developers").select("easy_solved, medium_solved, hard_solved"),
    ]);

    const queryError =
      totalResult.error ?? claimedResult.error ?? tallestResult.error ?? solveResult.error;
    if (queryError) {
      throw queryError;
    }

    const totalDevelopers = totalResult.count ?? 0;

    const claimedBuildings = claimedResult.count ?? 0;

    const solves = solveResult.data ?? [];
    const totalSolves = solves.reduce(
      (acc, d) => acc + (d.easy_solved ?? 0) + (d.medium_solved ?? 0) + (d.hard_solved ?? 0),
      0
    );

    const tallestDev = tallestResult.data;
    const tallestBuilding = {
      username: tallestDev?.github_login ?? "—",
      hardSolved: tallestDev?.hard_solved ?? 0,
    };

    return NextResponse.json(
      {
        totalDevelopers,
        claimedBuildings,
        totalSolves,
        tallestBuilding,
        generatedAt: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
        },
      }
    );
  } catch (error) {
    logApiError({ reqId, route: "/api/stats", error, message: "Error generating city stats" });
    return NextResponse.json(
      {
        totalDevelopers: 0,
        claimedBuildings: 0,
        totalSolves: 0,
        tallestBuilding: { username: "—", hardSolved: 0 },
        generatedAt: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
