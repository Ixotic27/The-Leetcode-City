import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";

// GET /api/arcade/maps/[id] — Retrieve single map details + map_json
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabaseAdmin();

  // Try matching by UUID id or slug
  const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);
  const query = sb.from("arcade_maps").select("*");

  if (isUuid) {
    query.eq("id", id);
  } else {
    query.eq("slug", id);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  return NextResponse.json({ map: data });
}

// PUT /api/arcade/maps/[id] — Update custom map (owner only)
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);
  
  // Verify map exists and requester is the creator
  let checkQuery = sb.from("arcade_maps").select("id, creator_id, version");
  if (isUuid) {
    checkQuery = checkQuery.eq("id", id);
  } else {
    checkQuery = checkQuery.eq("slug", id);
  }

  const { data: existingMap, error: fetchErr } = await checkQuery.single();

  if (fetchErr || !existingMap) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  if (existingMap.creator_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden: You are not the creator of this map" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { name, description, category, tags, is_public, map_json } = body;

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
      version: (existingMap.version || 1) + 1,
    };

    if (name && typeof name === "string") updates.name = name.trim();
    if (description !== undefined) updates.description = description ? description.trim() : null;
    if (category && typeof category === "string") updates.category = category;
    if (Array.isArray(tags)) updates.tags = tags;
    if (typeof is_public === "boolean") updates.is_public = is_public;
    if (map_json && typeof map_json === "object") updates.map_json = map_json;

    const { data: updatedMap, error: updateErr } = await sb
      .from("arcade_maps")
      .update(updates)
      .eq("id", existingMap.id)
      .select("*")
      .single();

    if (updateErr) {
      console.error("[PUT /api/arcade/maps/[id]] Update error:", updateErr.message);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ map: updatedMap });
  } catch (err: unknown) {
    console.error("[PUT /api/arcade/maps/[id]] Invalid payload:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

// DELETE /api/arcade/maps/[id] — Delete custom map (owner only)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const isUuid = /^[0-9a-fA-F-]{36}$/.test(id);

  let checkQuery = sb.from("arcade_maps").select("id, creator_id");
  if (isUuid) {
    checkQuery = checkQuery.eq("id", id);
  } else {
    checkQuery = checkQuery.eq("slug", id);
  }

  const { data: existingMap, error: fetchErr } = await checkQuery.single();

  if (fetchErr || !existingMap) {
    return NextResponse.json({ error: "Map not found" }, { status: 404 });
  }

  if (existingMap.creator_id !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden: You are not the creator of this map" }, { status: 403 });
  }

  const { error: deleteErr } = await sb.from("arcade_maps").delete().eq("id", existingMap.id);

  if (deleteErr) {
    console.error("[DELETE /api/arcade/maps/[id]] Delete error:", deleteErr.message);
    return NextResponse.json({ error: deleteErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
