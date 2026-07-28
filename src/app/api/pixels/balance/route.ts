import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getBalance } from "@/lib/pixels";

export async function GET() {
  const { resolveAuthenticatedDeveloper } =
    await import("@/lib/authenticated-developer");
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = auth.user;

  const githubLogin = (
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();

  const sb = getSupabaseAdmin();
  const { data: dev } = await sb
    .from("developers")
    .select("id")
    .eq("github_login", githubLogin)
    .single();

  if (!dev) return NextResponse.json({ balance: 0 });

  const wallet = await getBalance(dev.id);
  return NextResponse.json(wallet);
}
