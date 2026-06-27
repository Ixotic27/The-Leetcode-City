import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/arcade/rooms/counts — get live player counts grouped by room
export async function GET(req: NextRequest) {
  const sb = getSupabaseAdmin();
  const activeCounts: Record<string, number> = {};
  let totalOnline = 0;

  try {
    const cutoff = new Date(Date.now() - 45 * 1000).toISOString();
    const { data, error } = await sb
      .from("arcade_active_players")
      .select("room_id")
      .gt("last_heartbeat", cutoff);

    if (error) {
      throw error;
    }

    if (data) {
      for (const p of data) {
        activeCounts[p.room_id] = (activeCounts[p.room_id] ?? 0) + 1;
        totalOnline++;
      }
    }
  } catch (e: any) {
    if (e && e.code === "PGRST205") {
      console.warn("Could not query active players count: 'arcade_active_players' table is missing from schema cache (migration 066 not applied).");
    } else {
      console.warn("Could not query active players count:", e);
    }
  }

  return NextResponse.json({ counts: activeCounts, totalOnline }, {
    headers: { "Cache-Control": "no-store" },
  });
}
