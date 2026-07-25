import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveAuthenticatedDeveloper } from "../authenticated-developer";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

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

describe("resolveAuthenticatedDeveloper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns an unauthenticated result when auth is optional and no user exists", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await resolveAuthenticatedDeveloper({ requireAuth: false });

    expect(result.ok).toBe(true);
    expect(result.authenticated).toBe(false);
    expect(result.user).toBeNull();
    expect(result.developer).toBeNull();
    expect(result.status).toBe(200);
  });

  it("returns a structured error when authentication is required", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

    const result = await resolveAuthenticatedDeveloper({ requireAuth: true });

    expect(result.ok).toBe(false);
    expect(result.authenticated).toBe(false);
    expect(result.error).toBe("Not authenticated");
    expect(result.status).toBe(401);
  });

  it("resolves the owning developer record for an authenticated user", async () => {
    mockGetUser.mockResolvedValueOnce({ data: { user: { id: "user-123" } }, error: null });
    mockFrom.mockReturnValueOnce({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: { id: 42, github_login: "test-user", claimed: true },
            error: null,
          }),
        }),
      }),
    });

    const result = await resolveAuthenticatedDeveloper({ select: "id, github_login, claimed" });

    expect(result.ok).toBe(true);
    expect(result.authenticated).toBe(true);
    expect(result.user?.id).toBe("user-123");
    expect(result.developer?.id).toBe(42);
    expect(result.developer?.github_login).toBe("test-user");
    expect(result.status).toBe(200);
  });
});
