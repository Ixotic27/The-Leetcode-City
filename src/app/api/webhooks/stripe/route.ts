import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SKY_AD_PLANS, isValidPlanId } from "@/lib/skyAdPlans";
import { InfrastructureError } from "@/lib/errors";
import {
  claimPendingPurchaseAtomically,
  orchestratePurchaseFulfillment,
} from "@/lib/purchase-orchestrator";
import type Stripe from "stripe";

// Disable body parsing — Stripe needs raw body for signature verification
export const dynamic = "force-dynamic";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  const { data: processedEvent, error: processedEventError } = await sb
    .from("stripe_processed_events")
    .select("id")
    .eq("id", event.id)
    .maybeSingle();

  if (processedEventError) {
    console.error("Stripe idempotency lookup failed:", processedEventError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (processedEvent) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  async function finalizeStripeEvent() {
    const { error: finalError } = await sb
      .from("stripe_processed_events")
      .insert({ id: event.id });

    if (!finalError) {
      return;
    }

    if (finalError.code === "23505") {
      return;
    }

    throw finalError;
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // --- Sky Ad purchase ---
        if (session.metadata?.type === "sky_ad") {
          const skyAdId = session.metadata.sky_ad_id;
          if (!skyAdId) {
            console.error("Missing sky_ad_id in session metadata:", session.id);
            break;
          }

          // Find the sky_ad by stripe_session_id, fallback to ad ID
          let { data: ad } = await sb
            .from("sky_ads")
            .select("id, plan_id, active")
            .eq("stripe_session_id", session.id)
            .maybeSingle();

          if (!ad) {
            const { data: adById } = await sb
              .from("sky_ads")
              .select("id, plan_id, active")
              .eq("id", skyAdId)
              .maybeSingle();
            ad = adById;
          }

          if (!ad) {
            console.error("Sky ad not found for session:", session.id);
            break;
          }

          // Skip if already activated (duplicate webhook)
          if (ad.active) break;

          const planId = ad.plan_id;
          if (!planId || !isValidPlanId(planId)) {
            console.error("Invalid plan_id on sky_ad:", ad.id);
            break;
          }

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
              purchaser_email: session.customer_details?.email ?? null,
            })
            .eq("id", ad.id)
            .eq("active", false);

          // Auto-deactivate the "advertise" placeholder if same vehicle type
          if (plan.vehicle === "plane") {
            await sb
              .from("sky_ads")
              .update({ active: false })
              .eq("id", "advertise")
              .eq("active", true);
          }

          break;
        }

        // --- Shop item purchase ---
        const developerId = session.metadata?.developer_id;
        const itemId = session.metadata?.item_id;
        const idempotencyKey = session.metadata?.idempotency_key;
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;

        if (!developerId || !itemId) {
          console.error("Missing metadata in Stripe session:", session.id);
          break;
        }

        // Idempotency check: skip if already processed
        if (idempotencyKey) {
          const { data: existingPurchase } = await sb
            .from("purchases")
            .select("id")
            .eq("idempotency_key", idempotencyKey)
            .maybeSingle();
          if (existingPurchase) {
            console.log(
              `[Stripe webhook] Duplicate event for ${idempotencyKey}, skipping`,
            );
            break;
          }
        }

        const txId = paymentIntentId ?? session.id;
        const githubLogin = session.metadata?.github_login;
        const giftedTo = session.metadata?.gifted_to;

        const orchestrationResult = await orchestratePurchaseFulfillment({
          provider: "stripe",
          transactionId: txId,
          developerId: Number(developerId),
          itemId,
          githubLogin,
          giftedTo: giftedTo ? Number(giftedTo) : null,
          supabaseClient: sb,
          claimPendingPurchase: async ({
            transactionId,
            developerId: claimDeveloperId,
            itemId: claimItemId,
            supabaseClient: claimSb,
          }) =>
            claimPendingPurchaseAtomically({
              provider: "stripe",
              transactionId,
              developerId: claimDeveloperId,
              itemId: claimItemId,
              supabaseClient: claimSb,
            }),
        });

        if (orchestrationResult.kind === "sold_out") {
          console.error(
            `[Stripe webhook] Item ${itemId} oversold. Issuing Stripe refund for ${txId}.`,
          );
          let refundSuccess = false;
          if (paymentIntentId) {
            try {
              await stripe.refunds.create({
                payment_intent: paymentIntentId,
                reason: "requested_by_customer",
              });
              refundSuccess = true;
            } catch (refundError) {
              console.error("[Stripe webhook] Refund failed:", refundError);
            }
          }

          if (orchestrationResult.purchaseId) {
            await sb
              .from("purchases")
              .update({
                status: refundSuccess ? "refunded" : "failed",
                provider_tx_id: txId,
              })
              .eq("id", orchestrationResult.purchaseId)
              .eq("status", "pending");
          }
          break;
        }

        if (orchestrationResult.kind === "completed") {
          break;
        }

        if (orchestrationResult.kind === "duplicate") {
          break;
        }

        // Check if this txId already has a completed/delivered/processing purchase
        const { data: alreadyProcessed, error: alreadyProcessedError } =
          await sb
            .from("purchases")
            .select("id, status")
            .eq("provider_tx_id", txId)
            .in("status", ["completed", "delivered", "processing"])
            .maybeSingle();

        if (alreadyProcessedError) {
          throw new InfrastructureError(
            `[Stripe webhook] failed to validate processed tx ${txId}: ${alreadyProcessedError.message}`,
            alreadyProcessedError,
          );
        }

        if (alreadyProcessed) {
          console.log(
            `[Stripe webhook] Purchase ${alreadyProcessed.id} already fulfilled — skipping duplicate webhook`,
          );
          break;
        }

        console.error(
          `[Stripe webhook] Pending purchase not found for session ${session.id}. Cannot safely fulfill item ${itemId}. Issuing refund.`,
        );
        if (paymentIntentId) {
          try {
            await stripe.refunds.create({
              payment_intent: paymentIntentId,
              reason: "requested_by_customer",
            });
          } catch (refundError) {
            console.error(
              "[Stripe webhook] Refund failed for missing purchase:",
              refundError,
            );
          }
        }
        break;
      }

      case "checkout.session.expired": {
        const expiredSession = event.data.object as Stripe.Checkout.Session;
        if (expiredSession.metadata?.type === "sky_ad") {
          // Clean up orphaned inactive ad row from abandoned checkout
          await sb
            .from("sky_ads")
            .delete()
            .eq("stripe_session_id", expiredSession.id)
            .eq("active", false);
        }
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId =
          typeof charge.payment_intent === "string"
            ? charge.payment_intent
            : charge.payment_intent?.id;

        if (paymentIntentId) {
          // Refund shop purchases (both completed and delivered consumables)
          await sb
            .from("purchases")
            .update({ status: "refunded" })
            .eq("provider_tx_id", paymentIntentId)
            .in("status", ["completed", "delivered"]);

          // Refund sky ads: find checkout session for this payment intent
          const stripe = getStripe();
          const sessions = await stripe.checkout.sessions.list({
            payment_intent: paymentIntentId,
            limit: 1,
          });
          const refundedSession = sessions.data[0];
          if (refundedSession?.metadata?.type === "sky_ad") {
            await sb
              .from("sky_ads")
              .update({ active: false })
              .eq("stripe_session_id", refundedSession.id);
          }
        }
        break;
      }
    }
  } catch (err) {
    if (err instanceof InfrastructureError) {
      // Transient failure — let Stripe retry by returning 500
      console.error(
        "[Stripe webhook] Infrastructure error, returning 500 for retry:",
        err.message,
        err.cause,
      );
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }
    // BusinessLogicError or unknown — return 200 to prevent futile retries
    console.error("[Stripe webhook] Business logic or unexpected error:", err);
    try {
      await finalizeStripeEvent();
    } catch (finalizationError) {
      console.error(
        "Stripe idempotency finalization failed after business error:",
        finalizationError,
      );
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ received: true });
  }

  try {
    await finalizeStripeEvent();
  } catch (finalizationError) {
    console.error("Stripe idempotency finalization failed:", finalizationError);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
