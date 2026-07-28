import { beforeEach, describe, expect, it, vi } from "vitest";

const { authUser, mockGetUser, mockRateLimit, mockFrom, mockRpc } = vi.hoisted(
  () => ({
    authUser: { id: "user-1" },
    mockGetUser: vi
      .fn()
      .mockResolvedValue({ data: { user: { id: "user-1" } } }),
    mockRateLimit: vi.fn().mockResolvedValue({ ok: true }),
    mockFrom: vi.fn(),
    mockRpc: vi.fn(),
  }),
);

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(async () => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: Parameters<typeof mockRateLimit>) =>
    mockRateLimit(...args),
}));

import { POST } from "../buy-with-points/route";

describe("POST /api/shop/buy-with-points", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockRateLimit.mockResolvedValue({ ok: true });
    mockGetUser.mockResolvedValue({ data: { user: authUser } });

    const developerChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({
          data: { id: 7, github_login: "alice", points: 100 },
          error: null,
        }),
    };
    const itemChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({
          data: {
            id: "flag",
            name: "Flag",
            price_points: 50,
            category: "identity",
          },
          error: null,
        }),
    };
    const purchasesChain = {
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: 11 }, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    };
    const activityFeedChain = {
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    };

    mockFrom.mockImplementation((table: string) => {
      if (table === "developers") return developerChain;
      if (table === "items") return itemChain;
      if (table === "purchases") return purchasesChain;
      if (table === "activity_feed") return activityFeedChain;
      throw new Error(`Unexpected table ${table}`);
    });
  });

  it("completes a points purchase through the atomic RPC", async () => {
    const rpcChain = {
      select: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({
          data: {
            ok: true,
            error_code: null,
            purchase_id: 11,
            status: "completed",
            points_remaining: 50,
          },
          error: null,
        }),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: {
            ok: true,
            error_code: null,
            purchase_id: 11,
            status: "completed",
            points_remaining: 50,
          },
          error: null,
        }),
    };
    mockRpc.mockReturnValue(rpcChain);

    const response = await POST(
      new Request("http://localhost/api/shop/buy-with-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "key-1",
        },
        body: JSON.stringify({ item_id: "flag" }),
      }),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(json.points_remaining).toBe(50);
    expect(mockRpc).toHaveBeenCalledWith(
      "finalize_points_purchase",
      expect.objectContaining({
        p_purchase_id: 11,
        p_developer_id: 7,
        p_item_id: "flag",
        p_price_points: 50,
        p_is_dev: false,
        p_github_login: "alice",
      }),
    );
  });

  it("returns a 409 when the atomic RPC reports insufficient points", async () => {
    const rpcChain = {
      select: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({
          data: {
            ok: false,
            error_code: "not_enough_points",
            purchase_id: null,
            status: null,
            points_remaining: null,
          },
          error: null,
        }),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: {
            ok: false,
            error_code: "not_enough_points",
            purchase_id: null,
            status: null,
            points_remaining: null,
          },
          error: null,
        }),
    };
    mockRpc.mockReturnValue(rpcChain);

    const response = await POST(
      new Request("http://localhost/api/shop/buy-with-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "key-4",
        },
        body: JSON.stringify({ item_id: "flag" }),
      }),
    );

    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe(
      "Not enough points or a concurrent purchase already deducted your balance. Please try again.",
    );
  });

  it("returns a 500 when the atomic RPC reports a purchase-finalization failure", async () => {
    const rpcChain = {
      select: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({
          data: {
            ok: false,
            error_code: "grant_failed",
            purchase_id: null,
            status: null,
            points_remaining: null,
          },
          error: null,
        }),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: {
            ok: false,
            error_code: "grant_failed",
            purchase_id: null,
            status: null,
            points_remaining: null,
          },
          error: null,
        }),
    };
    mockRpc.mockReturnValue(rpcChain);

    const response = await POST(
      new Request("http://localhost/api/shop/buy-with-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "key-2",
        },
        body: JSON.stringify({ item_id: "flag" }),
      }),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Failed to grant item");
  });

  it("returns a 500 when the atomic RPC reports a purchase-finalization failure", async () => {
    const rpcChain = {
      select: vi.fn().mockReturnThis(),
      single: vi
        .fn()
        .mockResolvedValue({
          data: {
            ok: false,
            error_code: "purchase_failed",
            purchase_id: null,
            status: null,
            points_remaining: null,
          },
          error: null,
        }),
      maybeSingle: vi
        .fn()
        .mockResolvedValue({
          data: {
            ok: false,
            error_code: "purchase_failed",
            purchase_id: null,
            status: null,
            points_remaining: null,
          },
          error: null,
        }),
    };
    mockRpc.mockReturnValue(rpcChain);

    const response = await POST(
      new Request("http://localhost/api/shop/buy-with-points", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "key-3",
        },
        body: JSON.stringify({ item_id: "flag" }),
      }),
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error).toBe("Failed to complete purchase");
  });
});
