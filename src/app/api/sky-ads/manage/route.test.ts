import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, PATCH, POST, PUT } from "./route";

const { mockGetUser, mockInsert, mockUpdate, mockFrom } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
  mockFrom: vi.fn(),
}));

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

describe("/api/sky-ads/manage route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({
      data: {
        user: {
          user_metadata: {
            user_name: "Ixotic27",
          },
        },
      },
    });

    mockInsert.mockReturnValue({
      select: () => ({
        single: async () => ({ data: { id: "ad-1" }, error: null }),
      }),
    });

    mockUpdate.mockReturnValue({
      eq: () => ({
        select: () => ({
          single: async () => ({ data: { id: "ad-1" }, error: null }),
        }),
      }),
      in: async () => ({ error: null }),
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "sky_ad_events") {
        return {
          delete: () => ({
            eq: async () => ({ error: null }),
            in: async () => ({ error: null }),
          }),
        };
      }

      return {
        insert: mockInsert,
        update: mockUpdate,
        delete: () => ({
          eq: async () => ({ error: null }),
          in: async () => ({ error: null }),
        }),
      };
    });
  });

  it("rejects create payloads with blocked content", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage", {
      method: "POST",
      body: JSON.stringify({
        id: "ad-1",
        brand: "Test Brand",
        text: "buy followers fast",
      }),
    });

    const response = await POST(request as unknown as Request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("Content contains prohibited language");
    expect(mockInsert).not.toHaveBeenCalled();
  });

  it("rejects update payloads with suspicious links", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage", {
      method: "PUT",
      body: JSON.stringify({
        id: "ad-1",
        link: "https://paypal.verify.com",
      }),
    });

    const response = await PUT(request as unknown as Request);

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toBe("This link is not allowed");
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("returns 403 when non-admin attempts create", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "other" } } } });
    const request = new Request("http://localhost/api/sky-ads/manage", {
      method: "POST",
      body: JSON.stringify({ id: "ad-1", brand: "B", text: "T" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "Forbidden" });
  });

  it("returns 400 when required fields are missing on create", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage", {
      method: "POST",
      body: JSON.stringify({ brand: "B", text: "T" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing required fields: id, brand, text" });
  });

  it("creates an ad successfully", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage", {
      method: "POST",
      body: JSON.stringify({ id: "ad-1", brand: "B", text: "T" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: "ad-1" });
  });

  it("returns 400 when updating without valid fields", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage", {
      method: "PUT",
      body: JSON.stringify({ id: "ad-1", unknown: "value" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "No valid fields to update" });
  });

  it("updates an ad successfully", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage", {
      method: "PUT",
      body: JSON.stringify({ id: "ad-1", text: "Updated" }),
    });

    const response = await PUT(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "ad-1" });
  });

  it("returns 400 when delete request is missing id", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage", { method: "DELETE" });
    const response = await DELETE(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing ad id" });
  });

  it("deletes an ad successfully", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage?id=ad-1", { method: "DELETE" });
    const response = await DELETE(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("returns 400 when batch action is missing ids", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage", {
      method: "PATCH",
      body: JSON.stringify({ action: "pause" }),
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Missing ids array" });
  });

  it("returns 400 when batch action is invalid", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage", {
      method: "PATCH",
      body: JSON.stringify({ ids: ["ad-1"], action: "invalid" }),
    });
    const response = await PATCH(request);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Invalid action. Use: pause, resume, delete" });
  });

  it("pauses ads successfully", async () => {
    const request = new Request("http://localhost/api/sky-ads/manage", {
      method: "PATCH",
      body: JSON.stringify({ ids: ["ad-1"], action: "pause" }),
    });
    const response = await PATCH(request);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, affected: 1 });
  });
});
