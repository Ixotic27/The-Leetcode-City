import { describe, expect, it, vi, beforeEach } from "vitest";
import { POST } from "../route";

const mockGetUser = vi.fn();
const mockLookupDeveloper = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
    },
  })),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockLookupDeveloper }) }) }),
  })),
}));

vi.mock("@/lib/items", () => ({
  grantFreeClaimItem: vi.fn(),
}));

describe("/api/claim route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLookupDeveloper.mockResolvedValue({ data: null, error: null });
  });

  it("returns a GitHub-specific error when OAuth metadata has no login", async () => {
    mockGetUser.mockResolvedValueOnce({
      data: {
        user: {
          id: "user-without-github-login",
          user_metadata: {
            user_name: null,
            preferred_username: null,
          },
        },
      },
    });

    const response = await POST();
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe(
      "GitHub profile information could not be retrieved. Please log in again."
    );
    expect(json.error).not.toMatch(/leetcode username/i);
  });
});
