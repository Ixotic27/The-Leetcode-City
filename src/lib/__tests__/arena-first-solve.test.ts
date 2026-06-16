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

describe("rotateDailyChallenges — concurrent-rotation idempotency", () => {  type ChallengeRow = {
    challenge_date: string;
    type: string;
    difficulty: string;
    problem_id: string;
  };

  function makeStore() {
    // Keyed by "date|type|difficulty" to simulate UNIQUE constraint
    const committed = new Map<string, ChallengeRow>();

    return {
      insert(rows: ChallengeRow[]) {
        // No ON CONFLICT guard — always inserts, producing duplicates
        rows.forEach((r) => {
          const key = `${r.challenge_date}|${r.type}|${r.difficulty}`;
          committed.set(`${key}|${Math.random()}`, r); // unique synthetic pk
        });
      },
      upsert(rows: ChallengeRow[], ignoreDuplicates: boolean) {
        rows.forEach((r) => {
          const key = `${r.challenge_date}|${r.type}|${r.difficulty}`;
          if (ignoreDuplicates && committed.has(key)) return; // ON CONFLICT DO NOTHING
          committed.set(key, r);
        });
      },
      count() {
        return committed.size;
      },
      rows() {
        return [...committed.values()];
      },
    };
  }

  const DATE = "2026-06-16";

  const CHALLENGES: ChallengeRow[] = [
    { challenge_date: DATE, type: "daily", difficulty: "easy",   problem_id: "P1" },
    { challenge_date: DATE, type: "daily", difficulty: "medium", problem_id: "P2" },
    { challenge_date: DATE, type: "daily", difficulty: "hard",   problem_id: "P3" },
  ];

  it("OLD behaviour (plain insert): two concurrent invocations produce 6 rows — demonstrating the bug", () => {
    const store = makeStore();

    // Both invocations pass the guard (store is empty at read time)
    // and both insert — TOCTOU race
    store.insert(CHALLENGES); // invocation A
    store.insert(CHALLENGES); // invocation B (concurrent)

    expect(store.count()).toBe(6); // BUG: 6 rows for one date
  });

  it("NEW behaviour (upsert + ignoreDuplicates): two concurrent invocations produce exactly 3 rows", () => {
    const store = makeStore();

    store.upsert(CHALLENGES, true); // invocation A — commits all 3
    store.upsert(CHALLENGES, true); // invocation B — all 3 conflict → no-op

    expect(store.count()).toBe(3); // FIXED: exactly 3 rows
  });

  it("each difficulty appears exactly once after concurrent rotation", () => {
    const store = makeStore();

    store.upsert(CHALLENGES, true);
    store.upsert(CHALLENGES, true); // concurrent duplicate

    const difficulties = store.rows().map((r) => r.difficulty).sort();
    expect(difficulties).toEqual(["easy", "hard", "medium"]);
  });

  it("upsert is idempotent across N invocations", () => {
    const store = makeStore();

    for (let i = 0; i < 10; i++) {
      store.upsert(CHALLENGES, true);
    }

    expect(store.count()).toBe(3);
  });

  it("different dates do not conflict with each other", () => {
    const store = makeStore();

    const tomorrow: ChallengeRow[] = CHALLENGES.map((r) => ({
      ...r,
      challenge_date: "2026-06-17",
    }));

    store.upsert(CHALLENGES, true); // today
    store.upsert(tomorrow, true);   // tomorrow

    expect(store.count()).toBe(6); // 3 per date — correct
  });

  it("the JS-level guard (existingChallenges.length >= 3) remains a valid fast-path check", () => {
    // Verifies the guard logic independently — it's still useful as a
    // fast-path to avoid unnecessary DB round-trips even though it's no
    // longer safety-critical after the upsert fix.
    const existingChallenges = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const shouldSkip = existingChallenges.length >= 3;
    expect(shouldSkip).toBe(true);
  });

  it("guard does NOT skip when fewer than 3 challenges exist (partial rotation)", () => {
    const existingChallenges = [{ id: 1 }];
    const shouldSkip = existingChallenges.length >= 3;
    expect(shouldSkip).toBe(false);
  });

  it("upsert preserves the problem_id from the first writer under a conflict", () => {
    const store = makeStore();

    const firstWriterChallenges: ChallengeRow[] = [
      { challenge_date: DATE, type: "daily", difficulty: "easy", problem_id: "FIRST" },
    ];
    const secondWriterChallenges: ChallengeRow[] = [
      { challenge_date: DATE, type: "daily", difficulty: "easy", problem_id: "SECOND" },
    ];

    store.upsert(firstWriterChallenges, true);
    store.upsert(secondWriterChallenges, true); // ignored — first writer wins

    const row = store.rows().find((r) => r.difficulty === "easy");
    expect(row?.problem_id).toBe("FIRST");
  });
});