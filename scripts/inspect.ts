import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function inspectFull() {
    const { data, error } = await sb
        .from("developers")
        .select("*")
        .eq("github_login", "kentcdodds")
        .single();

    if (error) {
        console.error("Error fetching kentcdodds:", error);
    } else {
        console.log(JSON.stringify(data, null, 2));
    }
}

inspectFull();
