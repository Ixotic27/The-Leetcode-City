import { describe, it, expect } from "vitest";
import { generateCityLayout } from "../github";

// Generate 50 dummy developers with extremely high stats to fill the downtown tier
const dummyDevs = Array.from({ length: 50 }, (_, i) => ({
  github_login: `dummy_dev_${i}`,
  contributions: 50000, // Extremely high to sort first
  total_stars: 100000,
  public_repos: 500,
  primary_language: "TypeScript",
  rank: i + 1,
}));

const mockDevs = [
  ...dummyDevs,
  { github_login: "dev1", contributions: 0, total_stars: 0, public_repos: 0, primary_language: "TypeScript", rank: 100 }, // frontend (Mumbai, north)
  { github_login: "dev2", contributions: 0, total_stars: 0, public_repos: 0, primary_language: "Java", rank: 101 },       // backend (Hyderabad, east)
  { github_login: "dev3", contributions: 0, total_stars: 0, public_repos: 0, primary_language: "Python", rank: 102 },     // data_ai (Ahmedabad, north-west)
];

describe("Multi-City Layout Positioning Tests", () => {
  const layout = generateCityLayout(mockDevs as any);
  const plaza = (district: string) => layout.plazas.find((p) => p.district === district)!.position;

  it("sets each district on its compass slot around downtown", () => {
    const [dx, , dz] = plaza("downtown");
    const [fx, , fz] = plaza("frontend");
    const [bx, , bz] = plaza("backend");
    const [ax, , az] = plaza("data_ai");
    // Same column / row as downtown, separated by at least a civic square plus the channel.
    expect(fx).toBe(dx);
    expect(fz - dz).toBeGreaterThan(500);
    expect(bz).toBe(dz);
    expect(bx - dx).toBeGreaterThan(500);
    expect(ax).toBeLessThan(dx);
    expect(az).toBe(fz);
  });

  it("places each resident inside their own district, next to its square", () => {
    for (const [login, district] of [["dev1", "frontend"], ["dev2", "backend"], ["dev3", "data_ai"]]) {
      const building = layout.buildings.find((b) => b.login === login)!;
      const [px, , pz] = plaza(district);
      expect(building.district).toBe(district);
      expect(Math.hypot(building.position[0] - px, building.position[2] - pz)).toBeLessThan(500);
    }
  });

  it("sets district property for all placed buildings", () => {
    for (const b of layout.buildings) {
      expect(b.district).toBeDefined();
      expect(typeof b.district).toBe("string");
    }
  });
});
