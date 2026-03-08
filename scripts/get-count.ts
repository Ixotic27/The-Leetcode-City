
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

async function getCount() {
    const { count, error } = await sb.from("developers").select("*", { count: "exact", head: true });
    if (error) {
        console.error(error);
        return;
    }
    console.log(`Total Developers: ${count}`);

    const { data: stats } = await sb.from("city_stats").select("*").eq("id", 1).single();
    console.log(`City Stats Total: ${stats?.total_developers}`);
}

getCount();
