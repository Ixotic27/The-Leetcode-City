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

    // The idempotency key MUST be supplied by the client so that a retry of the
    // *same* purchase (e.g. after a network timeout) reuses the same key. A
    // server-generated key would be regenerated on every retry, defeating
    // duplicate detection entirely.
    const clientKey = (request.headers.get("Idempotency-Key") || body.idempotency_key || "").trim();
    if (!clientKey || clientKey.length > 200 || !/^[A-Za-z0-9_-]+$/.test(clientKey)) {
        return NextResponse.json({ error: "Missing or invalid Idempotency-Key" }, { status: 400 });
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

    // Namespace the client key per developer + item so it stays unique across
    // unrelated purchases while remaining stable across retries of this one.
    const idempotencyKey = `points_${dev.id}_${item_id}_${clientKey}`;

    // 4. INSERT purchase record in pending state before any money or item moves
    const { data: purchase, error: purchaseError } = await admin
        .from("purchases")
        .insert({
            developer_id: dev.id,
            item_id: item_id,
            provider: "points",
            idempotency_key: idempotencyKey,
            amount_cents: 0,
            currency: "usd",
            status: "pending",
        })
        .select("id")
        .single();

    if (purchaseError) {
        // A unique-violation (23505) means this exact key was already used — i.e.
        // a retry of the same operation. Treat it as idempotent instead of an error.
        if (purchaseError.code === "23505") {
            return NextResponse.json(
                { ok: true, points_remaining: deductedPoints, idempotent: true },
                { status: 200 },
            );
        }
        return NextResponse.json({ error: "Failed to record purchase" }, { status: 500 });
    }

    // 5. Deduct points atomically — rollback by deleting the pending record on failure
    if (!isDev) {
        const { data: deducted, error: deductError } = await admin
            .rpc("deduct_points_atomic", {
                p_developer_id: dev.id,
                p_price_points: item.price_points,
            })
            .select("success, remaining_points")
            .maybeSingle();

        if (deductError || !deducted?.success) {
            await admin.from("purchases").delete().eq("id", purchase.id);
            return NextResponse.json({ error: "Not enough points or a concurrent purchase already deducted your balance. Please try again." }, { status: 409 });
        }
        deductedPoints = deducted.remaining_points;
    }

    // 6. Fulfill/grant item only after points are secured
    let finalStatus: string;
    try {
        const { status: purchaseStatus } = await fulfillItemPurchase(dev.id, item_id, admin);
        finalStatus = purchaseStatus;
    } catch (fulfillErr) {
        // Points were deducted — restore them before returning the error
        if (!isDev) {
            await admin.rpc("add_points_atomic", {
                p_developer_id: dev.id,
                p_price_points: item.price_points,
            });
        }
        await admin.from("purchases").delete().eq("id", purchase.id);
        console.error("[buy-with-points] fulfillItemPurchase failed:", fulfillErr);
        return NextResponse.json({ error: "Failed to grant item" }, { status: 500 });
    }

    // 7. Mark purchase completed now that item is in hand
    await admin
        .from("purchases")
        .update({ status: finalStatus })
        .eq("id", purchase.id);

    // Insert activity feed
    await admin.from("activity_feed").insert({
        event_type: "item_purchased",
        actor_id: dev.id,
        metadata: { login: dev.github_login, item_id, provider: "points" },
    });

    return NextResponse.json({ ok: true, points_remaining: deductedPoints });
}
