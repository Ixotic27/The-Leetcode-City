import { getSupabaseAdmin } from "@/lib/supabase";

interface PurchaseRow {
  id?: string | number;
  provider?: string | null;
  amount_cents?: number | null;
  item_id?: string;
  developer_id?: number | string | null;
  gifted_to?: number | string | null;
}

interface InventoryRow {
  item_id?: string;
  developer_id?: number | string | null;
  user_id?: number | string | null;
}

export class OwnershipResolver {
  private readonly admin = getSupabaseAdmin();

  async ownsItem(developerId: number, itemId: string, options: { purchasesTable?: string; inventoryTable?: string; ownerColumn?: string } = {}): Promise<boolean> {
    const purchaseRow = await this.fetchPurchaseRow(developerId, itemId, options.purchasesTable);
    if (purchaseRow) {
      return this.isMeaningfulPurchase(purchaseRow);
    }

    if (options.inventoryTable) {
      const inventoryRow = await this.fetchInventoryRow(developerId, itemId, options.inventoryTable, options.ownerColumn);
      return Boolean(inventoryRow);
    }

    return false;
  }

  async ownsInventoryItem(developerId: number, itemId: string, options: { inventoryTable?: string; ownerColumn?: string } = {}): Promise<boolean> {
    const inventoryTable = options.inventoryTable ?? "arena_inventory";
    const inventoryRow = await this.fetchInventoryRow(developerId, itemId, inventoryTable, options.ownerColumn);
    return Boolean(inventoryRow);
  }

  async listOwnedItems(developerId: number, options: { purchasesTable?: string; inventoryTable?: string; ownerColumn?: string } = {}): Promise<string[]> {
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
      .filter((row) => this.isMeaningfulPurchase(row as PurchaseRow))
      .map((row) => row.item_id as string);
  }

  async buildOwnedItemsMap(developerIds: number[], options: { purchasesTable?: string; inventoryTable?: string; ownerColumn?: string } = {}): Promise<Record<number, string[]>> {
    if (developerIds.length === 0) {
      return {};
    }

    const result: Record<number, string[]> = {};

    const { data, error } = await this.admin
      .from(options.purchasesTable ?? "purchases")
      .select("developer_id, gifted_to, item_id, provider, amount_cents")
      .in("developer_id", developerIds)
      .is("gifted_to", null)
      .eq("status", "completed");

    if (error) {
      throw error;
    }

    for (const row of data ?? []) {
      const purchase = row as PurchaseRow;
      if (!this.isMeaningfulPurchase(purchase)) {
        continue;
      }
      const devId = this.coerceDeveloperId(purchase.developer_id);
      if (devId === null) {
        continue;
      }
      if (!result[devId]) result[devId] = [];
      result[devId].push(String(purchase.item_id));
    }

    const { data: giftData, error: giftError } = await this.admin
      .from(options.purchasesTable ?? "purchases")
      .select("developer_id, gifted_to, item_id, provider, amount_cents")
      .in("gifted_to", developerIds)
      .eq("status", "completed");

    if (giftError) {
      throw giftError;
    }

    for (const row of giftData ?? []) {
      const purchase = row as PurchaseRow;
      if (!this.isMeaningfulPurchase(purchase)) {
        continue;
      }
      const devId = this.coerceDeveloperId(purchase.gifted_to);
      if (devId === null) {
        continue;
      }
      if (!result[devId]) result[devId] = [];
      result[devId].push(String(purchase.item_id));
    }

    if (options.inventoryTable) {
      const { data: inventoryData, error: inventoryError } = await this.admin
        .from(options.inventoryTable)
        .select("developer_id, user_id, item_id")
        .in(options.ownerColumn ?? "developer_id", developerIds);

      if (inventoryError) {
        throw inventoryError;
      }

      for (const row of inventoryData ?? []) {
        const inventoryRow = row as InventoryRow;
        const devId = this.resolveInventoryDeveloperId(inventoryRow, options.ownerColumn);
        if (!devId) continue;
        if (!result[devId]) result[devId] = [];
        result[devId].push(String(inventoryRow.item_id));
      }
    }

    return result;
  }

  private async fetchPurchaseRow(developerId: number, itemId: string, purchasesTable = "purchases"): Promise<PurchaseRow | null> {
    const baseQuery = this.admin.from(purchasesTable)
      .select("id, provider, amount_cents");

    const query = typeof baseQuery.or === "function"
      ? baseQuery.or(`developer_id.eq.${developerId},gifted_to.eq.${developerId}`).eq("item_id", itemId).eq("status", "completed")
      : baseQuery.eq("item_id", itemId).eq("status", "completed");

    const maybeSingleResult = query.maybeSingle
      ? await query.maybeSingle()
      : await query;

    if (maybeSingleResult && typeof maybeSingleResult === "object" && "data" in maybeSingleResult) {
      const response = maybeSingleResult as { data: PurchaseRow | null; error?: unknown };
      if (response.error) {
        throw response.error;
      }
      return response.data ?? null;
    }

    return maybeSingleResult as PurchaseRow | null | undefined ?? null;
  }

  private async fetchInventoryRow(developerId: number, itemId: string, inventoryTable: string, ownerColumn = "developer_id"): Promise<InventoryRow | null> {
    const { data, error } = await this.admin
      .from(inventoryTable)
      .select("item_id, developer_id")
      .eq(ownerColumn, developerId)
      .eq("item_id", itemId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? (data as InventoryRow) : null;
  }

  private resolveInventoryDeveloperId(row: InventoryRow, ownerColumn?: string): number | null {
    if (ownerColumn && ownerColumn !== "developer_id") {
      const value = row[ownerColumn as keyof InventoryRow];
      return this.coerceDeveloperId(value);
    }

    return this.coerceDeveloperId(row.developer_id);
  }

  private coerceDeveloperId(value: number | string | null | undefined): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return null;
  }

  private isMeaningfulPurchase(row: PurchaseRow | null): boolean {
    if (!row) return false;
    if (row.amount_cents === 0 && ["stripe", "cashfree", "abacatepay", "nowpayments"].includes(row.provider ?? "")) {
      return false;
    }
    return true;
  }
}
