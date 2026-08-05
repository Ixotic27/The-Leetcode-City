import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { resolveAuthenticatedDeveloper } from "@/lib/authenticated-developer";
import { parsePageParams } from "@/lib/parse-pagination";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// GET /api/arcade/maps — List custom maps with search, category, pagination
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const search = url.searchParams.get("q")?.trim();
  const category = url.searchParams.get("category");
  const creatorId = url.searchParams.get("creator_id");
  const { page, limit, offset } = parsePageParams(
    url.searchParams.get("page"),
    url.searchParams.get("limit")
  );

  const sb = getSupabaseAdmin();

  let query = sb
    .from("arcade_maps")
    .select("id, slug, name, description, creator_id, creator_name, category, tags, is_public, version, created_at, updated_at", { count: "exact" })
    .eq("is_public", true)
    .range(offset, offset + limit - 1)
    .order("created_at", { ascending: false });

  if (search) {
    query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (category) {
    query = query.eq("category", category);
  }

  if (creatorId) {
    query = query.eq("creator_id", creatorId);
  }

  const { data, error, count } = await query;

  if (error) {
    console.error("[GET /api/arcade/maps] Database error:", error.message);
    return NextResponse.json({ maps: [], total: 0, page, limit, error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    maps: data ?? [],
    total: count ?? 0,
    page,
    limit,
  });
}

// POST /api/arcade/maps — Create a new custom map
export async function POST(req: NextRequest) {
  const auth = await resolveAuthenticatedDeveloper({ select: "id, github_login" });
  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, description, category, tags, is_public, map_json } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Map name is required" }, { status: 400 });
    }

    if (!map_json || typeof map_json !== "object") {
      return NextResponse.json({ error: "Valid map_json layout object is required" }, { status: 400 });
    }

    const baseSlug = slugify(name) || "custom-map";
    const uniqueSlug = `${baseSlug}-${Date.now().toString(36)}`;

    const sb = getSupabaseAdmin();
    const creatorName = auth.developer?.github_login ?? auth.user.email ?? "Anonymous";

    const { data, error } = await sb
      .from("arcade_maps")
      .insert({
        slug: uniqueSlug,
        name: name.trim(),
        description: description?.trim() ?? null,
        creator_id: auth.user.id,
        creator_name: creatorName,
        category: category ?? "custom",
        tags: Array.isArray(tags) ? tags : [],
        is_public: is_public ?? true,
        version: 1,
        map_json,
      })
      .select("*")
      .single();

    if (error) {
      console.error("[POST /api/arcade/maps] Insert error:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ map: data }, { status: 201 });
  } catch (err: unknown) {
    console.error("[POST /api/arcade/maps] Invalid payload:", err);
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}
