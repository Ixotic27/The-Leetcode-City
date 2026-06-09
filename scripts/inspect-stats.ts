import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function inspectStats() {
    const { data, error } = await sb
        .from("city_stats")
        .select("*")
        .eq("id", 1)
        .single();

    if (error) {
        console.error("Error fetching city_stats:", error);
    } else {
        console.log("city_stats columns and data:", JSON.stringify(data, null, 2));
    }
}

inspectStats();
