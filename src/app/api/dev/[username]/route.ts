import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

async function hashKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key + (process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function isRateLimited(key: string): Promise<boolean> {
  const rateLimitEnv = process.env.RATE_LIMIT_PER_HOUR ?? "15";
  const RATE_LIMIT = parseInt(rateLimitEnv);
  const sb = getSupabaseAdmin();
  const ipHash = await hashKey(key);
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { count } = await sb
    .from("add_requests")
    .select("*", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", oneHourAgo);

  return (count ?? 0) >= RATE_LIMIT; // increased limit
}

async function recordRateLimitRequest(key: string): Promise<void> {
  const sb = getSupabaseAdmin();
  const ipHash = await hashKey(key);
  await sb.from("add_requests").insert({ ip_hash: ipHash });
}

const LC_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "*/*",
  "Origin": "https://leetcode.com",
  "Referer": "https://leetcode.com",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "x-csrftoken": "csrftoken",
};

import { parseMaxStreak } from "@/lib/leetcode";
import { calculateLeetcodeXp } from "@/lib/xp";

async function fetchLeetCodeUser(username: string) {
  const currentYear = new Date().getFullYear();
  // Only fetch current + previous year calendars to keep query size small
  // (fetching all years back to 2015 makes the query too large and LeetCode rejects it)
  const prevYear = currentYear - 1;

  const query = `
    query($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          realName userAvatar ranking reputation
          countryName school company websites
        }
        badges { id name icon displayName }
        submitStats {
          acSubmissionNum { difficulty count }
          totalSubmissionNum { difficulty count }
        }
        yearCurrent: userCalendar(year: ${currentYear}) { streak totalActiveDays submissionCalendar }
        yearPrev: userCalendar(year: ${prevYear}) { submissionCalendar }
      }
      userContestRanking(username: $username) {
        rating
        globalRanking
        attendedContestsCount
        topPercentage
        badge { name }
      }
    }
  `;
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: LC_HEADERS,
      body: JSON.stringify({ query, variables: { username } }),
    });
    if (!res.ok) {
      console.error(`[/api/dev] LeetCode responded ${res.status} for user "${username}"`);
      return null;
    }
    const rawText = await res.text();
    let json: any;
    try { json = JSON.parse(rawText); } catch (err) { 
      console.error(`[/api/dev] LeetCode non-JSON response for "${username}": ${rawText.substring(0, 200)}`, err);
      return null;
    }
    if (!json?.data?.matchedUser) {
      console.error(`[/api/dev] LeetCode returned no matchedUser for "${username}". Status: ${res.status}. firstErr:`, json?.errors?.[0]?.message);
    }
    if (json?.data?.matchedUser) {
      // Map calendar data into the structure parseMaxStreak expects (y<year> keys)
      const mu = json.data.matchedUser;
      // Both are aliased: yearCurrent = this year, yearPrev = last year
      if (mu.yearCurrent) {
        (mu as Record<string, unknown>)[`y${currentYear}`] = mu.yearCurrent;
        // Populate streak/totalActiveDays from the aliased calendar
        if (!mu.userCalendar) {
          mu.userCalendar = { streak: mu.yearCurrent.streak ?? 0, totalActiveDays: mu.yearCurrent.totalActiveDays ?? 0 };
        }
      }
      if (mu.yearPrev) (mu as Record<string, unknown>)[`y${prevYear}`] = mu.yearPrev;
      mu.maxStreak = parseMaxStreak(mu, currentYear);
    }
    return json?.data ?? null;
  } catch (err) { console.warn("[app/api/dev/[username]/route.ts] error:", err); return null;
   }
}

