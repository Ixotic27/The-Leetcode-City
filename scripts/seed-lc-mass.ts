/**
 * LC City Mass Seeder
 * Populates the developers table with thousands of real LeetCode users.
 *
 * It paginates through LeetCode's global ranking pages to reliably grab real,
 * active users and fetch their stats via GraphQL.
 *
 * Run:  npx tsx --env-file=.env.local scripts/seed-lc-mass.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const LC_HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "User-Agent": "Mozilla/5.0",
};

async function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

// 1. Fetch ranking page to extract usernames
async function fetchRankingPage(page: number): Promise<string[]> {
    const query = `
    query globalRanking($page: Int!) {
      globalRanking(page: $page) {
        rankingNodes {
          currentGlobalRanking
          currentRating
          user {
            username
            profile {
              userAvatar
              realName
            }
          }
        }
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
        const nodes = json?.data?.globalRanking?.rankingNodes ?? [];
        return nodes.map((n: any) => n.user.username);
    } catch (err) {
        console.error(`Error fetching ranking page ${page}:`, err);
        return [];
    }
}

// 2. Fetch rich user stats
async function fetchLCUserStats(username: string) {
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
      userContestRanking(username: $username) { rating }
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

// 3. Upsert
async function upsertUser(username: string, data: any): Promise<boolean> {
    const user = data?.matchedUser;
    if (!user) return false;

    const acNums = user.submitStats?.acSubmissionNum ?? [];
    const totNums = user.submitStats?.totalSubmissionNum ?? [];
    const getAC = (d: string) => acNums.find((x: any) => x.difficulty === d)?.count ?? 0;
    const getTot = (d: string) => totNums.find((x: any) => x.difficulty === d)?.count ?? 1;

    const totalSolved = getAC("All");
    const totalSub = getTot("All");
    const easySolved = getAC("Easy");
    const medSolved = getAC("Medium");
    const hardSolved = getAC("Hard");
    const activeDays = user.userCalendar?.totalActiveDays ?? 0;
    const streak = user.userCalendar?.streak ?? 0;
    const lcRank = user.profile?.ranking ?? 999999;
    const reputation = user.profile?.reputation ?? 0;
    const contestRating = Math.round(data?.userContestRanking?.rating ?? 0);
    const acceptanceRate = totalSub > 0 ? Math.round((totalSolved / totalSub) * 100) / 100 : 0;
    // Fallback for missing realName
    const realName = user.profile?.realName?.trim() ? user.profile.realName : user.username;
    const litPercentage = Math.min(1.0, Math.max(0.1, activeDays / 365)); // Give them at least some light

    // Generate fake github ID for compatibility
    let hash = 0;
    for (const ch of username) hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0;
    const virtualGithubId = Math.abs(hash);

    const { error } = await sb.from("developers").upsert(
        {
            github_login: username.toLowerCase(),
            github_id: virtualGithubId,
            name: realName,
            avatar_url: user.profile?.userAvatar || "",
            contributions: Math.max(1, totalSolved),
            contributions_total: Math.round(litPercentage * 1000), // V2 detection uses this for litPercentage
            total_stars: reputation,
            public_repos: Math.max(0, parseInt(String(lcRank), 10) > 0 ? 500000 - lcRank : 0),
            rank: lcRank,
            fetch_priority: 2, // General mass pool
            fetched_at: new Date().toISOString(),
            claimed: false,
            easy_solved: easySolved,
            medium_solved: medSolved,
            hard_solved: hardSolved,
            acceptance_rate: acceptanceRate,
            contest_rating: contestRating,
            lc_streak: streak,
            active_days_last_year: activeDays,
        },
        { onConflict: "github_login" }
    );

    if (error) {
        console.error(`DB Error for ${username}:`, error.message);
    }
    return !error;
}

// ─── Main Execution ────────────────────────────────────────────────────────

const START_PAGE = 1;
const PAGES_TO_FETCH = 40; // ~1000 people total (25 per page)

async function main() {
    console.log(`\n🏙️  LC City Mass Seeder — Fetching ${PAGES_TO_FETCH} pages of rankings...\n`);

    let ok = 0;
    let skip = 0;
    let fail = 0;

    for (let page = START_PAGE; page < START_PAGE + PAGES_TO_FETCH; page++) {
        console.log(`\n--- Fetching global ranking page ${page} ---`);
        const usernames = await fetchRankingPage(page);

        if (usernames.length === 0) {
            console.log("⚠️  No users found on page. Rate limited?");
            // Try backing off
            await sleep(5000);
            continue;
        }

        for (const username of usernames) {
            process.stdout.write(`  Upserting ${username.padEnd(20)} `);

            const stats = await fetchLCUserStats(username);

            if (!stats?.matchedUser) {
                console.log("⚠️  not found / private");
                skip++;
                await sleep(500); // Backoff for missed fetches
                continue;
            }

            const inserted = await upsertUser(username, stats);
            if (inserted) {
                const solved = stats.matchedUser?.submitStats?.acSubmissionNum?.find((x: any) => x.difficulty === "All")?.count ?? 0;
                console.log(`✅ ${solved} solved, rank #${stats.matchedUser?.profile?.ranking ?? "N/A"}`);
                ok++;
            } else {
                console.log("❌ DB error");
                fail++;
            }

            await sleep(1000); // 1 second between profiles to be safe against LC rate limits
        }

        // Slight pause between ranking pages
        await sleep(2000);
    }

    console.log(`\n✅ Done!  seeded: ${ok} | skipped (not found): ${skip} | failed: ${fail}\n`);
}

main().catch(console.error);
