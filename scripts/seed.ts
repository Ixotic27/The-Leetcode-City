import { createClient } from "@supabase/supabase-js";

// ─── Config ──────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const GITHUB_TOKEN = process.env.GITHUB_TOKEN!;

if (!SUPABASE_URL || !SUPABASE_KEY || !GITHUB_TOKEN) {
  console.error(
    "Missing env vars. Make sure NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and GITHUB_TOKEN are set."
  );
  console.error("Run: source .env.local && npx tsx scripts/seed.ts");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

// ─── Top devs list ───────────────────────────────────────────

const TOP_DEVS = [
  "neal_wu", "tourist", "awice", "lee215", "stefanpochmann", "erictra", "wavy", "votrubac", "dbabichev",
  "lwy", "tonygarkovski", "katorz", "yan_xinyi", "hank55663", "liouh", "cuiaoxiang", "zemen", "xiaowuc1"
];

// ─── GitHub Helpers ──────────────────────────────────────────

const ghHeaders = {
  Accept: "application/vnd.github.v3+json",
  Authorization: `Bearer ${GITHUB_TOKEN}`,
  "User-Agent": "git-city-seed",
};

interface ExpandedGitHubData {
  contributions: number;
  contributions_total: number;
  contribution_years: number[];
  total_prs: number;
  total_reviews: number;
  total_issues: number;
  repos_contributed_to: number;
  followers: number;
  following: number;
  organizations_count: number;
  account_created_at: string | null;
  current_streak: number;
  longest_streak: number;
  active_days_last_year: number;
}

function buildYearAliases(): string {
  const currentYear = new Date().getFullYear();
  const lines: string[] = [];
  for (let y = currentYear; y >= currentYear - 9; y--) {
    lines.push(`y${y}: contributionsCollection(from: "${y}-01-01T00:00:00Z", to: "${y}-12-31T23:59:59Z") { contributionCalendar { totalContributions } }`);
  }
  return lines.join("\n    ");
}

function computeStreaks(weeks: Array<{ contributionDays: Array<{ contributionCount: number; date: string }> }>): {
  current_streak: number;
  longest_streak: number;
  active_days_last_year: number;
} {
  const allDays: { count: number; date: string }[] = [];
  for (const week of weeks) {
    for (const day of week.contributionDays) {
      allDays.push({ count: day.contributionCount, date: day.date });
    }
  }
  allDays.sort((a, b) => a.date.localeCompare(b.date));

  let active_days_last_year = 0;
  let longest_streak = 0;
  let currentRun = 0;

  for (const day of allDays) {
    if (day.count > 0) {
      active_days_last_year++;
      currentRun++;
      if (currentRun > longest_streak) longest_streak = currentRun;
    } else {
      currentRun = 0;
    }
  }

  let current_streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  for (let i = allDays.length - 1; i >= 0; i--) {
    const day = allDays[i];
    if (i === allDays.length - 1 && day.date !== today && day.date !== yesterday) break;
    if (i === allDays.length - 1 && day.count === 0 && day.date === today) continue;
    if (day.count > 0) {
      current_streak++;
    } else {
      break;
    }
  }

  return { current_streak, longest_streak, active_days_last_year };
}

async function fetchExpandedGitHubData(login: string): Promise<ExpandedGitHubData | null> {
  const yearAliases = buildYearAliases();

  const query = `
    query($login: String!) {
      user(login: $login) {
        createdAt
        followers { totalCount }
        following { totalCount }
        organizations(first: 1) { totalCount }
        repositoriesContributedTo(first: 1, contributionTypes: [COMMIT, PULL_REQUEST]) {
          totalCount
        }

        current: contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays { contributionCount, date }
            }
          }
          totalPullRequestContributions
          totalIssueContributions
          totalPullRequestReviewContributions
        }

        ${yearAliases}
      }
    }
  `;

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query, variables: { login } }),
    });

    if (!res.ok) return null;

    const json = await res.json();
    const user = json?.data?.user;
    if (!user) return null;

    const currentCollection = user.current;
    const contributions = currentCollection?.contributionCalendar?.totalContributions ?? 0;

    const currentYear = new Date().getFullYear();
    let contributions_total = 0;
    const contribution_years: number[] = [];
    for (let y = currentYear; y >= currentYear - 9; y--) {
      const yearData = user[`y${y}`];
      const yearContribs = yearData?.contributionCalendar?.totalContributions ?? 0;
      if (yearContribs > 0) {
        contributions_total += yearContribs;
        contribution_years.push(y);
      }
    }

    const weeks = currentCollection?.contributionCalendar?.weeks ?? [];
    const streaks = computeStreaks(weeks);

    return {
      contributions,
      contributions_total,
      contribution_years,
      total_prs: currentCollection?.totalPullRequestContributions ?? 0,
      total_reviews: currentCollection?.totalPullRequestReviewContributions ?? 0,
      total_issues: currentCollection?.totalIssueContributions ?? 0,
      repos_contributed_to: user.repositoriesContributedTo?.totalCount ?? 0,
      followers: user.followers?.totalCount ?? 0,
      following: user.following?.totalCount ?? 0,
      organizations_count: user.organizations?.totalCount ?? 0,
      account_created_at: user.createdAt ?? null,
      ...streaks,
    };
  } catch {
    return null;
  }
}

