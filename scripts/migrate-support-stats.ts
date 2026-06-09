import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
    console.log("Altering city_stats table to add support renewal columns...");
    
    const { data, error } = await sb.rpc('exec_sql', {
        query: `
        ALTER TABLE public.city_stats 
        ADD COLUMN IF NOT EXISTS renewal_target_inr integer DEFAULT 2900,
        ADD COLUMN IF NOT EXISTS renewal_raised_inr integer DEFAULT 0;
        `
    });

    if (error) {
        console.error("Error running migration:", error);
    } else {
        console.log("Successfully added columns to city_stats table.");
        
        // Let's set some initial values if needed or just output current stats
        const { data: stats } = await sb.from("city_stats").select("*").eq("id", 1).single();
        console.log("Updated city_stats:", stats);
    }
}

main().catch(console.error);
