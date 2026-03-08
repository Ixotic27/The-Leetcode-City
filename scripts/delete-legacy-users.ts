import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function cleanLegacyUsers() {
    console.log("Cleaning up all legacy GitHub users...");

    // We want to delete all developers who have NOT claimed their profile
    // AND who have 0 easy/medium/hard solved (meaning they aren't active LeetCode users from the mass-seed)
    // Actually, wait, let's just delete all unclaimed users that have 0 easy_solved and 0 medium_solved
    const { data, error, count } = await sb
        .from("developers")
        .delete({ count: "exact" })
        .eq("claimed", false)
        .eq("easy_solved", 0)
        .eq("medium_solved", 0)
        .eq("hard_solved", 0);

    if (error) {
        console.error("Error deleting legacy users:", error.message);
    } else {
        console.log(`Successfully deleted ${count} legacy unclaimed users with 0 solved problems.`);
    }

    // Also let's check how many total are left
    const remaining = await sb.from("developers").select("id", { count: "exact", head: true });
    console.log(`Remaining developers in DB: ${remaining.count}`);
}

cleanLegacyUsers();
