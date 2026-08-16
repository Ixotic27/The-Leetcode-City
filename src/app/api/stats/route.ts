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
      // Aggregate in the database instead of shipping every developer row to
      // the Node process (#1660). Falls back to a bounded client-side scan if
      // the RPC is unavailable (e.g. migration not yet applied).
      sb.rpc("get_city_solve_totals"),
    ]);

    const queryError =
      totalResult.error ?? claimedResult.error ?? tallestResult.error ?? solveResult.error;
    if (queryError) {
      throw queryError;
    }

    const totalDevelopers = totalResult.count ?? 0;

    const claimedBuildings = claimedResult.count ?? 0;

    const rpcData = solveResult.data as
      | { total_solves?: number; total_developers?: number }
      | undefined;
    const totalSolves = rpcData?.total_solves ?? 0;

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
