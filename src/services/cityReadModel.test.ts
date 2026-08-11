import { beforeEach, describe, expect, it, vi } from "vitest";
import { CityReadModel } from "./cityReadModel";
import { clearCityCache } from "../lib/cityCache";

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
  private readonly callLog: string[];

  constructor(
    rows: Record<string, Array<Record<string, unknown>>>,
    errors: Record<string, Error | null | undefined> = {},
    callLog: string[] = [],
  ) {
    this.rows = rows;
    this.errors = errors;
    this.callLog = callLog;
  }

  from(table: string): FakeQueryBuilder {
    this.callLog.push(table);
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

describe("CityReadModel", () => {
  beforeEach(() => {
    clearCityCache();
  });

  it("loads city data and preserves the public projection shape", async () => {
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
          rabbit_completed: false,
          xp_total: 0,
          xp_level: 1,
          building_style: "tower",
          loadout: { crown: null, roof: null, aura: null, faces: null },
          active_raid_tag: { attacker_login: "", tag_style: "", expires_at: "" },
          owned_items: [],
          achievements: [],
          billboard_images: [],
          custom_color: null,
          selected_title: null,
        },
      ],
      city_stats: [{ total_developers: 1, total_contributions: 10 }],
      items: [{ metadata: { raised_inr: 1200, target_inr: 2900 } }],
      purchases: [],
      developer_customizations: [],
      developer_achievements: [],
      raid_tags: [],
    });

    const service = new CityReadModel(admin as never);
    const result = await service.loadCityData({ from: 0, to: 50 });

    expect(result.status).toBe(200);
    const body = result.body as { developers: Array<Record<string, unknown>> };
    expect(body.developers).toHaveLength(1);
    expect(body.developers[0]).toEqual({
      id: 1,
      github_login: "octocat",
      name: "Octo",
      contributions: 10,
      total_stars: 2,
      public_repos: 3,
    });
  });

  it("uses the runtime cache on repeated loads", async () => {
    const callLog: string[] = [];
    const admin = new FakeSupabaseClient({
      developers: [{ id: 1, github_login: "octocat", contributions: 1, total_stars: 1, public_repos: 1 }],
      city_stats: [{ total_developers: 1, total_contributions: 1 }],
      items: [{ metadata: { raised_inr: 0, target_inr: 2900 } }],
      purchases: [],
      developer_customizations: [],
      developer_achievements: [],
      raid_tags: [],
    }, {}, callLog);

    const service = new CityReadModel(admin as never);
    await service.loadCityData({ from: 0, to: 50 });
    await service.loadCityData({ from: 0, to: 50 });

    expect(callLog.filter((table) => table === "developers")).toHaveLength(1);
  });
});
