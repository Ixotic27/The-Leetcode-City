import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function fixStats() {
    // Get max contributions (solved)
    const { data: devs } = await sb
        .from("developers")
        .select("contributions, total_stars")
        .not("easy_solved", "is", null);

    if (!devs || devs.length === 0) return;

    let maxC = 0;
    let maxS = 0;
    for (const d of devs) {
        if (d.contributions > maxC) maxC = d.contributions;
        if (d.total_stars > maxS) maxS = d.total_stars;
    }

    console.log("New max solved:", maxC, "New max reputation:", maxS);

    await sb.from("city_stats").update({
        total_developers: devs.length,
        total_contributions: devs.map(d => d.contributions).reduce((a, b) => a + b, 0),
        max_contributions: maxC,
        max_stars: maxS
    }).eq("id", 1);

    console.log("Updated city_stats");
}

fixStats();
