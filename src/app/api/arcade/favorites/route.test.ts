import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabase: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({ from: mockFrom })),
}));

import { GET, POST } from "./route";

type FavoriteRow = { room_id: string };

type SelectResult = {
  data?: FavoriteRow[] | null;
  error?: { message: string } | null;
  throws?: Error;
};

/** Stubs `arcade_room_favorites` for the list query used by GET. */
function createListAdmin({ data = [], error = null, throws }: SelectResult) {
  mockFrom.mockImplementation((table: string) => {
    if (table !== "arcade_room_favorites") {
      throw new Error(`Unexpected table: ${table}`);
    }

    const query = {
      select: () => query,
      eq: vi.fn().mockImplementation(() => {
        if (throws) {
          return Promise.reject(throws);
        }
        return Promise.resolve({ data, error });
      }),
    };
    return query;
  });
}

/** Stubs `arcade_room_favorites` for the read-then-write flow used by POST. */
function createToggleAdmin({ existing }: { existing: FavoriteRow | null }) {
  const del = { eq: vi.fn().mockReturnThis() };
  const insert = vi.fn().mockResolvedValue({ error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table !== "arcade_room_favorites") {
      throw new Error(`Unexpected table: ${table}`);
    }

    const query = {
      select: () => query,
      eq: () => query,
      single: vi.fn().mockResolvedValue({ data: existing, error: null }),
      delete: () => del,
      insert,
    };
    return query;
  });

  return { del, insert };
}

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/arcade/favorites", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("/api/arcade/favorites", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  describe("GET", () => {
    it("returns the user's favorited room ids and forbids caching", async () => {
      createListAdmin({ data: [{ room_id: "lobby" }, { room_id: "fsociety" }] });

      const response = await GET();

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ favorites: ["lobby", "fsociety"] });
    });

    it("does not allow unauthenticated responses to be cached", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const response = await GET();

      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it("does not allow query failures to be cached", async () => {
      createListAdmin({ error: { message: "database unavailable" } });

      const response = await GET();

      expect(response.status).toBe(500);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "database unavailable" });
    });

    it("falls back to an empty list when the favorites table is unreachable", async () => {
      createListAdmin({ throws: new Error("connection reset") });

      const response = await GET();

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ favorites: [] });
    });
  });

  describe("POST", () => {
    it("adds a favorite without caching the response", async () => {
      const { insert } = createToggleAdmin({ existing: null });

      const response = await POST(postRequest({ room_id: "lobby" }));

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ favorited: true });
      expect(insert).toHaveBeenCalledWith({ user_id: "user-1", room_id: "lobby" });
    });

    it("removes an existing favorite without caching the response", async () => {
      const { insert } = createToggleAdmin({ existing: { room_id: "lobby" } });

      const response = await POST(postRequest({ room_id: "lobby" }));

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ favorited: false });
      expect(insert).not.toHaveBeenCalled();
    });

    it("does not allow validation errors to be cached", async () => {
      const response = await POST(postRequest({}));

      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "room_id required" });
    });

    it("does not allow unauthenticated responses to be cached", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

      const response = await POST(postRequest({ room_id: "lobby" }));

      expect(response.status).toBe(401);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(mockFrom).not.toHaveBeenCalled();
    });
  });
});
