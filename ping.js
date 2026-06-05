const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

async function check() {
  console.log("Pinging Supabase...");
  const { data, error } = await sb.from("arena_problems").select("id").limit(1);
  if (error) {
    console.error("❌ Supabase is still down:", error.message);
  } else {
    console.log("✅ Supabase is back ONLINE and accepting connections!");
  }
}

check();
