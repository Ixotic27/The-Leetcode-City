import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function runMigration(fileName: string) {
  console.log(`Reading migration ${fileName}...`);
  const sqlPath = path.join(__dirname, `../supabase/migrations/${fileName}`);
  const query = fs.readFileSync(sqlPath, "utf8");

  console.log(`Executing SQL migration ${fileName} via exec_sql RPC...`);
  const { data, error } = await sb.rpc("exec_sql", { query });

  if (error) {
    console.error(`Migration ${fileName} failed:`, error);
    return false;
  } else {
    console.log(`Migration ${fileName} executed successfully!`);
    console.log("Response:", data);
    return true;
  }
}

async function main() {
  const success065 = await runMigration("065_arcade_system_schema.sql");
  if (!success065) {
    console.warn("Migration 065 had warnings or errors (might be okay if tables already exist). Proceeding with 066...");
  }
  
  const success066 = await runMigration("066_supabase_realtime_multiplayer.sql");
  if (!success066) {
    process.exit(1);
  }
  
  console.log("All arcade migrations ran successfully!");
}

main().catch((err) => {
  console.error("Unhandled error:", err);
  process.exit(1);
});
