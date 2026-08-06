import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
});

function displayNameFromUser(user: {
  user_metadata?: Record<string, unknown>;
  email?: string | null;
}): string {
  const meta = user.user_metadata ?? {};
  const login =
    (typeof meta.user_name === "string" && meta.user_name) ||
    (typeof meta.preferred_username === "string" && meta.preferred_username) ||
    (typeof meta.full_name === "string" && meta.full_name) ||
    user.email?.split("@")[0] ||
    "member";
  return login.slice(0, 64);
}

export async function GET() {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Not authenticated", state: "unauthorized" },
      { status: auth.status },
    );
  }

  const sb = getSupabaseAdmin();
  const userId = auth.user.id;

  const { data: membership, error: membershipError } = await sb
    .from("shared_instance_memberships")
    .select("id, instance_id, display_name, role, status, created_at")
    .eq("user_id", userId)
    .in("status", ["pending", "approved"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error("[api/instance] membership lookup:", membershipError);
    return NextResponse.json({ error: "Failed to load instance" }, { status: 500 });
  }

  if (!membership) {
    return NextResponse.json({ state: "no-instance" });
  }

  const { data: instance, error: instanceError } = await sb
    .from("shared_instances")
    .select("id, name, invite_token, owner_user_id, created_at")
    .eq("id", membership.instance_id)
    .maybeSingle();

  if (instanceError || !instance) {
    console.error("[api/instance] instance lookup:", instanceError);
    return NextResponse.json({ error: "Failed to load instance" }, { status: 500 });
  }

  if (membership.status === "pending") {
    return NextResponse.json({
      state: "joined-member",
      instance: { id: instance.id, name: instance.name },
      membership,
    });
  }

  if (membership.role === "owner" || instance.owner_user_id === userId) {
    const { data: members, error: membersError } = await sb
      .from("shared_instance_memberships")
      .select("id, display_name, role, status, user_id, created_at")
      .eq("instance_id", instance.id)
      .order("created_at", { ascending: true });

    if (membersError) {
      console.error("[api/instance] members lookup:", membersError);
      return NextResponse.json({ error: "Failed to load members" }, { status: 500 });
    }

    const pending = (members ?? []).filter((m) => m.status === "pending");
    const active = (members ?? []).filter((m) => m.status === "approved");

    return NextResponse.json({
      state: "admin-dashboard",
      instance: {
        id: instance.id,
        name: instance.name,
        invite_token: instance.invite_token,
      },
      membership,
      pendingRequests: pending.map((m) => ({
        id: m.id,
        name: m.display_name,
        email: m.user_id,
      })),
      activeUsers: active.map((m) => ({
        id: m.id,
        name: m.role === "owner" ? `${m.display_name} (You)` : m.display_name,
        role: m.role === "owner" ? "Owner" : "Member",
      })),
    });
  }

  return NextResponse.json({
    state: "joined-member",
    instance: { id: instance.id, name: instance.name },
    membership: { ...membership, status: "approved" },
  });
}

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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Instance name must be 2–80 characters" },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const userId = auth.user.id;

  const { data: existing } = await sb
    .from("shared_instance_memberships")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["pending", "approved"])
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You already belong to an instance" },
      { status: 409 },
    );
  }

  const inviteToken = randomBytes(16).toString("hex");
  const displayName = displayNameFromUser(auth.user);

  const { data: instance, error: createError } = await sb
    .from("shared_instances")
    .insert({
      name: parsed.data.name,
      invite_token: inviteToken,
      owner_user_id: userId,
    })
    .select("id, name, invite_token")
    .single();

  if (createError || !instance) {
    console.error("[api/instance] create:", createError);
    return NextResponse.json({ error: "Failed to create instance" }, { status: 500 });
  }

  const { error: memberError } = await sb.from("shared_instance_memberships").insert({
    instance_id: instance.id,
    user_id: userId,
    display_name: displayName,
    role: "owner",
    status: "approved",
  });

  if (memberError) {
    console.error("[api/instance] owner membership:", memberError);
    await sb.from("shared_instances").delete().eq("id", instance.id);
    return NextResponse.json({ error: "Failed to create instance" }, { status: 500 });
  }

  return NextResponse.json({
    state: "admin-dashboard",
    instance,
  });
}
