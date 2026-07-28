import { describe, it, expect } from "vitest";
import { generateCityLayout, DISTRICT_ORIGINS } from "../github";

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
  {
    github_login: "dev1",
    contributions: 0,
    total_stars: 0,
    public_repos: 0,
    primary_language: "TypeScript", // frontend (Mumbai: [0, 0, 4000])
    rank: 100,
  },
  {
    github_login: "dev2",
    contributions: 0,
    total_stars: 0,
    public_repos: 0,
    primary_language: "Java", // backend (Hyderabad: [3500, 0, 0])
    rank: 101,
  },
  {
    github_login: "dev3",
    contributions: 0,
    total_stars: 0,
    public_repos: 0,
    primary_language: "Python", // fullstack (Delhi: [0, 0, -4000])
    rank: 102,
  },
];

describe("Multi-City Layout Positioning Tests", () => {
  it("computes layout and offsets building coordinates by their district origins", () => {
    const layout = generateCityLayout(mockDevs as any);

    // Check that we have generated buildings
    expect(layout.buildings.length).toBeGreaterThan(50);

    // Find building positions for each developer
    const b1 = layout.buildings.find((b) => b.login === "dev1");
    const b2 = layout.buildings.find((b) => b.login === "dev2");

    expect(b1).toBeDefined();
    expect(b2).toBeDefined();

    // dev1 primary language is TypeScript -> frontend (Mumbai origin: [0, 0, 4000])
    // The building Z coordinate should be close to 4000
    expect(b1!.position[2]).toBeGreaterThan(3000);
    expect(b1!.position[2]).toBeLessThan(5000);

    // dev2 primary language is Java -> backend (Hyderabad origin: [3500, 0, 0])
    // The building X coordinate should be close to 3500
    expect(b2!.position[0]).toBeGreaterThan(2500);
    expect(b2!.position[0]).toBeLessThan(4500);
  });

  it("assigns plazas to correct district names and offsets them dynamically", () => {
    const layout = generateCityLayout(mockDevs as any);
    expect(layout.plazas.length).toBeGreaterThan(0);

    // Plazas should be grouped/assigned to their districts
    const frontendPlaza = layout.plazas.find((p) => p.district === "frontend");
    const backendPlaza = layout.plazas.find((p) => p.district === "backend");

    expect(frontendPlaza).toBeDefined();
    expect(backendPlaza).toBeDefined();

    // Frontend plaza coordinate matches DISTRICT_ORIGINS.frontend + gridToWorld(0, 0)
    expect(frontendPlaza!.position[0]).toBe(DISTRICT_ORIGINS.frontend[0]);
    expect(frontendPlaza!.position[2]).toBe(DISTRICT_ORIGINS.frontend[2] + 150);

    // Backend plaza coordinate matches DISTRICT_ORIGINS.backend + gridToWorld(0, 0)
    expect(backendPlaza!.position[0]).toBe(DISTRICT_ORIGINS.backend[0]);
    expect(backendPlaza!.position[2]).toBe(DISTRICT_ORIGINS.backend[2] + 150);
  });

  it("sets district property for all placed buildings", () => {
    const layout = generateCityLayout(mockDevs as any);
    for (const b of layout.buildings) {
      expect(b.district).toBeDefined();
      expect(typeof b.district).toBe("string");
    }
  });
});
