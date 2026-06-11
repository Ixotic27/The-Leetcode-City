/**
 * LC City Profile Backfiller
 * Refreshes ALL existing developers in the DB with full LeetCode profile data,
 * including the new columns added in migration 040 (badges, bio, contest stats, tags, etc.)
 *
 * Run:  npx tsx --env-file=.env.local scripts/backfill-lc-profiles.ts
 *
 * Safe to re-run — uses upsert with ON CONFLICT DO UPDATE.
 * Rate: ~1 user/second = ~3600/hour (LeetCode allows ~1 req/sec per IP)
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

const LC_HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "User-Agent": "Mozilla/5.0 (compatible; LeetCodeCity/1.0)",
};

const DELAY_MS = 1200;  // 1.2s per user — ~3000 users/hour comfortably within LC limits
const BATCH_SIZE = 100; // Fetch from DB in chunks

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

// Build per-year calendar aliases for max streak calculation
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
        languageProblemCount {
          languageName
          problemsSolved  
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
            method: "POST",
            headers: LC_HEADERS,
            body: JSON.stringify({ query, variables: { username } }),
        });
        const json = await res.json();
        if (json?.data?.matchedUser) {
            json.data.matchedUser.maxStreak = parseMaxStreak(json.data.matchedUser, new Date().getFullYear());
        }
        return json?.data ?? null;
    } catch {
        return null;
    }
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

    const languages = user.languageProblemCount ?? [];
    const dominantLanguage = languages.length > 0
      ? [...languages].sort((a: any, b: any) => 
        b.problemsSolved - a.problemsSolved)[0].languageName
      : null;
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
            primary_language: dominantLanguage,
            fetched_at: new Date().toISOString(),
            // Solved breakdown
            easy_solved: getAC("Easy"),
            medium_solved: getAC("Medium"),
            hard_solved: getAC("Hard"),
            acceptance_rate: totalSub > 0 ? Math.round((totalSolved / totalSub) * 100) / 100 : 0,
            total_submitted: totalSub,
            // Streak
            lc_streak: user.maxStreak ?? user.userCalendar?.streak ?? 0,
            lc_max_streak: user.maxStreak ?? 0,
            active_days_last_year: activeDays,
            total_active_days: activeDays,
            // Contest
            contest_rating: Math.round(contestStats?.rating ?? 0),
            contest_rank: contestStats?.globalRanking ?? null,
            contests_attended: contestStats?.attendedContestsCount ?? 0,
            contest_top_percentage: contestStats?.topPercentage ?? null,
            contest_badge_name: contestStats?.badge?.name ?? null,
            // Badges
            lc_badge: badges.length > 0 ? badges[badges.length - 1].name : null,
            lc_badges_all: badges.map((b) => ({ name: b.name, icon: b.icon, displayName: b.displayName })),
            // Profile metadata
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

async function main() {
    console.log("\n🏙️  LC City Profile Backfiller\n");
    console.log("   Fetching all developers from DB...\n");

    // Fetch all developer logins in batches
    const logins: string[] = [];
    let offset = 0;
    while (true) {
        const { data, error } = await sb
            .from("developers")
            .select("github_login")
            .order("claimed", { ascending: false }) // claimed users first
            .range(offset, offset + BATCH_SIZE - 1);
        if (error || !data || data.length === 0) break;
        logins.push(...data.map((d: any) => d.github_login));
        offset += BATCH_SIZE;
        if (data.length < BATCH_SIZE) break;
    }

    console.log(`   Found ${logins.length} developers. Starting backfill at ~${Math.round(3600 / (DELAY_MS / 1000))} users/hour...\n`);
    console.log("   Press Ctrl+C at any time — all progress is saved via upsert.\n");
    console.log("─".repeat(60));

    let ok = 0, skip = 0, fail = 0;

    for (let i = 0; i < logins.length; i++) {
        const username = logins[i];
        const pct = ((i + 1) / logins.length * 100).toFixed(1);
        process.stdout.write(`  [${String(i + 1).padStart(5)}/${logins.length}] (${pct}%) ${username.padEnd(25)} `);

        const data = await fetchLCFullProfile(username);

        if (!data?.matchedUser) {
            console.log("⚠️  not found / private");
            skip++;
        } else {
            const success = await upsertFullProfile(username, data);
            if (success) {
                const solved = data.matchedUser?.submitStats?.acSubmissionNum?.find((x: any) => x.difficulty === "All")?.count ?? 0;
                const streak = data.matchedUser?.maxStreak ?? 0;
                const badges = data.matchedUser?.badges?.length ?? 0;
                console.log(`✅  ${solved} solved | streak ${streak} | ${badges} badge(s)`);
                ok++;
            } else {
                console.log("❌ DB error");
                fail++;
            }
        }

        await sleep(DELAY_MS);
    }

    console.log("\n" + "─".repeat(60));
    console.log(`✅ Backfill complete!`);
    console.log(`   Success: ${ok} | Skipped (private/not found): ${skip} | Failed: ${fail}`);
    console.log(`   ETA was: ~${Math.round(logins.length * DELAY_MS / 3600000 * 10) / 10} hours\n`);
}

main().catch(console.error);
