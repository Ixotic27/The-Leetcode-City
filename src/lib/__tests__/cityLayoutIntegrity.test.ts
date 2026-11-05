import { describe, expect, it } from "vitest";
import { generateCityLayout, type CityBuilding, type DeveloperRecord } from "../github";

function footprintCollisions(buildings: CityBuilding[]): string[] {
  const collisions: string[] = [];
  for (let a = 0; a < buildings.length; a++) {
    for (let b = a + 1; b < buildings.length; b++) {
      const left = buildings[a], right = buildings[b];
      if (Math.abs(left.position[0] - right.position[0]) < (left.width + right.width) / 2
        && Math.abs(left.position[2] - right.position[2]) < (left.depth + right.depth) / 2) {
        collisions.push(`${left.login} overlaps ${right.login}`);
      }
    }
  }
  return collisions;
}

function developer(index: number, extra: Partial<DeveloperRecord> = {}): DeveloperRecord {
  return {
    id: index, github_login: `resident-${index}`, github_id: null,
    name: null, avatar_url: null, bio: null, contributions: 1000 - index,
    total_stars: 0, public_repos: 0, primary_language: "TypeScript",
    rank: index + 1, fetched_at: "", created_at: "", claimed: false,
    fetch_priority: 0, claimed_at: null, ...extra,
  };
}

describe("city layout integrity", () => {
  it("keeps every resident's footprint separate as a district grows", () => {
    const records = Array.from({ length: 1100 }, (_, index) => developer(index));
    const { buildings } = generateCityLayout(records);
    expect(buildings).toHaveLength(records.length);
    expect(footprintCollisions(buildings)).toEqual([]);
  });

  it("reserves enough lots for the existing full-size bungalow", () => {
    const records = Array.from({ length: 110 }, (_, index) => developer(index, {
      building_style: index % 3 === 0 ? "bungalow" : "tower",
    }));
    const { buildings } = generateCityLayout(records);
    // A bungalow fills a 2x2 lot (2 * 38 + 3 by 2 * 32 + 3) without touching its neighbours.
    const bungalow = buildings.find((building) => building.building_style === "bungalow")!;
    expect(bungalow.width).toBeGreaterThan(70);
    expect(bungalow.width).toBeLessThan(79);
    expect(bungalow.depth).toBeLessThan(67);
    expect(footprintCollisions(buildings)).toEqual([]);
  });

  it("ignores a district that was backfilled rather than chosen", () => {
    const records = Array.from({ length: 400 }, (_, index) => developer(index, { district: "fullstack", primary_language: null }));
    const districts = new Set(generateCityLayout(records).buildings.map((building) => building.district));
    expect(districts.size).toBeGreaterThan(8);
  });

  it("merges old district aliases and explicit downtown residents into one district each", () => {
    const records = [
      ...Array.from({ length: 50 }, (_, index) => developer(index)),
      developer(70, { district: "data", district_chosen: true }),
      developer(71, { district: "data_ai", district_chosen: true }),
      developer(72, { district: "algorithms", district_chosen: true }),
      developer(73, { district: "security", district_chosen: true }),
      developer(74, { district: "downtown", district_chosen: true }),
    ];
    const { buildings, plazas } = generateCityLayout(records);
    expect(buildings.find((building) => building.login === "resident-70")?.district).toBe("data_ai");
    expect(buildings.find((building) => building.login === "resident-72")?.district).toBe("security");
    expect(plazas.filter((plaza) => plaza.district === "downtown")).toHaveLength(1);
    expect(new Set(buildings.map((building) => building.position.join(","))).size).toBe(records.length);
  });
});
