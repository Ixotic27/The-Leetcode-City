import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { DailyMissionService } from "@/services/dailyMissionService";

export async function POST() {
  const { resolveAuthenticatedDeveloper } = await import("@/lib/authenticated-developer");
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Early rate limit: coarse guard against extreme spam (e.g. scripted floods).
  // Allows 3 requests per 30s so transient failures don't block retries, but
  // still caps abuse. A tighter idempotency check fires after the RPC succeeds.
  const { ok: earlyOk } = await rateLimit(`checkin:${auth.user.id}`, 3, 30_000);
  if (!earlyOk) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const service = new DailyMissionService();
  try {
    const result = await service.checkIn(auth.user.id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Check-in failed";
    const status = typeof error === "object" && error && "status" in error ? Number((error as { status?: number }).status) || 500 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}