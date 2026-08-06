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

describe("POST /api/shop/redeem - atomic RPC shop code redemption", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default mock implementation for developers table
    const mockDevelopersSelect = {
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { id: 42, claimed: true } }),
        }),
      }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") return mockDevelopersSelect;
      return {};
    });
  });

  it("returns 401 if user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });

    const request = new Request("http://localhost/api/shop/redeem", {
      method: "POST",
      body: JSON.stringify({ code: "TEST_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
    const json = await response.json();
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 400 if code is missing", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    const request = new Request("http://localhost/api/shop/redeem", {
      method: "POST",
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("No code provided");
  });

  it("returns 403 if developer account is not linked or claimed", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    // Override default mock to return null developer
    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: null }),
            }),
          }),
        };
      }
      return {};
    });

    const request = new Request("http://localhost/api/shop/redeem", {
      method: "POST",
      body: JSON.stringify({ code: "TEST_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    const json = await response.json();
    expect(json.error).toBe("You must claim your building first to redeem codes.");
  });

  it("calls RPC and returns granted item details on success", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    mockRpc.mockResolvedValue({
      data: [{ ok: true, error_code: null, item_id: "neon_outline", item_name: "Neon Outline" }],
      error: null,
    });

    const request = new Request("http://localhost/api/shop/redeem", {
      method: "POST",
      body: JSON.stringify({ code: "TEST_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.success).toBe(true);
    expect(json.item_id).toBe("neon_outline");
    expect(json.item_name).toBe("Neon Outline");
    expect(mockRpc).toHaveBeenCalledWith("redeem_shop_code", {
      p_code: "TEST_CODE",
      p_developer_id: 42,
    });
  });

  it("handles RPC optimistic lock exception gracefully", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "redeem_optimistic_lock_failed" },
    });

    const request = new Request("http://localhost/api/shop/redeem", {
      method: "POST",
      body: JSON.stringify({ code: "TEST_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("This code has already been fully used.");
  });

  it("maps rpc error_code invalid_code to 404", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    mockRpc.mockResolvedValue({
      data: [{ ok: false, error_code: "invalid_code" }],
      error: null,
    });

    const request = new Request("http://localhost/api/shop/redeem", {
      method: "POST",
      body: JSON.stringify({ code: "TEST_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
    const json = await response.json();
    expect(json.error).toBe("Invalid or expired code.");
  });

  it("maps rpc error_code expired_code to 410", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    mockRpc.mockResolvedValue({
      data: [{ ok: false, error_code: "expired_code" }],
      error: null,
    });

    const request = new Request("http://localhost/api/shop/redeem", {
      method: "POST",
      body: JSON.stringify({ code: "TEST_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(410);
    const json = await response.json();
    expect(json.error).toBe("This code has expired.");
  });

  it("maps rpc error_code fully_used_code to 409", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    mockRpc.mockResolvedValue({
      data: [{ ok: false, error_code: "fully_used_code" }],
      error: null,
    });

    const request = new Request("http://localhost/api/shop/redeem", {
      method: "POST",
      body: JSON.stringify({ code: "TEST_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe("This code has already been fully used.");
  });

  it("maps rpc error_code item_not_available to 410", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    mockRpc.mockResolvedValue({
      data: [{ ok: false, error_code: "item_not_available" }],
      error: null,
    });

    const request = new Request("http://localhost/api/shop/redeem", {
      method: "POST",
      body: JSON.stringify({ code: "TEST_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(410);
    const json = await response.json();
    expect(json.error).toBe("The item linked to this code is no longer available.");
  });

  it("maps rpc error_code already_owned to 409", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-123" } },
    });

    mockRpc.mockResolvedValue({
      data: [{ ok: false, error_code: "already_owned", item_name: "Crown Aura" }],
      error: null,
    });

    const request = new Request("http://localhost/api/shop/redeem", {
      method: "POST",
      body: JSON.stringify({ code: "TEST_CODE" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(409);
    const json = await response.json();
    expect(json.error).toBe('You already own "Crown Aura".');
  });
});
