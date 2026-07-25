import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyCashfreeWebhook, getCashfreeOrderStatus } from "@/lib/cashfree";
import { SKY_AD_PLANS, isValidPlanId } from "@/lib/skyAdPlans";
import { InfrastructureError } from "@/lib/errors";
import { claimPendingPurchaseAtomically, orchestratePurchaseFulfillment } from "@/lib/purchase-orchestrator";


export const dynamic = "force-dynamic";

/**
 * Cashfree Webhook Handler
 *
 * Cashfree sends a POST with headers:
 *   x-webhook-signature – Base64(HMAC-SHA256(timestamp + rawBody, secretKey))
 *   x-webhook-timestamp – Unix timestamp string
 *
 * Event types we handle:
 *   PAYMENT_SUCCESS_WEBHOOK – payment completed
 *   PAYMENT_FAILED_WEBHOOK  – payment failed
 */
export async function POST(request: Request) {
  const signature = request.headers.get("x-webhook-signature") ?? "";
  const timestamp = request.headers.get("x-webhook-timestamp") ?? "";

  const rawBody = await request.text();

  // Verify webhook signature
  if (!signature || !timestamp || !verifyCashfreeWebhook(signature, rawBody, timestamp)) {
    console.error("[Cashfree webhook] Invalid signature");
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    type?: string;
    event?: string;
    data?: {
      order?: { order_id?: string };
      customer_details?: { customer_email?: string };
    };
  };
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  try {
    const eventType = body.type ?? body.event;
    const orderData = body.data?.order ?? {};
    const orderId: string | undefined = orderData.order_id;

    if (!orderId) {
      console.warn("[Cashfree webhook] No order_id found in payload");
      return NextResponse.json({ received: true });
    }

    switch (eventType) {
      case "PAYMENT_SUCCESS_WEBHOOK": {
        // Idempotency check using Cashfree order_id as idempotency key
        const idempotencyKey = `cashfree_${orderId}`;
        const { data: existingIdem } = await sb
          .from("purchases")
          .select("id")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existingIdem) {
          console.log(`[Cashfree webhook] Duplicate event for ${orderId}, skipping`);
          break;
        }

        // Double-check order status with Cashfree API
        const { orderStatus, orderAmount } = await getCashfreeOrderStatus(orderId);

        if (orderStatus !== "PAID") {
          console.warn(`[Cashfree webhook] Order ${orderId} status is ${orderStatus}, not PAID`);
          break;
        }

        // Check if it is a support renewal donation
        if (orderId.startsWith("support_")) {
          const supportAmountInr = Math.round(orderAmount);
          if (supportAmountInr > 0) {
            // Try to record this transaction in support_donations table
            const { data: inserted, error: insertError } = await sb
              .from("support_donations")
              .insert({ order_id: orderId, amount_inr: supportAmountInr })
              .select("id")
              .maybeSingle();
            
            if (insertError || !inserted) {
              console.log(`[Cashfree webhook] Support donation ${orderId} already processed — skipping`);
              break;
            }

            // Increment raised_inr inside items table for id='support_renewal'
            const { data: item } = await sb
              .from("items")
              .select("metadata")
              .eq("id", "support_renewal")
              .single();

            const currentMeta = (item?.metadata as Record<string, unknown>) || {};
            const currentRaised = Number(currentMeta.raised_inr || 0);
            const targetInr = Number(currentMeta.target_inr || 2900);

            await sb
              .from("items")
              .update({
                metadata: {
                  ...currentMeta,
                  raised_inr: currentRaised + supportAmountInr,
                  target_inr: targetInr,
                }
              })
              .eq("id", "support_renewal");

            console.log(`[Cashfree webhook] Support renewal updated: +${supportAmountInr} INR. New total: ${currentRaised + supportAmountInr} INR.`);
          }
          break;
        }

        // Check if it is a sky ad purchase (linked to orderId)
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
              const endsAt = new Date(now.getTime() + plan.duration_days * 24 * 60 * 60 * 1000);

              await sb
                .from("sky_ads")
                .update({
                  active: true,
                  starts_at: now.toISOString(),
                  ends_at: endsAt.toISOString(),
                  purchaser_email: body.data?.customer_details?.customer_email ?? null,
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

        // Find the pending purchase by provider_tx_id
        const { data: purchase } = await sb
          .from("purchases")
          .select("id, status, developer_id, item_id, gifted_to")
          .eq("provider_tx_id", orderId)
          .eq("provider", "cashfree")
          .maybeSingle();

        if (!purchase) {
          console.warn(`[Cashfree webhook] No purchase found for order ${orderId}`);
          break;
        }

        if (purchase.status !== "pending") {
          console.log(`[Cashfree webhook] Purchase ${purchase.id} already ${purchase.status} — skipping`);
          break;
        }

        // Atomic claim: transition pending → processing in one UPDATE with stock check.
        const { data: claimData, error: claimError } = await sb.rpc("claim_pending_purchase_atomic", {
          p_developer_id: purchase.developer_id,
          p_item_id: purchase.item_id,
          p_provider: "cashfree",
          p_tx_id: orderId,
          p_purchase_id: purchase.id
        });

        if (claimError) {
          throw new InfrastructureError(
            `[Cashfree webhook] Failed to claim pending purchase ${orderId}: ${claimError.message}`,
            claimError
          );
        }

        const claimResult = Array.isArray(claimData) ? claimData[0] : claimData;

        if (claimResult && claimResult.error_code === 'sold_out') {
          console.error(`[Cashfree webhook] Item ${purchase.item_id} oversold. Manual refund required for ${orderId}.`);
          if (claimResult.purchase_id) {
            await sb.from("purchases").update({
              status: "failed",
              provider_tx_id: orderId,
            }).eq("id", claimResult.purchase_id).eq("status", "pending");
          }
          break;
        }

        if (!claimResult || !claimResult.ok) {
          console.log(`[Cashfree webhook] Purchase ${purchase.id} already claimed by concurrent request — skipping`);
          break;
        }

        const orchestrationResult = await orchestratePurchaseFulfillment({
          provider: "cashfree",
          transactionId: orderId,
          purchaseId: purchase.id,
          developerId: purchase.developer_id,
          itemId: purchase.item_id,
          giftedTo: purchase.gifted_to,
          idempotencyKey,
          supabaseClient: sb,
          claimPendingPurchase: async ({ transactionId, developerId: claimDeveloperId, itemId: claimItemId, purchaseId: pendingPurchaseId, supabaseClient: claimSb }) =>
            claimPendingPurchaseAtomically({
              provider: "cashfree",
              transactionId,
              developerId: claimDeveloperId,
              itemId: claimItemId,
              purchaseId: pendingPurchaseId,
              supabaseClient: claimSb,
            }),
        });

        if (orchestrationResult.kind !== "completed") {
          if (orchestrationResult.kind === "sold_out") {
            await sb.from("purchases").update({ status: "failed", provider_tx_id: orderId }).eq("id", purchase.id).eq("status", "pending");
          }
          console.log(`[Cashfree webhook] Purchase ${purchase.id} finished with result ${orchestrationResult.kind}`);
        }
        break;
      }

      case "PAYMENT_FAILED_WEBHOOK": {
        // Mark purchase as expired
        const { data: failedPurchase } = await sb
          .from("purchases")
          .select("id")
          .eq("provider_tx_id", orderId)
          .eq("provider", "cashfree")
          .eq("status", "pending")
          .maybeSingle();

        if (failedPurchase) {
          await sb
            .from("purchases")
            .update({ status: "expired" })
            .eq("id", failedPurchase.id);
        }
        break;
      }
    }
  } catch (err) {
    if (err instanceof InfrastructureError) {
      console.error("[Cashfree webhook] Infrastructure error, returning 500 for retry:", err.message, err.cause);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
    console.error("[Cashfree webhook] Business logic or unexpected error:", err);
  }

  return NextResponse.json({ received: true });
}
