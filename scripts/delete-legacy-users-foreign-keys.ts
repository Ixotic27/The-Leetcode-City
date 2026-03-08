import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function fullClean() {
    console.log("Cleaning up xp_log...");

    // Find legacy developers
    const { data: legacyUsers } = await sb
        .from("developers")
        .select("id")
        .eq("claimed", false)
        .eq("easy_solved", 0)
        .eq("medium_solved", 0)
        .eq("hard_solved", 0);

    if (!legacyUsers || legacyUsers.length === 0) {
        console.log("No legacy users found.");
        return;
    }

    const ids = legacyUsers.map((u: any) => u.id);
    console.log(`Found ${ids.length} legacy users to delete.`);

    const CHUNK_SIZE = 500;
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
        const chunk = ids.slice(i, i + CHUNK_SIZE);

        // Clean up purely associated objects
        await sb.from("purchases").delete().in("developer_id", chunk);
        await sb.from("purchases").delete().in("gifted_to", chunk);
        await sb.from("developer_customizations").delete().in("developer_id", chunk);
        await sb.from("developer_achievements").delete().in("developer_id", chunk);
        await sb.from("raid_tags").delete().in("building_id", chunk);
        await sb.from("streak_checkins").delete().in("developer_id", chunk);
        await sb.from("district_changes").delete().in("developer_id", chunk);
        await sb.from("daily_mission_progress").delete().in("developer_id", chunk);
        await sb.from("xp_log").delete().in("developer_id", chunk);

        // Delete developers
        const { error: delErr } = await sb.from("developers").delete().in("id", chunk);
        if (!delErr) {
            console.log("Deleted chunk", i / CHUNK_SIZE + 1);
        } else {
            console.log("ERROR on chunk", delErr.message);
        }
    }
    console.log("Done.");
}

fullClean().catch(console.error);