/**
 * @param {import('next/server').NextRequest} request
 * @param {{ params: any }} context
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ username: string }> }
) {
  const { username } = await params;
  const { searchParams } = new URL(request.url);
  const forceRefresh = searchParams.get("refresh") === "true";
  const sb = getSupabaseAdmin();

  let cachedRecord = null;
  const { data: cached } = await sb
    .from("developers")
    .select("*")
    .eq("github_login", username.toLowerCase())
    .single();

  if (cached) {
    const cacheTtlHours = process.env.CACHE_TTL_HOURS ?? "12";
    const CACHE_TTL_MS = parseInt(cacheTtlHours) * 3600000;
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (!forceRefresh && age < CACHE_TTL_MS) {  // 12h cache
      cachedRecord = cached;
    }
  }

  // Rate limit check
  // Bypass rate limit for authenticated force-refreshes (e.g., the ↻ button in the building card)
  let rateLimitKey: string | null = null;
  let isAuthenticatedUser = false;
  if (!cachedRecord) {
    let key: string;
    try {
      const authClient = await createServerSupabase();
      const { data: { user } } = await authClient.auth.getUser();
      isAuthenticatedUser = !!user;
      key = user ? `user:${user.id}` : (
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown"
      );
    } catch (err) {
      console.warn("[app/api/dev/[username]/route.ts] error:", err);
      key = "unknown";
    }
    rateLimitKey = key;
    // Skip rate limiting if this is a force-refresh from a logged-in user
    const skipRateLimit = forceRefresh && isAuthenticatedUser;
    if (!skipRateLimit && await isRateLimited(key)) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }
  }

  let upserted = cachedRecord;

  if (!cachedRecord) {
    const data = await fetchLeetCodeUser(username);
    if (!data?.matchedUser) {
      if (cached) return NextResponse.json(cached); // return stale if LC fetch fails
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
      lc_streak: user.maxStreak ?? user.userCalendar?.streak ?? 0,
      lc_max_streak: user.maxStreak ?? 0,
      active_days_last_year: activeDays,
      total_active_days: activeDays,
      total_submitted: totalSub,
      // Contest extended
      contests_attended: data.userContestRanking?.attendedContestsCount ?? 0,
      contest_top_percentage: data.userContestRanking?.topPercentage ?? null,
      contest_badge_name: data.userContestRanking?.badge?.name ?? null,
      // Badges
      lc_badge: (user.badges?.length ?? 0) > 0 ? user.badges[user.badges.length - 1].name : null,
      lc_badges_all: (user.badges ?? []).map((b: any) => ({ name: b.name, icon: b.icon, displayName: b.displayName })),
      // Profile metadata
      lc_bio: user.profile?.aboutMe ?? null,
      lc_country_code: user.profile?.countryName ?? null,
      lc_school: user.profile?.school ?? null,
      lc_company: user.profile?.company ?? null,
      lc_website: user.profile?.websites?.[0] ?? null,
      lc_twitter: user.profile?.twitterUrl ?? null,
      lc_linkedin: user.profile?.linkedinUrl ?? null,
      lc_github: user.profile?.githubUrl ?? null,
      // Tag stats
      lc_tag_stats: [
        ...(user.tagProblemCounts?.advanced ?? []),
        ...(user.tagProblemCounts?.intermediate ?? []),
        ...(user.tagProblemCounts?.fundamental ?? []),
      ]
        .sort((a: any, b: any) => b.problemsSolved - a.problemsSolved)
        .slice(0, 20)
        .map((t: any) => ({ name: t.tagName, solved: t.problemsSolved })),
    };

    const newBaseXp = calculateLeetcodeXp({
      easy_solved: record.easy_solved,
      medium_solved: record.medium_solved,
      hard_solved: record.hard_solved,
      contest_rating: record.contest_rating,
      lc_streak: record.lc_streak
    });

    // We must merge new Base XP with existing Base XP safely. 
    // Wait to upsert until we check if the user exists so we know what to append.
    const mergeRecord = { ...record, xp_github: newBaseXp, xp_total: newBaseXp };
    
    if (cached) {
        mergeRecord.xp_total = (cached.xp_total - cached.xp_github) + newBaseXp;
    }

    const { data: upsertedResult, error: upsertError } = await sb
      .from("developers")
      .upsert(mergeRecord, { onConflict: "github_login" })
      .select()
      .single();

    if (upsertError) {
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }
    upserted = upsertedResult;
  }

  // Round 2: Fetch customizations and items to return a full building record
  const [purchasesResult, giftPurchasesResult, customizationsResult, raidTagsResult] = await Promise.all([
    sb
      .from("purchases")
      .select("item_id, provider, amount_cents")
      .eq("developer_id", upserted.id)
      .is("gifted_to", null)
      .eq("status", "completed"),
    sb
      .from("purchases")
      .select("item_id, provider, amount_cents")
      .eq("gifted_to", upserted.id)
      .eq("status", "completed"),
    sb
      .from("developer_customizations")
      .select("item_id, config")
      .eq("developer_id", upserted.id)
      .in("item_id", ["custom_color", "billboard", "loadout", "building_style", "led_banner"]),
    sb
      .from("raid_tags")
      .select("attacker_login, tag_style, expires_at")
      .eq("building_id", upserted.id)
      .eq("active", true),
  ]);

  const ownedItems = [
    ...(purchasesResult.data ?? [])
      .filter(p => !(p.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(p.provider)))
      .map(p => p.item_id),
    ...(giftPurchasesResult.data ?? [])
      .filter(p => !(p.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(p.provider)))
      .map(p => p.item_id),
  ];

  const customColor = (customizationsResult.data ?? []).find(c => c.item_id === "custom_color")?.config?.color ?? null;
  const billboardConfig = (customizationsResult.data ?? []).find(c => c.item_id === "billboard")?.config;
  const billboardImages = Array.isArray(billboardConfig?.images) ? billboardConfig.images : (billboardConfig?.image_url ? [billboardConfig.image_url] : []);
  const loadoutConfig = (customizationsResult.data ?? []).find(c => c.item_id === "loadout")?.config;
  const loadout = loadoutConfig ? {
    crown: loadoutConfig.crown ?? null,
    roof: loadoutConfig.roof ?? null,
    aura: loadoutConfig.aura ?? null,
    faces: loadoutConfig.faces ?? null,
  } : null;

  const ledBannerText = (customizationsResult.data ?? []).find(c => c.item_id === "led_banner")?.config?.text ?? null;

  const buildingStyle = (customizationsResult.data ?? []).find(c => c.item_id === "building_style")?.config?.style ?? "tower";

  const result = {
    ...upserted,
    owned_items: ownedItems,
    custom_color: customColor,
    billboard_images: billboardImages,
    led_banner_text: ledBannerText,
    loadout: loadout,
    building_style: buildingStyle,
    active_raid_tag: raidTagsResult.data?.[0] ?? null,
  };

  if (rateLimitKey) await recordRateLimitRequest(rateLimitKey);

  return NextResponse.json(result);
}
