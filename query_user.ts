import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

const envContent = fs.readFileSync(path.join(process.cwd(), ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const parts = line.split("=");
  if (parts.length >= 2) {
    env[parts[0].trim()] = parts.slice(1).join("=").trim();
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Supabase URL and Service Role Key must be configured in environment or .env.local");
}

const sb = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: user, error } = await sb.auth.admin.getUserById("a0acaa69-fda1-4097-a2cb-6defeb7a4ab1");
  if (error) console.error("Error:", error);
  else console.log("User:", user);
}

main();
