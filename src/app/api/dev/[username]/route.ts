import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";
import { checkAchievements, countGifts } from "@/lib/achievements";

export const dynamic = "force-dynamic";

interface LeetCodeProfile {
  realName?: string;
  userAvatar?: string;
  reputation?: number;
  ranking?: number;
  aboutMe?: string;
  countryName?: string;
  school?: string;
  company?: string;
  websites?: string[];
  twitterUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
}

interface LeetCodeYearCalendar {
  streak?: number;
  totalActiveDays?: number;
}

interface LeetCodeContestRanking {
  rating?: number;
  globalRanking?: number;
  attendedContestsCount?: number;
  topPercentage?: number;
  badge?: { name?: string };
}

interface LeetCodeMatchedUser {
  username?: string;
  profile?: LeetCodeProfile;
  submitStats?: {
    acSubmissionNum?: { difficulty: string; count: number }[];
    totalSubmissionNum?: { difficulty: string; count: number }[];
  };
  userCalendar?: LeetCodeYearCalendar;
  maxStreak?: number;
  languageProblemCount?: { languageName: string; problemsSolved: number }[];
  badges?: { name: string; icon: string; displayName: string }[];
  tagProblemCounts?: {
    advanced?: { tagName: string; problemsSolved: number }[];
    intermediate?: { tagName: string; problemsSolved: number }[];
    fundamental?: { tagName: string; problemsSolved: number }[];
  };
  yearCurrent?: LeetCodeYearCalendar;
  yearPrev?: LeetCodeYearCalendar;
  [key: string]: unknown;
}

interface LeetCodeApiResponse {
  data?: {
    matchedUser?: LeetCodeMatchedUser;
    userContestRanking?: LeetCodeContestRanking;
  };
  errors?: { message?: string }[];
}

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

  return (count ?? 0) >= RATE_LIMIT;
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
import { calculateLeetcodeXp, mergeBaseXp } from "@/lib/xp";

