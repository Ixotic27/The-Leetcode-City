import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { Webhook } from "svix";

export const dynamic = "force-dynamic";

/**
 * Resend webhook handler for email delivery events.
 * Handles bounces, complaints, delivery confirmations, and opens/clicks.
 * Updates notification_log delivery lifecycle and notification_suppressions.
 */
/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  // Verify webhook secret (set in Resend dashboard)
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
  
  const payload = await request.text();
  let body: { type: string; data: Record<string, unknown> };

  if (webhookSecret) {
    const svix_id = request.headers.get("svix-id");
    const svix_timestamp = request.headers.get("svix-timestamp");
    const svix_signature = request.headers.get("svix-signature");

    if (!svix_id || !svix_timestamp || !svix_signature) {
      return NextResponse.json({ error: "Missing svix headers" }, { status: 401 });
    }

    try {
      const wh = new Webhook(webhookSecret);
      body = wh.verify(payload, {
        "svix-id": svix_id,
        "svix-timestamp": svix_timestamp,
        "svix-signature": svix_signature,
      }) as { type: string; data: Record<string, unknown> };
    } catch (err) {
      console.warn("[app/api/webhooks/resend/route.ts] Invalid signature:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  } else {
    try {
      body = JSON.parse(payload);
    } catch (err) {
      console.warn("[app/api/webhooks/resend/route.ts] error:", err);
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }
  }
  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  try {
    switch (body.type) {
      case "email.bounced": {
        const email = (body.data.to as string[])?.[0];
        const emailId = body.data.email_id as string;

        if (email) {
          // Add to suppressions
          await sb
            .from("notification_suppressions")
            .upsert(
              { identifier: email, channel: "email", reason: "bounce", created_at: now },
              { onConflict: "identifier,channel" },
            );
        }

        if (emailId) {
          await sb
            .from("notification_log")
            .update({ status: "bounced", failed_at: now, failure_reason: "bounced" })
            .eq("provider_id", emailId);
        }
        break;
      }

      case "email.complained": {
        const email = (body.data.to as string[])?.[0];
        const emailId = body.data.email_id as string;

        if (email) {
          await sb
            .from("notification_suppressions")
            .upsert(
              { identifier: email, channel: "email", reason: "complaint", created_at: now },
              { onConflict: "identifier,channel" },
            );
        }

        if (emailId) {
          await sb
            .from("notification_log")
            .update({ status: "complained", failed_at: now, failure_reason: "spam_complaint" })
            .eq("provider_id", emailId);
        }
        break;
      }

      case "email.delivered": {
        const emailId = body.data.email_id as string;
        if (emailId) {
          await sb
            .from("notification_log")
            .update({ status: "delivered", delivered_at: now })
            .eq("provider_id", emailId);
        }
        break;
      }

      case "email.opened": {
        const emailId = body.data.email_id as string;
        if (emailId) {
          await sb
            .from("notification_log")
            .update({ opened_at: now })
            .eq("provider_id", emailId)
            .is("opened_at", null); // Only update first open
        }
        break;
      }

      case "email.clicked": {
        const emailId = body.data.email_id as string;
        if (emailId) {
          await sb
            .from("notification_log")
            .update({ clicked_at: now })
            .eq("provider_id", emailId)
            .is("clicked_at", null); // Only update first click
        }
        break;
      }
    }
  } catch (err) {
    console.error("[webhook:resend] Error processing event:", err);
  }

  return NextResponse.json({ received: true });
}
