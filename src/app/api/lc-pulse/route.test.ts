import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();
const mockGetSupabaseAdmin = vi.fn(() => ({ from: mockFrom }));

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => mockGetSupabaseAdmin(),
}));

import { POST } from "./route";

type DevRow = { id: number; github_login: string; contributions: number };

const DEV: DevRow = { id: 1, github_login: "leetcoder", contributions: 42 };

/** Stubs the `developers` lookup/update and the `activity_feed` insert. */
function createAdmin(dev: DevRow | null) {
  const update = vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) }));
  const insert = vi.fn().mockResolvedValue({ error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === "developers") {
      const query = {
        select: () => query,
        eq: () => query,
        maybeSingle: vi.fn().mockResolvedValue({ data: dev }),
        update,
      };
      return query;
    }

    if (table === "activity_feed") {
      return { insert };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { update, insert };
}

/** Stubs the LeetCode GraphQL call with the given accepted submissions. */
function stubLeetCode(submissions: Array<{ title: string; lang: string; timestamp: number }>) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { recentAcSubmissionList: submissions } }),
    })
  );
}

describe("POST /api/lc-pulse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    mockGetSupabaseAdmin.mockImplementation(() => ({ from: mockFrom }));
    stubLeetCode([]);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("reports presence and forbids caching on success", async () => {
    const { update } = createAdmin(DEV);

    const response = await POST();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      active: false,
      username: "leetcoder",
      recent_solves: 0,
    });
    expect(update).toHaveBeenCalledOnce();
  });

  it("does not allow unauthenticated responses to be cached", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const response = await POST();

    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Not authenticated" });
  });

  it("does not allow the unlinked-account response to be cached", async () => {
    createAdmin(null);

    const response = await POST();

    expect(response.status).toBe(404);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "No linked GitHub account" });
  });

  it("surfaces the message when a real Error is thrown", async () => {
    mockGetSupabaseAdmin.mockImplementation(() => {
      throw new Error("database unavailable");
    });

    const response = await POST();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "database unavailable" });
  });

  it("falls back to a generic message when a non-Error value is thrown", async () => {
    mockGetSupabaseAdmin.mockImplementation(() => {
      throw "connection reset";
    });

    const response = await POST();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    // Previously `err.message` was `undefined`, serialising to a bare `{}`.
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });

  it("still returns JSON when a nullish value is thrown", async () => {
    mockGetSupabaseAdmin.mockImplementation(() => {
      throw null;
    });

    // Previously `err.message` raised a TypeError *inside* the catch block, which
    // escaped the handler and produced a bodyless 500.
    const response = await POST();

    expect(response.status).toBe(500);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({ error: "Internal server error" });
  });
});
