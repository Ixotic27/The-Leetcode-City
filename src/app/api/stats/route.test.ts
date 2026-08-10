import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

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
                    resolve({ count: 100, data: null, error: null }),
                  count: 100,
                  data: null,
                  error: null,
                };
              }

              // solveResult
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
      rpc: (fn: string) => {
        // get_city_solve_totals: (10+5+2) + (20+15+8) = 60
        if (fn === "get_city_solve_totals") {
          return Promise.resolve({
            data: { total_solves: 60, total_developers: 100 },
            error: null,
          });
        }
        return Promise.resolve({ data: null, error: null });
      },
    }),
  };
});


describe("GET /api/stats", () => {
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

  });
});
