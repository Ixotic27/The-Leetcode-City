import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getAuthenticatedDeveloper } from "@/lib/arena";

export async function POST(request: NextRequest) {
  const dev = await getAuthenticatedDeveloper(request);
  if (!dev) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const { item_id } = body;

  if (!item_id) {
    return NextResponse.json({ error: "Missing item_id" }, { status: 400 });
  }

  const sb = getSupabaseAdmin();

  // Fetch item and user's inventory record
  const { data: invRecord, error: invError } = await sb
    .from("arena_inventory")
    .select(`
      id,
      quantity,
      is_equipped,
      item:arena_items (
        id,
        name,
        slug,
        item_type,
        rarity,
        effect_type,
        effect_value
      )
    `)
    .eq("user_id", dev.id)
    .eq("item_id", item_id)
    .maybeSingle();

  if (invError || !invRecord) {
    return NextResponse.json({ error: "Item not found in inventory" }, { status: 404 });
  }

  const item = invRecord.item as any;
  if (!item) {
    return NextResponse.json({ error: "Item definition not found" }, { status: 404 });
  }

  const isEquippable = ["gear", "cosmetic", "legendary", "companion"].includes(item.item_type);

  if (isEquippable) {
    // 1. Equippable Gear: Toggle equipped status
    const newEquipped = !invRecord.is_equipped;

    // If equipping a companion, badge, or weapon, we might want to unequip others of the same type
    // to keep loadout clean. But toggle is the simplest starting point.
    if (newEquipped) {
      // Unequip items of the same type first (e.g. only one companion or weapon equipped at a time)
      const { data: equippedSameType } = await sb
        .from("arena_inventory")
        .select(`
          id,
          item:arena_items!inner(id, item_type)
        `)
        .eq("user_id", dev.id)
        .eq("is_equipped", true);

      if (equippedSameType) {
        const sameTypeIds = equippedSameType
          .filter((rec: any) => rec.item?.item_type === item.item_type)
          .map((rec: any) => rec.id);

        if (sameTypeIds.length > 0) {
          await sb
            .from("arena_inventory")
            .update({ is_equipped: false })
            .in("id", sameTypeIds);
        }
      }
    }

    const { error: updateError } = await sb
      .from("arena_inventory")
      .update({ is_equipped: newEquipped })
      .eq("id", invRecord.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      action: newEquipped ? "equipped" : "unequipped",
      item: { id: item.id, name: item.name, slug: item.slug }
    });

  } else if (item.item_type === "consumable" || item.item_type === "material") {
    // 2. Consumable item: consume it!
    if (invRecord.quantity < 1) {
      return NextResponse.json({ error: "Out of stock" }, { status: 400 });
    }

    // Decrement quantity
    const newQuantity = invRecord.quantity - 1;
    if (newQuantity === 0) {
      await sb.from("arena_inventory").delete().eq("id", invRecord.id);
    } else {
      await sb.from("arena_inventory").update({ quantity: newQuantity }).eq("id", invRecord.id);
    }

    // Apply consumable effect
    const effType = item.effect_type;
    const effVal = item.effect_value || {};
    let appliedEffect = "";

    if (effType === "streak_freeze") {
      // Grant streak freeze in developers table
      const { data: devRec } = await sb
        .from("developers")
        .select("streak_freezes_available")
        .eq("id", dev.id)
        .single();
      
      const newFreezes = Math.min((devRec?.streak_freezes_available || 0) + (effVal.amount || 1), 2);
      await sb
        .from("developers")
        .update({ streak_freezes_available: newFreezes })
        .eq("id", dev.id);

      appliedEffect = `streak_freezes_increased_to_${newFreezes}`;

    } else if (["xp_boost", "time_bonus", "raid_shield", "raid_attack"].includes(effType)) {
      // Timed buff consumable: add to active buffs table
      const durationHours = effVal.duration_hours || 24;
      const expiresAt = new Date(Date.now() + durationHours * 60 * 60 * 1000).toISOString();
      const multiplier = effVal.multiplier || 1.25;

      await sb.from("arena_active_buffs").insert({
        user_id: dev.id,
        item_id: item.id,
        buff_type: effType,
        buff_value: multiplier,
        expires_at: expiresAt
      });

      appliedEffect = `buff_${effType}_applied_for_${durationHours}h`;

    } else if (effType === "reset_daily_challenge") {
      // Phoenix Token: Reset a failed daily challenge submission for today
      const todayStr = new Date().toISOString().split("T")[0];
      const { data: challenges } = await sb
        .from("arena_challenges")
        .select("id")
        .eq("challenge_date", todayStr);

      if (challenges && challenges.length > 0) {
        const challengeIds = challenges.map(c => c.id);
        // Delete WRONG_ANSWER / failed submissions for today's challenges
        const { error: delErr } = await sb
          .from("arena_submissions")
          .delete()
          .eq("user_id", dev.id)
          .in("challenge_id", challengeIds)
          .neq("status", "accepted");
        
        if (delErr) {
          console.error("Error deleting submissions:", delErr.message);
        }
      }

      appliedEffect = "daily_failed_submissions_reset";
    } else {
      appliedEffect = "consumed_generic";
    }

    return NextResponse.json({
      success: true,
      action: "consumed",
      item: { id: item.id, name: item.name, slug: item.slug },
      effect: appliedEffect
    });
  }

  return NextResponse.json({ error: "Unsupported item type" }, { status: 400 });
}

export const dynamic = "force-dynamic";
