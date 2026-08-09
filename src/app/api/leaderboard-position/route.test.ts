import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: vi.fn(() => ({ from: mockFrom, rpc: vi.fn() })),
}));

import { GET } from "./route";

type Developer = {
  id: string;
  github_login: string;
  name: string;
  avatar_url: string;
  contributions: number;
  contributions_total: number;
  total_stars: number;
  public_repos: number;
  lc_global_rank: number | null;
  referral_count: number;
  kudos_count: number;
  lc_streak: number;
  contest_rating: number;
  xp_total: number;
  easy_solved: number;
};

const DEV: Developer = {
  id: "dev-1",
  github_login: "octocat",
  name: "Octo Cat",
  avatar_url: "https://example.com/octo.png",
  contributions: 5,
  contributions_total: 5,
  total_stars: 0,
  public_repos: 0,
  lc_global_rank: null,
  referral_count: 0,
  kudos_count: 0,
  lc_streak: 0,
  contest_rating: 0,
  xp_total: 0,
  easy_solved: 5,
};

function mockSupabase({ dev, count = null }: { dev: Developer | null; count?: number | null }) {
  mockFrom.mockImplementation((table: string) => {
    if (table !== "developers") {
      throw new Error(`Unexpected table: ${table}`);
    }
    const query = {
      count: null as number | null,
      data: null as unknown,
      select: vi.fn(),
      eq: vi.fn(),
      not: vi.fn(),
      gt: vi.fn(),
      single: vi.fn(),
    };
    // `select("id", { count: "exact", head: true })` is the count query.
    query.select = vi.fn((_columns?: string, options?: object) => {
      if (options) query.count = count;
      return query;
    });
    query.eq = vi.fn().mockReturnValue(query);
    query.not = vi.fn().mockReturnValue(query);
    query.gt = vi.fn().mockReturnValue(query);
    query.single = vi.fn().mockResolvedValue({ data: dev });
    return query;
  });
}

describe("GET /api/leaderboard-position", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an invalid tab with a 400 and descriptive message before querying Supabase", async () => {
    mockSupabase({ dev: DEV });

    const response = await GET(
      new Request("http://localhost/api/leaderboard-position?tab=cheater&login=octocat")
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid tab. Must be one of: solved, lc_rank, streak, contest, xp, achievers.",
    });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns 400 when login is missing", async () => {
    mockSupabase({ dev: DEV });

    const response = await GET(new Request("http://localhost/api/leaderboard-position?tab=solved"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing login" });
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("returns the position for a valid tab", async () => {
    mockSupabase({ dev: DEV, count: 9 });

    const response = await GET(
      new Request("http://localhost/api/leaderboard-position?tab=solved&login=octocat")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      github_login: "octocat",
      position: 10,
      metricValue: "5 solved",
    });
  });

  it("returns 404 when the developer does not exist", async () => {
    mockSupabase({ dev: null });

    const response = await GET(
      new Request("http://localhost/api/leaderboard-position?tab=solved&login=ghost")
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Not found" });
  });
});
