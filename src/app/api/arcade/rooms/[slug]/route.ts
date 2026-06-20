import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase-server";

import fs from "fs/promises";
import path from "path";

// GET /api/arcade/rooms/[slug] — get room with full map_json + track visit
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("arcade_rooms")
    .select("id, slug, name, room_type, floor_number, max_players, visibility, category, description, is_featured, portals, map_json, created_at, updated_at")
    .eq("slug", slug)
    .single();

  if (error || !data) {
    if (slug === "lobby") {
      try {
        const filePath = path.join(process.cwd(), "public/maps/lobby.json");
        const fileContent = await fs.readFile(filePath, "utf-8");
        const mapJson = JSON.parse(fileContent);
        const fallbackRoom = {
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
          map_json: mapJson,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return NextResponse.json({ room: fallbackRoom });
      } catch (err: any) {
        console.error("Failed to read fallback lobby map:", err);
      }
    } else if (slug === "fsociety") {
      try {
        const filePath = path.join(process.cwd(), "public/maps/lobby.json");
        const fileContent = await fs.readFile(filePath, "utf-8");
        const mapJson = JSON.parse(fileContent);
        const fallbackRoom = {
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
          map_json: mapJson,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return NextResponse.json({ room: fallbackRoom });
      } catch (err: any) {
        console.error("Failed to read fallback fsociety map:", err);
      }
    } else if (slug === "trading_floor") {
      try {
        const filePath = path.join(process.cwd(), "public/maps/lobby.json");
        const fileContent = await fs.readFile(filePath, "utf-8");
        const mapJson = JSON.parse(fileContent);
        const fallbackRoom = {
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
          map_json: mapJson,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return NextResponse.json({ room: fallbackRoom });
      } catch (err: any) {
        console.error("Failed to read fallback trading_floor map:", err);
      }

    } else if (slug === "ixotopia") {
      try {
        const filePath = path.join(process.cwd(), "public/pokemon_resources/ixotopia-converted.json");
        const fileContent = await fs.readFile(filePath, "utf-8");
        const mapJson = JSON.parse(fileContent);
        const fallbackRoom = {
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
          map_json: mapJson,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        return NextResponse.json({ room: fallbackRoom });
      } catch (err: any) {
        console.error("Failed to read fallback ixotopia map:", err);
      }
    }
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }

  // Track visit (best-effort, don't block response)
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      void sb.rpc("upsert_arcade_visit", { p_user_id: user.id, p_room_id: data.id });
    }
  } catch {
    // Not authenticated — skip visit tracking
  }

  return NextResponse.json({ room: data }, {
    headers: { "Cache-Control": "public, s-maxage=10, stale-while-revalidate=30" },
  });
}

// PUT /api/arcade/rooms/[slug] — update map_json (admin only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Auth check — must be logged in
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Admin check
  const login = (
    user.user_metadata?.user_name ??
    user.user_metadata?.preferred_username ??
    ""
  ).toLowerCase();
  const admins = (process.env.ADMIN_GITHUB_LOGINS ?? "")
    .split(",")
    .map((l: string) => l.trim().toLowerCase())
    .filter(Boolean);
  if (!admins.includes(login)) {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }

  const body = await req.json();
  if (!body.map_json) {
    return NextResponse.json({ error: "map_json required" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb
    .from("arcade_rooms")
    .update({ map_json: body.map_json, updated_at: new Date().toISOString() })
    .eq("slug", slug);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
