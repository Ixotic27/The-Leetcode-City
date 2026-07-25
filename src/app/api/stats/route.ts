import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Returns aggregate platform statistics without authentication. */
export async function GET() {
  const sb = getSupabaseAdmin();

  const [{ data: devs, error: devsError }, { data: topDevs, error: topError }] = await Promise.all([
    sb
      .from("developers")
      .select("contributions", { count: "exact", head: true }),
    sb
      .from("developers")
      .select("github_login, contributions, total_stars")
      .order("contributions", { ascending: false })
      .limit(10),
  ]);

  if (devsError) {
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }

  return NextResponse.json(
    {
      total_developers: devs?.count ?? 0,
      top_contributors: topDevs ?? [],
      fetched_at: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "public, s-maxage=300" } },
  );
}
