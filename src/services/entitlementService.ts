import { getSupabaseAdmin } from "@/lib/supabase";

export interface EntitlementEvaluationOptions {
  developerId: number;
  itemIds: string[];
  inventoryTable?: string;
  purchasesTable?: string;
}

export interface EntitlementEvaluationResult {
  owned: string[];
  missing: string[];
}

export interface EntitlementQueryOptions {
  inventoryTable?: string;
  purchasesTable?: string;
  ownerColumn?: string;
}

interface PurchaseRow {
  id?: string | number;
  provider?: string | null;
  amount_cents?: number | null;
  item_id?: string;
}

interface SupabaseSingleResponse<T> {
  data: T | null;
  error: unknown;
}

export class EntitlementService {
  private readonly admin = getSupabaseAdmin();

  async ownsItem(
    developerId: number,
    itemId: string,
    options: EntitlementQueryOptions = {}
  ): Promise<boolean> {
    const row = await this.fetchPurchaseRow(developerId, itemId, options.purchasesTable);
    if (!row) return false;
    return this.isMeaningfulPurchase(row);
  }

  async ownsInventoryItem(
    developerId: number,
    itemId: string,
    options: EntitlementQueryOptions = {}
  ): Promise<boolean> {
    const inventoryTable = options.inventoryTable ?? "arena_inventory";
    const { data, error } = await this.admin
      .from(inventoryTable)
      .select("id")
      .eq(options.ownerColumn ?? "developer_id", developerId)
      .eq("item_id", itemId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  async hasEntitlement(
    developerId: number,
    itemId: string,
    options: EntitlementQueryOptions = {}
  ): Promise<boolean> {
    if (options.inventoryTable) {
      try {
        const inventoryOwned = await this.ownsInventoryItem(developerId, itemId, options);
        if (inventoryOwned) return true;
      } catch {
        // Fall back to purchase ownership below.
      }
    }

    return this.ownsItem(developerId, itemId, options);
  }

  async canAccess(
    developerId: number,
    itemId: string,
    options: EntitlementQueryOptions = {}
  ): Promise<boolean> {
    return this.hasEntitlement(developerId, itemId, options);
  }

  async evaluate(
    options: EntitlementEvaluationOptions
  ): Promise<EntitlementEvaluationResult> {
    const owned: string[] = [];
    const missing: string[] = [];

    for (const itemId of options.itemIds) {
      const isOwned = await this.hasEntitlement(options.developerId, itemId, {
        inventoryTable: options.inventoryTable,
        purchasesTable: options.purchasesTable,
      });

      if (isOwned) {
        owned.push(itemId);
      } else {
        missing.push(itemId);
      }
    }

    return { owned, missing };
  }

  async listOwnedItems(
    developerId: number,
    options: EntitlementQueryOptions = {}
  ): Promise<string[]> {
    if (options.inventoryTable) {
      const { data, error } = await this.admin
        .from(options.inventoryTable)
        .select("item_id")
        .eq(options.ownerColumn ?? "developer_id", developerId);

      if (error) {
        throw error;
      }

      return (data ?? []).map((row) => row.item_id as string);
    }

    const { data, error } = await this.admin
      .from(options.purchasesTable ?? "purchases")
      .select("item_id, provider, amount_cents")
      .or(`developer_id.eq.${developerId},gifted_to.eq.${developerId}`)
      .eq("status", "completed");

    if (error) {
      throw error;
    }

    return (data ?? [])
      .filter((row) => this.isMeaningfulPurchase(row))
      .map((row) => row.item_id as string);
  }

  private async fetchPurchaseRow(
    developerId: number,
    itemId: string,
    purchasesTable = "purchases"
  ): Promise<PurchaseRow | null> {
    const baseQuery = this.admin.from(purchasesTable)
      .select("id, provider, amount_cents");

    const query = typeof baseQuery.or === "function"
      ? baseQuery.or(`developer_id.eq.${developerId},gifted_to.eq.${developerId}`).eq("item_id", itemId).eq("status", "completed")
      : baseQuery.eq("item_id", itemId).eq("status", "completed");

    const maybeSingleResult = query.maybeSingle
      ? await query.maybeSingle()
      : await query;

    if (maybeSingleResult && typeof maybeSingleResult === "object" && "data" in maybeSingleResult) {
      const response = maybeSingleResult as SupabaseSingleResponse<PurchaseRow | null>;
      if (response.error) {
        throw response.error;
      }
      return response.data ?? null;
    }

    return maybeSingleResult as PurchaseRow | null | undefined ?? null;
  }

  private isMeaningfulPurchase(row: PurchaseRow | null): boolean {
    if (!row) return false;
    if (row.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(row.provider ?? "")) {
      return false;
    }
    return true;
  }
}
