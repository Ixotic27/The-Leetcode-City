import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), scan: vi.fn(), total: 100 }));

vi.mock("@/lib/api-logger", () => ({ logApiError: vi.fn(), newReqId: () => "stats-test" }));

vi.mock("@/lib/supabase", () => {
  return {
    getSupabaseAdmin: () => ({
      from: (table: string) => {
        if (table === "developers") {
          return {
            select: (cols: string, opts?: { count?: string; head?: boolean }) => {
              if (opts?.count === "exact") {
                return {
                  eq: () => {
                    return Promise.resolve({ count: 42, data: null, error: null });
                  },
                  then: (resolve: (val: { count: number; data: null; error: null }) => void) =>
                    resolve({ count: mocks.total, data: null, error: null }),
                  count: mocks.total,
                  data: null,
                  error: null,
                };
              }

              if (cols === "easy_solved, medium_solved, hard_solved") {
                return { order: () => ({ range: mocks.scan }) };
              }

              if (cols === "github_login, easy_solved, medium_solved, hard_solved") {
                return {
                  order: () => ({
                    limit: () => ({
                      maybeSingle: () =>
                        Promise.resolve({
                          data: {
                            github_login: "top-coder",
                            easy_solved: 100,
                            medium_solved: 50,
                            hard_solved: 30,
                          },
                          error: null,
                        }),
                    }),
                  }),
                };
              }

              return {};
            },
          };
        }
        return {};
      },
      rpc: mocks.rpc,
    }),
  };
});


describe("GET /api/stats", () => {
  beforeEach(() => {
    mocks.total = 100;
    mocks.rpc.mockReset().mockResolvedValue({ data: { total_solves: 60, total_developers: 100 }, error: null });
    mocks.scan.mockReset();
  });

  it("returns aggregate city statistics with expected JSON structure", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json).toHaveProperty("totalDevelopers");
    expect(json).toHaveProperty("claimedBuildings");
    expect(json).toHaveProperty("totalSolves");
    expect(json).toHaveProperty("tallestBuilding");
    expect(json).toHaveProperty("generatedAt");

    expect(json.tallestBuilding).toEqual({
      username: "top-coder",
      hardSolved: 30,
    });
    expect(json.totalDevelopers).toBe(100);
    expect(json.claimedBuildings).toBe(42);
    expect(json.totalSolves).toBe(60); // (10+5+2) + (20+15+8) = 60

    expect(res.headers.get("Cache-Control")).toContain("public");
    expect(mocks.scan).not.toHaveBeenCalled();
  });

  it.each(["PGRST202", "42883"])("scans bounded pages when the solve RPC is missing (%s)", async (code) => {
    mocks.total = 2002;
    mocks.rpc.mockResolvedValue({ data: null, error: { code } });
    mocks.scan
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ easy_solved: 1, medium_solved: null })), error: null })
      .mockResolvedValueOnce({ data: Array.from({ length: 1000 }, () => ({ medium_solved: 2 })), error: null })
      .mockResolvedValueOnce({ data: [{ hard_solved: 3 }, { hard_solved: 3 }], error: null });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ totalDevelopers: 2002, claimedBuildings: 42, totalSolves: 3006, tallestBuilding: { username: "top-coder", hardSolved: 30 } });
    expect(mocks.scan.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2001]]);
  });

  it("does not mask an RPC permission error with a fallback", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "permission denied" } });
    const res = await GET();
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(mocks.scan).not.toHaveBeenCalled();
  });

  it("handles a database row cap below the requested page size", async () => {
    mocks.total = 3;
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    mocks.scan
      .mockResolvedValueOnce({ data: [{ easy_solved: 5 }, { medium_solved: 6 }], error: null })
      .mockResolvedValueOnce({ data: [{ hard_solved: 9 }], error: null });
    const res = await GET();
    expect(res.status).toBe(200);
    expect((await res.json()).totalSolves).toBe(20);
    expect(mocks.scan.mock.calls).toEqual([[0, 2], [2, 2]]);
  });

  it("rejects a missing fallback page instead of reporting a false zero", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    mocks.scan.mockResolvedValue({ data: [], error: null });
    expect((await GET()).status).toBe(500);
  });

  it("returns an error if a fallback page fails instead of caching partial totals", async () => {
    mocks.total = 1001;
    mocks.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
    mocks.scan
      .mockResolvedValueOnce({ data: [{ easy_solved: 10 }], error: null })
      .mockResolvedValueOnce({ data: null, error: { code: "57014", message: "query cancelled" } });
    const res = await GET();
    expect(res.status).toBe(500);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});
