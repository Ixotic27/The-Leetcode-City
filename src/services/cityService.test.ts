import { describe, expect, it } from "vitest";
import { CityService } from "./cityService";

type QueryResult<T> = { data: T | null; error?: Error | null };

type FakeTable = {
  select: (...args: string[]) => FakeQueryBuilder;
  eq: (column: string, value: string | number) => FakeQueryBuilder;
  in: (column: string, values: Array<string | number>) => FakeQueryBuilder;
  is: (column: string, value: string | null) => FakeQueryBuilder;
  not: (column: string, operator: string, value: string | null) => FakeQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => FakeQueryBuilder;
  range: (from: number, to: number) => FakeQueryBuilder;
  maybeSingle: () => Promise<QueryResult<Record<string, unknown>>>;
  single: () => Promise<QueryResult<Record<string, unknown>>>;
};

type FakeQueryBuilder = FakeTable & {
  data: Record<string, unknown> | Array<Record<string, unknown>> | null;
  error: Error | null;
};

class FakeSupabaseClient {
  private readonly rows: Record<string, Array<Record<string, unknown>>>;
  private readonly errors: Record<string, Error | null | undefined>;

  constructor(
    rows: Record<string, Array<Record<string, unknown>>>,
    errors: Record<string, Error | null | undefined> = {},
  ) {
    this.rows = rows;
    this.errors = errors;
  }

  from(table: string): FakeQueryBuilder {
    const data = this.rows[table] ?? [];
    const error = this.errors[table] ?? null;
    const builder: FakeQueryBuilder = {
      data,
      error,
      select: () => builder,
      eq: () => builder,
      in: () => builder,
      is: () => builder,
      not: () => builder,
      order: () => builder,
      range: () => builder,
      maybeSingle: async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error }),
      single: async () => ({ data: Array.isArray(data) ? data[0] ?? null : data, error }),
    };
    return builder;
  }
}

describe("CityService", () => {
  it("loads city data and serializes developers without changing the public shape", async () => {
    const admin = new FakeSupabaseClient({
      developers: [
        {
          id: 1,
          github_login: "octocat",
          name: "Octo",
          contributions: 10,
          total_stars: 2,
          public_repos: 3,
          claimed: false,
          kudos_count: 0,
          visit_count: 0,
          app_streak: 0,
          raid_xp: 0,
          xp_level: 1,
          rabbit_completed: false,
          current_week_contributions: 0,
          current_week_kudos_given: 0,
          current_week_kudos_received: 0,
          easy_solved: 0,
          medium_solved: 0,
          hard_solved: 0,
          contest_rating: 0,
          lc_streak: 0,
        },
      ],
      city_stats: [{ total_developers: 1, total_contributions: 10 }],
      items: [{ metadata: { raised_inr: 1200, target_inr: 2900 } }],
      purchases: [],
      developer_customizations: [],
      developer_achievements: [],
      raid_tags: [],
    });

    const service = new CityService(admin as never);
    const result = await service.loadCityData({ from: 0, to: 50 });

    expect(result.body.developers).toHaveLength(1);
    expect(result.body.developers[0]).toEqual({
      id: 1,
      github_login: "octocat",
      name: "Octo",
      contributions: 10,
      total_stars: 2,
      public_repos: 3,
    });
    expect(result.body.stats).toMatchObject({
      total_developers: 1,
      total_contributions: 10,
      renewal_raised_inr: 1200,
      renewal_target_inr: 2900,
    });
  });
});


describe("CityService query failures", () => {
  const emptyRows = {
    developers: [],
    city_stats: [{ total_developers: 0, total_contributions: 0 }],
    items: [],
    purchases: [],
    developer_customizations: [],
    developer_achievements: [],
    raid_tags: [],
  };

  it("returns a non-cacheable failure when a primary query fails", async () => {
    const service = new CityService(new FakeSupabaseClient(emptyRows, {
      developers: new Error("permission denied"),
    }) as never);

    const result = await service.loadCityData({ from: 0, to: 50 });

    expect(result).toEqual({
      status: 500,
      headers: { "Cache-Control": "no-store" },
      body: { error: "Failed to load city data" },
    });
  });

  it("returns a non-cacheable failure when an enrichment query fails", async () => {
    const service = new CityService(new FakeSupabaseClient({
      ...emptyRows,
      developers: [{ id: 1, easy_solved: 0 }],
    }, {
      developer_customizations: new Error("permission denied"),
    }) as never);

    const result = await service.loadCityData({ from: 0, to: 50 });

    expect(result).toEqual({
      status: 500,
      headers: { "Cache-Control": "no-store" },
      body: { error: "Failed to load city data" },
    });
  });

  it("keeps an empty successful city response cacheable", async () => {
    const service = new CityService(new FakeSupabaseClient(emptyRows) as never);

    const result = await service.loadCityData({ from: 0, to: 50 });

    expect(result.status).toBe(200);
    expect(result.headers).toEqual({
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
    });
    expect(result.body).toMatchObject({ developers: [] });
  });
});
