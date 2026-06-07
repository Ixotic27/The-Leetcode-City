import { getSupabaseAdmin } from "./supabase";

// ─── Types ───────────────────────────────────────────────────

export interface ShopItem {
  id: string;
  category: "effect" | "structure" | "identity" | "consumable";
  name: string;
  description: string | null;
  price_usd_cents: number;
  price_brl_cents: number;
  is_active: boolean;
  zone: "crown" | "roof" | "aura" | "faces" | null;
  metadata: Record<string, unknown>;
  created_at: string;
  // A11: Seasonal/limited items
  available_until: string | null;
  max_quantity: number | null;
  is_exclusive: boolean;
  price_points: number | null;
}

export interface PurchaseRecord {
  id: string;
  developer_id: number;
  item_id: string;
  provider: "stripe" | "abacatepay" | "cashfree" | "free" | "achievement";
  provider_tx_id: string | null;
  amount_cents: number;
  currency: "usd" | "brl";
  status: "pending" | "completed" | "expired" | "refunded";
  created_at: string;
}

export type OwnedItems = string[];

// ─── Helpers ─────────────────────────────────────────────────

export async function getOwnedItems(developerId: number): Promise<string[]> {
  const sb = getSupabaseAdmin();

  // Items bought directly (not gifts to others)
  const { data: ownData } = await sb
    .from("purchases")
    .select("item_id, provider, amount_cents")
    .eq("developer_id", developerId)
    .is("gifted_to", null)
    .eq("status", "completed");

  // Items received as gifts
  const { data: giftData } = await sb
    .from("purchases")
    .select("item_id, provider, amount_cents")
    .eq("gifted_to", developerId)
    .eq("status", "completed");

  const ownFiltered = (ownData ?? [])
    .filter(row => !(row.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(row.provider)))
    .map((row) => row.item_id);

  const giftFiltered = (giftData ?? [])
    .filter(row => !(row.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(row.provider)))
    .map((row) => row.item_id);

  return [...ownFiltered, ...giftFiltered];
}

/** Item granted for free when a developer first claims their building. */
export const FREE_CLAIM_ITEM = "flag";

/**
 * Grant the free claim item to a developer.
 * No-ops if they already own it (idempotent).
 * Returns true if the item was granted, false if already owned.
 */
export async function grantFreeClaimItem(
  developerId: number
): Promise<boolean> {
  const sb = getSupabaseAdmin();

  // Check if already owned
  const { data: existing } = await sb
    .from("purchases")
    .select("id")
    .eq("developer_id", developerId)
    .eq("item_id", FREE_CLAIM_ITEM)
    .eq("status", "completed")
    .maybeSingle();

  if (existing) return false;

  await sb.from("purchases").insert({
    developer_id: developerId,
    item_id: FREE_CLAIM_ITEM,
    provider: "free",
    provider_tx_id: `free_claim_${developerId}`,
    amount_cents: 0,
    currency: "usd",
    status: "completed",
  });

  return true;
}

/**
 * Auto-equip an item if the developer has only one item in its zone.
 * Called after a purchase is completed (buy or gift).
 */
export async function autoEquipIfSolo(
  developerId: number,
  itemId: string
): Promise<void> {
  const { ZONE_ITEMS } = await import("./zones");

  // Find which zone this item belongs to
  let zone: string | null = null;
  for (const [z, ids] of Object.entries(ZONE_ITEMS)) {
    if (ids.includes(itemId)) { zone = z; break; }
  }
  if (!zone) return; // faces or unknown zone, skip

  const sb = getSupabaseAdmin();

  // Get all owned items in this zone (bought by them OR gifted to them)
  const { data: ownPurchases } = await sb
    .from("purchases")
    .select("item_id")
    .eq("developer_id", developerId)
    .is("gifted_to", null)
    .eq("status", "completed");
  const { data: giftPurchases } = await sb
    .from("purchases")
    .select("item_id")
    .eq("gifted_to", developerId)
    .eq("status", "completed");
  const purchases = [...(ownPurchases ?? []), ...(giftPurchases ?? [])];

  const zoneItems = ZONE_ITEMS[zone];
  const ownedInZone = (purchases ?? [])
    .map((p) => p.item_id)
    .filter((id) => zoneItems.includes(id));

  if (ownedInZone.length !== 1) return; // 0 or 2+ items, don't auto-equip

  // Get current loadout
  const { data: existing } = await sb
    .from("developer_customizations")
    .select("config")
    .eq("developer_id", developerId)
    .eq("item_id", "loadout")
    .maybeSingle();

  const config = (existing?.config ?? { crown: null, roof: null, aura: null }) as Record<string, string | null>;
  config[zone] = itemId;

  const { error: upsertError } = await sb.from("developer_customizations").upsert(
    {
      developer_id: developerId,
      item_id: "loadout",
      config,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "developer_id,item_id" }
  );

  if (upsertError) {
    console.error("[items.ts] autoEquipIfSolo: Failed to upsert loadout:", upsertError);
  }

}

