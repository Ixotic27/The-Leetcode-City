/**
 * LC City Seeder
 * Populates the developers table with real LeetCode users.
 *
 * Run:  npx tsx --env-file=.env.local scripts/seed-lc.ts
 *
 * Uses a curated list of well-known LeetCode users (top contest participants,
 * editorial writers, etc.) whose profiles are public. For each user it fetches
 * full stats via the LeetCode GraphQL API and upserts into Supabase.
 */

import { createClient } from "@supabase/supabase-js";
import { parseMaxStreak } from "../src/lib/leetcode";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://ykqxkfazxsyantffjouf.supabase.co";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL) {
    console.error("Error: NEXT_PUBLIC_SUPABASE_URL is missing. Set it or ensure the fallback is set.");
    process.exit(1);
}

if (!SUPABASE_KEY) {
    console.error("Error: SUPABASE_SERVICE_ROLE_KEY is missing. Please configure it in your environment or GitHub Secrets.");
    process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

// ─── Curated list of top/known LC users ──────────────────────────────────────
// These are real, public LeetCode accounts spanning all skill levels.
// Includes top contest participants, editorial contributors, etc.

const LC_USERS = [
    // 100% API Verified Global Competitors & Contest Winners (Top Rankings)
    "fjzzq2002", "neal_wu", "Yawn_Sean", "ahmed007boss", "liming-v", 
    "numb3r5", "PurpleCrayon", "hankray", "HazemAllaham", "fmota", 
    "pandaforever", "xiaowuc1", "zhoupeiyun", "Nahin_Imtiaz", "qeetcode", 
    "Shandse40", "Carefreejs", "jonathanirvings", "wwwwodddd", "TheWander", 
    "_kevinyang", "emthrm", "MisterSoandSo", "snap_dragon", "dong_liu", 
    "thenymphsofdelphi", "usephysics", "tmwilliamlin168", "user8991p", "Naruto_x", 
    "ayushkumar980", "lympanda", "satyajeetramnit2708", "bucker", "mohfadhil", 
    "natsugiri", "manohar.morthala", "getnaukri", "tabr", "queerAsfolk", 
    "Allink", "hitonanode", "stany", "waakaaka", "bucketpotato", 
    "Aging", "rfpermen", "kirika-comp", "0suoicsnocbus", "karate", 
    "dreamoon", "python_champ123", "LayCurse", "bilyhurington", "skpeng", 
    "tarek", "parallel_stream", "penguinhacker", "Poojash18", "youtube_aryanc403", 
    "MichaelPengDeveloper", "flashmt", "Nirav5502", "klion26", "zeusmx", 
    "pathetic-dog", "dnialh", "VeritasVelata", "mayur0055", "AntonRaichuk", 
    "zacharychao", "vince1114", "smax", "kaikaikaikaikai", "369488685", 
    "superlevelup", "katcibo", "green_pig", "shyamjha12", "friedall", 
    "gdkat", "istiak227", "R3mix", "cai_lw", "awice", "wery0", 
    "doc967", "Sd-Invol", "Dear_starboy", "chalowis", "scanhex", 
    "beet", "freeyourmind", "lachy_136", "theone7", "homedir", 
    "sqqqqqq", "viraaj", "enev13", "superluminal",

    // Famous Community Profiles & Tech Educators
    "NeetCode", "striver", "loveBabbar", "kunal_kushwaha", "nishant_chahar", 
    "freeCodeCamp", "ThePrimeagen", "TechLead", "JomaTech", "code_with_harry",
    "lee215", "stefanpochmann", "votrubac", "hiepit", "DBabichev", "errichto"
];

// ─── LeetCode GraphQL fetcher ─────────────────────────────────────────────────

const LC_HEADERS = {
    "Content-Type": "application/json",
    "Referer": "https://leetcode.com",
    "User-Agent": "Mozilla/5.0",
};

async function sleep(ms: number) {
    return new Promise(r => setTimeout(r, ms));
}

async function fetchLCUser(username: string) {
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
        yearCurrent: userCalendar(year: ${currentYear}) { streak totalActiveDays submissionCalendar }
        yearPrev: userCalendar(year: ${prevYear}) { submissionCalendar }
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
        if (json?.data?.matchedUser) {
            const mu = json.data.matchedUser;
            if (mu.yearCurrent) {
                mu[`y${currentYear}`] = mu.yearCurrent;
                if (!mu.userCalendar) {
                    mu.userCalendar = {
                        streak: mu.yearCurrent.streak ?? 0,
                        totalActiveDays: mu.yearCurrent.totalActiveDays ?? 0
                    };
                }
            }
            if (mu.yearPrev) {
                mu[`y${prevYear}`] = mu.yearPrev;
            }
        }
        return json?.data ?? null;
    } catch {
        return null;
    }
}

// ─── Upsert into Supabase ────────────────────────────────────────────────────

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
    const litPercentage = Math.min(0.92, Math.max(0.15, activeDays / 365));

    // Stable hash for fake github_id
    let hash = 0;
    for (const ch of username) hash = (Math.imul(31, hash) + ch.charCodeAt(0)) | 0;

    const { error } = await sb.from("developers").upsert({
        github_login: username.toLowerCase(),
        github_id: Math.abs(hash),
        name: user.profile?.realName || user.username,
        avatar_url: user.profile?.userAvatar || "",
        contributions: Math.max(1, totalSolved),
        contributions_total: Math.round(litPercentage * 1000),
        total_stars: reputation,
        public_repos: Math.max(0, 500000 - lcRank),
        rank: lcRank,
        fetch_priority: 1,
        fetched_at: new Date().toISOString(),
        claimed: false,
        // LC-specific fields
        easy_solved: easySolved,
        medium_solved: medSolved,
        hard_solved: hardSolved,
        acceptance_rate: acceptanceRate,
        contest_rating: contestRating,
        lc_streak: streak,
        active_days_last_year: activeDays,
    }, { onConflict: "github_login" });

    return !error;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n🏙️  LC City Seeder — seeding ${LC_USERS.length} users...\n`);

    let ok = 0, skip = 0, fail = 0;

    for (let i = 0; i < LC_USERS.length; i++) {
        const username = LC_USERS[i];
        process.stdout.write(`  [${String(i + 1).padStart(3)}/${LC_USERS.length}] ${username.padEnd(22)} `);

        const data = await fetchLCUser(username);
        if (!data?.matchedUser) {
            console.log("⚠️  not found / private");
            skip++;
            await sleep(300);
            continue;
        }

        const inserted = await upsertUser(username, data);
        if (inserted) {
            const solved = data.matchedUser?.submitStats?.acSubmissionNum
                ?.find((x: any) => x.difficulty === "All")?.count ?? 0;
            console.log(`✅ ${solved} solved, rank #${data.matchedUser?.profile?.ranking ?? "N/A"}`);
            ok++;
        } else {
            console.log("❌ DB error");
            fail++;
        }

        // Polite delay to avoid LC rate limits
        await sleep(500);
    }

    console.log(`\n✅ Done!  seeded: ${ok} | skipped (not found): ${skip} | failed: ${fail}\n`);
}

main().catch(console.error);
