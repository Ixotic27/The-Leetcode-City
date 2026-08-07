import { getSupabaseAdmin } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { InfrastructureError } from "./errors";
import { InventoryEconomyService } from "@/services/inventoryEconomyService";
import { OwnershipResolver } from "@/services/ownershipResolver";

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
  const resolver = new OwnershipResolver();
  return resolver.listOwnedItems(developerId);
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

  // Atomically insert the purchase record.
  // We use `upsert` with `ignoreDuplicates: true` and `onConflict: "provider_tx_id"`
  // to prevent concurrent requests from inserting duplicate free claims.
  const { data, error } = await sb
    .from("purchases")
    .upsert(
      {
        developer_id: developerId,
        item_id: FREE_CLAIM_ITEM,
        provider: "free",
        provider_tx_id: `free_claim_${developerId}_${FREE_CLAIM_ITEM}`,
        amount_cents: 0,
        currency: "usd",
        status: "completed",
      },
      {
        onConflict: "provider_tx_id",
        ignoreDuplicates: true,
      }
    )
    .select("id");

  if (error) {
    console.error("[items.ts] grantFreeClaimItem: Failed to insert free purchase:", error);
    return false;
  }

  // If a row was returned, it means it was inserted (newly granted).
  // If no rows were returned, a conflict occurred (already owned).
  return data && data.length > 0;
}

/**
 * Auto-equip an item if the developer has only one item in its zone.
 * Called after a purchase is completed (buy or gift).
 */
export async function autoEquipIfSolo(
  developerId: number,
  itemId: string
): Promise<void> {
  const service = new InventoryEconomyService();
  await service.autoEquipIfSolo({ developerId, itemId });
}

export async function getOwnedItemsForDevelopers(
  developerIds: number[]
): Promise<Record<number, string[]>> {
  const resolver = new OwnershipResolver();
  return resolver.buildOwnedItemsMap(developerIds);
}

/**
 * Fulfills/records the purchase of an item for a developer.
 * Handles consumables (adds them to inventory/counters and returns 'delivered' to bypass unique index constraints).
 * Returns the final status to use for the purchases table.
 */
export interface AtomicCheckoutPurchaseArgs {
  developerId: number;
  recipientId: number;
  itemId: string;
  provider: string;
  idempotencyKey: string;
  amountCents: number;
  currency: string;
  giftedTo?: number | null;
  supabaseClient?: SupabaseClient;
}

export async function createAtomicCheckoutPurchase({
  developerId,
  recipientId,
  itemId,
  provider,
  idempotencyKey,
  amountCents,
  currency,
  giftedTo = null,
  supabaseClient,
}: AtomicCheckoutPurchaseArgs): Promise<{ purchaseId: string }> {
  const sb = supabaseClient || getSupabaseAdmin();

  const { data, error } = await sb.rpc("create_checkout_purchase_and_fulfill", {
    p_developer_id: developerId,
    p_recipient_id: recipientId,
    p_item_id: itemId,
    p_provider: provider,
    p_idempotency_key: idempotencyKey,
    p_amount_cents: amountCents,
    p_currency: currency,
    p_gifted_to: giftedTo,
  });

  if (error) {
    throw new InfrastructureError(
      `[createAtomicCheckoutPurchase] RPC failed: ${error.message}`,
      error
    );
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.purchase_id) {
    throw new InfrastructureError("[createAtomicCheckoutPurchase] Missing purchase_id from RPC response");
  }

  return {
    purchaseId: String(row.purchase_id),
  };
}

export async function fulfillItemPurchase(
   developerId: number,
   itemId: string,
   supabaseAdminClient?: SupabaseClient
 ): Promise<{ status: "completed" | "delivered" }> {
   const service = new InventoryEconomyService(supabaseAdminClient);
   return service.fulfillPurchasedItem({ developerId, itemId, supabaseClient: supabaseAdminClient });
 } 
