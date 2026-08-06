import { describe, expect, it } from "vitest";
import type { CityBuilding } from "@/lib/github";

import {
  DEV_CLASSES,
  getDevClass,
  buildComparisonRows,
  getComparisonSummary,
} from "./ComparisonPanel";

describe("getDevClass", () => {
  it("returns the same developer class for the same login", () => {
    expect(getDevClass("octocat")).toBe(getDevClass("octocat"));
  });

  it("always returns one of the predefined developer classes", () => {
    expect(DEV_CLASSES).toContain(getDevClass("octocat"));
    expect(DEV_CLASSES).toContain(getDevClass("torvalds"));
    expect(DEV_CLASSES).toContain(getDevClass(""));
  });
});

const devA = {
  login: "alice",
  rank: 1000,
  contributions: 400,
  total_stars: 200,
  // Rank boost (500000 - lcRank) — must NOT be treated as LC Rank
  public_repos: 499000,
  kudos_count: 50,
} as CityBuilding;

const devB = {
  login: "bob",
  rank: 5000,
  contributions: 300,
  total_stars: 100,
  public_repos: 495000,
  kudos_count: 30,
} as CityBuilding;

describe("buildComparisonRows", () => {
  it("calculates comparison rows correctly", () => {
    const { cmpRows, totalAWins, totalBWins } = buildComparisonRows([
      devA as CityBuilding,
      devB as CityBuilding,
    ]);

    expect(cmpRows).toHaveLength(5);
    expect(totalAWins).toBeGreaterThan(totalBWins);
  });

  it("uses actual LC rank instead of public_repos boost", () => {
    const { cmpRows } = buildComparisonRows([devA, devB]);
    const lc = cmpRows.find((r) => r.id === "lc_rank");
    expect(lc).toBeDefined();
    expect(lc!.a).toBe(1000);
    expect(lc!.b).toBe(5000);
    expect(lc!.aW).toBe(true);
    expect(lc!.bW).toBe(false);
  });

  it("marks unavailable LC ranks as N/A (0) instead of boost scores", () => {
    const unranked = {
      ...devB,
      rank: 999999,
      public_repos: 0,
    } as CityBuilding;
    const { cmpRows } = buildComparisonRows([devA, unranked]);
    const lc = cmpRows.find((r) => r.id === "lc_rank");
    expect(lc!.b).toBe(0);
    expect(lc!.aW).toBe(true);
  });
});

describe("getComparisonSummary", () => {
  it("returns winner summary", () => {
    expect(getComparisonSummary([devA, devB], 4, 1)).toBe("@alice wins 4-1");
  });

  it("returns tie summary", () => {
    expect(getComparisonSummary([devA, devB], 2, 2)).toBe("Tie 2-2");
  });
});
