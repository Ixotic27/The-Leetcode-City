import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";

interface PurchaseRequest {
  idempotency_key?: string;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ok } = await rateLimit(`shop-purchase:${user.id}`, 1, 5_000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }
  if (!itemId) {
    return NextResponse.json({ error: "Missing itemId" }, { status: 400 });
  }

  const body = (await request.json().catch(() => ({}))) as PurchaseRequest;

  // Client-supplied idempotency key is critical for preventing duplicate charges
  // on network retries or double-clicks
  const clientKey = (body.idempotency_key || request.headers.get("Idempotency-Key") || "").trim();
  if (!clientKey || clientKey.length > 200 || !/^[A-Za-z0-9_-]+$/.test(clientKey)) {
    return NextResponse.json(
      { error: "Missing or invalid Idempotency-Key header or body field" },
      { status: 400 }
    );
  }

  const admin = getSupabaseAdmin();

  // 1. Fetch developer and item
  const { data: dev } = await admin
    .from("developers")
    .select("id, github_login, stripe_customer_id")
    .eq("claimed_by", user.id)
    .single();

  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  const { data: item } = await admin
    .from("items")
    .select("id, name, price_cents, currency, category")
    .eq("id", itemId)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  if (!item.price_cents) {
    return NextResponse.json(
      { error: "This item cannot be purchased" },
      { status: 400 }
    );
  }

  const isConsumable = item.category === "consumable";

  // 2. Check if already owned (unless consumable)
  if (!isConsumable) {
    const { data: existing } = await admin
      .from("purchases")
      .select("id")
      .eq("developer_id", dev.id)
      .eq("item_id", itemId)
      .eq("status", "completed")
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "Already owned" }, { status: 409 });
    }
  }

  // Create a stable idempotency key that's unique per (developer, item, client-key) tuple
  // The combination ensures different purchases have different keys while retries reuse the same key
  const stableIdempotencyKey = `purchase_${dev.id}_${itemId}_${clientKey}`;

  // 3. Check if this exact purchase attempt (same idempotency key) already exists
  const { data: existingPurchase } = await admin
    .from("purchases")
    .select("id, status, stripe_payment_intent_id")
    .eq("developer_id", dev.id)
    .eq("item_id", itemId)
    .eq("idempotency_key", stableIdempotencyKey)
    .maybeSingle();

  // If we've already processed this exact request, return the cached result
  if (existingPurchase) {
    // If it's still pending, the Stripe call might still be in progress
    if (existingPurchase.status === "pending") {
      return NextResponse.json(
        {
          error: "Purchase already in progress",
          purchase_id: existingPurchase.id,
          status: "pending"
        },
        { status: 409 }
      );
    }
    // If completed or failed, return the cached result
    return NextResponse.json(
      { ok: true, purchase_id: existingPurchase.id, status: existingPurchase.status }
    );
  }

  // 4. Create Stripe payment intent with idempotency key
  // Stripe's idempotency key ensures that if the request is retried, the same
  // payment intent is returned instead of creating a duplicate
  let paymentIntent: Stripe.PaymentIntent;
  try {
    paymentIntent = await getStripe().paymentIntents.create(
      {
        amount: item.price_cents,
        currency: item.currency || "inr",
        customer: dev.stripe_customer_id || undefined,
        metadata: {
          developer_id: dev.id,
          item_id: itemId,
          github_login: dev.github_login,
        },
        description: `${dev.github_login} - ${item.name}`,
      },
      // Pass the same idempotency key to Stripe so it also prevents duplicate charges
      { idempotencyKey: stableIdempotencyKey }
    );
  } catch (stripeError) {
    console.error("[shop-purchase] Stripe error:", stripeError);
    return NextResponse.json(
      { error: "Payment processing failed" },
      { status: 500 }
    );
  }

  // 5. Record purchase in database with pending status
  const { data: purchase, error: insertError } = await admin
    .from("purchases")
    .insert({
      developer_id: dev.id,
      item_id: itemId,
      provider: "stripe",
      stripe_payment_intent_id: paymentIntent.id,
      idempotency_key: stableIdempotencyKey,
      amount_cents: item.price_cents,
      currency: item.currency || "inr",
      status: "pending",
    })
    .select("id, client_secret")
    .single();

  if (insertError) {
    // If unique constraint violation on (developer_id, item_id), it means
    // the user already owns this item and shouldn't buy it again
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Already owned" },
        { status: 409 }
      );
    }
    console.error("[shop-purchase] Database error:", insertError);
    return NextResponse.json(
      { error: "Failed to record purchase" },
      { status: 500 }
    );
  }

  // 6. Return payment intent details for frontend to complete the payment
  return NextResponse.json({
    ok: true,
    purchase_id: purchase.id,
    client_secret: paymentIntent.client_secret,
    status: "pending",
  });
}

// Webhook handler for Stripe payment completion events
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ itemId: string }> }
) {
  await params;
  const admin = getSupabaseAdmin();
  const body = await request.json().catch(() => ({}));

  const { purchase_id, status } = body;
  if (!purchase_id || !status) {
    return NextResponse.json(
      { error: "Missing purchase_id or status" },
      { status: 400 }
    );
  }

  // Update purchase status based on Stripe webhook
  const { error: updateError } = await admin
    .from("purchases")
    .update({ status })
    .eq("id", purchase_id);

  if (updateError) {
    console.error("[shop-purchase] Status update error:", updateError);
    return NextResponse.json(
      { error: "Failed to update purchase status" },
      { status: 500 }
    );
  }

  // If completed, fulfill the item
  if (status === "completed") {
    const { data: purchase } = await admin
      .from("purchases")
      .select("developer_id, item_id")
      .eq("id", purchase_id)
      .single();

    if (purchase) {
      // Grant the item to the developer's inventory
      await admin
        .from("developer_items")
        .insert({
          developer_id: purchase.developer_id,
          item_id: purchase.item_id,
        })
        .select("id")
        .maybeSingle();

      // Log activity
      const { data: dev } = await admin
        .from("developers")
        .select("github_login")
        .eq("id", purchase.developer_id)
        .single();

      await admin.from("activity_feed").insert({
        event_type: "item_purchased",
        actor_id: purchase.developer_id,
        metadata: {
          login: dev?.github_login,
          item_id: purchase.item_id,
          provider: "stripe",
        },
      });
    }
  }

  return NextResponse.json({ ok: true, status });
}
