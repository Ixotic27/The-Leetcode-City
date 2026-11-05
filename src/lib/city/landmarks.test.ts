import { describe, expect, it } from "vitest";
import { generateCityLayout, type DeveloperRecord } from "@/lib/github";
import { placeCityLandmarks } from "./landmarks";

const resident = (i: number): DeveloperRecord => ({
  id: i, github_login: `user-${i}`, github_id: null, name: null, avatar_url: null, bio: null,
  contributions: 500 - i, total_stars: 0, public_repos: 0, primary_language: null, rank: i + 1,
  fetched_at: "", created_at: "", claimed: false, fetch_priority: 0, claimed_at: null,
});

describe("landmark placement", () => {
  it("gives every landmark its own downtown lot, clear of every building", () => {
    const layout = generateCityLayout(Array.from({ length: 300 }, (_, i) => resident(i)));
    const sites = placeCityLandmarks(layout.decorations);
    expect(new Set(sites.map((s) => s.join(","))).size).toBe(16);
    const downtown = layout.districtZones.find((zone) => zone.id === "downtown")!;
    for (const [x, , z] of sites) {
      expect(Math.hypot(x - downtown.center[0], z - downtown.center[2])).toBeLessThan(1200);
      expect(layout.buildings.some((b) => Math.abs(b.position[0] - x) < 80 && Math.abs(b.position[2] - z) < 68)).toBe(false);
    }
  });

  it("still returns a position for every landmark in an empty city", () => {
    expect(placeCityLandmarks([])).toHaveLength(16);
  });
});
