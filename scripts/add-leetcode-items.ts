import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error(
        "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Item Validation Schema
 */
const ItemSchema = z.object({
    id: z.string().min(1, "ID is required"),
    category: z.string().min(1, "Category is required"),
    name: z.string().min(1, "Name is required"),
    description: z.string().min(1, "Description is required"),
    price_usd_cents: z.number().positive("USD price must be greater than 0"),
    price_brl_cents: z.number().positive("BRL price must be greater than 0"),
    zone: z.string().min(1, "Zone is required"),
    is_active: z.boolean(),
    metadata: z.record(z.any()).default({}),
});

async function addItems() {
    const items = [
        {
            id: "ac_badge",
            category: "structure",
            name: "Accepted Badge",
            description:
                "Floating neon AC sign that glows with the green of success.",
            price_usd_cents: 250,
            price_brl_cents: 1290,
            zone: "crown",
            is_active: true,
            metadata: {},
        },
        {
            id: "tle_fire",
            category: "structure",
            name: "TLE Fire",
            description:
                "Intense glitchy fire for those who push their limits beyond time.",
            price_usd_cents: 150,
            price_brl_cents: 790,
            zone: "roof",
            is_active: true,
            metadata: {},
        },
        {
            id: "binary_tree",
            category: "structure",
            name: "Binary Tree",
            description:
                "A perfectly balanced 3D binary tree for your rooftop garden.",
            price_usd_cents: 100,
            price_brl_cents: 490,
            zone: "roof",
            is_active: true,
            metadata: {},
        },

        // Example invalid item for testing
        {
            id: "",
            category: "",
            name: "",
            description: "Invalid item",
            price_usd_cents: -1,
            price_brl_cents: -1,
            zone: "",
            is_active: true,
            metadata: {},
        },
    ];

    let inserted = 0;
    let skipped = 0;

    for (const item of items) {
        const validation = ItemSchema.safeParse(item);

        if (!validation.success) {
            console.error(`\nValidation failed for item: ${item.id || "UNKNOWN"}`);

            validation.error.issues.forEach((err) => {
                console.error(`- ${err.path.join(".")}: ${err.message}`);
            });

            skipped++;
            continue;
        }

        console.log(`\nUpserting item: ${item.id}`);

        const { error } = await supabase
            .from("items")
            .upsert(validation.data, {
                onConflict: "id",
            });

        if (error) {
            console.error(`Database error for ${item.id}: ${error.message}`);
            skipped++;
        } else {
            console.log(`Successfully added/updated ${item.id}`);
            inserted++;
        }
    }

    console.log("\n========== SUMMARY ==========");
    console.log(`Inserted/Updated: ${inserted}`);
    console.log(`Skipped: ${skipped}`);
    console.log("=============================");
}

addItems().catch((err) => {
    console.error("Unexpected error:", err);
});