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
  rank: 10,
  contributions: 400,
  total_stars: 200,
  public_repos: 15,
  kudos_count: 50,
} as CityBuilding;

const devB = {
  login: "bob",
  rank: 20,
  contributions: 300,
  total_stars: 100,
  public_repos: 25,
  kudos_count: 30,
} as CityBuilding;


describe("buildComparisonRows", () => {
  it("calculates comparison rows correctly", () => {
    const { cmpRows, totalAWins, totalBWins } =
      buildComparisonRows([
        devA as CityBuilding,
        devB as CityBuilding,
      ]);

    expect(cmpRows).toHaveLength(5);

    expect(totalAWins).toBeGreaterThan(totalBWins);
  });
});

describe("getComparisonSummary", () => {
  it("returns winner summary", () => {
    expect(
      getComparisonSummary([devA, devB], 4, 1)
    ).toBe("@alice wins 4-1");
  });

  it("returns tie summary", () => {
    expect(
      getComparisonSummary([devA, devB], 2, 2)
    ).toBe("Tie 2-2");
  });
});
