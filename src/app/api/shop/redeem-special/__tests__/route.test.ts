import { describe, it, expect, vi, beforeEach } from "vitest";
import { POST } from "../route";

// Mock supabase-server getUser
const mockGetUser = vi.fn();
vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

// Mock admin client
const mockFrom = vi.fn();
const mockRpc = vi.fn();
const mockAdminObj = {
  from: mockFrom,
  rpc: mockRpc,
};

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => mockAdminObj),
}));

describe("POST /api/shop/redeem-special - atomic RPC grant", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls RPC and returns granted items on success", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-uuid-123" } },
    });

    const mockDevelopersSelect = {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: 42, github_login: "test-dev" } }),
        }),
      }),
    };

    const mockSpecialCodesSelect = {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 99,
              code: "SPECIAL_CODE",
              expires_at: null,
              max_uses: 10,
              used_count: 5,
              type: "all_items",
            },
          }),
        }),
      }),
    };

    const mockSpecialCodeUsagesSelect = {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
    };

    const mockItemsSelect = {
      select: () => ({
        eq: async () => ({ data: [{ id: "item-1", name: "Item 1" }] }),
      }),
    };

    const mockPurchasesSelect = {
      select: () => ({
        eq: () => ({
          is: () => ({
            in: async () => ({ data: [] }),
          }),
        }),
      }),
    };

    mockRpc.mockResolvedValue({ error: null });

    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") return mockDevelopersSelect;
      if (table === "special_codes") return mockSpecialCodesSelect;
      if (table === "special_code_usages") return mockSpecialCodeUsagesSelect;
      if (table === "items") return mockItemsSelect;
      if (table === "purchases") return mockPurchasesSelect;
      return {};
    });

    const request = new Request("http://localhost/api/shop/redeem-special", {
      method: "POST",
      body: JSON.stringify({ code: "SPECIAL_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.granted_items).toEqual(["item-1"]);
    expect(mockRpc).toHaveBeenCalledWith("redeem_special_all_items", {
      p_code_id: 99,
      p_dev_id: 42,
      p_item_ids: ["item-1"],
      p_expected_used_count: 5,
    });
  });

  it("handles RPC optimistic lock failure gracefully", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-uuid-123" } },
    });

    const mockDevelopersSelect = {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: 42, github_login: "test-dev" } }),
        }),
      }),
    };

    const mockSpecialCodesSelect = {
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: {
              id: 99,
              code: "SPECIAL_CODE",
              expires_at: null,
              max_uses: 10,
              used_count: 5,
              type: "all_items",
            },
          }),
        }),
      }),
    };

    const mockSpecialCodeUsagesSelect = {
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({ data: null }),
          }),
        }),
      }),
    };

    const mockItemsSelect = {
      select: () => ({
        eq: async () => ({ data: [{ id: "item-1", name: "Item 1" }] }),
      }),
    };

    const mockPurchasesSelect = {
      select: () => ({
        eq: () => ({
          is: () => ({
            in: async () => ({ data: [] }),
          }),
        }),
      }),
    };

    mockRpc.mockResolvedValue({
      error: { message: "redeem_special_optimistic_lock_failed" },
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") return mockDevelopersSelect;
      if (table === "special_codes") return mockSpecialCodesSelect;
      if (table === "special_code_usages") return mockSpecialCodeUsagesSelect;
      if (table === "items") return mockItemsSelect;
      if (table === "purchases") return mockPurchasesSelect;
      return {};
    });

    const request = new Request("http://localhost/api/shop/redeem-special", {
      method: "POST",
      body: JSON.stringify({ code: "SPECIAL_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
    const json = await response.json();
    expect(json.error).toBe("Failed to grant items. Please try again.");
  });
});