async function fetchLeetCodeUser(username: string) {
  const currentYear = new Date().getFullYear();
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
        languageProblemCount {
          languageName
          problemsSolved
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
    let json: LeetCodeApiResponse;
    try { json = JSON.parse(rawText); } catch (err) { 
      console.error(`[/api/dev] LeetCode non-JSON response for "${username}": ${rawText.substring(0, 200)}`, err);
      return null;
    }
    if (!json?.data?.matchedUser) {
      console.error(`[/api/dev] LeetCode returned no matchedUser for "${username}". Status: ${res.status}. firstErr:`, json?.errors?.[0]?.message);
    }
    const apiData = json.data;
    if (apiData?.matchedUser) {
      const mu = apiData.matchedUser;
      if (mu.yearCurrent) {
        mu[`y${currentYear}`] = mu.yearCurrent;
        if (!mu.userCalendar) {
          mu.userCalendar = {
            streak: mu.yearCurrent.streak ?? 0,
            totalActiveDays: mu.yearCurrent.totalActiveDays ?? 0,
          };
        }
      }
      if (mu.yearPrev) mu[`y${prevYear}`] = mu.yearPrev;
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
    .ilike("github_login", username)
    .single();

  if (cached) {
    const cacheTtlHours = process.env.CACHE_TTL_HOURS ?? "12";
    const CACHE_TTL_MS = parseInt(cacheTtlHours) * 3600000;
    const age = Date.now() - new Date(cached.fetched_at).getTime();
    if (!forceRefresh && age < CACHE_TTL_MS) {
      cachedRecord = cached;
    }
  }

  
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
    if (!skipRateLimit) {
      if (await isRateLimited(key)) {
        return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
      }
      // Record immediately, before the LeetCode API call, to prevent race condition
      await recordRateLimitRequest(key);
      rateLimitKey = null;
    }
  }

  let upserted = cachedRecord;

  if (!cachedRecord) {
    const data = await fetchLeetCodeUser(username);
    if (!data) {
      if (cached) {
        upserted = cached;
      } else {
        return NextResponse.json({ error: "Failed to fetch LeetCode data" }, { status: 502 });
      }
    } else if (!data.matchedUser) {
      return NextResponse.json({ error: "User not found on LeetCode" }, { status: 404 });
    } else {
      interface SubmissionNum {
        difficulty: string;
        count: number;
      }
      interface LanguageProblem {
        languageName: string;
        problemsSolved: number;
      }
      interface Badge {
        name: string;
        icon: string;
        displayName: string;
      }
      interface TagCount {
        tagName: string;
        problemsSolved: number;
      }

      const user = data.matchedUser;
      const acNums = (user.submitStats?.acSubmissionNum ?? []) as SubmissionNum[];
      const totNums = (user.submitStats?.totalSubmissionNum ?? []) as SubmissionNum[];
      const getAC = (d: string) => acNums.find((x: SubmissionNum) => x.difficulty === d)?.count ?? 0;
      const getTot = (d: string) => totNums.find((x: SubmissionNum) => x.difficulty === d)?.count ?? 1;

      const totalSolved = getAC("All");
      const totalSub = getTot("All");
      const activeDays = user.userCalendar?.totalActiveDays ?? 0;
      const lcRank = user.profile?.ranking ?? 999999;
      const languages = (user.languageProblemCount ?? []) as LanguageProblem[];
      const dominantLanguage = languages.length > 0
        ? [...languages].sort((a: LanguageProblem, b: LanguageProblem) => 
        b.problemsSolved - a.problemsSolved)[0].languageName
        : null;
      const litPercentage = Math.min(0.92, Math.max(0.15, activeDays / 365));
      const badges = user.badges ?? [];

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
        lc_global_rank: lcRank,
        fetched_at: new Date().toISOString(),
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
        contests_attended: data.userContestRanking?.attendedContestsCount ?? 0,
        contest_top_percentage: data.userContestRanking?.topPercentage ?? null,
        contest_badge_name: data.userContestRanking?.badge?.name ?? null,
        lc_badge: badges.length > 0 ? badges[badges.length - 1].name : null,
        lc_badges_all: badges.map((b: Badge) => ({ name: b.name, icon: b.icon, displayName: b.displayName })),
        lc_bio: user.profile?.aboutMe ?? null,
        lc_country_code: user.profile?.countryName ?? null,
        lc_school: user.profile?.school ?? null,
        lc_company: user.profile?.company ?? null,
        lc_website: user.profile?.websites?.[0] ?? null,
        lc_twitter: user.profile?.twitterUrl ?? null,
        lc_linkedin: user.profile?.linkedinUrl ?? null,
        lc_github: user.profile?.githubUrl ?? null,
        primary_language:dominantLanguage,
        lc_tag_stats: [
          ...((user.tagProblemCounts?.advanced ?? []) as TagCount[]),
          ...((user.tagProblemCounts?.intermediate ?? []) as TagCount[]),
          ...((user.tagProblemCounts?.fundamental ?? []) as TagCount[]),
        ]
          .sort((a: TagCount, b: TagCount) => b.problemsSolved - a.problemsSolved)
          .slice(0, 20)
          .map((t: TagCount) => ({ name: t.tagName, solved: t.problemsSolved })),
      };

      const newBaseXp = calculateLeetcodeXp({
        easy_solved: record.easy_solved,
        medium_solved: record.medium_solved,
        hard_solved: record.hard_solved,
        contest_rating: record.contest_rating,
        lc_streak: record.lc_streak
      });

      const mergeRecord = {
        ...record,
        xp_github: newBaseXp,
        xp_total: mergeBaseXp(cached?.xp_total, cached?.xp_github, newBaseXp),
      };

      const { data: upsertedResult, error: upsertError } = await sb
        .from("developers")
        .upsert(mergeRecord, { onConflict: "github_login" })
        .select()
        .single();

      if (upsertError) {
        return NextResponse.json({ error: "Database error" }, { status: 500 });
      }
      upserted = upsertedResult;

      try {
        const [giftsSent, giftsReceived] = await Promise.all([
          countGifts(sb, upserted.id, "sent"),
          countGifts(sb, upserted.id, "received"),
        ]);

        await checkAchievements(
          upserted.id,
          {
            contributions: upserted.contributions,
            public_repos: upserted.public_repos,
            total_stars: upserted.total_stars,
            referral_count: upserted.referral_count ?? 0,
            kudos_count: upserted.kudos_count ?? 0,
            gifts_sent: giftsSent,
            gifts_received: giftsReceived,
            easy_solved: upserted.easy_solved ?? 0,
            medium_solved: upserted.medium_solved ?? 0,
            hard_solved: upserted.hard_solved ?? 0,
            contest_rating: upserted.contest_rating ?? 0,
            lc_streak: upserted.lc_streak ?? 0,
          },
          upserted.github_login,
        );
      } catch (err) {
        console.error("[dev/[username]] achievement check failed:", err);
      }
    }
  }

  
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

  return NextResponse.json(result);
}