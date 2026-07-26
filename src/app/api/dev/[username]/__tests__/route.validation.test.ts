import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "../route";

const { mockGetSupabaseAdmin } = vi.hoisted(() => ({
  mockGetSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: mockGetSupabaseAdmin,
}));

describe("/api/dev/[username] validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid username params before running business logic", async () => {
    const response = await GET(
      new Request("https://theleetcodecity.tech/api/dev/bad%20name"),
      { params: Promise.resolve({ username: "bad name" }) },
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({
      error: "Validation failed",
      details: [
        expect.objectContaining({
          field: "params.username",
        }),
      ],
    });
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid refresh query values", async () => {
    const response = await GET(
      new Request("https://theleetcodecity.tech/api/dev/rajdeep?refresh=maybe"),
      { params: Promise.resolve({ username: "rajdeep" }) },
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toMatchObject({
      error: "Validation failed",
      details: [
        expect.objectContaining({
          field: "query.refresh",
        }),
      ],
    });
    expect(mockGetSupabaseAdmin).not.toHaveBeenCalled();
  });
});
