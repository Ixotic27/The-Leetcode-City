/**
 * Tests for the arena_ratings concurrent-write race condition fix.
 * Verifies that update_arena_ratings_atomic RPC is called with the
 * correct arguments in all submission scenarios, and that the
 * old read-then-upsert pattern no longer exists in this handler.
 */

import { POST } from "../route";
import { NextRequest } from "next/server";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockRpc = jest.fn();
const mockFrom = jest.fn();

jest.mock("@/lib/supabase", () => ({
  getSupabaseAdmin: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

jest.mock("@/lib/arena", () => ({
  getAuthenticatedDeveloper: jest.fn().mockResolvedValue({ id: 42 }),
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: object) {
  return new NextRequest("http://localhost/api/arena/submit", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function setupMocks({
  insertError = null,
  claimResult = [{ won_race: true }],
  ratingsError = null,
}: {
  insertError?: any;
  claimResult?: any;
  ratingsError?: any;
} = {}) {
  // Default chain: .from().select().eq().gt() → activeBuffs
  //                .from().insert()           → submission insert
  const chainDefault = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
    insert: jest.fn().mockResolvedValue({ error: insertError }),
  };
  mockFrom.mockReturnValue(chainDefault);

  mockRpc.mockImplementation((name: string) => {
    if (name === "claim_first_solve")
      return Promise.resolve({ data: claimResult, error: null });
    if (name === "grant_xp_atomic")
      return Promise.resolve({ data: null, error: null });
    if (name === "update_arena_ratings_atomic")
      return Promise.resolve({ data: null, error: ratingsError });
    // upsert_arena_inventory_item (item drops — none in these tests)
    return Promise.resolve({ data: null, error: null });
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("POST /api/arena/submit — atomic ratings update", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("calls update_arena_ratings_atomic (not a direct upsert) on every submission", async () => {
    setupMocks();

    await POST(
      makeRequest({
        problem_id: "two-sum",
        status: "accepted",
        language: "typescript",
      })
    );

    const rpcCalls = mockRpc.mock.calls.map(([name]) => name);
    expect(rpcCalls).toContain("update_arena_ratings_atomic");
  });

  it("never calls arena_ratings.upsert directly from the route", async () => {
    setupMocks();

    await POST(
      makeRequest({
        problem_id: "two-sum",
        status: "accepted",
        language: "typescript",
      })
    );

    // If the old code path ran it would call sb.from("arena_ratings").upsert(...)
    const upsertCalls = mockFrom.mock.calls.filter(
      ([table]: [string]) => table === "arena_ratings"
    );
    expect(upsertCalls).toHaveLength(0);
  });

  it("passes is_accepted=true and is_first_solve=true for first accepted solve", async () => {
    setupMocks({ claimResult: [{ won_race: true }] });

    await POST(
      makeRequest({
        problem_id: "valid-parentheses",
        status: "accepted",
        language: "python",
      })
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "update_arena_ratings_atomic",
      expect.objectContaining({
        p_user_id:        42,
        p_is_accepted:    true,
        p_is_first_solve: true,
      })
    );
  });

  it("passes is_first_solve=false when claim_first_solve loses the race", async () => {
    setupMocks({ claimResult: [{ won_race: false }] });

    await POST(
      makeRequest({
        problem_id: "valid-parentheses",
        status: "accepted",
        language: "python",
      })
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "update_arena_ratings_atomic",
      expect.objectContaining({
        p_is_accepted:    true,
        p_is_first_solve: false,
      })
    );
  });

  it("passes is_accepted=false for a wrong-answer submission", async () => {
    setupMocks();

    await POST(
      makeRequest({
        problem_id: "merge-intervals",
        status: "wrong_answer",
        language: "java",
      })
    );

    expect(mockRpc).toHaveBeenCalledWith(
      "update_arena_ratings_atomic",
      expect.objectContaining({
        p_is_accepted:    false,
        p_is_first_solve: false,
      })
    );
  });

  it("returns 500 when update_arena_ratings_atomic errors", async () => {
    setupMocks({ ratingsError: { message: "deadlock detected" } });

    const res = await POST(
      makeRequest({
        problem_id: "two-sum",
        status: "accepted",
        language: "typescript",
      })
    );

    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error).toBe("Failed to update ratings");
  });

  it("still returns 500 on submission insert failure (pre-ratings path)", async () => {
    setupMocks({ insertError: { message: "unique constraint" } });

    const res = await POST(
      makeRequest({
        problem_id: "two-sum",
        status: "accepted",
        language: "typescript",
      })
    );

    expect(res.status).toBe(500);
  });
});