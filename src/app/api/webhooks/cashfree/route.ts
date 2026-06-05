import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyCashfreeWebhook, getCashfreeOrderStatus } from "@/lib/cashfree";
import { autoEquipIfSolo } from "@/lib/items";
import { sendPurchaseNotification, sendGiftSentNotification } from "@/lib/notification-senders/purchase";
import { sendGiftReceivedNotification } from "@/lib/notification-senders/gift";

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: any;
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
        // Double-check order status with Cashfree API
        const { orderStatus } = await getCashfreeOrderStatus(orderId);

        if (orderStatus !== "PAID") {
          console.warn(`[Cashfree webhook] Order ${orderId} status is ${orderStatus}, not PAID`);
          break;
        }

        // Find the pending purchase by provider_tx_id
        const { data: purchase } = await sb
          .from("purchases")
          .select("id, status")
          .eq("provider_tx_id", orderId)
          .eq("provider", "cashfree")
          .maybeSingle();

        if (!purchase) {
          console.warn(`[Cashfree webhook] No purchase found for order ${orderId}`);
          break;
        }

        if (purchase.status !== "pending") {
          console.log(`[Cashfree webhook] Purchase ${purchase.id} already ${purchase.status}`);
          break;
        }

        // Mark as completed
        await sb
          .from("purchases")
          .update({ status: "completed" })
          .eq("id", purchase.id);

        // Fetch full purchase data for post-purchase logic
        const { data: fullPurchase } = await sb
          .from("purchases")
          .select("developer_id, item_id, gifted_to")
          .eq("id", purchase.id)
          .single();

        if (fullPurchase) {
          // Auto-equip if it's the only item in its zone
          const itemOwner = fullPurchase.gifted_to ?? fullPurchase.developer_id;
          await autoEquipIfSolo(itemOwner, fullPurchase.item_id);

          // Get developer info for notifications
          const { data: dev } = await sb
            .from("developers")
            .select("github_login")
            .eq("id", fullPurchase.developer_id)
            .single();

          if (fullPurchase.gifted_to) {
            // Gift notifications
            const { data: receiver } = await sb
              .from("developers")
              .select("github_login")
              .eq("id", fullPurchase.gifted_to)
              .single();

            await sb.from("activity_feed").insert({
              event_type: "gift_sent",
              actor_id: fullPurchase.developer_id,
              target_id: fullPurchase.gifted_to,
              metadata: {
                giver_login: dev?.github_login,
                receiver_login: receiver?.github_login,
                item_id: fullPurchase.item_id,
              },
            });

            sendGiftSentNotification(
              fullPurchase.developer_id,
              dev?.github_login ?? "",
              receiver?.github_login ?? "unknown",
              purchase.id,
              fullPurchase.item_id,
            );
            sendGiftReceivedNotification(
              fullPurchase.gifted_to,
              dev?.github_login ?? "someone",
              receiver?.github_login ?? "unknown",
              purchase.id,
              fullPurchase.item_id,
            );
          } else {
            // Purchase notification
            await sb.from("activity_feed").insert({
              event_type: "item_purchased",
              actor_id: fullPurchase.developer_id,
              metadata: {
                login: dev?.github_login,
                item_id: fullPurchase.item_id,
              },
            });

            sendPurchaseNotification(
              fullPurchase.developer_id,
              dev?.github_login ?? "",
              purchase.id,
              fullPurchase.item_id,
            );
          }
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
    console.error("[Cashfree webhook] Handler error:", err);
  }

  // Always return 200 so Cashfree doesn't retry
  return NextResponse.json({ received: true });
}
