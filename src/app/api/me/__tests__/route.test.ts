import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

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

describe("/api/me route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null values when not authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null } });
    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.leetcode_username).toBeNull();
    expect(json.claimed).toBe(false);
  });

  it("returns developer details and customizations when authenticated", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } } });

    // Mock query logic
    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: async () => ({
                  data: {
                    id: 99,
                    github_login: "test-user",
                    claimed: true,
                    xp_level: 4,
                    xp_total: 1000,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }
      if (table === "developer_customizations") {
        return {
          select: () => ({
            eq: () => ({
              in: () => ({
                data: [
                  { item_id: "custom_color", config: { color: "#ff0000" } },
                  { item_id: "building_style", config: { style: "bungalow" } },
                ],
                error: null,
              }),
            }),
          }),
        };
      }
      return {};
    });

    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.leetcode_username).toBe("test-user");
    expect(json.claimed).toBe(true);
    expect(json.xp_level).toBe(4);
    expect(json.xp_total).toBe(1000);
    expect(json.developer_id).toBe(99);
    expect(json.customizations).toEqual({
      custom_color: { color: "#ff0000" },
      building_style: { style: "bungalow" },
    });
  });
});
