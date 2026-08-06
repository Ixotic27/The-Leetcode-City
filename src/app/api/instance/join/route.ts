import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

const joinSchema = z.object({
  inviteToken: z.string().trim().min(8).max(128),
  displayName: z.string().trim().min(1).max(64).optional(),
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

  const parsed = joinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invite token is required" },
      { status: 400 },
    );
  }

  const sb = getSupabaseAdmin();
  const userId = auth.user.id;
  const token = parsed.data.inviteToken.replace(/^.*[/=]/, "").trim();

  const { data: existing } = await sb
    .from("shared_instance_memberships")
    .select("id, status")
    .eq("user_id", userId)
    .in("status", ["pending", "approved"])
    .limit(1)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You already have an active or pending membership" },
      { status: 409 },
    );
  }

  const { data: instance, error: instanceError } = await sb
    .from("shared_instances")
    .select("id, name, owner_user_id")
    .eq("invite_token", token)
    .maybeSingle();

  if (instanceError) {
    console.error("[api/instance/join] lookup:", instanceError);
    return NextResponse.json({ error: "Failed to join instance" }, { status: 500 });
  }

  if (!instance) {
    return NextResponse.json({ error: "Invalid invite token" }, { status: 404 });
  }

  if (instance.owner_user_id === userId) {
    return NextResponse.json({ error: "You already own this instance" }, { status: 409 });
  }

  const displayName = parsed.data.displayName?.trim() || displayNameFromUser(auth.user);

  const { data: membership, error: insertError } = await sb
    .from("shared_instance_memberships")
    .insert({
      instance_id: instance.id,
      user_id: userId,
      display_name: displayName,
      role: "member",
      status: "pending",
    })
    .select("id, status")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return NextResponse.json(
        { error: "Join request already exists for this instance" },
        { status: 409 },
      );
    }
    console.error("[api/instance/join] insert:", insertError);
    return NextResponse.json({ error: "Failed to submit join request" }, { status: 500 });
  }

  return NextResponse.json({
    state: "joined-member",
    instance: { id: instance.id, name: instance.name },
    membership,
  });
}

export async function DELETE() {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Not authenticated" },
      { status: auth.status },
    );
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("shared_instance_memberships")
    .delete()
    .eq("user_id", auth.user.id)
    .eq("status", "pending");

  if (error) {
    console.error("[api/instance/join] cancel:", error);
    return NextResponse.json({ error: "Failed to cancel request" }, { status: 500 });
  }

  return NextResponse.json({ state: "no-instance" });
}
