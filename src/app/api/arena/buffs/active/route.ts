import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedDeveloper } from "@/lib/arena";

export async function GET(request: NextRequest) {
  const dev = await getAuthenticatedDeveloper(request);
  if (!dev) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const now = new Date().toISOString();

  // 1. Fetch active temporary buffs (consumables)
  const { data: tempBuffs, error: tempError } = await sb
    .from("arena_active_buffs")
    .select(`
      id,
      buff_type,
      buff_value,
      started_at,
      expires_at,
      item:arena_items (
        name,
        slug,
        icon_path
      )
    `)
    .eq("user_id", dev.id)
    .gt("expires_at", now);

  if (tempError) {
    return NextResponse.json({ error: tempError.message }, { status: 500 });
  }

  // 2. Fetch equipped gear (passive permanent buffs)
  const { data: equippedGear, error: gearError } = await sb
    .from("arena_inventory")
    .select(`
      id,
      item:arena_items (
        id,
        name,
        slug,
        item_type,
        effect_type,
        effect_value,
        icon_path
      )
    `)
    .eq("user_id", dev.id)
    .eq("is_equipped", true);

  if (gearError) {
    return NextResponse.json({ error: gearError.message }, { status: 500 });
  }

  // Format response: combine temporary buffs and passive gear buffs
  const buffs = (tempBuffs || []).map((b: any) => ({
    source: "consumable",
    name: b.item?.name || b.buff_type,
    slug: b.item?.slug || "",
    icon_path: b.item?.icon_path || "",
    buff_type: b.buff_type,
    buff_value: b.buff_value,
    expires_at: b.expires_at
  }));

  const passiveBuffs = (equippedGear || [])
    .filter((g: any) => g.item?.effect_type)
    .map((g: any) => ({
      source: "gear",
      name: g.item.name,
      slug: g.item.slug,
      icon_path: g.item.icon_path,
      buff_type: g.item.effect_type,
      buff_value: g.item.effect_value?.multiplier || 1.0,
      expires_at: null // permanent while equipped
    }));

  return NextResponse.json({
    active_buffs: [...buffs, ...passiveBuffs]
  });
}

export const dynamic = "force-dynamic";
