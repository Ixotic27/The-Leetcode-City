import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { getDailyMissions, getTodayStr, MISSIONS_BY_ID } from "@/lib/dailies";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { ok } = rateLimit(`dailies-progress:${user.id}`, 5, 10_000);
  if (!ok) {
    return NextResponse.json({ error: "Too fast" }, { status: 429 });
  }

  const body = await request.json();
  const { mission_id, points, mobile } = body as {
    mission_id: string;
    points?: number;
    mobile?: boolean;   // ← read from body
  };
  const isMobile = mobile === true;  // ← derive flag
  const increment = typeof points === "number" && points > 0 ? points : 1;

  if (!mission_id || !MISSIONS_BY_ID.has(mission_id)) {
    return NextResponse.json({ error: "Invalid mission_id" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: dev } = await admin
    .from("developers")
    .select("id, claimed")
    .eq("claimed_by", user.id)
    .single();

  if (!dev || !dev.claimed) {
    return NextResponse.json({ error: "Must claim building first" }, { status: 403 });
  }

  const today = getTodayStr();
  const missions = getDailyMissions(dev.id, today, isMobile);  // ← pass flag
  const mission = missions.find((m) => m.id === mission_id);

  if (!mission) {
    return NextResponse.json({ error: "Mission not assigned today" }, { status: 400 });
  }

  const { data: result, error: rpcError } = await admin.rpc("record_mission_progress", {
    p_developer_id: dev.id,
    p_mission_id: mission_id,
    p_threshold: mission.threshold,
    p_increment: increment,
  });

  if (rpcError) {
    console.error("[dailies] progress RPC error:", rpcError);
    return NextResponse.json({ error: "Failed to update progress" }, { status: 500 });
  }

  return NextResponse.json(result);
}