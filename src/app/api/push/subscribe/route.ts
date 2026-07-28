import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function POST(req: Request) {
  try {
    const { resolveAuthenticatedDeveloper } =
      await import("@/lib/authenticated-developer");
    const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

    if (!auth.ok || !auth.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = auth.user;

    const { subscription, platform } = await req.json();

    if (!subscription?.endpoint) {
      return NextResponse.json(
        { error: "Missing required field: subscription.endpoint" },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();

    const { data: dev } = await admin
      .from("developers")
      .select("id")
      .eq("claimed_by", user.id)
      .eq("claimed", true)
      .maybeSingle();

    if (!dev) {
      return NextResponse.json(
        { error: "Developer profile not found" },
        { status: 404 },
      );
    }

    const { error } = await admin.from("push_subscriptions").upsert(
      {
        developer_id: dev.id,
        token: JSON.stringify(subscription),
        platform: platform || "web",
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );

    if (error) {
      console.error("[api/push/subscribe] DB upsert error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/push/subscribe] POST error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { resolveAuthenticatedDeveloper } =
      await import("@/lib/authenticated-developer");
    const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

    if (!auth.ok || !auth.user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const user = auth.user;

    const { endpoint } = await req.json();

    if (!endpoint) {
      return NextResponse.json(
        { error: "Missing required field: endpoint" },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();

    const { data: dev } = await admin
      .from("developers")
      .select("id")
      .eq("claimed_by", user.id)
      .eq("claimed", true)
      .maybeSingle();

    if (!dev) {
      return NextResponse.json(
        { error: "Developer profile not found" },
        { status: 404 },
      );
    }

    const { error } = await admin
      .from("push_subscriptions")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("developer_id", dev.id)
      .like("token", `%${endpoint}%`);

    if (error) {
      console.error("[api/push/subscribe] DB update error:", error);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[api/push/subscribe] DELETE error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
