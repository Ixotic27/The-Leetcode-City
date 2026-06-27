import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { fulfillItemPurchase } from "@/lib/items";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
    const supabase = await createServerSupabase();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { ok } = await rateLimit(`buy-points:${user.id}`, 1, 5_000);
    if (!ok) {
        return NextResponse.json({ error: "Too fast" }, { status: 429 });
    }

    const body = await request.json().catch(() => ({}));
    const { item_id, dev_mode } = body;
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

    const isConsumable = item.category === "consumable";

    // 2. Check if already owned (unless consumable)
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

    const isDev = ["ishant_27", "ixotic", "ixotic27"].includes(dev.github_login.toLowerCase()) && dev_mode === true;

    let deductedPoints = dev.points ?? 0;

    // 3. Check points balance (early check, race condition handled by atomic RPC later)
    if (!isDev && (dev.points ?? 0) < item.price_points) {
        return NextResponse.json({ error: "Not enough points" }, { status: 403 });
    }

    // 4. Fulfill/grant consumable items to developers (updates tables and determines correct status string)
    const { status: purchaseStatus } = await fulfillItemPurchase(dev.id, item_id, admin);

    const idempotencyKey = `points_${dev.id}_${item_id}_${Date.now()}`;

    // 5. INSERT purchase record FIRST (before deduction)
    const { data: purchase, error: purchaseError } = await admin
        .from("purchases")
        .insert({
            developer_id: dev.id,
            item_id: item_id,
            provider: "points",
            idempotency_key: idempotencyKey,
            amount_cents: 0,
            currency: "usd",
            status: purchaseStatus,
        })
        .select("id")
        .single();

    if (purchaseError) {
        return NextResponse.json({ error: "Failed to record purchase" }, { status: 500 });
    }

    // 6. Deduct points AFTER successful INSERT — no rollback needed
    if (!isDev) {
        const { data: deducted, error: deductError } = await admin
            .rpc("deduct_points_atomic", {
                p_developer_id: dev.id,
                p_price_points: item.price_points,
            })
            .select("success, remaining_points")
            .maybeSingle();

        if (deductError || !deducted?.success) {
            // Deduction failed — clean up the purchase record
            await admin.from("purchases").delete().eq("id", purchase.id);
            return NextResponse.json({ error: "Not enough points or a concurrent purchase already deducted your balance. Please try again." }, { status: 409 });
        }
        deductedPoints = deducted.remaining_points;
    }

    // Insert activity feed
    await admin.from("activity_feed").insert({
        event_type: "item_purchased",
        actor_id: dev.id,
        metadata: { login: dev.github_login, item_id, provider: "points" },
    });

    return NextResponse.json({ ok: true, points_remaining: deductedPoints });
}
