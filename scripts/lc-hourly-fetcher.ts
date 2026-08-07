/**
 * LC City Hourly Fetcher
 * Runs continuously and refreshes stale developer profiles.
 * Also supports running in `--one-shot` mode for CI/CD and scheduled cron environments (e.g. GitHub Actions).
 *
 * Run:  npx tsx --env-file=<path_to_env> scripts/lc-hourly-fetcher.ts [options]
 * Options:
 *   --one-shot                 Run one cycle and exit
 *   --limit <number>           Number of profiles to refresh (default: 75)
 *   --concurrency <number>     Concurrency limit (default: 5)
 *   --discover-pages <number>  Number of ranking pages to scan (default: 2)
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

// ── Parse CLI arguments ───────────────────────────────────────
const args = process.argv.slice(2);
const ONE_SHOT = args.includes("--one-shot");

function getArgValue(name: string): string | null {
    const idx = args.indexOf(name);
    if (idx !== -1 && idx + 1 < args.length) {
        return args[idx + 1];
    }
    return null;
}

const LIMIT = parseInt(getArgValue("--limit") || "75", 10);
const CONCURRENCY = parseInt(getArgValue("--concurrency") || "5", 10);
const DISCOVER_PAGES = parseInt(getArgValue("--discover-pages") || "2", 10);

const HOUR_MS = 60 * 60 * 1000;
const CHUNK_DELAY_MS = 3000; // 3 seconds delay between concurrent chunks

const LC_HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "User-Agent": "Mozilla/5.0 (compatible; LeetCodeCity/1.0)",
};

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

function calendarAliases(): string {
    const year = new Date().getFullYear();
    // Return aliases from 2020 to current year to avoid oversized LC calendar payloads.
    return Array.from({ length: year - 2019 }, (_, i) => 2020 + i)
        .map((y) => `\n        y${y}: userCalendar(year: ${y}) { submissionCalendar }`)
        .join("");
}

async function fetchLCFullProfile(username: string): Promise<any> {
    const currentYear = new Date().getFullYear();
    const prevYear = currentYear - 1;

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
            const mu = json.data.matchedUser;
            mu.maxStreak = parseMaxStreak(mu, currentYear);
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

    // Calculate weekly contributions (last 7 days)
    const now = new Date();
    const sevenDaysAgoTs = Math.floor(now.getTime() / 1000) - 7 * 24 * 60 * 60;
    const sevenDaysAgoDate = new Date(sevenDaysAgoTs * 1000);

    const currentYear = now.getUTCFullYear();
    const sevenDaysAgoYear = sevenDaysAgoDate.getUTCFullYear();

    const yearsToCheck = [currentYear];
    if (sevenDaysAgoYear !== currentYear) {
        yearsToCheck.push(sevenDaysAgoYear);
    }

    let weeklyContributions = 0;

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
                console.warn(`  [lc-refresh] Error parsing calendar for year ${year} of ${username}:`, err);
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
        { onConflict: "github_login" }
    );

    if (error) console.error(`  DB error for ${username}:`, error.message);
    return !error;
}

// ── Discovery: find new users from LC ranking pages ──────────

async function fetchRankingPage(page: number): Promise<string[]> {
    const query = `
    query globalRanking($page: Int!) {
      globalRanking(page: $page) {
        rankingNodes {
          user {
            username
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
        return nodes.map((n: { user: { username: string } }) => n.user.username);
    } catch (err) {
        console.error("Error fetching ranking page:", err);
        return [];
    }
}

async function filterNewUsernames(usernames: string[]): Promise<string[]> {
    if (usernames.length === 0) return [];

    const { data: existing } = await sb
        .from("developers")
        .select("github_login")
        .in("github_login", usernames.map((u) => u.toLowerCase()));

    const existingSet = new Set((existing ?? []).map((d: { github_login: string }) => d.github_login));
    return usernames.filter((u) => !existingSet.has(u.toLowerCase()));
}

async function discoverNewUsers(pagesToScan: number): Promise<number> {
    console.log(`\n  Discovery: scanning ${pagesToScan} randomized ranking page(s) for new users...`);

    let totalDiscovered = 0;
    const scannedPages = new Set<number>();

    for (let i = 0; i < pagesToScan; i++) {
        // Pick a random page from the top 100 global ranking pages
        let page = Math.floor(Math.random() * 100) + 1;
        while (scannedPages.has(page)) {
            page = Math.floor(Math.random() * 100) + 1;
        }
        scannedPages.add(page);

        const usernames = await fetchRankingPage(page);

        if (usernames.length === 0) {
            console.log(`  ⚠️  No users found on ranking page ${page}. Rate limited?`);
            await sleep(5000);
            continue;
        }

        const newUsernames = await filterNewUsernames(usernames);

        if (newUsernames.length === 0) {
            console.log(`  Page ${page}: all ${usernames.length} users already in DB`);
            continue;
        }

        console.log(`  Page ${page}: ${newUsernames.length} new users out of ${usernames.length}`);

        // Stub-insert new users so they get picked up by standard stale-user refresh queue
        const stubs = newUsernames.map((login) => {
            let hash = 0;
            for (const ch of login) hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0;
            return {
                github_login: login.toLowerCase(),
                github_id: Math.abs(hash),
                fetched_at: new Date(0).toISOString(), // Epoch timestamp pushes them to front of queue
            };
        });

        const { error } = await sb
            .from("developers")
            .upsert(stubs, { onConflict: "github_login", ignoreDuplicates: true });

        if (error) {
            console.warn("  ❌ Discovery insert error:", error.message);
        } else {
            totalDiscovered += newUsernames.length;
            console.log(`  ✅ Inserted ${newUsernames.length} stubs from page ${page}`);
        }

        await sleep(1500);
    }

    return totalDiscovered;
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

    const claimedLogins = (claimed ?? []).map((d: { github_login: string }) => d.github_login);
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

    return [...claimedLogins, ...(unclaimed ?? []).map((d: { github_login: string }) => d.github_login)];
}

async function runHourlyCycle(cycleNum: number) {
    const now = new Date().toLocaleTimeString();
    console.log(`\n${"═".repeat(60)}`);
    console.log(`  🔄  Hourly Cycle #${cycleNum} — ${now}`);
    console.log(`${"═".repeat(60)}\n`);

    const discovered = await discoverNewUsers(DISCOVER_PAGES);
    console.log(` Discovered & stubbed ${discovered} new user(s)\n`);

    const logins = await pickStalestDevs(LIMIT);

    if (logins.length === 0) {
        console.log("  ✅ All profiles are fresh. Nothing to refresh this hour.\n");
        return;
    }

    console.log(`  Refreshing ${logins.length} profiles (target: ${LIMIT}, concurrency: ${CONCURRENCY})...\n`);

    let ok = 0, skip = 0, fail = 0;

    async function fetchAndUpsert(username: string, index: number): Promise<void> {
        const data = await fetchLCFullProfile(username);

        if (!data?.matchedUser) {
            console.log(`  [${String(index + 1).padStart(3)}] ${username.padEnd(28)} ⚠️  not found / private`);
            skip++;
        } else {
            const success = await upsertFullProfile(username, data);
            if (success) {
                const solved = data.matchedUser?.submitStats?.acSubmissionNum?.find((x: { difficulty: string }) => x.difficulty === "All")?.count ?? 0;
                const streak = data.matchedUser?.maxStreak ?? 0;
                console.log(`  [${String(index + 1).padStart(3)}] ${username.padEnd(28)} ✅  ${solved} solved | streak ${streak}`);
                ok++;
            } else {
                console.log(`  [${String(index + 1).padStart(3)}] ${username.padEnd(28)} ❌ DB error`);
                fail++;
            }
        }
    }

    // Run in concurrent chunks
    for (let i = 0; i < logins.length; i += CONCURRENCY) {
        const chunk = logins.slice(i, i + CONCURRENCY);
        await Promise.allSettled(chunk.map((username, index) => fetchAndUpsert(username, i + index)));
        if (i + CONCURRENCY < logins.length) {
            await sleep(CHUNK_DELAY_MS);
        }
    }

    console.log(`\n  ✅ Cycle #${cycleNum} done — ${discovered} discovered | ${ok} refreshed | ${skip} skipped | ${fail} failed`);
}

async function main() {
    console.log("\n🏙️  LC City Pipeline Fetcher");
    console.log(`   Target:       ~${LIMIT} users/run`);
    console.log(`   Concurrency:  ${CONCURRENCY}`);
    console.log(`   Discovery:    ${DISCOVER_PAGES} random pages`);
    console.log(`   One-shot:     ${ONE_SHOT}`);
    console.log(`   Claimed users refreshed if stale > 6h`);
    console.log(`   Seeded users refreshed if stale > 24h`);
    console.log("\n   Press Ctrl+C to stop at any time.\n");

    if (ONE_SHOT) {
        await runHourlyCycle(1);
        console.log("\n👋 One-shot run completed. Exiting.");
        process.exit(0);
    }

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
