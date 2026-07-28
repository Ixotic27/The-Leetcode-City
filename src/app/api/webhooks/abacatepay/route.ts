import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SKY_AD_PLANS, isValidPlanId } from "@/lib/skyAdPlans";
import { verifyAbacatePayWebhook } from "@/lib/abacatepay";
import { InfrastructureError } from "@/lib/errors";
import { orchestratePurchaseFulfillment } from "@/lib/purchase-orchestrator";

export const dynamic = "force-dynamic";

function extractPixId(
  data: { id?: string; pixQrCode?: { id?: string } } | undefined,
): string | undefined {
  // billing.paid payload: data.pixQrCode.id
  // pixQrCode.paid payload: data.id or data.pixQrCode.id
  return data?.pixQrCode?.id ?? data?.id;
}

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  // Layer 1: Validate webhook token via header (not query string)
  if (!process.env.ABACATEPAY_WEBHOOK_SECRET) {
    console.error("ABACATEPAY_WEBHOOK_SECRET is not set");
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 },
    );
  }
  const receivedToken = request.headers.get("x-webhook-token");
  if (!verifyAbacatePayWebhook(receivedToken)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rawBody = await request.text();

  let body: {
    event?: string;
    data?: { id?: string; pixQrCode?: { id?: string } };
  };
  try {
    body = JSON.parse(rawBody);
  } catch (err) {
    console.warn("[app/api/webhooks/abacatepay/route.ts] error:", err);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const sb = getSupabaseAdmin();
  const pixId = extractPixId(body.data);

  try {
    switch (body.event) {
      case "billing.paid":
      case "pixQrCode.paid": {
        if (!pixId) break;

        // Idempotency check using pix_id as idempotency key
        const idempotencyKey = `abacatepay_${pixId}`;
        const { data: existingIdem } = await sb
          .from("purchases")
          .select("id")
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (existingIdem) {
          console.log(
            `[AbacatePay webhook] Duplicate event for ${pixId}, skipping`,
          );
          break;
        }

        // --- Sky Ad purchase ---
        const { data: ad } = await sb
          .from("sky_ads")
          .select("id, plan_id, active")
          .eq("pix_id", pixId)
          .maybeSingle();

        if (ad && !ad.active) {
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
          break;
        }

        // --- Shop item purchase ---
        const { data: purchase } = await sb
          .from("purchases")
          .select("id, status, developer_id, item_id, gifted_to")
          .eq("provider_tx_id", pixId)
          .eq("provider", "abacatepay")
          .maybeSingle();

        if (purchase && purchase.status === "pending") {
          const result = await orchestratePurchaseFulfillment({
            provider: "abacatepay",
            transactionId: pixId,
            purchaseId: purchase.id,
            developerId: purchase.developer_id,
            itemId: purchase.item_id,
            giftedTo: purchase.gifted_to,
            idempotencyKey,
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
              `[AbacatePay webhook] Purchase ${purchase.id} finished with result ${result.kind}`,
            );
          }
        }
        break;
      }

      case "pix.expired":
      case "pixQrCode.expired": {
        if (!pixId) break;

        // Expire shop purchases
        await sb
          .from("purchases")
          .update({ status: "expired" })
          .eq("provider_tx_id", pixId)
          .eq("status", "pending")
          .eq("provider", "abacatepay");

        // Clean up expired sky ad rows
        await sb
          .from("sky_ads")
          .delete()
          .eq("pix_id", pixId)
          .eq("active", false);
        break;
      }
    }
  } catch (err) {
    if (err instanceof InfrastructureError) {
      console.error(
        "[AbacatePay webhook] Infrastructure error, returning 500 for retry:",
        err.message,
        err.cause,
      );
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    console.error(
      "[AbacatePay webhook] Business logic or unexpected error:",
      err,
    );
  }

  return NextResponse.json({ received: true });
}
