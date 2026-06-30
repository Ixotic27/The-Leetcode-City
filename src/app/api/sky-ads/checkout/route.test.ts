import { describe, it, expect, beforeEach, vi } from "vitest";
import { MAX_TEXT_LENGTH } from "@/lib/skyAds";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockRateLimit = vi.fn(async () => ({ ok: true }));
const mockCreateSession = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
  })),
}));

vi.mock("@/lib/base-url", () => ({
  getBaseUrl: vi.fn(() => "https://localhost"),
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: vi.fn(() => ({
    checkout: {
      sessions: {
        create: mockCreateSession,
      },
    },
  })),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: Parameters<typeof mockRateLimit>) => mockRateLimit(...args),
}));

import { POST } from "./route";

describe("/api/sky-ads/checkout route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: null } });
    mockRateLimit.mockResolvedValue({ ok: true });
    mockCreateSession.mockResolvedValue({ id: "sess_123", url: "https://stripe.com/checkout" });

    mockFrom.mockImplementation(() => ({
      insert: async () => ({ error: null }),
      update: () => ({
        eq: async () => ({ error: null }),
      }),
    }));
  });

  it("returns 400 for an invalid plan", async () => {
    const request = new Request("http://localhost/api/sky-ads/checkout", {
      method: "POST",
      body: JSON.stringify({
        plan_id: "invalid_plan",
        text: "Hello world",
        color: "#ffffff",
        bgColor: "#000000",
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid plan" });
  });

  it("returns 400 for blocked ad text", async () => {
    const request = new Request("http://localhost/api/sky-ads/checkout", {
      method: "POST",
      body: JSON.stringify({
        plan_id: "plane_weekly",
        text: "Free money guaranteed",
        color: "#ffffff",
        bgColor: "#000000",
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Content contains prohibited language" });
  });

  it("returns 400 for invalid JSON payload", async () => {
    const request = new Request("http://localhost/api/sky-ads/checkout", {
      method: "POST",
      body: "not-json",
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid JSON" });
  });

  it("creates a Stripe checkout session on success", async () => {
    const request = new Request("http://localhost/api/sky-ads/checkout", {
      method: "POST",
      body: JSON.stringify({
        plan_id: "plane_weekly",
        text: "Hello LeetCode City",
        color: "#ffffff",
        bgColor: "#000000",
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: "https://stripe.com/checkout" });
    expect(mockCreateSession).toHaveBeenCalled();
  });

  it("returns 400 when text exceeds the maximum length", async () => {
    const request = new Request("http://localhost/api/sky-ads/checkout", {
      method: "POST",
      body: JSON.stringify({
        plan_id: "plane_weekly",
        text: "A".repeat(MAX_TEXT_LENGTH + 1),
        color: "#ffffff",
        bgColor: "#000000",
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: `Text must be ${MAX_TEXT_LENGTH} characters or less`,
    });
  });
});
