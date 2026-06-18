import { NextRequest, NextResponse } from "next/server";
import { syncCodeforcesProblems } from "@/lib/arena";

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    console.log("[cron/sync-arena-problems] Starting sync...");
    // Sync 3 new problems for each difficulty level
    const syncedCount = await syncCodeforcesProblems(3);
    console.log(`[cron/sync-arena-problems] Synced ${syncedCount} problems.`);
    return NextResponse.json({ ok: true, synced: syncedCount });
  } catch (err: any) {
    console.error("[cron/sync-arena-problems] Error running sync:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
