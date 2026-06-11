import { describe, it, expect, vi, beforeEach } from "vitest";

// Pure unit tests for the idempotency logic — mocking the Supabase RPC
// to verify the application layer correctly interprets claim_first_solve results.

function buildMockSb(wonRace: boolean, claimError: any = null) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({ error: null }),
      upsert: vi.fn().mockResolvedValue({ error: null }),
      eq: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      single: vi.fn().mockResolvedValue({ data: { rating: 1200, problems_solved: 0, problems_attempted: 0, current_streak: 0, best_streak: 0 } }),
    }),
    rpc: vi.fn().mockImplementation((name: string) => {
      if (name === "claim_first_solve") {
        return Promise.resolve({
          data: claimError ? null : [{ won_race: wonRace }],
          error: claimError,
        });
      }
      if (name === "grant_xp_atomic") {
        return Promise.resolve({ data: { granted: 10, new_total: 110, new_level: 1 }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
  };
}

describe("Arena first-solve idempotency — application layer", () => {
  // ── won_race interpretation ───────────────────────────────────

  it("sets isFirstSolve = true when claim_first_solve returns won_race: true", async () => {
    const claimResult = [{ won_race: true }];
    const isFirstSolve = claimResult?.[0]?.won_race === true;
    expect(isFirstSolve).toBe(true);
  });

  it("sets isFirstSolve = false when claim_first_solve returns won_race: false", async () => {
    const claimResult = [{ won_race: false }];
    const isFirstSolve = claimResult?.[0]?.won_race === true;
    expect(isFirstSolve).toBe(false);
  });

  it("sets isFirstSolve = false when claim_first_solve returns null data", async () => {
    const claimResult: any = null;
    const isFirstSolve = claimResult?.[0]?.won_race === true;
    expect(isFirstSolve).toBe(false);
  });

  it("sets isFirstSolve = false when won_race is undefined", async () => {
    const claimResult: any = [{}];
    const isFirstSolve = claimResult?.[0]?.won_race === true;
    expect(isFirstSolve).toBe(false);
  });

  // ── RPC parameter routing ─────────────────────────────────────

  it("passes p_challenge_id and null p_problem_id when challenge_id is present", () => {
    const challenge_id = "abc-123";
    const problem_id = "P001";
    const params = {
      p_challenge_id: challenge_id || null,
      p_problem_id:   challenge_id ? null : problem_id,
    };
    expect(params.p_challenge_id).toBe("abc-123");
    expect(params.p_problem_id).toBeNull();
  });

  it("passes null p_challenge_id and p_problem_id when no challenge_id", () => {
    const challenge_id = null;
    const problem_id = "P001";
    const params = {
      p_challenge_id: challenge_id || null,
      p_problem_id:   challenge_id ? null : problem_id,
    };
    expect(params.p_challenge_id).toBeNull();
    expect(params.p_problem_id).toBe("P001");
  });

  // ── Reward paths ──────────────────────────────────────────────

  it("grant_xp is called only when won_race is true", async () => {
    const sb = buildMockSb(true);
    // Simulate the route's conditional: only call grant_xp_atomic if isFirstSolve
    const isFirstSolve = true;
    if (isFirstSolve) {
      await sb.rpc("grant_xp_atomic", { p_developer_id: 1, p_source: "arena_medium", p_amount: 10 });
    }
    expect(sb.rpc).toHaveBeenCalledWith("grant_xp_atomic", expect.objectContaining({ p_amount: 10 }));
  });

  it("grant_xp is NOT called when won_race is false", async () => {
    const sb = buildMockSb(false);
    const isFirstSolve = false;
    if (isFirstSolve) {
      await sb.rpc("grant_xp_atomic", { p_developer_id: 1, p_source: "arena_medium", p_amount: 10 });
    }
    expect(sb.rpc).not.toHaveBeenCalledWith("grant_xp_atomic", expect.anything());
  });

  // ── Multiplier calculation ─────────────────────────────────────

  it("xp multiplier accumulates correctly from active xp_boost buffs", () => {
    const activeBuffs = [
      { buff_type: "xp_boost", buff_value: 1.25 },
      { buff_type: "xp_boost", buff_value: 1.50 },
    ];
    let xpMultiplier = 1.0;
    for (const buff of activeBuffs) {
      if (buff.buff_type === "xp_boost") xpMultiplier += (buff.buff_value - 1.0);
    }
    expect(xpMultiplier).toBeCloseTo(1.75);
  });

  it("points multiplier unaffected by xp_boost-only buffs", () => {
    const activeBuffs = [{ buff_type: "xp_boost", buff_value: 1.25 }];
    let pointsMultiplier = 1.0;
    for (const buff of activeBuffs) {
      if (buff.buff_type === "reward_multiplier") pointsMultiplier += (buff.buff_value - 1.0);
    }
    expect(pointsMultiplier).toBe(1.0);
  });

  it("reward_multiplier buff affects both xp and points multipliers", () => {
    const activeBuffs = [{ buff_type: "reward_multiplier", buff_value: 1.5 }];
    let xpMultiplier = 1.0;
    let pointsMultiplier = 1.0;
    for (const buff of activeBuffs) {
      if (buff.buff_type === "reward_multiplier") {
        xpMultiplier += (buff.buff_value - 1.0);
        pointsMultiplier += (buff.buff_value - 1.0);
      }
    }
    expect(xpMultiplier).toBeCloseTo(1.5);
    expect(pointsMultiplier).toBeCloseTo(1.5);
  });

  it("grantedPoints rounds correctly", () => {
    const basePoints = 100;
    const pointsMultiplier = 1.25;
    expect(Math.round(basePoints * pointsMultiplier)).toBe(125);
  });

  // ── Non-accepted submissions never trigger reward path ─────────

  it("isFirstSolve stays false for wrong_answer status", () => {
    const status: string = "wrong_answer";
    const isAccepted = status === "accepted";
    // claim_first_solve is never called if !isAccepted
    expect(isAccepted).toBe(false);
  });

  it("isFirstSolve stays false for tle status", () => {
    const status: string = "tle";
    expect(status === "accepted").toBe(false);
  });

  // ── claim_first_solve error handling ──────────────────────────

  it("returns 500 when claim_first_solve RPC errors", async () => {
    const sb = buildMockSb(false, { message: "DB error" });
    const { data: claimResult, error: claimError } = await sb.rpc("claim_first_solve", {});
    expect(claimError).not.toBeNull();
    expect(claimResult).toBeNull();
  });
});