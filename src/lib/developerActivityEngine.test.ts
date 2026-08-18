import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./achievements", () => ({
  checkAchievements: vi.fn(),
}));

vi.mock("./notification-helpers", () => ({
  touchLastActive: vi.fn(),
}));

import { processDeveloperActivity } from "./developerActivityEngine";
import * as achievementsModule from "./achievements";
import * as notificationHelpers from "./notification-helpers";

function makeAdmin(overrides?: {
  rpcResult?: { data?: unknown; error?: unknown };
  rpcReject?: Error;
  feedInsertReject?: Error;
}) {
  const rpc = overrides?.rpcReject
    ? vi.fn().mockRejectedValue(overrides.rpcReject)
    : vi.fn().mockResolvedValue(overrides?.rpcResult ?? { data: { granted: 10 }, error: null });
  const insert = overrides?.feedInsertReject
    ? vi.fn().mockRejectedValue(overrides.feedInsertReject)
    : vi.fn().mockResolvedValue({ data: null, error: null });
  const upsert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn().mockReturnValue({ insert, upsert });
  return { rpc, from, insert, upsert };
}

describe("processDeveloperActivity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(achievementsModule.checkAchievements).mockResolvedValue([]);
  });

  it("calls touchLastActive fire-and-forget", async () => {
    const admin = makeAdmin();
    await processDeveloperActivity(admin as never, { developerId: 1 });

    expect(notificationHelpers.touchLastActive).toHaveBeenCalledWith(1);
  });

  it("grants XP via grant_xp_atomic for each grant", async () => {
    const admin = makeAdmin();
    await processDeveloperActivity(admin as never, {
      developerId: 42,
      xpGrants: [
        { source: "kudos_given", amount: 3 },
        { source: "kudos_received", amount: 1 },
      ],
    });

    expect(admin.rpc).toHaveBeenCalledTimes(2);
    expect(admin.rpc).toHaveBeenCalledWith("grant_xp_atomic", {
      p_developer_id: 42,
      p_source: "kudos_given",
      p_amount: 3,
    });
    expect(admin.rpc).toHaveBeenCalledWith("grant_xp_atomic", {
      p_developer_id: 42,
      p_source: "kudos_received",
      p_amount: 1,
    });
  });

  it("skips XP grants with amount <= 0", async () => {
    const admin = makeAdmin();
    const result = await processDeveloperActivity(admin as never, {
      developerId: 1,
      xpGrants: [{ source: "zero", amount: 0 }, { source: "negative", amount: -5 }],
    });

    expect(admin.rpc).not.toHaveBeenCalled();
    expect(result.xpResults).toEqual([]);
  });

  it("records xpResult success and failure", async () => {
    const admin = makeAdmin();
    admin.rpc
      .mockResolvedValueOnce({ data: { granted: 10 }, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "duplicate" } });

    const result = await processDeveloperActivity(admin as never, {
      developerId: 1,
      xpGrants: [
        { source: "a", amount: 10 },
        { source: "b", amount: 5 },
      ],
    });

    expect(result.xpResults).toHaveLength(2);
    expect(result.xpResults[0]).toMatchObject({ source: "a", amount: 10, success: true });
    expect(result.xpResults[1]).toMatchObject({ source: "b", amount: 5, success: false });
  });

  it("inserts activity feed event with correct payload", async () => {
    const admin = makeAdmin();
    await processDeveloperActivity(admin as never, {
      developerId: 42,
      feedEvent: {
        eventType: "kudos_given",
        metadata: { giver_login: "alice", receiver_login: "bob" },
        targetId: 7,
      },
    });

    expect(admin.from).toHaveBeenCalledWith("activity_feed");
    expect(admin.insert).toHaveBeenCalledWith({
      event_type: "kudos_given",
      actor_id: 42,
      target_id: 7,
      metadata: { giver_login: "alice", receiver_login: "bob" },
    });
  });

  it("uses custom actorId when provided", async () => {
    const admin = makeAdmin();
    await processDeveloperActivity(admin as never, {
      developerId: 42,
      feedEvent: {
        eventType: "raid_success",
        metadata: {},
        actorId: 99,
      },
    });

    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: 99 }),
    );
  });

  it("upserts feed event when upsert option is set", async () => {
    const admin = makeAdmin();
    await processDeveloperActivity(admin as never, {
      developerId: 42,
      feedEvent: {
        eventType: "streak_checkin",
        metadata: { streak: 5 },
        eventDate: "2026-01-15",
        upsert: true,
        onConflict: "actor_id,event_type,event_date",
        ignoreDuplicates: true,
      },
    });

    expect(admin.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "streak_checkin", event_date: "2026-01-15" }),
      { onConflict: "actor_id,event_type,event_date", ignoreDuplicates: true },
    );
  });

  it("checks achievements when stats are provided", async () => {
    const checkMock = vi.mocked(achievementsModule.checkAchievements);
    checkMock.mockResolvedValue(["ach-1", "ach-2"]);

    const admin = makeAdmin();
    const result = await processDeveloperActivity(admin as never, {
      developerId: 42,
      actorLogin: "octocat",
      stats: {
        contributions: 50,
        kudos_count: 10,
        app_streak: 7,
      },
    });

    expect(checkMock).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ contributions: 50, kudos_count: 10, app_streak: 7 }),
      "octocat",
    );
    expect(result.newAchievements).toEqual(["ach-1", "ach-2"]);
  });

  it("skips achievement check when stats are not provided", async () => {
    const admin = makeAdmin();
    await processDeveloperActivity(admin as never, { developerId: 42 });

    expect(achievementsModule.checkAchievements).not.toHaveBeenCalled();
  });

  it("returns feedInserted: false when no feed event is provided", async () => {
    const admin = makeAdmin();
    const result = await processDeveloperActivity(admin as never, { developerId: 1 });

    expect(result.feedInserted).toBe(false);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("handles feed insert failure gracefully without throwing", async () => {
    const admin = makeAdmin({ feedInsertReject: new Error("connection refused") });
    const result = await processDeveloperActivity(admin as never, {
      developerId: 42,
      feedEvent: { eventType: "test", metadata: {} },
    });

    expect(result.feedInserted).toBe(false);
    expect(result.newAchievements).toEqual([]);
  });

  it("handles XP grant RPC error gracefully without throwing", async () => {
    const admin = makeAdmin({ rpcReject: new Error("network timeout") });

    const result = await processDeveloperActivity(admin as never, {
      developerId: 42,
      xpGrants: [{ source: "test", amount: 10 }],
    });

    expect(result.xpResults[0]).toMatchObject({ source: "test", amount: 10, success: false });
    expect(result.xpResults[0].error).toBeInstanceOf(Error);
  });

  it("handles achievement check failure gracefully without throwing", async () => {
    vi.mocked(achievementsModule.checkAchievements).mockRejectedValue(new Error("db down"));

    const admin = makeAdmin();
    const result = await processDeveloperActivity(admin as never, {
      developerId: 42,
      stats: { contributions: 1 },
    });

    expect(result.newAchievements).toEqual([]);
  });

  it("returns all results when everything is provided", async () => {
    vi.mocked(achievementsModule.checkAchievements).mockResolvedValue(["ach-new"]);

    const admin = makeAdmin();
    const result = await processDeveloperActivity(admin as never, {
      developerId: 42,
      actorLogin: "alice",
      stats: { contributions: 100 },
      xpGrants: [{ source: "checkin", amount: 10 }],
      feedEvent: { eventType: "streak_checkin", metadata: { streak: 5 } },
    });

    expect(result.newAchievements).toEqual(["ach-new"]);
    expect(result.xpResults).toHaveLength(1);
    expect(result.xpResults[0]).toMatchObject({ source: "checkin", amount: 10, success: true });
    expect(result.feedInserted).toBe(true);
    expect(admin.insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_type: "streak_checkin" }),
    );
  });
});
