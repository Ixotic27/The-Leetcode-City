/**
 * LeetCode City — Redeem Code Generator (Admin Tool)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-codes.ts --item crown --count 5
 *   npx tsx --env-file=.env.local scripts/generate-codes.ts --item crown --count 10 --uses 3 --note "Twitter giveaway"
 *   npx tsx --env-file=.env.local scripts/generate-codes.ts --item crown --count 1 --uses -1  (unlimited use)
 *
 * Options:
 *   --item   <item_id>   Required. The item ID to link (e.g. crown, flag, spire)
 *   --count  <n>         Number of codes to generate (default: 1)
 *   --uses   <n>         Max uses per code. 1 = single-use, -1 = unlimited (default: 1)
 *   --note   <text>      Optional label (e.g. "Discord event April 2025")
 *   --expires <date>     Optional expiry date (e.g. "2025-12-31")
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

// Parse CLI args
function getArg(name: string): string | null {
    const idx = process.argv.indexOf(`--${name}`);
    return idx !== -1 ? process.argv[idx + 1] ?? null : null;
}

const itemId = getArg("item");
const count = parseInt(getArg("count", 10) ?? "1", 10);
const maxUses = parseInt(getArg("uses", 10) ?? "1", 10);
const note = getArg("note") ?? null;
const expiresInput = getArg("expires");
const expiresAt = expiresInput ? new Date(expiresInput).toISOString() : null;

if (!itemId) {
    console.error("❌ --item is required. Example: --item crown");
    process.exit(1);
}

// Generate a readable code: CITY-{ITEM_PREFIX}-{8 random chars}
function generateCode(prefix: string): string {
    const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `CITY-${prefix.toUpperCase().slice(0, 5)}-${rand}`;
}

async function main() {
    // Validate item exists
    const { data: item } = await sb.from("items").select("id, name").eq("id", itemId!).single();
    if (!item) {
        console.error(`\n❌ Item "${itemId}" not found in the database.`);
        
        // Fetch and show valid items to help the user
        const { data: validItems } = await sb.from("items").select("id, name").eq("is_active", true).order("id");
        if (validItems && validItems.length > 0) {
            console.log("\n   Available item IDs:");
            validItems.forEach(i => console.log(`   - ${i.id.padEnd(20)} (${i.name})`));
        }
        process.exit(1);
    }

    console.log(`\n🎟  Generating ${count} code(s) for item: ${item.name} (${item.id})`);
    console.log(`   Max uses per code: ${maxUses === -1 ? "unlimited" : maxUses}`);
    if (note) console.log(`   Note: ${note}`);
    if (expiresAt) console.log(`   Expires: ${expiresAt}`);
    console.log();

    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
        let code = generateCode(itemId!);
        // Retry if collision (extremely unlikely)
        for (let tries = 0; tries < 5; tries++) {
            const { error } = await sb.from("redeem_codes").insert({
                code,
                item_id: itemId!,
                max_uses: maxUses,
                used_count: 0,
                expires_at: expiresAt,
                note,
            });
            if (!error) {
                codes.push(code);
                break;
            } else if (error.code === "23505") {
                // Unique violation — regenerate
                code = generateCode(itemId!);
            } else {
                console.error(`❌ DB error for code ${code}:`, error.message);
                break;
            }
        }
    }

    console.log("═".repeat(50));
    console.log(`✅ Generated ${codes.length} code(s):\n`);
    codes.forEach((c) => console.log(`   ${c}`));
    console.log("\n" + "═".repeat(50));
    console.log("Share these codes with users. They can redeem them in the shop.");
    console.log("Single-use codes are automatically deleted after redemption.\n");
}

main().catch(console.error);
