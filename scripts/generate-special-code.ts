/**
 * LeetCode City — Generate Special Redeem Codes (Admin Tool)
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/generate-special-code.ts --type all_items
 *   npx tsx --env-file=.env.local scripts/generate-special-code.ts --type all_items --uses 1 --note "For myself"
 *
 * Options:
 *   --type  <type>    Required. Code type: "all_items"
 *   --uses  <n>       Max uses per code (default: 1, -1 = unlimited)
 *   --note  <text>    Optional label
 *   --count <n>       Number of codes to generate (default: 1)
 */

import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
);

const TYPE_LABELS: Record<string, string> = {
    all_items: "ALL",
};

function getArg(name: string): string | null {
    const idx = process.argv.indexOf(`--${name}`);
    return idx !== -1 ? process.argv[idx + 1] ?? null : null;
}

const type = getArg("type") ?? "all_items";
const maxUses = parseInt(getArg("uses", 10) ?? "1", 10);
const note = getArg("note") ?? null;
const count = parseInt(getArg("count") ?? "1", 10);

const label = TYPE_LABELS[type];
if (!label) {
    console.error(`❌ Unknown type "${type}". Valid types: ${Object.keys(TYPE_LABELS).join(", ")}`);
    process.exit(1);
}

function generateCode(): string {
    const rand = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `CITY-${label}-${rand}`;
}

async function main() {
    console.log(`\n🎟  Generating ${count} "${type}" code(s)`);
    console.log(`   Max uses per code: ${maxUses === -1 ? "unlimited" : maxUses}`);
    if (note) console.log(`   Note: ${note}`);

    const codes: string[] = [];

    for (let i = 0; i < count; i++) {
        let code = generateCode();
        for (let tries = 0; tries < 5; tries++) {
            const { error } = await sb.from("special_codes").insert({
                code,
                type,
                max_uses: maxUses,
                used_count: 0,
                note,
            });

            if (!error) {
                codes.push(code);
                break;
            } else if (error.code === "23505") {
                code = generateCode(); // retry on collision
            } else if (error.code === "42P01") {
                console.error(`\n❌ Table 'special_codes' does not exist. Run this SQL first:\n`);
                console.log(`-- scripts/create-special-codes-table.sql`);
                process.exit(1);
            } else {
                console.error(`❌ DB error for ${code}:`, error.message);
                break;
            }
        }
    }

    if (codes.length > 0) {
        console.log("\n" + "═".repeat(50));
        console.log(`✅ Generated ${codes.length} code(s):\n`);
        codes.forEach(c => console.log(`   ${c}`));
        console.log("\n" + "═".repeat(50) + "\n");
    }
}

main().catch(console.error);
