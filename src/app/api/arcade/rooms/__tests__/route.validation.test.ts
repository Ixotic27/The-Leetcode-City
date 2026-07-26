import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const { mockGetSupabaseAdmin } = vi.hoisted(() => ({
  mockGetSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: mockGetSupabaseAdmin,
}));

describe("/api/arcade/rooms validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for out-of-range pagination query values", async () => {
    const response = await GET(
      new Request("https://theleetcodecity.tech/api/arcade/rooms?page=0&limit=200") as never,
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({
      error: "Validation failed",
      details: expect.arrayContaining([
        expect.objectContaining({ field: "query.page" }),
        expect.objectContaining({ field: "query.limit" }),
      ]),
    });
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });
});
