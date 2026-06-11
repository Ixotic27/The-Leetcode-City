import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedDeveloper } from "@/lib/arena";

export async function GET(request: NextRequest) {
  const dev = await getAuthenticatedDeveloper(request);
  if (!dev) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  // Fetch the developer's inventory with full item details joined
  const { data: inventory, error } = await sb
    .from("arena_inventory")
    .select(`
      id,
      quantity,
      is_equipped,
      acquired_at,
      expires_at,
      item:arena_items (
        id,
        name,
        slug,
        description,
        item_type,
        rarity,
        effect_type,
        effect_value,
        icon_path,
        max_stack,
        is_tradeable
      )
    `)
    .eq("user_id", dev.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ inventory: inventory || [] });
}

export const dynamic = "force-dynamic";
