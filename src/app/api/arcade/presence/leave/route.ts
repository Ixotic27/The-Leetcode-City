import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

/**
 * POST /api/arcade/presence/leave
 *
 * Deletes the caller's rows from `arcade_active_players`. This endpoint exists
 * because `navigator.sendBeacon()` can only POST (no DELETE, no headers), so
 * the tab-close cleanup in the multiplayer client falls back to a beacon here.
 *
 * Auth: cookie session is preferred; a `{ token }` body is accepted as a
 * fallback since beacons carry no Authorization header.
 */
export async function POST(request: NextRequest) {
  let userId: string | null = null;

  // 1. Cookie session (works for regular fetches)
  try {
    const auth = await resolveAuthenticatedDeveloper({ select: "id" });
    if (auth.ok && auth.user) userId = auth.user.id;
  } catch {
    // fall through to token path
  }

  // 2. Session token supplied in the body (sendBeacon path)
  if (!userId) {
    try {
      const body = (await request.json()) as { token?: unknown };
      if (typeof body.token === "string" && body.token.length > 0) {
        const { data, error } = await getSupabaseAdmin().auth.getUser(
          body.token,
        );
        if (!error && data.user) userId = data.user.id;
      }
    } catch {
      // invalid body — treat as unauthenticated
    }
  }

  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("arcade_active_players")
    .delete()
    .eq("user_id", userId);

  if (error) {
    console.error("[arcade/presence/leave] delete failed:", error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
