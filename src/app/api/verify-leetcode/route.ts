import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { fetchLeetCodeAboutMe } from "@/lib/leetcode";

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
            return NextResponse.json({ error: "Could not find this GitHub account" }, { status: 404 });
        }

        if (!aboutMe.includes(expectedToken)) {
            return NextResponse.json({
                error: `Verification failed. Could not find ${expectedToken} in your LeetCode Summary. Make sure you saved your profile.`
            }, { status: 403 });
        }

        const admin = getSupabaseAdmin();

        // Check if someone else already claimed this LeetCode username
        const { data: existingClaim } = await admin
            .from("developers")
            .select("claimed_by")
            .eq("github_login", leetcode_username.toLowerCase())
            .maybeSingle();

        if (existingClaim && existingClaim.claimed_by && existingClaim.claimed_by !== user.id) {
            return NextResponse.json({ error: "This GitHub account is already linked to another LeetCode user." }, { status: 409 });
        }

        // Fetch full LC stats: easy/medium/hard, contest rating, streak
        let lcUserStats = null;
        let lcContestStats = null;
        let lcStreakStats = null;
        try {
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
                        }
                        submitStats {
                            acSubmissionNum { difficulty count }
                            totalSubmissionNum { difficulty count }
                        }
                        userCalendar {
                            streak
                            totalActiveDays
                        }
                    }
                    userContestRanking(username: $username) {
                        rating
                        globalRanking
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
        } catch { }

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
        const lc_streak = lcStreakStats?.streak ?? 0;
        const active_days_last_year = lcStreakStats?.totalActiveDays ?? 0;

        // litPercentage = how lit the building windows are
        // For LC: active_days / 365 (capped at 1.0), same mechanic as LeetCode City uses commit frequency
        // Min 15% so building always looks inhabited; max 92% so some windows always dark
        const litPercentage = Math.min(0.92, Math.max(0.15, active_days_last_year / 365));

        let contributions = Math.max(1, total_solved);
        let rank = lcUserStats?.profile?.ranking ?? 999999;
        let reputation = lcUserStats?.profile?.reputation ?? 0;
        let name = lcUserStats?.profile?.realName || lcUserStats?.username || leetcode_username;
        let avatar_url = lcUserStats?.profile?.userAvatar || "";

        let hash = 0;
        for (let i = 0; i < leetcode_username.length; i++) {
            hash = Math.imul(31, hash) + leetcode_username.charCodeAt(i) | 0;
        }
        const github_id = Math.abs(hash);

        // Store raw LC rank in `rank` column for display
        // Store `500000 - lcRank` in `public_repos` so building height calculation rewards better rank
        // (lower rank number = better = bigger building, since the height formula rewards higher public_repos)
        const rankBoost = Math.max(0, 500000 - rank);

        const { data: upsertData, error: upsertError } = await admin
            .from("developers")
            .upsert({
                github_login: leetcode_username.toLowerCase(),
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
                // LeetCode-specific stats for building visuals
                easy_solved: easy_solved,
                medium_solved: medium_solved,
                hard_solved: hard_solved,
                acceptance_rate: acceptance_rate,
                contest_rating: contest_rating,
                contest_rank: contest_rank,
                lc_streak: lc_streak,
                active_days_last_year: active_days_last_year,
                // Store litPercentage so city layout uses submission-frequency window brightness
                contributions_total: Math.round(litPercentage * 1000), // encode as int (0-1000)
            }, { onConflict: "github_login" })
            .select("id")
            .single();

        if (upsertError) {
            return NextResponse.json({ error: "Failed to link user record." }, { status: 500 });
        }
        let devId = upsertData?.id;

        // Insert feed event
        if (devId) {
            await admin.from("activity_feed").insert({
                event_type: "building_claimed",
                actor_id: devId,
                metadata: { login: leetcode_username.toLowerCase() },
            });
        }

        return NextResponse.json({ success: true, leetcode_username: leetcode_username.toLowerCase() });

    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
