import { beforeEach, describe, expect, it, vi } from "vitest";

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

import { POST } from "./route";

type OwnershipResult = {
  data?: Array<{ item_id: string }> | null;
  error?: Error | null;
  throws?: Error;
};

function createAdmin({ data = [], error = null, throws }: OwnershipResult) {
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const savedLoadout = { developer_id: 1, pet_id: "paid_dragon" };

  mockFrom.mockImplementation((table: string) => {
    if (table === "developers") {
      const query = {
        select: () => query,
        eq: () => query,
        single: vi.fn().mockResolvedValue({ data: { id: 1 } }),
      };
      return query;
    }

    if (table === "arcade_inventory") {
      const query = {
        select: () => query,
        eq: () => query,
        in: () => {
          if (throws) {
            return Promise.reject(throws);
          }
          return Promise.resolve({ data, error });
        },
      };
      return query;
    }

    if (table === "arcade_avatar_loadouts") {
      const query = {
        upsert,
        select: () => query,
        eq: () => query,
        single: vi.fn().mockResolvedValue({ data: savedLoadout }),
      };
      return query;
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { upsert, savedLoadout };
}

describe("POST /api/arcade/avatar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("saves a loadout when every equipped item is owned", async () => {
    const { upsert, savedLoadout } = createAdmin({ data: [{ item_id: "paid_dragon" }] });

    const response = await POST(new Request("http://localhost/api/arcade/avatar", {
      method: "POST",
      body: JSON.stringify({ pet_id: "paid_dragon" }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ loadout: savedLoadout });
    expect(upsert).toHaveBeenCalledOnce();
  });

  it("rejects unowned items without persisting the loadout", async () => {
    const { upsert } = createAdmin({ data: [] });

    const response = await POST(new Request("http://localhost/api/arcade/avatar", {
      method: "POST",
      body: JSON.stringify({ pet_id: "paid_dragon" }),
    }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Items not owned",
      items: ["paid_dragon"],
    });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("fails closed when the ownership query returns an error", async () => {
    const { upsert } = createAdmin({ error: new Error("database unavailable") });

    const response = await POST(new Request("http://localhost/api/arcade/avatar", {
      method: "POST",
      body: JSON.stringify({ pet_id: "paid_dragon" }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to verify item ownership" });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("fails closed when the ownership query throws", async () => {
    const { upsert } = createAdmin({ throws: new Error("connection reset") });

    const response = await POST(new Request("http://localhost/api/arcade/avatar", {
      method: "POST",
      body: JSON.stringify({ pet_id: "paid_dragon" }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: "Failed to verify item ownership" });
    expect(upsert).not.toHaveBeenCalled();
  });
});
