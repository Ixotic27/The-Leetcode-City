import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function addItems() {
    const items = [
        {
            id: "ac_badge",
            category: "structure",
            name: "Accepted Badge",
            description: "Floating neon AC sign that glows with the green of success.",
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
            description: "Intense glitchy fire for those who push their limits beyond time.",
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
            description: "A perfectly balanced 3D binary tree for your rooftop garden.",
            price_usd_cents: 100,
            price_brl_cents: 490,
            zone: "roof",
            is_active: true,
            metadata: {},
        },
    ];

    for (const item of items) {
        console.log(`Inserting/Updating item: ${item.id}...`);
        const { error } = await supabase.from("items").upsert(item, { onConflict: "id" });
        if (error) {
            console.error(`Error inserting ${item.id}:`, error.message);
        } else {
            console.log(`Successfully added ${item.id}`);
        }
    }
}

addItems().catch(console.error);
