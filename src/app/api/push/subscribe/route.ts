import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// ── POST /api/push/subscribe ─────────────────────────────────────────────────
// Body: { developerId: number, subscription: PushSubscriptionJSON, platform: string }
//
// PushSubscriptionJSON looks like:
//   { endpoint: string, keys: { p256dh: string, auth: string } }
//
// We store the entire object as JSON text in the `token` column so
// dispatchPush() can JSON.parse() it and pass it straight to web-push.
// Upsert on `token` (unique) so re-subscribing the same device doesn't
// duplicate rows, and re-activates a previously deactivated subscription.

export async function POST(req: Request) {
  try {
    const { developerId, subscription, platform } = await req.json();

    if (!developerId || !subscription?.endpoint) {
      return NextResponse.json(
        { error: "Missing required fields: developerId and subscription.endpoint" },
        { status: 400 }
      );
    }

    const sb = getSupabaseAdmin();

    const { error } = await sb.from("push_subscriptions").upsert(
      {
        developer_id: developerId,
        token: JSON.stringify(subscription), // store full PushSubscription JSON
        platform: platform || "web",
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" } // unique index on token prevents duplicates
    );

    if (error) {
      console.error("[api/push/subscribe] DB upsert error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/push/subscribe] POST error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE /api/push/subscribe ───────────────────────────────────────────────
// Body: { developerId: number, endpoint: string }
//
// We mark the row inactive rather than hard-deleting it so we retain audit
// history and dispatchPush() can see that the subscription was voluntarily
// removed (vs. expired — those are marked inactive by 404/410 error handling).
//
// NOTE: The endpoint is stored inside the JSON `token` column. We filter by
// developer_id + LIKE to locate it. For a high-scale app, add a separate
// indexed `endpoint text unique` column (see docs/web-push-setup.md).

export async function DELETE(req: Request) {
  try {
    const { developerId, endpoint } = await req.json();

    if (!developerId || !endpoint) {
      return NextResponse.json(
        { error: "Missing required fields: developerId and endpoint" },
        { status: 400 }
      );
    }

    const sb = getSupabaseAdmin();

    const { error } = await sb
      .from("push_subscriptions")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("developer_id", developerId)
      .like("token", `%${endpoint}%`); // endpoint is inside the stored JSON

    if (error) {
      console.error("[api/push/subscribe] DB update error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/push/subscribe] DELETE error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}