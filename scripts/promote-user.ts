import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigrations() {
    console.log("Adding is_dev and is_first_citizen columns...");

    // Supabase JS doesn't support direct SQL migrations, so we execute it via RPC or just assume they exist if it's managed.
    // But wait, I can try to use a dummy query to see if they exist or use a "service role" power to alter table if allowed.
    // Alternatively, just try to select from them.

    // Since I can't run raw SQL easily via the client without a custom RPC, I'll recommend the user to run it if it fails,
    // OR I can use the `psql` command if available.

    // Let's check if psql is available or if I can use a generic script.
    // THE MOST RELIABLE WAY on local env is often to just try an update that adds the column if missing or use a script that uses `fetch` to the dashboard if it was public, but it's not.

    // Actually, I'll just try to update the user account. If it fails, I'll know I need to add the columns.
}

async function promoteUser(login: string) {
    console.log(`Promoting ${login} to Dev and First Citizen...`);
    const { data, error } = await supabase
        .from("developers")
        .update({
            is_dev: true,
            is_first_citizen: true
        })
        .eq("github_login", login.toLowerCase())
        .select();

    if (error) {
        if (error.message.includes("column \"is_dev\" of relation \"developers\" does not exist")) {
            console.log("Columns missing. Need to add them.");
            // In a real environment, you'd runmigrations. Here I'll try to use a "query" if I had one.
            // I'll suggest the user to run the migration or I'll try to find another way.
        } else {
            console.error("Error:", error.message);
        }
    } else {
        console.log("Success:", data);
    }
}

// promoteUser("ishant-king").catch(console.error);
