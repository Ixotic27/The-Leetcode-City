import { describe, it, expect, vi } from "vitest";
import { GET as getMaps, POST as createMap } from "./route";
import { GET as getMapById, PUT as updateMap, DELETE as deleteMap } from "./[id]/route";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === "arcade_maps") {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          or: vi.fn().mockReturnThis(),
          range: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          insert: vi.fn().mockReturnThis(),
          update: vi.fn().mockReturnThis(),
          delete: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({
            data: {
              id: "test-map-id",
              slug: "test-map",
              name: "Test Map",
              creator_id: "user-123",
              version: 1,
              map_json: {},
            },
            error: null,
          }),
        };
      }
      return {};
    }),
  })),
}));

vi.mock("@/lib/authenticated-developer", () => ({
  resolveAuthenticatedDeveloper: vi.fn().mockResolvedValue({
    ok: true,
    user: { id: "user-123", email: "test@example.com" },
    developer: { github_login: "testuser" },
  }),
}));

describe("E.Arcade Maps API Endpoints", () => {
  it("GET /api/arcade/maps returns map list format", async () => {
    const req = new NextRequest("http://localhost:3000/api/arcade/maps?q=test");
    const res = await getMaps(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveProperty("maps");
  });

  it("POST /api/arcade/maps requires map name", async () => {
    const req = new NextRequest("http://localhost:3000/api/arcade/maps", {
      method: "POST",
      body: JSON.stringify({ description: "No name map" }),
    });
    const res = await createMap(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("name is required");
  });

  it("GET /api/arcade/maps/[id] fetches single map detail", async () => {
    const req = new NextRequest("http://localhost:3000/api/arcade/maps/test-map");
    const res = await getMapById(req, { params: Promise.resolve({ id: "test-map" }) });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.map.id).toBe("test-map-id");
  });

  it("PUT /api/arcade/maps/[id] updates map data for authorized user", async () => {
    const req = new NextRequest("http://localhost:3000/api/arcade/maps/test-map-id", {
      method: "PUT",
      body: JSON.stringify({ name: "Updated Test Map Name" }),
    });
    const res = await updateMap(req, { params: Promise.resolve({ id: "test-map-id" }) });
    expect(res.status).toBe(200);
  });

  it("DELETE /api/arcade/maps/[id] deletes map for creator", async () => {
    const req = new NextRequest("http://localhost:3000/api/arcade/maps/test-map-id", {
      method: "DELETE",
    });
    const res = await deleteMap(req, { params: Promise.resolve({ id: "test-map-id" }) });
    expect(res.status).toBe(200);
  });
});
