import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchLeetCodeAboutMe, parseMaxStreak } from "@/lib/leetcode";
import { calculateLeetcodeXp, mergeBaseXp } from "@/lib/xp";

type TagProblem = {
    tagName: string;
    problemsSolved: number;
};

type LeetCodeUserStats = {
    username?: string;
    maxStreak?: number;
    badges?: {
        id: string;
        name: string;
        icon: string;
        displayName: string;
    }[];
    profile?: {
        realName?: string;
        userAvatar?: string;
        aboutMe?: string;
        ranking?: number;
        reputation?: number;
        countryName?: string;
        school?: string;
        company?: string;
        websites?: string[];
        linkedinUrl?: string;
        twitterUrl?: string;
        githubUrl?: string;
    };
    submitStats?: {
        acSubmissionNum?: { difficulty: string; count: number }[];
        totalSubmissionNum?: { difficulty: string; count: number }[];
    };
    tagProblemCounts?: {
        advanced?: TagProblem[];
        intermediate?: TagProblem[];
        fundamental?: TagProblem[];
    };
};

type ContestStats = {
    rating?: number;
    globalRanking?: number;
    attendedContestsCount?: number;
    topPercentage?: number;
    badge?: {
        name?: string;
    };
};

type StreakStats = {
    streak?: number;
    totalActiveDays?: number;
};

/**
 * @param {import('next/server').NextRequest} req
 */
