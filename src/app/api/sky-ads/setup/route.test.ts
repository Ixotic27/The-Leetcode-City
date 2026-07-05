import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mockFrom = vi.fn();
const mockRateLimit = vi.fn(async (..._args: any[]) => ({ ok: true }));
vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: mockFrom,
  })),
}));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: any[]) => mockRateLimit(...args),
}));

type SkyAdsResponse = {
  data: { id: string; active: boolean } | null;
};

let mockAdResponse: SkyAdsResponse;

const buildSkyAdsFrom = () => ({
  select: () => ({
    eq: () => ({
      maybeSingle: async (): Promise<SkyAdsResponse> => mockAdResponse,
    }),
  }),
  update: () => ({
    eq: async () => ({ error: null }),
  }),
});

describe("/api/sky-ads/setup route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRateLimit.mockResolvedValue({ ok: true });
    mockAdResponse = { data: { id: "ad-1", active: true } };
    mockFrom.mockImplementation((table: string) => {
      if (table === "sky_ads") return buildSkyAdsFrom();
      return {} as unknown;
    });
  });

  it("returns 400 when token is invalid", async () => {
    const request = new NextRequest("http://localhost/api/sky-ads/setup", {
      method: "POST",
      body: JSON.stringify({ token: "short" }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Invalid token" });
  });

  it("returns 404 when ad is not found", async () => {
    mockAdResponse = { data: null };
    const request = new NextRequest("http://localhost/api/sky-ads/setup", {
      method: "POST",
      body: JSON.stringify({ token: "validtoken123" }),
    });

    const res = await POST(request);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Ad not found" });
  });

  it("returns ok when no update fields are provided", async () => {
    const request = new NextRequest("http://localhost/api/sky-ads/setup", {
      method: "POST",
      body: JSON.stringify({ token: "validtoken123" }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("returns 400 when brand contains blocked content", async () => {
    const request = new NextRequest("http://localhost/api/sky-ads/setup", {
      method: "POST",
      body: JSON.stringify({
        token: "validtoken123",
        brand: "Free money Brand",
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Content contains prohibited language" });
  });

  it("returns 400 when link is invalid", async () => {
    const request = new NextRequest("http://localhost/api/sky-ads/setup", {
      method: "POST",
      body: JSON.stringify({
        token: "validtoken123",
        link: "http://example.com",
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Link must start with https:// or mailto:" });
  });

  it("updates ad text successfully", async () => {
    const request = new NextRequest("http://localhost/api/sky-ads/setup", {
      method: "POST",
      body: JSON.stringify({
        token: "validtoken123",
        text: "New text",
      }),
    });

    const res = await POST(request);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
