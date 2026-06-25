import { describe, it, expect } from "vitest";
import { buildFlyLeaderboard, type FlyScoreRow } from "../fly-leaderboard";

function row(overrides: Partial<FlyScoreRow> = {}): FlyScoreRow {
  return {
    score: 100,
    collected: 5,
    max_combo: 3,
    flight_ms: 12_000,
    created_at: "2026-06-01T00:00:00.000Z",
    developer_id: 1,
    developers: { github_login: "alice", avatar_url: "https://img/alice.png" },
    ...overrides,
  };
}

describe("buildFlyLeaderboard", () => {
  it("resolves github_login/avatar_url from a to-one object embed (regression for #714)", () => {
    // `developers` arrives as a single object for the to-one FK relationship.
    const result = buildFlyLeaderboard([row()]);
    expect(result[0].github_login).toBe("alice");
    expect(result[0].avatar_url).toBe("https://img/alice.png");
  });

  it("still resolves login/avatar if the embed arrives as an array (typegen quirk)", () => {
    const result = buildFlyLeaderboard([
      row({
        developers: [{ github_login: "bob", avatar_url: "https://img/bob.png" }],
      }),
    ]);
    expect(result[0].github_login).toBe("bob");
    expect(result[0].avatar_url).toBe("https://img/bob.png");
  });

  it("returns null login/avatar (never undefined) when the embed is missing", () => {
    const result = buildFlyLeaderboard([row({ developers: null })]);
    expect(result[0].github_login).toBeNull();
    expect(result[0].avatar_url).toBeNull();
  });

  it("keeps only the first (best) row per developer", () => {
    const result = buildFlyLeaderboard([
      row({ developer_id: 1, score: 200 }),
      row({ developer_id: 1, score: 50 }),
      row({ developer_id: 2, score: 80, developers: { github_login: "carol", avatar_url: null } }),
    ]);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ score: 200, github_login: "alice" });
    expect(result[1]).toMatchObject({ score: 80, github_login: "carol" });
  });

  it("caps the leaderboard at the requested limit", () => {
    const rows = Array.from({ length: 25 }, (_, i) =>
      row({ developer_id: i + 1, github_login: `u${i}` } as Partial<FlyScoreRow>),
    );
    expect(buildFlyLeaderboard(rows)).toHaveLength(20);
    expect(buildFlyLeaderboard(rows, 5)).toHaveLength(5);
  });

  it("projects the scalar score fields unchanged", () => {
    const result = buildFlyLeaderboard([
      row({ score: 321, collected: 9, max_combo: 7, flight_ms: 9999 }),
    ]);
    expect(result[0]).toMatchObject({
      score: 321,
      collected: 9,
      max_combo: 7,
      flight_ms: 9999,
      created_at: "2026-06-01T00:00:00.000Z",
    });
  });

  it("handles null/undefined input", () => {
    expect(buildFlyLeaderboard(null)).toEqual([]);
    expect(buildFlyLeaderboard(undefined)).toEqual([]);
  });
});
