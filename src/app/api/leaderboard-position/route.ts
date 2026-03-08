import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") ?? "contributors";
  const login = searchParams.get("login")?.toLowerCase();

  if (!login) {
    return NextResponse.json({ error: "Missing login" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { data: dev } = await sb
    .from("developers")
    .select("id, github_login, name, avatar_url, contributions, contributions_total, total_stars, public_repos, lc_global_rank, referral_count, kudos_count, lc_streak, contest_rating, xp_total, easy_solved")
    .eq("github_login", login)
    .single();

  if (!dev) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let position: number | null = null;
  let metricValue = "";

  if (tab === "solved") {
    const contribs = (dev.contributions_total && dev.contributions_total > 0) ? dev.contributions_total : dev.contributions;
    const { count } = await sb
      .from("developers")
      .select("id", { count: "exact", head: true })
      .not("easy_solved", "is", null)
      .gt("contributions", dev.contributions); // Assuming contributions holds the "solved" count
    position = (count ?? 0) + 1;
    metricValue = contribs.toLocaleString() + " solved";
  } else if (tab === "lc_rank") {
    position = dev.lc_global_rank;
    metricValue = dev.lc_global_rank && dev.lc_global_rank < 999999 ? `#${dev.lc_global_rank.toLocaleString()}` : "Unranked";
  } else if (tab === "streak") {
    const { count } = await sb
      .from("developers")
      .select("id", { count: "exact", head: true })
      .not("easy_solved", "is", null)
      .gt("lc_streak", dev.lc_streak ?? 0);
    position = (count ?? 0) + 1;
    metricValue = (dev.lc_streak ?? 0).toString() + " days";
  } else if (tab === "contest") {
    const { count } = await sb
      .from("developers")
      .select("id", { count: "exact", head: true })
      .not("easy_solved", "is", null)
      .gt("contest_rating", dev.contest_rating ?? 0);
    position = (count ?? 0) + 1;
    metricValue = (dev.contest_rating ?? 0).toLocaleString();
  } else if (tab === "xp") {
    const { count } = await sb
      .from("developers")
      .select("id", { count: "exact", head: true })
      .not("easy_solved", "is", null)
      .gt("xp_total", dev.xp_total ?? 0);
    position = (count ?? 0) + 1;
    metricValue = (dev.xp_total ?? 0).toLocaleString();
  } else if (tab === "achievers") {
    const { count: userAchCount } = await sb
      .from("developer_achievements")
      .select("id", { count: "exact", head: true })
      .eq("developer_id", dev.id);
    const achCount = userAchCount ?? 0;
    // Count how many devs have more achievements using DB-side aggregation
    const { count: devsAbove } = await sb.rpc("count_devs_with_more_achievements", {
      target_count: achCount,
    });
    position = (devsAbove ?? 0) + 1;
    metricValue = String(achCount);
  }

  return NextResponse.json(
    {
      github_login: dev.github_login,
      name: dev.name,
      avatar_url: dev.avatar_url,
      position,
      metricValue,
    },
    {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    }
  );
}
