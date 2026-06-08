import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

const REPO_OWNER = "Ixotic27";
const REPO_NAME = "The-Leetcode-City";

function ghHeaders(): HeadersInit {
  const h: HeadersInit = {
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "leetcode-city-app",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function isStargazer(login: string): Promise<boolean> {
  const targetRepo = `${REPO_OWNER}/${REPO_NAME}`.toLowerCase();
  let page = 1;

  // We check the user's starred repos instead of the repo's stargazers.
  // GitHub returns starred repos sorted by `created` desc by default,
  // meaning recent stars are on the first page!
  while (page <= 30) {
    const res = await fetch(
      `https://api.github.com/users/${login}/starred?per_page=100&page=${page}`,
      { headers: ghHeaders() },
    );
    if (!res.ok) {
      if (res.status === 403 || res.status === 429) {
        throw new Error("GitHub API rate limit exceeded. Please try again later.");
      }
      return false;
    }

    const repos = (await res.json()) as { full_name: string }[];
    if (repos.length === 0) break;

    if (repos.some((r) => r.full_name.toLowerCase() === targetRepo)) return true;
    if (repos.length < 100) break;
    page++;
  }

  return false;
}

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ok } = rateLimit(`github_star:${user.id}`, 1, 5000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const githubLogin = (
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  if (!githubLogin) {
    return NextResponse.json({ error: "No LeetCode login" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { data: dev } = await sb
    .from("developers")
    .select("id, claimed")
    .eq("claimed_by", user.id)
    .single();

  if (!dev || !dev.claimed) {
    return NextResponse.json({ error: "Must claim building first" }, { status: 403 });
  }

  // Idempotent: already owns the item
  const { data: existing } = await sb
    .from("purchases")
    .select("id")
    .eq("developer_id", dev.id)
    .eq("item_id", "github_star")
    .eq("status", "completed")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, verified: true, already_owned: true });
  }

  // Check LeetCode star
  let starred = false;
  try {
    starred = await isStargazer(githubLogin);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to verify star" }, { status: 500 });
  }

  if (!starred) {
    return NextResponse.json({ ok: true, verified: false });
  }

  // Grant the item
  await sb.from("purchases").insert({
    developer_id: dev.id,
    item_id: "github_star",
    provider: "free",
    provider_tx_id: `github_star_${dev.id}`,
    amount_cents: 0,
    currency: "usd",
    status: "completed",
  });

  // Activity feed event
  await sb.from("activity_feed").insert({
    event_type: "github_star_verified",
    actor_id: dev.id,
    metadata: { login: githubLogin },
  });

  return NextResponse.json({ ok: true, verified: true });
}
