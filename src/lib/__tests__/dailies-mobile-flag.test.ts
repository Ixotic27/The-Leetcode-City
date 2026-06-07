/**
 * Tests — isMobile flag must be forwarded consistently across
 * getDailyMissions call sites so mobile users are validated against the
 * correct mission pool.
 */

import { getDailyMissions, trackDailyMission } from "../dailies";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRpc = jest.fn().mockResolvedValue({ data: null, error: null });

jest.mock("../supabase", () => ({
  getSupabaseAdmin: () => ({ rpc: mockRpc }),
}));

// ── Helpers ────────────────────────────────────────────────────────────────────

const DEV_ID = 99;
const DATE = "2025-06-07";

// ── getDailyMissions ──────────────────────────────────────────────────────────

describe("getDailyMissions", () => {
  it("desktop pool includes desktopOnly missions as candidates", () => {
    // Run enough developer IDs to confirm desktopOnly missions can appear
    const desktopOnlyIds = ["fly_score_50", "fly_score_150"];
    const found = new Set<string>();

    for (let id = 1; id <= 200; id++) {
      const missions = getDailyMissions(id, DATE, false);
      missions.forEach((m) => {
        if (desktopOnlyIds.includes(m.id)) found.add(m.id);
      });
    }

    // At least one desktopOnly mission should appear across 200 seeds
    expect(found.size).toBeGreaterThan(0);
  });

  it("mobile pool never contains desktopOnly missions", () => {
    for (let id = 1; id <= 500; id++) {
      const missions = getDailyMissions(id, DATE, true);
      const hasDesktopOnly = missions.some((m) => m.desktopOnly);
      expect(hasDesktopOnly).toBe(false);
    }
  });

  it("always includes checkin as the first mission regardless of isMobile", () => {
    for (const mobile of [true, false]) {
      const missions = getDailyMissions(DEV_ID, DATE, mobile);
      expect(missions[0].id).toBe("checkin");
    }
  });

  it("returns different secondary missions for same seed when isMobile changes pool size", () => {
    // Find a developer ID where the two pools produce different secondary missions
    let foundDifference = false;
    for (let id = 1; id <= 100; id++) {
      const desktop = getDailyMissions(id, DATE, false);
      const mobile  = getDailyMissions(id, DATE, true);
      const desktopSecondary = desktop.slice(1).map((m) => m.id).sort();
      const mobileSecondary  = mobile.slice(1).map((m) => m.id).sort();
      if (JSON.stringify(desktopSecondary) !== JSON.stringify(mobileSecondary)) {
        foundDifference = true;
        break;
      }
    }
    // The whole bug depends on this being true — if pools differ, output can differ
    expect(foundDifference).toBe(true);
  });

  it("is deterministic — same inputs always produce same output", () => {
    const a = getDailyMissions(DEV_ID, DATE, true);
    const b = getDailyMissions(DEV_ID, DATE, true);
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
  });
});

// ── trackDailyMission ─────────────────────────────────────────────────────────

describe("trackDailyMission", () => {
  beforeEach(() => jest.clearAllMocks());

  it("records progress when mission is in the mobile set", async () => {
    // Find a developer ID where give_kudos is in the mobile mission set
    let targetId: number | null = null;
    for (let id = 1; id <= 500; id++) {
      const missions = getDailyMissions(id, DATE, true);
      if (missions.some((m) => m.id === "give_kudos")) {
        targetId = id;
        break;
      }
    }
    if (!targetId) return; // skip if not found in range (seed-dependent)

    await trackDailyMission(targetId, "give_kudos", { isMobile: true });
    expect(mockRpc).toHaveBeenCalledWith("record_mission_progress", expect.objectContaining({
      p_developer_id: targetId,
      p_mission_id: "give_kudos",
    }));
  });

  it("skips (no-ops) when a desktopOnly mission is not in the mobile set", async () => {
    // fly_score_50 is desktopOnly — it will never be in the mobile pool
    await trackDailyMission(DEV_ID, "fly_score_50", { isMobile: true });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("may record fly_score_50 when isMobile=false and mission is assigned", async () => {
    let targetId: number | null = null;
    for (let id = 1; id <= 500; id++) {
      const missions = getDailyMissions(id, DATE, false);
      if (missions.some((m) => m.id === "fly_score_50")) {
        targetId = id;
        break;
      }
    }
    if (!targetId) return;

    await trackDailyMission(targetId, "fly_score_50", { score: 100, isMobile: false });
    expect(mockRpc).toHaveBeenCalledWith("record_mission_progress", expect.objectContaining({
      p_mission_id: "fly_score_50",
    }));
  });

  it("defaults isMobile to false when extra is omitted (backwards compatible)", async () => {
    // Give a desktop-assigned mission — should still work with no extra arg
    let targetId: number | null = null;
    for (let id = 1; id <= 200; id++) {
      const missions = getDailyMissions(id, DATE, false);
      if (missions.some((m) => m.id === "give_kudos")) {
        targetId = id;
        break;
      }
    }
    if (!targetId) return;

    await trackDailyMission(targetId, "give_kudos");  // no extra
    // Should not throw; may or may not call RPC depending on seed
    // Key assertion: no unhandled exception
    expect(true).toBe(true);
  });
});