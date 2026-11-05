import { describe, expect, it } from "vitest";
import { generateCityLayout, type DeveloperRecord } from "@/lib/github";
import { auditCityLayout } from "./layoutAudit";

function residents(count: number, extra: (i: number) => Partial<DeveloperRecord> = () => ({})): DeveloperRecord[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i, github_login: `lc-user-${i}`, github_id: null, name: null, avatar_url: null, bio: null,
    contributions: (i * 7919) % 3000, total_stars: (i * 31) % 500, public_repos: (i * 17) % 120,
    primary_language: null, rank: i + 1, fetched_at: "", created_at: "", claimed: false,
    fetch_priority: 0, claimed_at: null, ...extra(i),
  }));
}

const clean = {
  buildingOverlaps: 0, propsInBuildings: 0, propsOnRoads: 0, landmarkOverlaps: 0, waterOverBuildings: 0,
  waterOverRoads: 0, riverOverBuildings: 0, plazaOverBuildings: 0, districtIntrusions: 0,
  roadsOverBuildings: 0, propsInWater: 0, propOverlaps: 0, islandOverlaps: 0, vehiclesOffRoad: 0, parkedInTrafficLanes: 0,
};

describe("city master plan", () => {
  it("has no abnormalities for an empty, tiny or single-resident city", () => {
    for (const count of [0, 1, 7, 60]) {
      const layout = generateCityLayout(residents(count));
      expect(layout.buildings).toHaveLength(count);
      expect(auditCityLayout(layout)).toEqual(clean);
    }
  });

  it("spreads language-less LeetCode residents evenly over every city", () => {
    const layout = generateCityLayout(residents(6000));
    const population = layout.districtZones.filter((zone) => zone.id !== "downtown").map((zone) => zone.population);
    expect(population).toHaveLength(10);
    expect(Math.max(...population) / Math.min(...population)).toBeLessThan(1.3);
    // Parks (one pond each) stay near their 10% share instead of clustering into empty quarters.
    const blocks = layout.decorations.filter((d) => d.type === "sidewalk").length - layout.plazas.length;
    expect(layout.canals.length / blocks).toBeGreaterThan(0.05);
    expect(layout.canals.length / blocks).toBeLessThan(0.16);
    expect(auditCityLayout(layout)).toEqual(clean);
  });

  it("stays clean when one district grows far past the others, with bungalows mixed in", () => {
    const layout = generateCityLayout(residents(30000, (i) => ({
      district: i % 5 ? "frontend" : null, district_chosen: i % 5 !== 0,
      building_style: i % 97 === 0 ? "bungalow" : undefined,
    })));
    expect(layout.buildings).toHaveLength(30000);
    expect(auditCityLayout(layout)).toEqual(clean);
  }, 60_000);

  it("is deterministic", () => {
    const a = generateCityLayout(residents(800));
    const b = generateCityLayout(residents(800));
    expect(b.buildings.map((x) => x.position)).toEqual(a.buildings.map((x) => x.position));
    expect(b.decorations.length).toBe(a.decorations.length);
  });
});
