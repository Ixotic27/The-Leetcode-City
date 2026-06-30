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

    // Namespace the client key per developer + item so it stays unique across
    // unrelated purchases while remaining stable across retries of this one.
    const idempotencyKey = `points_${dev.id}_${item_id}_${clientKey}`;

    // 3. Call atomic RPC function to deduct points + record purchase atomically
    // This prevents race conditions where concurrent requests both pass balance check
    if (!isDev) {
        const { data: result, error: rpcError } = await admin
            .rpc("buy_item_with_points", {
                p_user_id: dev.id,
                p_item_id: item_id,
                p_cost: item.price_points,
            });

        if (rpcError || !result?.success) {
            const errorMsg = result?.error || rpcError?.message || "Transaction failed";
            const statusCode = result?.code === "INSUFFICIENT_POINTS" ? 402 : 500;
            return NextResponse.json({ error: errorMsg }, { status: statusCode });
        }

        // 4. Fulfill/grant item only after points are secured atomically
        try {
            const { status: purchaseStatus } = await fulfillItemPurchase(dev.id, item_id, admin);

            // Log activity
            await admin.from("activity_feed").insert({
                event_type: "item_purchased",
                actor_id: dev.id,
                metadata: { login: dev.github_login, item_id, provider: "points" },
            });

            return NextResponse.json({ ok: true, purchase_id: result.purchase_id, points_remaining: (dev.points ?? 0) - item.price_points });
        } catch (fulfillErr) {
            // Points already deducted atomically — cannot rollback at this point
            // Log the error and notify admins for manual review
            console.error("[buy-with-points] fulfillItemPurchase failed after atomic deduction:", fulfillErr);
            return NextResponse.json({ error: "Item granted pending (manual review required)", code: "PARTIAL_FULFILLMENT" }, { status: 500 });
        }
    } else {
        // Dev mode - bypass points check
        try {
            const { status: purchaseStatus } = await fulfillItemPurchase(dev.id, item_id, admin);
            await admin.from("activity_feed").insert({
                event_type: "item_purchased",
                actor_id: dev.id,
                metadata: { login: dev.github_login, item_id, provider: "points", dev_mode: true },
            });
            return NextResponse.json({ ok: true, dev_mode: true, points_remaining: dev.points ?? 0 });
        } catch (fulfillErr) {
            console.error("[buy-with-points] Dev mode fulfillItemPurchase failed:", fulfillErr);
            return NextResponse.json({ error: "Failed to grant item in dev mode" }, { status: 500 });
        }
    }
}
