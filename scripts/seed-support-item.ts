import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const sb = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });

async function main() {
    console.log("Seeding support_renewal item into items table...");
    
    const { data: existing, error: fetchError } = await sb
        .from("items")
        .select("id")
        .eq("id", "support_renewal")
        .maybeSingle();

    if (fetchError) {
        console.error("Error checking existing item:", fetchError);
        return;
    }

    if (existing) {
        console.log("Item 'support_renewal' already exists. Updating metadata...");
        const { error: updateError } = await sb
            .from("items")
            .update({
                name: "Website Renewal Support",
                description: "Keeping the LeetCode City domain and servers active.",
                metadata: {
                    raised_inr: 0,
                    target_inr: 2900,
                }
            })
            .eq("id", "support_renewal");

        if (updateError) {
            console.error("Error updating item:", updateError);
        } else {
            console.log("Successfully updated support_renewal item.");
        }
    } else {
        console.log("Creating 'support_renewal' item...");
        const { error: insertError } = await sb
            .from("items")
            .insert({
                id: "support_renewal",
                category: "support",
                name: "Website Renewal Support",
                description: "Keeping the LeetCode City domain and servers active.",
                price_usd_cents: 0,
                price_brl_cents: 0,
                metadata: {
                    raised_inr: 0,
                    target_inr: 2900,
                },
                is_active: true
            });

        if (insertError) {
            console.error("Error inserting item:", insertError);
        } else {
            console.log("Successfully created support_renewal item.");
        }
    }
}

main().catch(console.error);
