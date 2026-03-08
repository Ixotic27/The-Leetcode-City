import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function cleanLegacyUsers() {
    const { data: legacyUsers } = await sb
        .from("developers")
        .select("id")
        .eq("claimed", false)
        .eq("easy_solved", 0)
        .eq("medium_solved", 0)
        .eq("hard_solved", 0)
        .limit(10);

    if (!legacyUsers || legacyUsers.length === 0) return;
    const chunk = legacyUsers.map((u: any) => u.id);

    await sb.from("purchases").delete().in("developer_id", chunk);
    await sb.from("purchases").delete().in("gifted_to", chunk);
    await sb.from("developer_customizations").delete().in("developer_id", chunk);
    await sb.from("developer_achievements").delete().in("developer_id", chunk);
    await sb.from("raid_tags").delete().in("building_id", chunk);
    await sb.from("building_visits").delete().in("visitee_id", chunk);
    await sb.from("building_visits").delete().in("visitor_id", chunk);
    await sb.from("activity_feed").delete().in("developer_id", chunk);
    await sb.from("activity_feed").delete().in("target_dev_id", chunk);

    const { error: delErr } = await sb.from("developers").delete().in("id", chunk);
    if (delErr) {
        console.error(`FULL ERROR:`, JSON.stringify(delErr, null, 2));
    } else {
        console.log("Deleted successfully.");
    }
}

cleanLegacyUsers().catch(console.error);
