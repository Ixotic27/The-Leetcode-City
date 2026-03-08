import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Check if a LeetCode user has solved a problem in the last N minutes
async function getRecentSubmissions(username: string, withinMinutes = 30) {
    try {
        const query = `
            query recentAcSubmissions($username: String!, $limit: Int!) {
                recentAcSubmissionList(username: $username, limit: $limit) {
                    id
                    title
                    lang
                    timestamp
                }
            }
        `;
        const res = await fetch("https://leetcode.com/graphql", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Referer": "https://leetcode.com",
                "User-Agent": "Mozilla/5.0",
            },
            body: JSON.stringify({ query, variables: { username, limit: 5 } }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        const submissions = json?.data?.recentAcSubmissionList ?? [];

        const cutoff = Date.now() / 1000 - withinMinutes * 60;
        return submissions.filter((s: any) => Number(s.timestamp) > cutoff);
    } catch {
        return null;
    }
}

// POST: called by the client to report "I'm on LeetCode right now"
export async function POST() {
    try {
        const supabase = await createServerSupabase();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

        const admin = getSupabaseAdmin();

        // Find their linked LeetCode username
        const { data: dev } = await admin
            .from("developers")
            .select("id, github_login, contributions")
            .eq("claimed_by", user.id)
            .maybeSingle();

        if (!dev) return NextResponse.json({ error: "No linked GitHub account" }, { status: 404 });

        // Check for recent submissions
        const recentSolves = await getRecentSubmissions(dev.github_login, 30);
        const isActive = recentSolves !== null && recentSolves.length > 0;

        // Update the last_active_at field to indicate live presence
        await admin
            .from("developers")
            .update({
                fetched_at: new Date().toISOString(),
                // We reuse `fetch_priority` temporarily as an activity signal
                // fetch_priority > 1 means "actively coding on LeetCode right now"
                fetch_priority: isActive ? 2 : 1,
            })
            .eq("id", dev.id);

        // Fire an activity feed event if they just solved something
        if (isActive && recentSolves!.length > 0) {
            const latest = recentSolves![0];
            const solvedAt = new Date(Number(latest.timestamp) * 1000);
            const minsAgo = Math.floor((Date.now() - solvedAt.getTime()) / 60000);

            // Only fire if solved within last 5 minutes (very recent)
            if (minsAgo < 5) {
                try {
                    await admin.from("activity_feed").insert({
                        event_type: "push",
                        actor_id: dev.id,
                        metadata: {
                            login: dev.github_login,
                            message: `Solved "${latest.title}" on LeetCode  (${latest.lang})`,
                            repo: "leetcode",
                        },
                    });
                } catch { /* ignore duplicate feed entries */ }
            }
        }

        return NextResponse.json({
            active: isActive,
            username: dev.github_login,
            recent_solves: recentSolves?.length ?? 0,
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
