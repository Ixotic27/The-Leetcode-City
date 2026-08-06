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
function createToggleAdmin({
  existing,
  deleteError = null,
  throws,
  deleteThrows,
}: {
  existing: FavoriteRow | null;
  deleteError?: { message: string } | null;
  throws?: Error;
  deleteThrows?: Error;
}) {
  const insert = vi.fn().mockResolvedValue({ error: null });
  const del = vi.fn();
  const delEq = vi.fn();

  // Mirrors a real Supabase delete builder: chainable via `.eq()` *and*
  // thenable. A plain object would resolve on `await` even if the route
  // stopped awaiting the delete, hiding that regression.
  const deleteBuilder = {
    eq: (...args: unknown[]) => {
      delEq(...args);
      return deleteBuilder;
    },
    then: (
      resolve: (value: { error: { message: string } | null }) => unknown,
      reject?: (reason: unknown) => unknown
    ) =>
      deleteThrows
        ? Promise.reject(deleteThrows).then(resolve, reject)
        : Promise.resolve({ error: deleteError }).then(resolve, reject),
  };

  mockFrom.mockImplementation((table: string) => {
    if (table !== "arcade_room_favorites") {
      throw new Error(`Unexpected table: ${table}`);
    }

    const query = {
      select: () => query,
      eq: () => query,
      single: vi.fn().mockImplementation(() =>
        throws ? Promise.reject(throws) : Promise.resolve({ data: existing, error: null })
      ),
      delete: () => {
        del();
        return deleteBuilder;
      },
      insert,
    };
    return query;
  });

  return { del, delEq, insert };
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
      const { insert, del, delEq } = createToggleAdmin({ existing: { room_id: "lobby" } });

      const response = await POST(postRequest({ room_id: "lobby" }));

      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ favorited: false });
      expect(insert).not.toHaveBeenCalled();
      // Assert the delete actually ran and was scoped to this user + room, so
      // the route cannot regress to reporting `favorited: false` without it.
      expect(del).toHaveBeenCalledOnce();
      expect(delEq).toHaveBeenCalledWith("user_id", "user-1");
      expect(delEq).toHaveBeenCalledWith("room_id", "lobby");
    });

    it("does not report success when the delete fails", async () => {
      createToggleAdmin({
        existing: { room_id: "lobby" },
        deleteError: { message: "delete failed" },
      });

      const response = await POST(postRequest({ room_id: "lobby" }));

      expect(response.status).toBe(500);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "delete failed" });
    });

    it("does not fabricate success when the favorites table is unreachable", async () => {
      // GET degrades to an empty list on a throw, but a write cannot be faked:
      // a 200 here would suppress the client's `if (!res.ok)` rollback and leave
      // the star lit for a row that was never written.
      createToggleAdmin({ existing: null, throws: new Error("connection reset") });

      const response = await POST(postRequest({ room_id: "lobby" }));

      expect(response.status).toBe(500);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "Could not toggle favorite" });
    });

    it("never reports favorited: true for an un-favorite that throws", async () => {
      // The hardcoded fallback returned the *opposite* of the requested action
      // whenever a removal threw, so assert on the body and not just the status.
      createToggleAdmin({
        existing: { room_id: "lobby" },
        deleteThrows: new Error("connection reset"),
      });

      const response = await POST(postRequest({ room_id: "lobby" }));

      expect(response.status).toBe(500);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.not.toMatchObject({ favorited: true });
    });

    it("does not allow validation errors to be cached", async () => {
      const response = await POST(postRequest({}));

      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "room_id required" });
    });

    it("does not allow a malformed JSON body to escape uncached", async () => {
      const request = new NextRequest("http://localhost/api/arcade/favorites", {
        method: "POST",
        body: "{ not json",
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      await expect(response.json()).resolves.toEqual({ error: "Invalid JSON body" });
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
