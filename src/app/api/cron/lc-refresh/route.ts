import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { parseMaxStreak } from "@/lib/leetcode";

/**
 * Cron: LC Profile Refresh
 * Runs every hour — refreshes the N most-stale developer profiles.
 *
 * Schedule (vercel.json):
 *   Hourly:  "0 * * * *"   (Vercel Pro / Team)
 *   Daily:   "0 6 * * *"   (Vercel Hobby — adjust hour as preferred)
 *
 * Vercel function timeout: 60s (Pro) / 10s (Hobby)
 * At 1.2s/user we safely refresh ~50 users within the 60s Pro limit.
 */

const USERS_PER_RUN = 50; // How many stale profiles to refresh each invocation

const LC_HEADERS = {
  "Content-Type": "application/json",
  "Referer": "https://leetcode.com",
  "User-Agent": "Mozilla/5.0 (compatible; LeetCodeCity/1.0)",
};

function calendarAliases(): string {
  const year = new Date().getFullYear();
  return Array.from({ length: year - 2014 }, (_, i) => 2015 + i)
    .map((y) => `\n        y${y}: userCalendar(year: ${y}) { submissionCalendar }`)
    .join("");
}

async function fetchLCFullProfile(username: string): Promise<any> {
  const query = `
    query($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          realName userAvatar ranking reputation
          countryName school company websites linkedinUrl twitterUrl githubUrl aboutMe
        }
        badges { id name icon displayName }
        submitStats {
          acSubmissionNum { difficulty count }
          totalSubmissionNum { difficulty count }
        }
        tagProblemCounts {
          advanced { tagName problemsSolved }
          intermediate { tagName problemsSolved }
          fundamental { tagName problemsSolved }
        }
        userCalendar { streak totalActiveDays }${calendarAliases()}
      }
      userContestRanking(username: $username) {
        rating globalRanking attendedContestsCount topPercentage badge { name }
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
    if (json?.data?.matchedUser) {
      json.data.matchedUser.maxStreak = parseMaxStreak(
        json.data.matchedUser,
        new Date().getFullYear(),
      );
    }
    return json?.data ?? null;
  } catch (err) { console.warn("[app/api/cron/lc-refresh/route.ts] error:", err); return null;
   }
}

async function upsertFullProfile(
  sb: ReturnType<typeof getSupabaseAdmin>,
  username: string,
  data: any,
): Promise<boolean> {
  const user = data?.matchedUser;
  if (!user) return false;

  const acNums = user.submitStats?.acSubmissionNum ?? [];
  const totNums = user.submitStats?.totalSubmissionNum ?? [];
  const getAC = (d: string) => acNums.find((x: any) => x.difficulty === d)?.count ?? 0;
  const getTot = (d: string) => totNums.find((x: any) => x.difficulty === d)?.count ?? 1;

  const totalSolved = getAC("All");
  const totalSub = getTot("All");
  const activeDays = user.userCalendar?.totalActiveDays ?? 0;

  // Calculate weekly contributions (last 7 days)
  const now = new Date();
  const currentYear = now.getFullYear();
  const sevenDaysAgoDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const sevenDaysAgoYear = sevenDaysAgoDate.getFullYear();

  const yearsToCheck = [currentYear];
  if (sevenDaysAgoYear !== currentYear) {
    yearsToCheck.push(sevenDaysAgoYear);
  }

  let weeklyContributions = 0;
  now.setHours(0, 0, 0, 0);
  const sevenDaysAgoTs = Math.floor(now.getTime() / 1000) - 7 * 24 * 60 * 60;

  for (const year of yearsToCheck) {
    const calendarStr = user[`y${year}`]?.submissionCalendar;
    if (calendarStr) {
      try {
        const calendar = JSON.parse(calendarStr);
        for (const [timestampStr, count] of Object.entries(calendar)) {
          const timestamp = parseInt(timestampStr, 10);
          if (timestamp >= sevenDaysAgoTs) {
            weeklyContributions += count as number;
          }
        }
      } catch (err) {
        console.warn(`[lc-refresh] Error parsing calendar for year ${year}:`, err);
      }
    }
  }

  const lcRank = user.profile?.ranking ?? 999999;
  const litPercentage = Math.min(0.92, Math.max(0.15, activeDays / 365));
  const realName = user.profile?.realName?.trim() || user.username;
  let hash = 0;
  for (const ch of username) hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0;

  const contestStats = data?.userContestRanking;
  const badges: any[] = user.badges ?? [];
  const tagCounts = user.tagProblemCounts;
  const lc_tag_stats = [
    ...(tagCounts?.advanced ?? []),
    ...(tagCounts?.intermediate ?? []),
    ...(tagCounts?.fundamental ?? []),
  ]
    .sort((a: any, b: any) => b.problemsSolved - a.problemsSolved)
    .slice(0, 20)
    .map((t: any) => ({ name: t.tagName, solved: t.problemsSolved }));

  const { error } = await sb.from("developers").upsert(
    {
      github_login: username.toLowerCase(),
      github_id: Math.abs(hash),
      name: realName,
      avatar_url: user.profile?.userAvatar || "",
      contributions: Math.max(1, totalSolved),
      contributions_total: Math.round(litPercentage * 1000),
      total_stars: user.profile?.reputation ?? 0,
      public_repos: Math.max(0, 500000 - lcRank),
      current_week_contributions: weeklyContributions,
      rank: lcRank,
      lc_global_rank: lcRank,
      fetched_at: new Date().toISOString(),
      easy_solved: getAC("Easy"),
      medium_solved: getAC("Medium"),
      hard_solved: getAC("Hard"),
      acceptance_rate: totalSub > 0 ? Math.round((totalSolved / totalSub) * 100) / 100 : 0,
      total_submitted: totalSub,
      lc_streak: user.maxStreak ?? user.userCalendar?.streak ?? 0,
      lc_max_streak: user.maxStreak ?? 0,
      active_days_last_year: activeDays,
      total_active_days: activeDays,
      contest_rating: Math.round(contestStats?.rating ?? 0),
      contest_rank: contestStats?.globalRanking ?? null,
      contests_attended: contestStats?.attendedContestsCount ?? 0,
      contest_top_percentage: contestStats?.topPercentage ?? null,
      contest_badge_name: contestStats?.badge?.name ?? null,
      lc_badge: badges.length > 0 ? badges[badges.length - 1].name : null,
      lc_badges_all: badges.map((b) => ({ name: b.name, icon: b.icon, displayName: b.displayName })),
      lc_bio: user.profile?.aboutMe ?? null,
      lc_country_code: user.profile?.countryName ?? null,
      lc_school: user.profile?.school ?? null,
      lc_company: user.profile?.company ?? null,
      lc_website: user.profile?.websites?.[0] ?? null,
      lc_twitter: user.profile?.twitterUrl ?? null,
      lc_linkedin: user.profile?.linkedinUrl ?? null,
      lc_github: user.profile?.githubUrl ?? null,
      lc_tag_stats,
    },
    { onConflict: "github_login" },
  );

  if (error) console.error(`[lc-refresh] DB error for ${username}:`, error.message);
  return !error;
}

async function discoverAndInsertNewUsers(
  sb: ReturnType<typeof getSupabaseAdmin>,
  page: number,
): Promise<number> {
  const query = `
    query globalRanking($page: Int!) {
      globalRanking(page: $page) {
        rankingNodes { user { username } }
      }
    }
  `;
  try {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: LC_HEADERS,
      body: JSON.stringify({ query, variables: { page } }),
    });
    const json = await res.json();
    const usernames: string[] = (json?.data?.globalRanking?.rankingNodes ?? [])
      .map((n: any) => n.user.username.toLowerCase());

    if (usernames.length === 0) return 0;

    // Filter to only usernames not already in DB
    const { data: existing } = await sb
      .from("developers")
      .select("github_login")
      .in("github_login", usernames);

    const existingSet = new Set((existing ?? []).map((d: any) => d.github_login));
    const newUsers = usernames.filter((u) => !existingSet.has(u));

    if (newUsers.length === 0) return 0;

    // Stub-insert new users so they get picked up by the next refresh cycle
    const stubs = newUsers.map((login) => ({
      github_login: login,
      github_id: Math.abs(login.split("").reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0)),
      fetched_at: new Date(0).toISOString(), // epoch — will be picked as most stale immediately
    }));

    const { error } = await sb
      .from("developers")
      .upsert(stubs, { onConflict: "github_login", ignoreDuplicates: true });

    if (error) console.warn("[lc-refresh] discovery insert error:", error.message);
    return error ? 0 : newUsers.length;
  } catch (err) {
    console.warn("[lc-refresh] discovery fetch error:", err);
    return 0;
  }
}

/**
 * @param {import('next/server').NextRequest} request
 */
export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const results = { refreshed: 0, skipped: 0, failed: 0, users: [] as string[] };

  // ── Discovery: insert new users from ranking page ──
  // Rotate through pages using Unix hour as cursor — no DB state needed
  const discoveryPage = (Math.floor(Date.now() / 3_600_000) % 50) + 1;
  const discovered = await discoverAndInsertNewUsers(sb, discoveryPage);
  console.log(`[lc-refresh] Discovery: ${discovered} new users inserted from page ${discoveryPage}`);

  // ── Pick most-stale developers (claimed first, then unclaimed) ──
  const staleClaimedCutoff = new Date(Date.now() - 6 * 3600_000).toISOString();   // 6h
  const staleUnclaimedCutoff = new Date(Date.now() - 24 * 3600_000).toISOString(); // 24h

  const { data: claimed } = await sb
    .from("developers")
    .select("github_login")
    .eq("claimed", true)
    .lt("fetched_at", staleClaimedCutoff)
    .order("fetched_at", { ascending: true })
    .limit(USERS_PER_RUN);

  const claimedLogins = (claimed ?? []).map((d: any) => d.github_login);
  const remaining = USERS_PER_RUN - claimedLogins.length;

  const unclaimedLogins: string[] = [];
  if (remaining > 0) {
    const { data: unclaimed } = await sb
      .from("developers")
      .select("github_login")
      .eq("claimed", false)
      .lt("fetched_at", staleUnclaimedCutoff)
      .order("fetched_at", { ascending: true })
      .limit(remaining);
    unclaimedLogins.push(...(unclaimed ?? []).map((d: any) => d.github_login));
  }

  const logins = [...claimedLogins, ...unclaimedLogins];

  if (logins.length === 0) {
    return NextResponse.json({ ok: true, message: "All profiles are fresh", ...results });
  }

  // ── Refresh users in concurrent chunks (5× throughput vs sequential) ──
  // Chunks of 5 with 3s between chunks — stays within LC rate limits
  // while fitting comfortably inside Vercel's 60s Pro timeout
  const CHUNK_SIZE = 5;
  const CHUNK_DELAY_MS = 3000;

  async function fetchAndUpsert(username: string): Promise<void> {
    const data = await fetchLCFullProfile(username);
    if (!data?.matchedUser) {
      results.skipped++;
    } else {
      const success = await upsertFullProfile(sb, username, data);
      if (success) {
        results.refreshed++;
        results.users.push(username);
      } else {
        results.failed++;
      }
    }
  }

  for (let i = 0; i < logins.length; i += CHUNK_SIZE) {
    const chunk = logins.slice(i, i + CHUNK_SIZE);
    await Promise.allSettled(chunk.map(fetchAndUpsert));
    if (i + CHUNK_SIZE < logins.length) {
      await new Promise((r) => setTimeout(r, CHUNK_DELAY_MS));
    }
  }

  console.log(`[lc-refresh] Done: ${results.refreshed} refreshed, ${results.skipped} skipped, ${results.failed} failed`);
  return NextResponse.json({ ok: true, ...results });
}
