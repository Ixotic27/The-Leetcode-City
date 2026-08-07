/**
 * LeetCode City — Generate XP Redeem Codes (Admin Tool)
 * 
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-xp-codes.ts --amount 500 --count 5
 *   npx tsx --env-file=.env.local scripts/generate-xp-codes.ts --amount 1000 --count 10 --uses 3 --note "Discord drop"
 *
 * Options:
 *   --amount  <n>         Required. XP amount per code.
 *   --count   <n>         Number of codes to generate.
 *   --uses    <n>         Max uses per code. 1 = single-use, -1 = unlimited.
 *   --expires <date>      Optional. Expiry date.
 *   --note    <text>      Optional. Label/internal note.
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

function getArg(name: string): string | null {
    const idx = process.argv.indexOf(`--${name}`);
    return idx !== -1 ? process.argv[idx + 1] ?? null : null;
}

const amountStr = getArg("amount");
const count = parseInt(getArg("count") ?? "1", 10);
const maxUses = parseInt(getArg("uses") ?? "1", 10);
const note = getArg("note") ?? null;
const expiresInput = getArg("expires");
const expiresAt = expiresInput ? new Date(expiresInput).toISOString() : null;

if (!amountStr || Number.isNaN(parseInt(amountStr, 10))) {
    console.error("❌ --amount is required. Example: --amount 500");
    process.exit(1);
}
const xpAmount = parseInt(amountStr, 10);

function generateCode(): string {
    const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `CITY-XP${xpAmount}-${rand}`;
}

async function main() {
    console.log(`\n🎟  Generating ${count} XP code(s) for ${xpAmount} XP each`);
    console.log(`   Max uses per code: ${maxUses === -1 ? "unlimited" : maxUses}`);
    if (note) console.log(`   Note: ${note}`);
    if (expiresAt) console.log(`   Expires: ${expiresAt}`);
    

    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
        let code = generateCode();
        for (let tries = 0; tries < 5; tries++) {
            const { error } = await sb.from("xp_redeem_codes").insert({
                code,
                xp_amount: xpAmount,
                max_uses: maxUses,
                used_count: 0,
                expires_at: expiresAt,
                note,
            });
            if (!error) {
                codes.push(code);
                break;
            } else if (error.code === "23505") { // unique violation
                code = generateCode();
            } else if (error.code === "42P01") { // table does not exist
                console.error(`\n❌ DB Error: Table 'xp_redeem_codes' does not exist.\nRun the following SQL in your Supabase SQL Editor first:\n`);
                console.log(`CREATE TABLE public.xp_redeem_codes (\n  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,\n  code text UNIQUE NOT NULL,\n  xp_amount integer NOT NULL DEFAULT 500,\n  max_uses integer NOT NULL DEFAULT 1,\n  used_count integer NOT NULL DEFAULT 0,\n  expires_at timestamp with time zone,\n  note text,\n  created_at timestamp with time zone DEFAULT now()\n);`);
                process.exit(1);
            } else {
                console.error(`❌ DB error for code ${code}:`, error.message);
                break;
            }
        }
    }

    if (codes.length > 0) {
        console.log("\n" + "═".repeat(50));
        console.log(`✅ Generated ${codes.length} XP code(s):\n`);
        codes.forEach((c) => console.log(`   ${c}`));
        console.log("\n" + "═".repeat(50));
    }
}

main().catch(console.error);
