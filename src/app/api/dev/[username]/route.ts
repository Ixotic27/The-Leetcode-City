import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isRateLimited(key: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const ipHash = await hashKey(key);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await sb
    .from("add_requests")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo);

  return (count ?? 0) >= 15; // increased limit
}

async function recordRateLimitRequest(key: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const ipHash = await hashKey(key);
  await sb.from("add_requests").insert({ ip_hash: ipHash });
}

const LC_HEADERS = {
  "Content-Type": "application/json",
  "Referer": "https://leetcode.com",
  "User-Agent": "Mozilla/5.0",
};

async function fetchLeetCodeUser(username: string) {
  /* Updated to return rich data including globalRanking */
  const query = `
    query($username: String!) {
      matchedUser(username: $username) {
        username
        profile { realName userAvatar ranking reputation }
        submitStats {
          acSubmissionNum { difficulty count }
          totalSubmissionNum { difficulty count }
        }
        userCalendar { streak totalActiveDays }
      }
      userContestRanking(username: $username) { 
        rating 
        globalRanking
      }
    }
  `;
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: LC_HEADERS,
      body: JSON.stringify({ query, variables: { username } }),
    });
    const json = await res.json();
    return json?.data ?? null;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const sb = getSupabaseAdmin();

  const { data: cached } = await sb
    .from("developers")
    .select("*")
    .eq("github_login", username.toLowerCase())
    .single();

  if (cached) {
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (age < 12 * 60 * 60 * 1000) { // 12h cache
      return NextResponse.json(cached);
    }
  }

  // Rate limit check
  let rateLimitKey: string | null = null;
  if (!cached) {
    let key: string;
    try {
      const authClient = await createServerSupabase();
      const { data: { user } } = await authClient.auth.getUser();
      key = user ? `user:${user.id}` : (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
      );
    } catch {
      key = "unknown";
    }
    rateLimitKey = key;
    if (await isRateLimited(key)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }

  const data = await fetchLeetCodeUser(username);
  if (!data?.matchedUser) {
    return NextResponse.json({ error: "User not found on LeetCode" }, { status: 404 });
  }

  const user = data.matchedUser;
  const acNums = user.submitStats?.acSubmissionNum ?? [];
  const totNums = user.submitStats?.totalSubmissionNum ?? [];
  const getAC = (d: string) => acNums.find((x: any) => x.difficulty === d)?.count ?? 0;
  const getTot = (d: string) => totNums.find((x: any) => x.difficulty === d)?.count ?? 1;

  const totalSolved = getAC("All");
  const totalSub = getTot("All");
  const activeDays = user.userCalendar?.totalActiveDays ?? 0;
  const lcRank = user.profile?.ranking ?? 999999;
  const litPercentage = Math.min(0.92, Math.max(0.15, activeDays / 365));

  // Stable ID from username
  let hash = 0;
  for (const ch of username) hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0;

  const record = {
    github_login: username.toLowerCase(),
    github_id: Math.abs(hash),
    name: user.profile?.realName || user.username,
    avatar_url: user.profile?.userAvatar || "",
    contributions: Math.max(1, totalSolved),
    contributions_total: Math.round(litPercentage * 1000),
    total_stars: user.profile?.reputation || 0,
    public_repos: Math.max(0, 500000 - lcRank),
    rank: lcRank,
    lc_global_rank: lcRank, // Populate official rank
    fetched_at: new Date().toISOString(),
    // LC-specific
    easy_solved: getAC("Easy"),
    medium_solved: getAC("Medium"),
    hard_solved: getAC("Hard"),
    acceptance_rate: totalSub > 0 ? Math.round((totalSolved / totalSub) * 100) / 100 : 0,
    contest_rating: Math.round(data.userContestRanking?.rating ?? 0),
    contest_rank: data.userContestRanking?.globalRanking ?? null,
    lc_streak: user.userCalendar?.streak ?? 0,
    active_days_last_year: activeDays,
  };

  const { data: upserted, error: upsertError } = await sb
    .from("developers")
    .upsert(record, { onConflict: "github_login" })
    .select()
    .single();

  if (upsertError) {
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  // Round 2: Fetch customizations and items to return a full building record
  const [purchasesResult, giftPurchasesResult, customizationsResult, raidTagsResult] = await Promise.all([
    sb
      .from("purchases")
      .select("item_id")
      .eq("developer_id", upserted.id)
      .is("gifted_to", null)
      .eq("status", "completed"),
    sb
      .from("purchases")
      .select("item_id")
      .eq("gifted_to", upserted.id)
      .eq("status", "completed"),
    sb
      .from("developer_customizations")
      .select("item_id, config")
      .eq("developer_id", upserted.id)
      .in("item_id", ["custom_color", "billboard", "loadout", "building_style"]),
    sb
      .from("raid_tags")
      .select("attacker_login, tag_style, expires_at")
      .eq("building_id", upserted.id)
      .eq("active", true),
  ]);

  const ownedItems = [
    ...(purchasesResult.data ?? []).map(p => p.item_id),
    ...(giftPurchasesResult.data ?? []).map(p => p.item_id),
  ];

  const customColor = (customizationsResult.data ?? []).find(c => c.item_id === "custom_color")?.config?.color ?? null;
  const billboardConfig = (customizationsResult.data ?? []).find(c => c.item_id === "billboard")?.config;
  const billboardImages = Array.isArray(billboardConfig?.images) ? billboardConfig.images : (billboardConfig?.image_url ? [billboardConfig.image_url] : []);
  const loadoutConfig = (customizationsResult.data ?? []).find(c => c.item_id === "loadout")?.config;
  const loadout = loadoutConfig ? {
    crown: loadoutConfig.crown ?? null,
    roof: loadoutConfig.roof ?? null,
    aura: loadoutConfig.aura ?? null,
  } : null;

  const buildingStyle = (customizationsResult.data ?? []).find(c => c.item_id === "building_style")?.config?.style ?? "tower";

  const result = {
    ...upserted,
    owned_items: ownedItems,
    custom_color: customColor,
    billboard_images: billboardImages,
    loadout: loadout,
    building_style: buildingStyle,
    active_raid_tag: raidTagsResult.data?.[0] ?? null,
  };

  if (rateLimitKey) await recordRateLimitRequest(rateLimitKey);

  return NextResponse.json(result);
}
