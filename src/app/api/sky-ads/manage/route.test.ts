import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST, PUT } from "./route";

const { mockGetUser, mockInsert, mockUpdate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockInsert: vi.fn(),
  mockUpdate: vi.fn(),
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
    from: vi.fn(() => ({
      insert: mockInsert,
      update: mockUpdate,
    })),
  })),
}));

describe("/api/sky-ads/manage route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { user_metadata: { user_name: "Ixotic27" } } } });

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
});
