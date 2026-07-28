import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyIpnSignature } from "@/lib/nowpayments";
import { SKY_AD_PLANS, isValidPlanId } from "@/lib/skyAdPlans";
import { InfrastructureError } from "@/lib/errors";
import { orchestratePurchaseFulfillment } from "@/lib/purchase-orchestrator";

export const dynamic = "force-dynamic";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  let body: Record<string, unknown> & {
    payment_status: string;
    order_id?: string;
    payment_id?: string | number;
    customer_email?: string;
  };

  try {
    body = JSON.parse(rawBody);
  } catch (err) {
    console.warn("[app/api/webhooks/nowpayments/route.ts] error:", err);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  // Verify HMAC-SHA512 signature
  const signature = request.headers.get("x-nowpayments-sig");
  if (!signature || !verifyIpnSignature(body, signature)) {
    console.error("NOWPayments webhook signature mismatch");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  const paymentStatus: string = body.payment_status;
  const orderId: string | undefined = body.order_id;
  const paymentId = body.payment_id ? String(body.payment_id) : undefined;

  if (!orderId) {
    return NextResponse.json({ received: true });
  }

  try {
    switch (paymentStatus) {
      case "finished":
      case "confirmed": {
        // Idempotency check using order_id as idempotency key
        const idempotencyKey = `nowpayments_${orderId}`;
        const { data: existingIdem } = await sb
          .from("purchases")
          .select("id")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existingIdem) {
          console.log(
            `[NOWPayments webhook] Duplicate event for ${orderId}, skipping`,
          );
          break;
        }

        // Check if it is a sky ad purchase
        const { data: ad } = await sb
          .from("sky_ads")
          .select("id, plan_id, active")
          .eq("stripe_session_id", orderId)
          .maybeSingle();

        if (ad) {
          if (!ad.active) {
            const planId = ad.plan_id;
            if (planId && isValidPlanId(planId)) {
              const plan = SKY_AD_PLANS[planId];
              const now = new Date();
              const endsAt = new Date(
                now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000,
              );

              await sb
                .from("sky_ads")
                .update({
                  active: true,
                  starts_at: now.toISOString(),
                  ends_at: endsAt.toISOString(),
                  purchaser_email: body.customer_email ?? null,
                })
                .eq("id", ad.id)
                .eq("active", false);

              if (plan.vehicle === "plane") {
                await sb
                  .from("sky_ads")
                  .update({ active: false })
                  .eq("id", "advertise")
                  .eq("active", true);
              }
            }
          }
          break;
        }

        // Find pending purchase by provider_tx_id (invoice ID stored at checkout)
        const { data: purchase } = await sb
          .from("purchases")
          .select("id, status, developer_id, item_id, gifted_to")
          .eq("provider", "nowpayments")
          .eq("status", "pending")
          .eq("provider_tx_id", orderId)
          .maybeSingle();

        if (!purchase) {
          // Could be a concurrent request already claimed it (status is now "processing")
          // or genuinely not found. Either way, do not fulfill.
          console.log(
            `[NOWPayments webhook] No pending purchase for order ${orderId} — skipping`,
          );
          break;
        }

        const result = await orchestratePurchaseFulfillment({
          provider: "nowpayments",
          transactionId: orderId,
          purchaseId: purchase.id,
          developerId: purchase.developer_id,
          itemId: purchase.item_id,
          giftedTo: purchase.gifted_to,
          idempotencyKey,
          updatePurchaseFields: {
            provider_tx_id: paymentId ?? orderId,
          },
          supabaseClient: sb,
          claimPendingPurchase: async ({
            supabaseClient: claimSb,
            purchaseId: pendingPurchaseId,
          }) => {
            const { data: claimed } = await claimSb
              .from("purchases")
              .update({ status: "processing" })
              .eq("id", pendingPurchaseId)
              .eq("status", "pending")
              .select("id")
              .maybeSingle();

            if (!claimed) {
              return {
                ok: false,
                purchase_id: pendingPurchaseId,
                already_claimed: true,
                reason: "already_claimed",
              };
            }

            return { ok: true, purchase_id: pendingPurchaseId };
          },
        });

        if (result.kind !== "completed") {
          console.log(
            `[NOWPayments webhook] Purchase ${purchase.id} finished with result ${result.kind}`,
          );
        }
        break;
      }

      case "expired":
      case "failed":
      case "refunded": {
        const newStatus = paymentStatus === "refunded" ? "refunded" : "expired";
        const txIds = [orderId, paymentId].filter(Boolean) as string[];
        await sb
          .from("purchases")
          .update({ status: newStatus })
          .in("provider_tx_id", txIds)
          .in("status", ["pending", "completed", "delivered", "processing"])
          .eq("provider", "nowpayments");
        break;
      }

      // "waiting", "confirming", "sending", "partially_paid" — no action needed
    }
  } catch (err) {
    if (err instanceof InfrastructureError) {
      console.error(
        "[NOWPayments webhook] Infrastructure error, returning 500 for retry:",
        err.message,
        err.cause,
      );
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    console.error(
      "[NOWPayments webhook] Business logic or unexpected error:",
      err,
    );
  }

  return NextResponse.json({ received: true });
}
