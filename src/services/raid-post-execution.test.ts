import { beforeEach, describe, expect, it, vi } from "vitest";
import { performRaidPostExecution } from "./raid-post-execution";

const {
  mockTouchLastActive,
  mockTrackDailyMission,
  mockSendRaidAlertNotification,
} = vi.hoisted(() => ({
  mockTouchLastActive: vi.fn(),
  mockTrackDailyMission: vi.fn(),
  mockSendRaidAlertNotification: vi.fn(),
}));

vi.mock("@/lib/notification-helpers", () => ({
  touchLastActive: mockTouchLastActive,
}));

vi.mock("@/lib/dailies", () => ({
  trackDailyMission: mockTrackDailyMission,
}));

vi.mock("@/lib/notification-senders/raid", () => ({
  sendRaidAlertNotification: mockSendRaidAlertNotification,
}));

describe("performRaidPostExecution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTouchLastActive.mockResolvedValue(undefined);
    mockTrackDailyMission.mockResolvedValue(undefined);
    mockSendRaidAlertNotification.mockResolvedValue(undefined);
  });

  it("runs post-raid side effects in the expected order on success", async () => {
    const calls: string[] = [];
    const chain = {
      eq(...args: [string, string | number | boolean]) {
        calls.push(`eq:${args[0]}:${String(args[1])}`);
        return chain;
      },
      insert(values: Record<string, unknown>) {
        calls.push(`insert:${JSON.stringify(values)}`);
        return Promise.resolve({ error: null });
      },
      upsert(values: Record<string, unknown>) {
        calls.push(`upsert:${JSON.stringify(values)}`);
        return Promise.resolve({ error: null });
      },
      select() {
        return chain;
      },
      update(values: Record<string, unknown>) {
        calls.push(`update:${JSON.stringify(values)}`);
        return chain;
      },
      gt() {
        return chain;
      },
    };
    const admin = {
      from(table: string) {
        calls.push(`from:${table}`);
        return {
          ...chain,
        };
      },
      async rpc(fn: string, args: Record<string, unknown>) {
        calls.push(`rpc:${fn}:${JSON.stringify(args)}`);
        if (fn === "increment_relic_progress") {
          return { data: 1, error: null };
        }
        if (fn === "consume_consumable") {
          return { data: true, error: null };
        }
        return { data: null, error: null };
      },
    };

    await performRaidPostExecution(
      admin as never,
      { id: 1, github_login: "attacker" } as never,
      { id: 2, github_login: "defender" } as never,
      {
        boostPurchaseIdToConsume: 99,
        defenderItemUsed: true,
        activeDefenses: ["emp_shield"],
        success: true,
        raidId: "raid-1",
        vehicle: "airplane",
        tagStyle: "default",
        attack: { total: 12, breakdown: { commits: 0, streak: 0, kudos: 0 } },
        defense: { total: 10, breakdown: { commits: 0, streak: 0, kudos: 0 } },
        attackerConsumableItemId: "emp_device",
        defenderEffectiveDefense: null,
      },
      "2026-08-03",
    );

    expect(calls).toContain('from:purchases');
    expect(calls).toContain('update:{"status":"consumed"}');
    expect(calls).toContain('rpc:consume_consumable:{"p_developer_id":2,"p_item_id":"emp_shield","p_week_start":"2026-08-03"}');
    expect(calls).toContain('from:raid_tags');
    expect(calls.some((entry) => entry.startsWith('insert:{"raid_id":"raid-1"'))).toBe(true);
    expect(calls).toContain('from:activity_feed');
    expect(mockTouchLastActive).toHaveBeenCalledWith(1);
    expect(mockTrackDailyMission).toHaveBeenCalledWith(1, "attempt_battle");
    expect(mockTrackDailyMission).toHaveBeenCalledWith(1, "win_battle");
    expect(mockSendRaidAlertNotification).toHaveBeenCalledWith(2, "defender", "attacker", "raid-1", true, 12, 10);
  });
});