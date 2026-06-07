import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// Prevent Next.js from prerendering this API route at build time since it
// requires a server-side Supabase key which may not be available during static
// builds. Force dynamic handling so runtime env vars are used.
export const dynamic = "force-dynamic";
export const revalidate = 300; // ISR: regenerate every 5 min

export async function GET() {
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from("developers")
    .select("github_login, avatar_url, dailies_completed, dailies_streak")
    .eq("claimed", true)
    .gt("dailies_completed", 0)
    .order("dailies_streak", { ascending: false })
    .order("dailies_completed", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  return NextResponse.json({
    leaderboard: data ?? [],
    total: data?.length ?? 0,
  });
}
