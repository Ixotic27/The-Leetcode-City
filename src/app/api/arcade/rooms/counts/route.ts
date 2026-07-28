import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET /api/arcade/rooms/counts — get live player counts grouped by room
export async function GET() {
  const sb = getSupabaseAdmin();
  const activeCounts: Record<string, number> = {};
  let totalOnline = 0;

  try {
    // Best-effort cleanup of stale active players (> 60 seconds since last heartbeat)
    const pruneCutoff = new Date(Date.now() - 60 * 1000).toISOString();
    void sb
      .from("arcade_active_players")
      .delete()
      .lt("last_heartbeat", pruneCutoff)
      .then(({ error }) => {
        if (error) {
          console.warn(
            "[counts] Failed to prune stale active players:",
            error.message,
          );
        }
      });

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
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string } | null;
    if (err && err.code === "PGRST205") {
      console.warn(
        "Could not query active players count: 'arcade_active_players' table is missing from schema cache (migration 066 not applied).",
      );
    } else {
      console.warn("Could not query active players count:", e);
    }
  }

  return NextResponse.json(
    { counts: activeCounts, totalOnline },
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
