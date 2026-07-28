import { getSupabaseAdmin } from "@/lib/supabase";
import { InfrastructureError } from "@/lib/errors";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface GrantRewardPayload {
  developerId: number;
  itemId: string;
  providerTxId: string;
  supabaseClient?: SupabaseClient;
}

export interface FulfillItemPayload {
  developerId: number;
  itemId: string;
  supabaseClient?: SupabaseClient;
}

export interface AutoEquipPayload {
  developerId: number;
  itemId: string;
  supabaseClient?: SupabaseClient;
}

export class InventoryEconomyService {
  private readonly admin: SupabaseClient;

  constructor(admin?: SupabaseClient) {
    this.admin = admin ?? getSupabaseAdmin();
  }

  async grantRewardItem(
    payload: GrantRewardPayload,
  ): Promise<{ granted: boolean }> {
    const sb = payload.supabaseClient ?? this.admin;
    const { error } = await sb.from("purchases").upsert(
      {
        developer_id: payload.developerId,
        item_id: payload.itemId,
        provider: "free",
        provider_tx_id: payload.providerTxId,
        amount_cents: 0,
        currency: "usd",
        status: "completed",
      },
      { onConflict: "provider_tx_id", ignoreDuplicates: true },
    );

    if (error) {
      throw new InfrastructureError(
        `[InventoryEconomyService] grantRewardItem failed for item "${payload.itemId}": ${error.message}`,
        error,
      );
    }

    return { granted: true };
  }

  async fulfillPurchasedItem(
    payload: FulfillItemPayload,
  ): Promise<{ status: "completed" | "delivered" }> {
    const sb = payload.supabaseClient ?? this.admin;

    const { data: item, error: itemError } = await sb
      .from("items")
      .select("category")
      .eq("id", payload.itemId)
      .single();

    if (itemError) {
      throw new InfrastructureError(
        `[InventoryEconomyService] Failed to fetch item "${payload.itemId}": ${itemError.message}`,
        itemError,
      );
    }

    const isConsumable = item?.category === "consumable";
    if (!isConsumable) {
      return { status: "completed" };
    }

    if (payload.itemId === "streak_freeze") {
      const { error: freezeError } = await sb.rpc("grant_streak_freeze", {
        p_developer_id: payload.developerId,
      });
      if (freezeError) {
        throw new InfrastructureError(
          `[InventoryEconomyService] grant_streak_freeze RPC failed: ${freezeError.message}`,
          freezeError,
        );
      }

      const { error: logError } = await sb.from("streak_freeze_log").insert({
        developer_id: payload.developerId,
        action: "purchased",
      });
      if (logError) {
        throw new InfrastructureError(
          `[InventoryEconomyService] streak_freeze_log insert failed: ${logError.message}`,
          logError,
        );
      }
    } else {
      const BATTLE_CONSUMABLES = [
        "anti_missile_system",
        "anti_tank_mines",
        "scouting_satellite",
        "emp_shield",
        "stealth_cloak",
        "emp_device",
        "sabotage_virus",
      ];

      if (BATTLE_CONSUMABLES.includes(payload.itemId)) {
        const { error: consumableError } = await sb.rpc("grant_consumable", {
          p_developer_id: payload.developerId,
          p_item_id: payload.itemId,
        });
        if (consumableError) {
          throw new InfrastructureError(
            `[InventoryEconomyService] grant_consumable RPC failed for "${payload.itemId}": ${consumableError.message}`,
            consumableError,
          );
        }
      }
    }

    return { status: "delivered" };
  }

  async autoEquipIfSolo(payload: AutoEquipPayload): Promise<void> {
    const { ZONE_ITEMS } = await import("@/lib/zones");
    const sb = payload.supabaseClient ?? this.admin;

    let zone: string | null = null;
    for (const [z, ids] of Object.entries(ZONE_ITEMS)) {
      if (ids.includes(payload.itemId)) {
        zone = z;
        break;
      }
    }

    if (!zone) return;

    const { data: ownPurchases } = await sb
      .from("purchases")
      .select("item_id")
      .eq("developer_id", payload.developerId)
      .is("gifted_to", null)
      .eq("status", "completed");
    const { data: giftPurchases } = await sb
      .from("purchases")
      .select("item_id")
      .eq("gifted_to", payload.developerId)
      .eq("status", "completed");
    const purchases = [...(ownPurchases ?? []), ...(giftPurchases ?? [])];

    const zoneItems = ZONE_ITEMS[zone];
    const ownedInZone = (purchases ?? [])
      .map((p) => p.item_id)
      .filter((id) => zoneItems.includes(id));

    if (ownedInZone.length !== 1) return;

    const { data: existing } = await sb
      .from("developer_customizations")
      .select("config")
      .eq("developer_id", payload.developerId)
      .eq("item_id", "loadout")
      .maybeSingle();

    const config = (existing?.config ?? {
      crown: null,
      roof: null,
      aura: null,
    }) as Record<string, string | null>;
    config[zone] = payload.itemId;

    const { error: upsertError } = await sb
      .from("developer_customizations")
      .upsert(
        {
          developer_id: payload.developerId,
          item_id: "loadout",
          config,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "developer_id,item_id" },
      );

    if (upsertError) {
      console.error(
        "[InventoryEconomyService] autoEquipIfSolo: Failed to upsert loadout:",
        upsertError,
      );
    }
  }
}
