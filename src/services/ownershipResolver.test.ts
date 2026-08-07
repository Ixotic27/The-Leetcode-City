import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({ from: mockFrom })),
}));

import { OwnershipResolver } from "./ownershipResolver";

describe("OwnershipResolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats completed free purchases as owned but ignores zero-cost payment-provider rows", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "purchases") {
        return {
          select: () => ({
            or: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "p1", provider: "stripe", amount_cents: 0 }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const resolver = new OwnershipResolver();
    await expect(resolver.ownsItem(42, "flag")).resolves.toBe(false);
  });

  it("treats completed free rows as meaningful ownership", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "purchases") {
        return {
          select: () => ({
            or: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "p2", provider: "free", amount_cents: 0 }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const resolver = new OwnershipResolver();
    await expect(resolver.ownsItem(42, "flag")).resolves.toBe(true);
  });

  it("resolves gifted purchases to the recipient", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "purchases") {
        return {
          select: () => ({
            or: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: vi.fn().mockResolvedValue({ data: { id: "p3", provider: "stripe", amount_cents: 100 }, error: null }),
                }),
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const resolver = new OwnershipResolver();
    await expect(resolver.ownsItem(7, "crown")).resolves.toBe(true);
  });

  it("builds owned-item maps for multiple developers", async () => {
    const createQueryChain = (rows: Array<Record<string, unknown>>) => ({
      select: () => createQueryChain(rows),
      in: () => createQueryChain(rows),
      is: () => createQueryChain(rows),
      eq: () => Promise.resolve({ data: rows, error: null }),
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: null }),
      or: () => createQueryChain(rows),
      then: (resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => void) => resolve({ data: rows, error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "purchases") {
        const rows = [
          { developer_id: 1, item_id: "flag", provider: "free", amount_cents: 0 },
          { gifted_to: 2, item_id: "crown", provider: "stripe", amount_cents: 1200 },
          { developer_id: 1, item_id: "roof", provider: "stripe", amount_cents: 0 },
        ];
        return createQueryChain(rows);
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const resolver = new OwnershipResolver();
    const result = await resolver.buildOwnedItemsMap([1, 2]);

    expect(result).toEqual({
      1: ["flag"],
      2: ["crown"],
    });
  });
});
