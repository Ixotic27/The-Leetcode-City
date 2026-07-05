/**
 * LC City Infinite Mass Seeder
 * Populates the developers table continuously.
 *
 * It paginates through LeetCode's global ranking pages indefinitely to reliably grab real,
 * active users and fetch their stats via GraphQL.
 *
 * State (last completed page) is persisted to a local JSON file (scripts/seed-lc-state.json)
 * so runs can resume where they left off. In CI, this file is cached between workflow runs
 * (see .github/workflows/seed-cron.yml).
 *
 * Run:  npx tsx --env-file=.env.local scripts/seed-lc-infinite.ts
 * Batch (CI): npx tsx scripts/seed-lc-infinite.ts --pages 5
 */

import { createClient } from "@supabase/supabase-js";
import { parseMaxStreak } from "../src/lib/leetcode";
import fs from "fs";
import path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykqxkfazxsyantffjouf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── CLI Args ──
const args = process.argv.slice(2);
const pagesArg = args.indexOf("--pages");
let MAX_PAGES = Infinity;
if (pagesArg !== -1) {
  const raw = args[pagesArg + 1];
  const parsed = Number(raw);
  if (!raw || !Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
    console.error("Error: --pages must be a positive integer (e.g., --pages 5)");
    process.exit(1);
  }
  MAX_PAGES = parsed;
}

if (!SUPABASE_URL) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL is missing. Set it or ensure the fallback is set.");
  process.exit(1);
}

if (!SUPABASE_KEY) {
  console.error("Error: SUPABASE_SERVICE_ROLE_KEY is missing. Please configure it in your environment or GitHub Secrets.");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

const LC_HEADERS = {
  "Content-Type": "application/json",
  Referer: "https://leetcode.com",
  "User-Agent": "Mozilla/5.0",
};

const STATE_FILE = path.join(__dirname, "seed-lc-state.json");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// State persistence (local file) 

function getLastPage(): number {
  try {
    if (fs.existsSync(STATE_FILE)) {
      const raw = fs.readFileSync(STATE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed?.lastPage) return parsed.lastPage;
    }
  } catch {
    // Ignore, default to page 1
  }
  return 1;
}

function saveState(page: number) {
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ lastPage: page }));
  } catch (err) {
    console.warn("⚠️  Could not write local state file.", err);
  }
}

// LeetCode fetchers 

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

    if (res.status === 429) {
      console.warn(`⚠️  Rate limited fetching ranking page ${page} (HTTP 429).`);
      return [];
    }
    if (!res.ok) {
      console.error(`Error fetching ranking page ${page}: HTTP ${res.status}`);
      return [];
    }

    const json = await res.json();
    const nodes = json?.data?.globalRanking?.rankingNodes ?? [];
    return nodes.map((n: any) => n.user.username);
  } catch (err) {
    console.error(`Error fetching ranking page ${page}:`, err);
    return [];
  }
}

async function fetchLCUserStats(username: string) {
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  const query = `
    query($username: String!) {
      matchedUser(username: $username) {
        username
        profile { realName userAvatar ranking reputation }
        submitStats {
          acSubmissionNum { difficulty count }
          totalSubmissionNum { difficulty count }
        }
        userCalendar { streak totalActiveDays }${[currentYear, prevYear]
          .map((y) => `\n        y${y}: userCalendar(year: ${y}) { submissionCalendar }`)
          .join("")}
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

    if (!res.ok) {
      console.warn(`⚠️  HTTP ${res.status} fetching stats for ${username}`);
      return null;
    }

    const json = await res.json();

    if (json?.data?.matchedUser && !json.data.matchedUser.userCalendar) {
      // No calendar data (private profile, etc.) — treat like "not found" so callers skip it cleanly.
      return null;
    }

    return json?.data ?? null;
  } catch {
    return null;
  }
}

// Upsert 

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
  const streak = parseMaxStreak(user, new Date().getFullYear()) || user.userCalendar?.streak || 0;
  const lcRank = user.profile?.ranking ?? 999999;
  const reputation = user.profile?.reputation ?? 0;
  const contestRating = Math.round(data?.userContestRanking?.rating ?? 0);
  const acceptanceRate = totalSub > 0 ? Math.round((totalSolved / totalSub) * 100) / 100 : 0;
  const realName = user.profile?.realName?.trim() ? user.profile.realName : user.username;
  const litPercentage = Math.min(1.0, Math.max(0.1, activeDays / 365));

  // Generate stable fake github ID for compatibility with the existing schema.
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
      contributions_total: Math.round(litPercentage * 1000), // Visual light intensity
      total_stars: reputation,
      public_repos: Math.max(0, parseInt(String(lcRank), 10) > 0 ? 500000 - lcRank : 0),
      rank: lcRank,
      lc_global_rank: lcRank,
      fetch_priority: 2,
      fetched_at: new Date().toISOString(),
      claimed: false,
      easy_solved: easySolved,
      medium_solved: medSolved,
      hard_solved: hardSolved,
      acceptance_rate: acceptanceRate,
      contest_rating: contestRating,
      contest_rank: data?.userContestRanking?.globalRanking ?? null,
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

// Main Execution 

async function main() {
  const startPage = getLastPage();
  console.log(`\n🏙️  LC City Infinite Mass Seeder — Resuming from page ${startPage}...\n`);
  if (MAX_PAGES !== Infinity) {
    console.log(`📦 Batch mode: will process ${MAX_PAGES} page(s) then stop.\n`);
  }

  let ok = 0,
    skip = 0,
    fail = 0;
  let page = startPage;
  let retryCount = 0;
  const MAX_RETRIES_PER_PAGE = 3;

  // Flush current state on unexpected termination (e.g. CI timeout / SIGTERM) so progress isn't lost.
  const persistOnExit = () => {
    saveState(page);
    process.exit(1);
  };
  process.on("SIGTERM", persistOnExit);
  process.on("SIGINT", persistOnExit);

  while (page < startPage + MAX_PAGES) {
    console.log(`\n--- Fetching global ranking page ${page} ---`);
    const usernames = await fetchRankingPage(page);

    if (usernames.length === 0) {
      retryCount++;
      if (retryCount >= MAX_RETRIES_PER_PAGE) {
        console.warn(`⏭️  Page ${page} returned empty ${MAX_RETRIES_PER_PAGE} times — skipping.`);
        retryCount = 0;
        page++;
        saveState(page);
        continue;
      }
      console.log(`⚠️  No users found on page (attempt ${retryCount}/${MAX_RETRIES_PER_PAGE}). Rate limited? Backing off...`);
      await sleep(10000 * retryCount); // exponential-ish: 10s, 20s
      continue;
    }
    retryCount = 0;

    for (const username of usernames) {
      process.stdout.write(`  Upserting ${username.padEnd(20)} `);

      const stats = await fetchLCUserStats(username);

      if (!stats?.matchedUser) {
        console.log("⚠️  not found / private");
        skip++;
        await sleep(500);
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

      await sleep(1000); // Very important to sleep against LC API rules
    }

    // Save progress state after each fully-processed page.
    page++;
    saveState(page);

    // Pause between pages
    await sleep(2000);
  }

  process.off("SIGTERM", persistOnExit);
  process.off("SIGINT", persistOnExit);

  console.log(`\n🏁 Batch complete — ${ok} ok | ${skip} skipped | ${fail} failed | stopped at page ${page}`);
}

main().catch((err) => {
  console.error("Fatal error in seeder:", err);
  process.exit(1);
});