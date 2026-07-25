import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";

type FinalizePointsPurchaseResult = {
    ok: boolean;
    error_code: string | null;
    points_remaining: number | null;
};

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
    const { resolveAuthenticatedDeveloper } = await import("@/lib/authenticated-developer");
    const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

    if (!auth.ok || !auth.user) {
        return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = auth.user;

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

    const deductedPoints = dev.points ?? 0;

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

    // 5. Finalize the points purchase atomically:
    //    deduction, item fulfillment, purchase completion, and feed insertion
    //    must all succeed together.
    const { data, error: finalizeError } = await admin
        .rpc("finalize_points_purchase", {
            p_purchase_id: purchase.id,
            p_developer_id: dev.id,
            p_item_id: item_id,
            p_price_points: item.price_points,
            p_is_dev: isDev,
            p_github_login: dev.github_login,
        })
        .single();

    const finalizeResult = data as FinalizePointsPurchaseResult | null;

    if (finalizeError) {
        await admin.from("purchases").delete().eq("id", purchase.id);
        console.error("[buy-with-points] finalize_points_purchase failed:", finalizeError);
        return NextResponse.json({ error: "Failed to complete purchase" }, { status: 500 });
    }

    if (finalizeResult === null) {
        await admin.from("purchases").delete().eq("id", purchase.id);
        return NextResponse.json({ error: "Failed to complete purchase" }, { status: 500 });
    }

    if (!finalizeResult.ok) {
        await admin.from("purchases").delete().eq("id", purchase.id);
        if (finalizeResult.error_code === "not_enough_points") {
            return NextResponse.json({ error: "Not enough points or a concurrent purchase already deducted your balance. Please try again." }, { status: 409 });
        }
        if (finalizeResult.error_code === "grant_failed") {
            return NextResponse.json({ error: "Failed to grant item" }, { status: 500 });
        }
        return NextResponse.json({ error: "Failed to complete purchase" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, points_remaining: finalizeResult.points_remaining });
}
