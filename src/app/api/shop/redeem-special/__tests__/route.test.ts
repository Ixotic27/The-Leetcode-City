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
const mockAdminObj = {
  from: mockFrom,
};

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => mockAdminObj),
}));

describe("POST /api/shop/redeem-special - concurrency rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("performs rollback when update affects 0 rows", async () => {
    // 1. Mock getUser to return valid user
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-uuid-123" } },
    });

    // 2. Mock database calls
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
            eq: async () => ({ data: [] }),
          }),
        }),
      }),
    };

    const mockSpecialCodeUsagesInsert = {
      insert: async () => ({ error: null }),
    };

    const mockPurchasesInsert = {
      insert: async () => ({ error: null }),
    };

    const mockSpecialCodesUpdate = {
      update: () => ({
        eq: () => ({
          eq: () => ({
            select: async () => ({ data: [] }), // 0 rows updated
          }),
        }),
      }),
    };

    const mockSpecialCodeUsagesDelete = {
      delete: () => ({
        eq: () => ({
          eq: async () => ({ error: null }),
        }),
      }),
    };

    const mockPurchasesDelete = {
      delete: () => ({
        in: async () => ({ error: null }),
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") return mockDevelopersSelect;
      if (table === "special_codes") {
        return {
          ...mockSpecialCodesSelect,
          ...mockSpecialCodesUpdate,
        };
      }
      if (table === "special_code_usages") {
        return {
          ...mockSpecialCodeUsagesSelect,
          ...mockSpecialCodeUsagesInsert,
          ...mockSpecialCodeUsagesDelete,
        };
      }
      if (table === "items") return mockItemsSelect;
      if (table === "purchases") {
        return {
          ...mockPurchasesSelect,
          ...mockPurchasesInsert,
          ...mockPurchasesDelete,
        };
      }
      return {};
    });

    const request = new Request("http://localhost/api/shop/redeem-special", {
      method: "POST",
      body: JSON.stringify({ code: "SPECIAL_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("Code could not be redeemed. Please try again.");
  });
});
