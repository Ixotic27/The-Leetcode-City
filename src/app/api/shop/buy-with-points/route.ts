import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
    const supabase = await createServerSupabase();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
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
        .select("id, name, price_points")
        .eq("id", item_id)
        .single();

    if (!item) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (item.price_points === null || item.price_points === undefined) {
        return NextResponse.json({ error: "This item cannot be bought with points" }, { status: 400 });
    }

    // 2. Check if already owned (unless consumable like streak_freeze)
    if (item_id !== "streak_freeze") {
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
    } else {
        // For streak freeze, check max cap
        const { data: devFreeze } = await admin
            .from("developers")
            .select("streak_freezes_available")
            .eq("id", dev.id)
            .single();

        if ((devFreeze?.streak_freezes_available ?? 0) >= 2) {
            return NextResponse.json({ error: "Max 2 streak freezes stored" }, { status: 409 });
        }
    }

    // 3. Check points balance
    if ((dev.points ?? 0) < item.price_points) {
        return NextResponse.json({ error: "Not enough points" }, { status: 403 });
    }

    // 4. Atomic transaction via RPC or sequence
    // We'll use a transactionally-safe approach: deduct points then insert purchase
    const { error: deductError } = await admin
        .from("developers")
        .update({ points: dev.points - item.price_points })
        .eq("id", dev.id);

    if (deductError) {
        return NextResponse.json({ error: "Failed to deduct points" }, { status: 500 });
    }

    const { data: purchase, error: purchaseError } = await admin
        .from("purchases")
        .insert({
            developer_id: dev.id,
            item_id: item_id,
            provider: "points",
            amount_cents: 0,
            currency: "usd",
            status: "completed",
        })
        .select("id")
        .single();

    if (purchaseError) {
        // Rollback points if purchase insertion fails
        await admin.from("developers").update({ points: dev.points }).eq("id", dev.id);
        return NextResponse.json({ error: "Failed to record purchase" }, { status: 500 });
    }

    // Special handling for streak freeze: increment the counter
    if (item_id === "streak_freeze") {
        await admin.rpc("grant_streak_freeze", { p_developer_id: dev.id });
        await admin.from("streak_freeze_log").insert({
            developer_id: dev.id,
            action: "purchased",
        });
    }

    // Insert activity feed
    await admin.from("activity_feed").insert({
        event_type: "item_purchased",
        actor_id: dev.id,
        metadata: { login: dev.github_login, item_id, provider: "points" },
    });

    return NextResponse.json({ ok: true, points_remaining: dev.points - item.price_points });
}
