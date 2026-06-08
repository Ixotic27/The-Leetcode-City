import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(request: Request) {
    const supabase = await createServerSupabase();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { ok } = rateLimit(`buy-points:${user.id}`, 1, 5_000);
    if (!ok) {
        return NextResponse.json({ error: "Too fast" }, { status: 429 });
    }

    const { item_id } = await request.json();
    if (!item_id) {
        return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();

    // 1. Fetch developer and item
    const { data: dev } = await admin
        .from("developers")
        .select("id, github_login, points")
        .eq("claimed_by", user.id)
        .single();

    if (!dev) {
        return NextResponse.json({ error: "Developer not found" }, { status: 404 });
    }

    const { data: item } = await admin
        .from("items")
        .select("id, name, price_points, category")
        .eq("id", item_id)
        .single();

    if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.price_points === null || item.price_points === undefined) {
        return NextResponse.json({ error: "This item cannot be bought with points" }, { status: 400 });
    }

    // 2. Determine if consumable and set status
    // Non-consumables use 'completed' (for unique index constraints)
    // Consumables use 'delivered' (to allow multiple purchases)
    const isConsumable = item_id === "streak_freeze" || item.category === "battle_consumable";
    const purchaseStatus = isConsumable ? "delivered" : "completed";

    // 3. Check if already owned (only for non-consumables)
    if (!isConsumable) {
        const { data: existing } = await admin
            .from("purchases")
            .select("id")
            .eq("developer_id", dev.id)
            .eq("item_id", item_id)
            .eq("status", "completed")
            .maybeSingle();

        if (existing) {
            return NextResponse.json({ error: "Already owned" }, { status: 409 });
        }
    } else if (item_id === "streak_freeze") {
        const { data: devFreeze } = await admin
            .from("developers")
            .select("streak_freezes_available")
            .eq("id", dev.id)
            .single();

        if ((devFreeze?.streak_freezes_available ?? 0) >= 2) {
            return NextResponse.json({ error: "Max 2 streak freezes stored" }, { status: 409 });
        }
    }

    // 4. Check points balance
    if ((dev.points ?? 0) < item.price_points) {
        return NextResponse.json({ error: "Not enough points" }, { status: 403 });
    }

    // 5. Atomic call to the updated RPC
    const { data: pointsRemaining, error: rpcError } = await admin.rpc('process_purchase', {
        p_user_id: dev.id,
        p_item_id: item.id,
        p_price: item.price_points,
        p_status: purchaseStatus
    });

    if (rpcError || pointsRemaining === null) {
        return NextResponse.json({ 
            error: "Purchase failed. Either you don't have enough points or a concurrent purchase occurred." 
        }, { status: 409 });
    }

    // 6. Handle side effects for consumables
    if (isConsumable) {
        if (item_id === "streak_freeze") {
            await admin.rpc("grant_streak_freeze", { p_developer_id: dev.id });
        } else {
            await admin.from("user_inventory").insert({
                developer_id: dev.id,
                item_id: item.id,
                quantity: 1
            });
        }
    }

    // 7. Insert activity feed
    await admin.from("activity_feed").insert({
        event_type: "item_purchased",
        actor_id: dev.id,
        metadata: { login: dev.github_login, item_id, provider: "points" },
    });

    return NextResponse.json({ ok: true, points_remaining: pointsRemaining });
}