export async function POST(req: Request) {
    try {
        const { leetcode_username } = await req.json();
        if (!leetcode_username) {
            return NextResponse.json({ error: "Missing LeetCode username" }, { status: 400 });
        }

        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
        }

        // Generate the expected deterministic token for this user
        const expectedToken = "LCC-" + user.id.split("-")[0].toUpperCase();

        // Fetch the user's public LeetCode 'About Me' / Summary
        const aboutMe = await fetchLeetCodeAboutMe(leetcode_username);

        if (aboutMe === null) {
            return NextResponse.json({ error: "Could not find this LeetCode account" }, { status: 404 });
        }

        if (!aboutMe.includes(expectedToken)) {
            return NextResponse.json({
                error: `Verification failed. Could not find ${expectedToken} in your LeetCode Summary. Make sure you saved your profile.`
            }, { status: 403 });
        }

        const admin = getSupabaseAdmin();

        // Fetch full LC stats: easy/medium/hard, contest rating, streak
        let lcUserStats: LeetCodeUserStats | null = null;
        let lcContestStats: ContestStats | null = null;
        let lcStreakStats: StreakStats | null = null;
        try {
            const currentYear = new Date().getFullYear();
            let aliases = "";
            for (let y = 2015; y <= currentYear; y++) {
                aliases += `\n                        y${y}: userCalendar(year: ${y}) { submissionCalendar }`;
            }
            const profileQuery = `
                query getUserProfile($username: String!) {
                    matchedUser(username: $username) {
                        username
                        profile {
                            realName
                            userAvatar
                            aboutMe
                            ranking
                            reputation
                            countryName
                            school
                            company
                            websites
                            linkedinUrl
                            twitterUrl
                            githubUrl
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
                        userCalendar {
                            streak
                            totalActiveDays
                        }${aliases}
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
            const statsRes = await fetch("https://leetcode.com/graphql", {
                method: "POST",
                headers: { "Content-Type": "application/json", "Referer": "https://leetcode.com" },
                body: JSON.stringify({ query: profileQuery, variables: { username: leetcode_username } }),
            });
            const statsJson = await statsRes.json();
            lcUserStats = statsJson?.data?.matchedUser;
            lcContestStats = statsJson?.data?.userContestRanking;
            lcStreakStats = statsJson?.data?.matchedUser?.userCalendar;
            if (lcUserStats) {
                lcUserStats.maxStreak = parseMaxStreak(lcUserStats, currentYear);
            }
        } catch (err) { console.warn("[app/api/verify-leetcode/route.ts] non-critical error:", err); }
        // Parse solved counts by difficulty
        const acNums: { difficulty: string; count: number }[] =
            lcUserStats?.submitStats?.acSubmissionNum ?? [];
        const totalNums: { difficulty: string; count: number }[] =
            lcUserStats?.submitStats?.totalSubmissionNum ?? [];

        const getAC = (d: string) => acNums.find(x => x.difficulty === d)?.count ?? 0;
        const getTotal = (d: string) => totalNums.find(x => x.difficulty === d)?.count ?? 1;

        const easy_solved = getAC("Easy");
        const medium_solved = getAC("Medium");
        const hard_solved = getAC("Hard");
        const total_solved = getAC("All");
        const total_submitted = getTotal("All");
        const acceptance_rate = total_submitted > 0
            ? Math.round((total_solved / total_submitted) * 100) / 100
            : 0;

        const contest_rating = Math.round(lcContestStats?.rating ?? 0);
        const contest_rank = lcContestStats?.globalRanking ?? null;
        const lc_streak = lcUserStats?.maxStreak ?? lcStreakStats?.streak ?? 0;
        const lc_max_streak = lcUserStats?.maxStreak ?? 0;
        const active_days_last_year = lcStreakStats?.totalActiveDays ?? 0;
        const total_active_days = lcStreakStats?.totalActiveDays ?? 0;

        // Contest extended stats
        const contests_attended = lcContestStats?.attendedContestsCount ?? 0;
        const contest_top_percentage = lcContestStats?.topPercentage ?? null;
        const contest_badge_name = lcContestStats?.badge?.name ?? null;

        // Badges
        const badges: { id: string; name: string; icon: string; displayName: string }[] = lcUserStats?.badges ?? [];
        const lc_badges_all = badges.map((b) => ({ name: b.name, icon: b.icon, displayName: b.displayName }));
        const lc_badge = badges.length > 0 ? badges[badges.length - 1].name : null;

        // Profile metadata
        const lc_bio = lcUserStats?.profile?.aboutMe ?? null;
        const lc_country_code = lcUserStats?.profile?.countryName ?? null;
        const lc_school = lcUserStats?.profile?.school ?? null;
        const lc_company = lcUserStats?.profile?.company ?? null;
        const lc_website = lcUserStats?.profile?.websites?.[0] ?? null;
        const lc_twitter = lcUserStats?.profile?.twitterUrl ?? null;
        const lc_linkedin = lcUserStats?.profile?.linkedinUrl ?? null;
        const lc_github = lcUserStats?.profile?.githubUrl ?? null;

        // Tag problem stats: merge advanced + intermediate + fundamental
        const tagCounts = lcUserStats?.tagProblemCounts;
        const lc_tag_stats = [
            ...(tagCounts?.advanced ?? []),
            ...(tagCounts?.intermediate ?? []),
            ...(tagCounts?.fundamental ?? []),
        ]
            .sort((a: TagProblem, b: TagProblem) => b.problemsSolved - a.problemsSolved)
            .slice(0, 20)
            .map((t: TagProblem) => ({ name: t.tagName, solved: t.problemsSolved }));

        // litPercentage = how lit the building windows are
        // For LC: active_days / 365 (capped at 1.0), same mechanic as LeetCode City uses commit frequency
        // Min 15% so building always looks inhabited; max 92% so some windows always dark
        const litPercentage = Math.min(0.92, Math.max(0.15, active_days_last_year / 365));

        const contributions = Math.max(1, total_solved);
        const rank = lcUserStats?.profile?.ranking ?? 999999;
        const reputation = lcUserStats?.profile?.reputation ?? 0;
        const name = lcUserStats?.profile?.realName || lcUserStats?.username || leetcode_username;
        const avatar_url = lcUserStats?.profile?.userAvatar || "";

        let hash = 0;
        for (let i = 0; i < leetcode_username.length; i++) {
            hash = Math.imul(31, hash) + leetcode_username.charCodeAt(i) | 0;
        }
        const github_id = Math.abs(hash);

        // Store raw LC rank in `rank` column for display
        // Store `500000 - lcRank` in `public_repos` so building height calculation rewards better rank
        // (lower rank number = better = bigger building, since the height formula rewards higher public_repos)
        const rankBoost = Math.max(0, 500000 - rank);

        const newBaseXp = calculateLeetcodeXp({ easy_solved, medium_solved, hard_solved, contest_rating, lc_streak });

        // Atomic claim check: First, try to claim an unclaimed building or update own claim
        // This prevents TOCTOU race conditions by using database-level constraints.
        // Also pull existing XP so re-verification preserves earned (non-base) XP.
        const { data: existingDev } = await admin
            .from("developers")
            .select("id, claimed_by, xp_total, xp_github")
            .eq("github_login", leetcode_username.toLowerCase())
            .maybeSingle();

        // Re-verification must update the base XP without wiping XP earned from
        // other sources (check-ins, dailies, rewards, redemptions, raids, etc.).
        // For a first-time claim existingDev is null, so this is just newBaseXp.
        const newXpTotal = mergeBaseXp(existingDev?.xp_total, existingDev?.xp_github, newBaseXp);

        let devId: string | undefined;

        if (existingDev) {
            // Building exists - verify claim ownership
            if (existingDev.claimed_by && existingDev.claimed_by !== user.id) {
                return NextResponse.json({ 
                    error: "This LeetCode account is already linked to another user." 
                }, { status: 409 });
            }

            // Update existing building (either unclaimed or owned by current user)
            const { data: updateData, error: updateError } = await admin
                .from("developers")
                .update({
                    lc_username: leetcode_username.toLowerCase(),
                    github_id: github_id,
                    name: name,
                    avatar_url: avatar_url,
                    claimed: true,
                    claimed_by: user.id,
                    claimed_at: new Date().toISOString(),
                    fetch_priority: 1,
                    rank: rank,
                    lc_global_rank: rank,
                    contributions: contributions,
                    public_repos: rankBoost,
                    total_stars: reputation,
                    fetched_at: new Date().toISOString(),
                    easy_solved: easy_solved,
                    medium_solved: medium_solved,
                    hard_solved: hard_solved,
                    acceptance_rate: acceptance_rate,
                    contest_rating: contest_rating,
                    contest_rank: contest_rank,
                    lc_streak: lc_streak,
                    lc_max_streak: lc_max_streak,
                    active_days_last_year: active_days_last_year,
                    total_active_days: total_active_days,
                    total_submitted: total_submitted,
                    contests_attended: contests_attended,
                    contest_top_percentage: contest_top_percentage,
                    contest_badge_name: contest_badge_name,
                    lc_badge: lc_badge,
                    lc_badges_all: lc_badges_all,
                    lc_bio: lc_bio,
                    lc_country_code: lc_country_code,
                    lc_school: lc_school,
                    lc_company: lc_company,
                    lc_website: lc_website,
                    lc_twitter: lc_twitter,
                    lc_linkedin: lc_linkedin,
                    lc_github: lc_github,
                    lc_tag_stats: lc_tag_stats,
                    xp_github: newBaseXp,
                    xp_total: newXpTotal,
                    contributions_total: Math.round(litPercentage * 1000),
                })
                .eq("id", existingDev.id)
                .or(`claimed_by.is.null,claimed_by.eq.${user.id}`)
                .select("id")
                .maybeSingle();

            if (updateError || !updateData) {
                // Update failed - likely because someone else claimed it between our check and update
                return NextResponse.json({ 
                    error: "This LeetCode account was just claimed by another user. Please try again." 
                }, { status: 409 });
            }

            devId = updateData.id;
        } else {
            // Building doesn't exist - insert new one
            const { data: insertData, error: insertError } = await admin
                .from("developers")
                .insert({
                    github_login: leetcode_username.toLowerCase(),
                    lc_username: leetcode_username.toLowerCase(),
                    github_id: github_id,
                    name: name,
                    avatar_url: avatar_url,
                    claimed: true,
                    claimed_by: user.id,
                    claimed_at: new Date().toISOString(),
                    fetch_priority: 1,
                    rank: rank,
                    lc_global_rank: rank,
                    contributions: contributions,
                    public_repos: rankBoost,
                    total_stars: reputation,
                    fetched_at: new Date().toISOString(),
                    easy_solved: easy_solved,
                    medium_solved: medium_solved,
                    hard_solved: hard_solved,
                    acceptance_rate: acceptance_rate,
                    contest_rating: contest_rating,
                    contest_rank: contest_rank,
                    lc_streak: lc_streak,
                    lc_max_streak: lc_max_streak,
                    active_days_last_year: active_days_last_year,
                    total_active_days: total_active_days,
                    total_submitted: total_submitted,
                    contests_attended: contests_attended,
                    contest_top_percentage: contest_top_percentage,
                    contest_badge_name: contest_badge_name,
                    lc_badge: lc_badge,
                    lc_badges_all: lc_badges_all,
                    lc_bio: lc_bio,
                    lc_country_code: lc_country_code,
                    lc_school: lc_school,
                    lc_company: lc_company,
                    lc_website: lc_website,
                    lc_twitter: lc_twitter,
                    lc_linkedin: lc_linkedin,
                    lc_github: lc_github,
                    lc_tag_stats: lc_tag_stats,
                    xp_github: newBaseXp,
                    xp_total: newBaseXp,
                    contributions_total: Math.round(litPercentage * 1000),
                })
                .select("id")
                .single();

            if (insertError) {
                // Insert failed - check if it's a duplicate key conflict
                if (insertError.code === "23505") {
                    return NextResponse.json({ 
                        error: "This LeetCode account was just claimed by another user. Please try again." 
                    }, { status: 409 });
                }
                return NextResponse.json({ error: "Failed to create user record." }, { status: 500 });
            }

            devId = insertData?.id;
        }

        // Insert feed event
        if (devId) {
            await admin.from("activity_feed").insert({
                event_type: "building_claimed",
                actor_id: devId,
                metadata: { login: leetcode_username.toLowerCase() },
            });
        }

        return NextResponse.json({ success: true, leetcode_username: leetcode_username.toLowerCase() });

    } catch (err: unknown) {
        const message =
            err instanceof Error ? err.message : "Internal server error";
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
