import { NextRequest, NextResponse } from "next/server";
import { rotateDailyChallenges } from "@/lib/arena";

export async function GET(request: NextRequest) {
  // Verify Vercel Cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const todayStr = new Date().toISOString().split("T")[0];
    console.log(`[cron/rotate-daily-challenge] Rotating for date: ${todayStr}...`);
    const success = await rotateDailyChallenges(todayStr);

    if (!success) {
      return NextResponse.json({ error: "Rotation failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, rotated: true, date: todayStr });
  } catch (err: any) {
    console.error("[cron/rotate-daily-challenge] Error running rotation:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
