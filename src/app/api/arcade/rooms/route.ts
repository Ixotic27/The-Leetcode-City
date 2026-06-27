import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

// GET /api/arcade/rooms — list rooms with search, category, pagination
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category");
  const featured = url.searchParams.get("featured");
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(url.searchParams.get("limit") ?? "20", 10)));
  const offset = (page - 1) * limit;

  const sb = getSupabaseAdmin();

  let query = sb
    .from("arcade_rooms")
    .select("id, slug, name, room_type, floor_number, max_players, visibility, category, description, is_featured, portals, created_at", { count: "exact" })
    .in("visibility", ["open", "password"])
    .range(offset, offset + limit - 1)
    .order("is_featured", { ascending: false })
    .order("created_at", { ascending: true });

  if (search) {
    query = query.textSearch("search_vector", search, { type: "websearch" });
  }

  if (category) {
    query = query.eq("category", category);
  }

  if (featured === "true") {
    query = query.eq("is_featured", true);
  }

  const { data: dbData, error, count: dbCount } = await query;

  let data = dbData;
  let count = dbCount ?? 0;

  if (error) {
    console.debug("[rooms] DB table not found, using fallback rooms:", error.message);
    data = [
      {
        id: "lobby",
        slug: "lobby",
        name: "E.Arcade Lobby",
        room_type: "official_floor",
        floor_number: 0,
        max_players: 50,
        visibility: "open",
        category: "social",
        description: "Welcome to LeetCode City E.Arcade! Hangout and chat.",
        is_featured: true,
        portals: [
          { x: 14, y: 0, width: 4, type: "elevator", destination: "lobby", label: "Lobby" },
          { x: 13, y: 21, width: 4, type: "exit", destination: "ixotopia", label: "Exit to Outside World" }
        ],
        created_at: new Date().toISOString()
      },
      {
        id: "fsociety",
        slug: "fsociety",
        name: "Floor 1 - fsociety",
        room_type: "official_floor",
        floor_number: 1,
        max_players: 50,
        visibility: "open",
        category: "social",
        description: "Clearance level 1. fsociety headquarters.",
        is_featured: true,
        portals: [
          { x: 14, y: 0, width: 4, type: "elevator", destination: "lobby", label: "Lobby" },
          { x: 13, y: 21, width: 4, type: "exit", destination: "ixotopia", label: "Exit to Outside World" }
        ],
        created_at: new Date().toISOString()
      },
      {
        id: "trading_floor",
        slug: "trading_floor",
        name: "Floor 2 - Trading Floor",
        room_type: "official_floor",
        floor_number: 2,
        max_players: 50,
        visibility: "open",
        category: "social",
        description: "Clearance level 2. High-frequency algorithmic trading.",
        is_featured: true,
        portals: [
          { x: 14, y: 0, width: 4, type: "elevator", destination: "lobby", label: "Lobby" },
          { x: 13, y: 21, width: 4, type: "exit", destination: "ixotopia", label: "Exit to Outside World" }
        ],
        created_at: new Date().toISOString()
      },
      {
        id: "ixotopia",
        slug: "ixotopia",
        name: "🕹️ Ixotopia",
        room_type: "official_floor",
        floor_number: 3,
        max_players: 50,
        visibility: "open",
        category: "social",
        description: "Explore the Pokémon-style Ixotopia Overworld Town!",
        is_featured: true,
        portals: [
          { x: 20, y: 16, width: 1, type: "door", destination: "lobby", label: "Enter E.Arcade Lobby" }
        ],
        created_at: new Date().toISOString()
      }
    ];
    count = data.length;
  }

  // Fetch user's favorites and recent visits if authenticated
  let favorites: string[] = [];
  let recentVisits: Array<{ room_id: string; last_visited_at: string }> = [];

  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const [favRes, visitRes] = await Promise.all([
        sb.from("arcade_room_favorites")
          .select("room_id")
          .eq("user_id", user.id),
        sb.from("arcade_room_visits")
          .select("room_id, last_visited_at")
          .eq("user_id", user.id)
          .order("last_visited_at", { ascending: false })
          .limit(10),
      ]);
      favorites = (favRes.data ?? []).map((f) => f.room_id);
      recentVisits = visitRes.data ?? [];
    }
  } catch {
    // Not authenticated — no favorites/visits
  }

  return NextResponse.json({
    rooms: data,
    total: count ?? 0,
    page,
    limit,
    favorites,
    recentVisits,
  }, {
    headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
  });
}
