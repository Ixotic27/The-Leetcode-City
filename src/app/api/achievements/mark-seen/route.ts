import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

export async function POST() {
  const auth = await resolveAuthenticatedDeveloper({ select: "id" });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: auth.error ?? "Not authenticated" }, { status: auth.status });
  }

  const sb = getSupabaseAdmin();
  const dev = auth.developer;
  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  await sb
    .from("developer_achievements")
    .update({ seen: true })
    .eq("developer_id", dev.id)
    .eq("seen", false);

  return NextResponse.json({ ok: true });
}