type RepoItem = {
  name: string;
  stargazers_count: number;
  language: string | null;
  html_url: string;
  fork: boolean;
  size: number;
};

async function fetchAndUpsert(login: string): Promise<boolean> {
  const query = `
    query getUserProfile($username: String!) {
      matchedUser(username: $username) {
        username
        profile {
          realName
          userAvatar
          aboutMe
          ranking
          reputation
        }
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
      }
    }
  `;

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
      },
      body: JSON.stringify({ query, variables: { username: login } }),
    });

    const json = await res.json();
    const lcUser = json?.data?.matchedUser;

    if (!lcUser) {
      console.log(`  [SKIP] ${login} - not found`);
      return false;
    }

    const contributions = lcUser.submitStats?.acSubmissionNum?.find((d: any) => d.difficulty === "All")?.count ?? 0;
    const ranking = lcUser.profile?.ranking ?? 999999;
    const reputation = lcUser.profile?.reputation ?? 0;

    let hash = 0;
    for (let i = 0; i < login.length; i++) {
      hash = Math.imul(31, hash) + login.charCodeAt(i) | 0;
    }
    const github_id = Math.abs(hash);

    const { error } = await sb.from("developers").upsert(
      {
        github_login: lcUser.username.toLowerCase(),
        github_id: github_id,
        name: lcUser.profile?.realName || lcUser.username,
        avatar_url: lcUser.profile?.userAvatar,
        bio: lcUser.profile?.aboutMe || "",
        contributions: contributions,
        public_repos: ranking,
        total_stars: reputation,
        primary_language: "C++",
        top_repos: [],
        fetched_at: new Date().toISOString(),
      },
      { onConflict: "github_login" }
    );

    if (error) {
      console.log(`  [ERR]  ${login} - ${error.message}`);
      return false;
    }

    console.log(
      `  [OK]   ${lcUser.username} — ${contributions} solved, ${reputation} rep, rank ${ranking}`
    );
    return true;
  } catch (err) {
    console.log(`  [ERR]  ${login} - ${err}`);
    return false;
  }
}

// ─── Main ────────────────────────────────────────────────────

async function main() {
  console.log(`\nSeeding Git City with ${TOP_DEVS.length} developers...\n`);

  // Deduplicate
  const unique = [...new Set(TOP_DEVS.map((d) => d.toLowerCase()))];

  let success = 0;
  let failed = 0;

  for (const login of unique) {
    const ok = await fetchAndUpsert(login);
    if (ok) success++;
    else failed++;

    // 1s delay between requests
    await new Promise((r) => setTimeout(r, 1000));
  }

  // Recalculate ranks
  console.log("\nRecalculating ranks...");
  const { error } = await sb.rpc("recalculate_ranks");
  if (error) {
    console.error("Failed to recalculate ranks:", error.message);
  } else {
    console.log("Ranks updated.");
  }

  console.log(`\nDone! ${success} added, ${failed} skipped/failed.\n`);
}

main().catch(console.error);
