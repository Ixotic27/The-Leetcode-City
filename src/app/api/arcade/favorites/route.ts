import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

// Favorites are per-user and change the instant a room is toggled, so no response
// from this route may be stored by the browser or a shared CDN.
const NO_STORE = { "Cache-Control": "no-store" } as const;

// GET /api/arcade/favorites — list the signed-in user's favorited room ids
export async function GET() {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: auth.status, headers: NO_STORE }
    );
  }
  const user = auth.user;

  const sb = getSupabaseAdmin();

  try {
    const { data, error } = await sb
      .from("arcade_room_favorites")
      .select("room_id")
      .eq("user_id", user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    }

    return NextResponse.json(
      { favorites: (data ?? []).map((row) => row.room_id) },
      { headers: NO_STORE }
    );
  } catch (e) {
    // Mirrors the fallback in /api/arcade/rooms: a missing arcade table degrades
    // to "no favorites" rather than breaking the room browser.
    console.warn("Could not read favorites from DB, falling back to empty list:", e);
    return NextResponse.json({ favorites: [] }, { headers: NO_STORE });
  }
}

// POST /api/arcade/favorites — toggle favorite
export async function POST(req: NextRequest) {
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
  if (!auth.ok || !auth.user) {
    return NextResponse.json(
      { error: auth.error ?? "Unauthorized" },
      { status: auth.status, headers: NO_STORE }
    );
  }
  const user = auth.user;

  // Parsed inside a try: a malformed body makes `req.json()` throw, and an
  // uncaught throw here would escape the handler as a bodyless 500 with no
  // Cache-Control header at all.
  let room_id: string | undefined;
  try {
    ({ room_id } = (await req.json()) as { room_id?: string });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: NO_STORE });
  }

  if (!room_id) {
    return NextResponse.json({ error: "room_id required" }, { status: 400, headers: NO_STORE });
  }

  const sb = getSupabaseAdmin();

  try {
    // Check if already favorited
    const { data: existing } = await sb
      .from("arcade_room_favorites")
      .select("room_id")
      .eq("user_id", user.id)
      .eq("room_id", room_id)
      .single();

    if (existing) {
      // Remove favorite. The delete error is surfaced rather than ignored:
      // reporting `favorited: false` after a failed delete would leave the
      // client's state out of sync with the row that is still in the table.
      const { error: deleteError } = await sb.from("arcade_room_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("room_id", room_id);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500, headers: NO_STORE });
      }

      return NextResponse.json({ favorited: false }, { headers: NO_STORE });
    }

    // Add favorite
    const { error } = await sb.from("arcade_room_favorites")
      .insert({ user_id: user.id, room_id });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500, headers: NO_STORE });
    }

    return NextResponse.json({ favorited: true }, { headers: NO_STORE });
  } catch (e) {
    // A throw here means the toggle never reached the table, so there is no
    // state to report. The previous hardcoded `favorited: true` was wrong twice
    // over: it claimed a write that did not happen, and for an un-favorite it
    // returned the opposite of the action the user took. Unlike GET — where an
    // unreachable table can safely degrade to "no favorites" — a write cannot
    // be faked, so this surfaces a 500 and lets the optimistic update in
    // /arcade roll back via its `if (!res.ok)` check.
    console.error("Could not toggle favorite in DB:", e);
    return NextResponse.json(
      { error: "Could not toggle favorite" },
      { status: 500, headers: NO_STORE }
    );
  }
}
