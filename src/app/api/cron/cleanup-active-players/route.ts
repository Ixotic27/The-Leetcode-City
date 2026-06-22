import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { verifyCronAuth } from "@/lib/cron-auth";

export async function GET(request: NextRequest) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const sb = getSupabaseAdmin();
  const cutoff = new Date(Date.now() - 60 * 1000).toISOString();

  const { data, error } = await sb
    .from("arcade_active_players")
    .delete()
    .lt("last_heartbeat", cutoff)
    .select("user_id");

  if (error) {
    console.error("[cron/cleanup-active-players] Error:", error);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    pruned: data?.length ?? 0,
  });
}
