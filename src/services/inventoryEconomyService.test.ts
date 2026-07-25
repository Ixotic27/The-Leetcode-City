import { describe, it, expect, vi } from "vitest";
import { InventoryEconomyService } from "./inventoryEconomyService";

describe("InventoryEconomyService", () => {
  it("records a reward grant as a completed purchase row", async () => {
    const service = new InventoryEconomyService();
    const upsert = vi.fn().mockResolvedValue({ data: [{ id: "purchase-1" }], error: null });
    const sb = {
      from: vi.fn(() => ({
        upsert,
      })),
    } as never;

    const result = await service.grantRewardItem({
      developerId: 7,
      itemId: "flag",
      providerTxId: "reward-flag",
      supabaseClient: sb,
    });

    expect(result).toEqual({ granted: true });
    expect(upsert).toHaveBeenCalledWith(
      {
        developer_id: 7,
        item_id: "flag",
        provider: "free",
        provider_tx_id: "reward-flag",
        amount_cents: 0,
        currency: "usd",
        status: "completed",
      },
      { onConflict: "provider_tx_id", ignoreDuplicates: true }
    );
  });

  it("fulfills battle consumables through the shared grant_consumable flow", async () => {
    const service = new InventoryEconomyService();
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { category: "consumable" }, error: null }),
    });

    const sb = {
      from,
      rpc,
    } as never;

    const result = await service.fulfillPurchasedItem({
      developerId: 3,
      itemId: "emp_device",
      supabaseClient: sb,
    });

    expect(result).toEqual({ status: "delivered" });
    expect(rpc).toHaveBeenCalledWith("grant_consumable", {
      p_developer_id: 3,
      p_item_id: "emp_device",
    });
  });
});
