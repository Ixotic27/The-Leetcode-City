import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

const actionSchema = z.object({
  membershipId: z.string().uuid(),
  action: z.enum(["approve", "reject"]),
});

export async function POST(request: Request) {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Not authenticated" },
      { status: auth.status },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const parsed = actionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const userId = auth.user.id;

  const { data: membership, error: membershipError } = await sb
    .from("shared_instance_memberships")
    .select("id, instance_id, status, role")
    .eq("id", parsed.data.membershipId)
    .maybeSingle();

  if (membershipError || !membership) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  if (membership.status !== "pending" || membership.role !== "member") {
    return NextResponse.json({ error: "Request is not pending" }, { status: 409 });
  }

  const { data: instance, error: instanceError } = await sb
    .from("shared_instances")
    .select("id, owner_user_id")
    .eq("id", membership.instance_id)
    .maybeSingle();

  if (instanceError || !instance) {
    return NextResponse.json({ error: "Instance not found" }, { status: 404 });
  }

  if (instance.owner_user_id !== userId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const nextStatus = parsed.data.action === "approve" ? "approved" : "rejected";
  const { error: updateError } = await sb
    .from("shared_instance_memberships")
    .update({ status: nextStatus })
    .eq("id", membership.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("[api/instance/requests] update:", updateError);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: nextStatus });
}
