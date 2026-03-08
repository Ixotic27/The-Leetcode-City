import { createClient } from "@supabase/supabase-js";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function check() {
    const r = await sb.from("developers")
        .select("id, github_login, rank")
        .not("easy_solved", "is", null)
        .order("rank", { ascending: true })
        .limit(5);
    console.log(JSON.stringify(r.data, null, 2));
}

check();
