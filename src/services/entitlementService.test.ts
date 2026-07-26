import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({ from: mockFrom })),
}));

import { EntitlementService } from "./entitlementService";

describe("EntitlementService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats completed purchases as owned and ignores zero-cost payment providers", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "purchases") {
        return {
          select: () => ({
            or: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "p1", provider: "stripe", amount_cents: 0 } }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const service = new EntitlementService();
    await expect(service.ownsItem(42, "flag")).resolves.toBe(false);
  });

  it("checks inventory ownership for arcade items", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "arcade_inventory") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { item_id: "pet_dragon" } }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const service = new EntitlementService();
    await expect(service.ownsInventoryItem(42, "pet_dragon", { inventoryTable: "arcade_inventory" })).resolves.toBe(true);
  });

  it("evaluates mixed ownership checks in a single call", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "purchases") {
        return {
          select: () => ({
            or: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "p1", provider: "stripe", amount_cents: 100 } }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === "arcade_inventory") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: vi.fn().mockResolvedValue({ data: { item_id: "pet_dragon" } }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const service = new EntitlementService();
    const result = await service.evaluate({ developerId: 42, itemIds: ["flag", "pet_dragon"], inventoryTable: "arcade_inventory" });

    expect(result.owned).toEqual(["flag", "pet_dragon"]);
    expect(result.missing).toEqual([]);
  });
});
