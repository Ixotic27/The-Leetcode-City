/**
 * LC City Hourly Fetcher
 * Runs continuously and refreshes 60–100 stale developer profiles per hour.
 *
 * Strategy:
 *   Every hour it picks the N developers whose `fetched_at` is oldest
 *   (i.e. most stale), fetches fresh LC stats for them, and upserts.
 *   Claimed (real users) are always prioritised over seeded users.
 *
 * Run:  npx tsx --env-file=.env.local scripts/lc-hourly-fetcher.ts
 *
 * Keep this running in the background (e.g. screen / pm2 / Railway cron).
 */

import { createClient } from "@supabase/supabase-js";
import { parseMaxStreak } from "../src/lib/leetcode";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ── Config ───────────────────────────────────────────────────
const USERS_PER_HOUR = 75;       // Target users refreshed per hour (adjust freely)
const HOUR_MS = 60 * 60 * 1000;
const DELAY_MS = Math.floor(HOUR_MS / USERS_PER_HOUR); // e.g. 75/hr = 48s between each

const LC_HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "User-Agent": "Mozilla/5.0 (compatible; LeetCodeCity/1.0)",
};

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function calendarAliases(): string {
    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

    return [currentYear, prevYear]
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
            method: "POST", headers: LC_HEADERS,
            body: JSON.stringify({ query, variables: { username } }),
        });
        const json = await res.json();
        if (json?.data?.matchedUser) {
            json.data.matchedUser.maxStreak = parseMaxStreak(json.data.matchedUser, new Date().getFullYear());
        }
        return json?.data ?? null;
    } catch { return null; }
}

async function upsertFullProfile(username: string, data: any): Promise<boolean> {
    const user = data?.matchedUser;
    if (!user) return false;

    const acNums = user.submitStats?.acSubmissionNum ?? [];
    const totNums = user.submitStats?.totalSubmissionNum ?? [];
    const getAC = (d: string) => acNums.find((x: any) => x.difficulty === d)?.count ?? 0;
    const getTot = (d: string) => totNums.find((x: any) => x.difficulty === d)?.count ?? 1;

    const totalSolved = getAC("All");
    const totalSub = getTot("All");
    const activeDays = user.userCalendar?.totalActiveDays ?? 0;
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
        { onConflict: "github_login" }
    );

    if (error) console.error(`  DB error for ${username}:`, error.message);
    return !error;
}

/** Pick the N most-stale developers (claimed first, then unclaimed) */
async function pickStalestDevs(n: number): Promise<string[]> {
    // 1. Claimed users stale > 6 hours — top priority
    const { data: claimed } = await sb
        .from("developers")
        .select("github_login")
        .eq("claimed", true)
        .lt("fetched_at", new Date(Date.now() - 6 * 3600_000).toISOString())
        .order("fetched_at", { ascending: true })
        .limit(n);

    const claimedLogins = (claimed ?? []).map((d: any) => d.github_login);
    const remaining = n - claimedLogins.length;

    if (remaining <= 0) return claimedLogins;

    // 2. Fill remaining slots with oldest unclaimed
    const { data: unclaimed } = await sb
        .from("developers")
        .select("github_login")
        .eq("claimed", false)
        .lt("fetched_at", new Date(Date.now() - 24 * 3600_000).toISOString()) // must be >24h stale
        .order("fetched_at", { ascending: true })
        .limit(remaining);

    return [...claimedLogins, ...(unclaimed ?? []).map((d: any) => d.github_login)];
}

async function runHourlyCycle(cycleNum: number) {
    const now = new Date().toLocaleTimeString();
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  🔄  Hourly Cycle #${cycleNum} — ${now}`);
    console.log(`${"═".repeat(60)}\n`);

    const logins = await pickStalestDevs(USERS_PER_HOUR);

    if (logins.length === 0) {
        console.log("  ✅ All profiles are fresh. Nothing to refresh this hour.\n");
        return;
    }

    console.log(`  Refreshing ${logins.length} profiles (target: ${USERS_PER_HOUR}/hr)...\n`);

    let ok = 0, skip = 0, fail = 0;

    for (let i = 0; i < logins.length; i++) {
        const username = logins[i];
        process.stdout.write(`  [${String(i + 1).padStart(3)}/${logins.length}] ${username.padEnd(28)} `);

        const data = await fetchLCFullProfile(username);

        if (!data?.matchedUser) {
            console.log("⚠️  not found / private");
            skip++;
        } else {
            const success = await upsertFullProfile(username, data);
            if (success) {
                const solved = data.matchedUser?.submitStats?.acSubmissionNum?.find((x: any) => x.difficulty === "All")?.count ?? 0;
                const streak = data.matchedUser?.maxStreak ?? 0;
                console.log(`✅  ${solved} solved | streak ${streak}`);
                ok++;
            } else {
                console.log("❌ DB error");
                fail++;
            }
        }

        // Space requests evenly across the hour
        if (i < logins.length - 1) await sleep(DELAY_MS);
    }

    console.log(`\n  ✅ Cycle #${cycleNum} done — ${ok} refreshed | ${skip} skipped | ${fail} failed`);
}

async function main() {
    console.log("\n🏙️  LC City Hourly Fetcher");
    console.log(`   Target: ~${USERS_PER_HOUR} users/hour`);
    console.log(`   Delay:  ${(DELAY_MS / 1000).toFixed(1)}s between each user`);
    console.log(`   Claimed users refreshed if stale > 6h`);
    console.log(`   Seeded users refreshed if stale > 24h`);
    console.log("\n   Press Ctrl+C to stop at any time.\n");

    let cycle = 1;
    while (true) {
        const cycleStart = Date.now();
        await runHourlyCycle(cycle++);

        const elapsed = Date.now() - cycleStart;
        const waitMs = Math.max(0, HOUR_MS - elapsed);
        const waitMin = Math.round(waitMs / 60000);
        console.log(`\n   Sleeping ${waitMin} min until next cycle...`);
        await sleep(waitMs);
    }
}

main().catch(console.error);
