import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
  console.log("Reading migration 046_enable_missing_rls.sql...");
  const sqlPath = path.join(__dirname, "../supabase/migrations/046_enable_missing_rls.sql");
  const query = fs.readFileSync(sqlPath, "utf8");

  console.log("Executing SQL migration via exec_sql RPC...");
  const { data, error } = await sb.rpc("exec_sql", { query });

  if (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } else {
    console.log("Migration executed successfully!");
    console.log("Response:", data);
  }
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
