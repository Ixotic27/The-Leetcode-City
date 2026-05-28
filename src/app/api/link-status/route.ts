import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ linked: false }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: dev } = await admin
    .from("developers")
    .select("github_login, lc_username")
    .eq("claimed_by", user.id)
    .maybeSingle();

  if (!dev) {
    return NextResponse.json({ linked: false });
  }

  const linked = Boolean(dev.lc_username);
  return NextResponse.json({
    linked,
    githubLogin: dev.github_login,
    ...(linked ? { lcUsername: dev.lc_username } : {}),
  });
}