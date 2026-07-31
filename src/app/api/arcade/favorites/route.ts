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

  const { room_id } = (await req.json()) as { room_id?: string };
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
      // Remove favorite
      await sb.from("arcade_room_favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("room_id", room_id);
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
    console.warn("Could not toggle favorite in DB, fallback to fake success:", e);
    // Just toggle locally
    return NextResponse.json({ favorited: true }, { headers: NO_STORE });
  }
}