export async function getOwnedItemsForDevelopers(
  developerIds: number[]
): Promise<Record<number, string[]>> {
  if (developerIds.length === 0) return {};

  const sb = getSupabaseAdmin();

  // Items bought directly (not gifts)
  const { data: ownData } = await sb
    .from("purchases")
    .select("developer_id, item_id, provider, amount_cents")
    .in("developer_id", developerIds)
    .is("gifted_to", null)
    .eq("status", "completed");

  // Items received as gifts
  const { data: giftData } = await sb
    .from("purchases")
    .select("gifted_to, item_id, provider, amount_cents")
    .in("gifted_to", developerIds)
    .eq("status", "completed");

  const result: Record<number, string[]> = {};
  for (const row of ownData ?? []) {
    if (row.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(row.provider)) {
      continue;
    }
    if (!result[row.developer_id]) result[row.developer_id] = [];
    result[row.developer_id].push(row.item_id);
  }
  for (const row of giftData ?? []) {
    if (row.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(row.provider)) {
      continue;
    }
    const devId = row.gifted_to as number;
    if (!result[devId]) result[devId] = [];
    result[devId].push(row.item_id);
  }
  return result;
}

/**
 * Fulfills/records the purchase of an item for a developer.
 * Handles consumables (adds them to inventory/counters and returns 'delivered' to bypass unique index constraints).
 * Returns the final status to use for the purchases table.
 */
export async function fulfillItemPurchase(
  developerId: number,
  itemId: string,
  supabaseAdminClient?: any
): Promise<{ status: "completed" | "delivered" }> {
  const sb = supabaseAdminClient || getSupabaseAdmin();

  // 1. Fetch item details to determine category
  const { data: item } = await sb
    .from("items")
    .select("category")
    .eq("id", itemId)
    .single();

  const isConsumable = item?.category === "consumable";

  if (!isConsumable) {
    return { status: "completed" };
  }

  // 2. Fulfill based on specific consumable type
  if (itemId === "streak_freeze") {
    // Increment streak freeze counter
    await sb.rpc("grant_streak_freeze", { p_developer_id: developerId });
    await sb.from("streak_freeze_log").insert({
      developer_id: developerId,
      action: "purchased",
    });
  } else {
    // Battle consumable or other: increment quantity in developer_consumables
    const BATTLE_CONSUMABLES = [
      "anti_missile_system",
      "anti_tank_mines",
      "scouting_satellite",
      "emp_shield",
      "stealth_cloak",
      "emp_device",
      "sabotage_virus"
    ];

    if (BATTLE_CONSUMABLES.includes(itemId)) {
      const { data: existing } = await sb
        .from("developer_consumables")
        .select("quantity")
        .eq("developer_id", developerId)
        .eq("item_id", itemId)
        .maybeSingle();

      const newQty = (existing?.quantity ?? 0) + 1;

      await sb.from("developer_consumables").upsert(
        {
          developer_id: developerId,
          item_id: itemId,
          quantity: newQty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "developer_id,item_id" }
      );
    }
  }

  // To bypass unique index constraints for completed purchases of consumables, we use 'delivered' status
  return { status: "delivered" };
}
