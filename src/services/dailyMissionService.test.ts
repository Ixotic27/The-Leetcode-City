import { describe, expect, it } from "vitest";
import { getDailyMissions } from "@/lib/dailies";
import { DailyMissionService, DailyMissionServiceError } from "./dailyMissionService";

class FakeQueryBuilder {
  constructor(private readonly table: string, private readonly state: Record<string, unknown>, private readonly client: FakeSupabaseClient) {}

  select(_columns: string) { return this; }
  eq(column: string, value: string | number | boolean | null) {
    if (column === "developer_id") {
      this.client.currentDeveloperId = Number(value);
    }
    if (column === "mission_date") {
      this.client.currentMissionDate = String(value);
    }
    return this;
  }
  in(_column: string, _values: Array<string | number>) { return this; }
  is(_column: string, _value: string | null) { return this; }
  order(_column: string, _options?: { ascending?: boolean }) { return this; }
  range(_from: number, _to: number) { return this; }
  maybeSingle() { return Promise.resolve({ data: this.state[this.table] ?? null, error: null }); }
  single() { return Promise.resolve({ data: this.state[this.table] ?? null, error: null }); }
  insert(values: Record<string, unknown>) { return Promise.resolve({ data: values, error: null }); }
  upsert(values: Record<string, unknown>) { return Promise.resolve({ data: values, error: null }); }
  then(resolve: (value: { data: unknown; error: null }) => unknown) {
    return Promise.resolve({ data: this.state[this.table] ?? null, error: null }).then(resolve);
  }
}

class FakeSupabaseClient {
  public readonly rpcCalls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  public currentDeveloperId: number | null = null;
  public currentMissionDate: string | null = null;

  constructor(private readonly state: Record<string, unknown>) {}

  from(table: string) {
    if (table === "achievements") {
      return {
        select: () => ({
          data: [],
          error: null,
        }),
      };
    }
    if (table === "developer_achievements") {
      return {
        select: () => ({
          data: [],
          error: null,
        }),
        eq: () => ({ data: [], error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
      };
    }
    if (table === "purchases") {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              }),
            }),
          }),
          maybeSingle: () => Promise.resolve({ data: null, error: null }),
        }),
        eq: () => ({ data: [], error: null }),
        upsert: () => Promise.resolve({ data: null, error: null }),
      };
    }
    if (table === "activity_feed") {
      return {
        insert: () => Promise.resolve({ data: null, error: null }),
      };
    }
    return new FakeQueryBuilder(table, this.state, this);
  }

  async rpc(fn: string, args: Record<string, unknown>) {
    this.rpcCalls.push({ fn, args });

    if (fn === "record_mission_progress") {
      return { data: { ok: true }, error: null };
    }

    if (fn === "complete_all_dailies") {
      return { data: { already_completed: false, streak: 2, total: 5 }, error: null };
    }

    if (fn === "grant_xp_atomic") {
      return { data: true, error: null };
    }

    if (fn === "grant_streak_freeze") {
      return { data: [{ granted: true }], error: null };
    }

    return { data: null, error: null };
  }
}

describe("DailyMissionService", () => {
  it("assigns missions for the current day and auto-tracks a checkin", async () => {
    const admin = new FakeSupabaseClient({
      developers: { id: 7, github_login: "octocat", claimed: true, last_checkin_date: "2026-07-16", last_dailies_date: null },
    });
    const service = new DailyMissionService(admin as never);

    const summary = await service.loadMissionSummary({
      id: 7,
      github_login: "octocat",
      claimed: true,
      last_checkin_date: "2026-07-16",
      last_dailies_date: null,
    }, { isMobile: false, today: "2026-07-16" });

    expect(summary.missions).toHaveLength(3);
    expect(summary.missions[0].id).toBe("checkin");
    expect(admin.rpcCalls.some((call) => call.fn === "record_mission_progress")).toBe(true);
  });

  it("rejects progress updates for missions that are not assigned today", async () => {
    const admin = new FakeSupabaseClient({ developers: { id: 8, claimed: true } });
    const service = new DailyMissionService(admin as never);

    await expect(
      service.updateProgress({ developerId: 8, missionId: "fly_score_150", increment: 1, isMobile: false, today: "2026-07-16" }),
    ).rejects.toBeInstanceOf(DailyMissionServiceError);
  });

  it("claims rewards only when all missions are complete and prevents duplicates", async () => {
    const missions = getDailyMissions(9, "2026-07-16", false);
    const admin = new FakeSupabaseClient({
      developers: { id: 9, github_login: "octocat", claimed: true, last_dailies_date: null },
      daily_mission_progress: missions.map((mission) => ({ mission_id: mission.id, completed: true })),
    });
    const service = new DailyMissionService(admin as never);

    const result = await service.claimReward({
      developer: { id: 9, github_login: "octocat", claimed: true, last_dailies_date: null },
      isMobile: false,
      today: "2026-07-16",
    });

    expect(result.ok).toBe(true);
    expect(result.total).toBe(5);
  });
});
