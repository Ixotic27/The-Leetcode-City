import {
  generateCityLayout,
  getCircularCityPosition,
  getCircularCityRadius,
  type DeveloperRecord,
} from "../github";

function makeDev(index: number): DeveloperRecord {
  return {
    id: index + 1,
    github_login: `dev-${index}`,
    github_id: index + 10_000,
    name: `Developer ${index}`,
    avatar_url: null,
    bio: null,
    contributions: 40 + index * 3,
    public_repos: 8 + (index % 25),
    total_stars: 12 + index * 7,
    primary_language: index % 2 === 0 ? "TypeScript" : "Python",
    rank: index + 1,
    fetched_at: "2026-05-31T00:00:00.000Z",
    created_at: "2020-01-01T00:00:00.000Z",
    claimed: index % 4 === 0,
    fetch_priority: 0,
    claimed_at: null,
    easy_solved: 20 + index,
    medium_solved: 10 + index,
    hard_solved: index % 9,
  };
}

describe("circular city layout", () => {
  it("returns finite organic polar positions outside the landmark center", () => {
    const positions = Array.from({ length: 64 }, (_, index) =>
      getCircularCityPosition(index, 64, `dev-${index}`),
    );

    for (const position of positions) {
      expect(Number.isFinite(position.x)).toBe(true);
      expect(Number.isFinite(position.z)).toBe(true);
      expect(Number.isFinite(position.radius)).toBe(true);
      expect(position.radius).toBeGreaterThan(130);
      expect(position.scale).toBeGreaterThan(0.7);
      expect(position.scale).toBeLessThanOrEqual(1);
    }

    const uniqueAngles = new Set(positions.map((position) => position.angle.toFixed(3)));
    expect(uniqueAngles.size).toBeGreaterThan(50);
  });

  it("keeps existing slots stable when the city expands outward", () => {
    const firstWave = Array.from({ length: 40 }, (_, index) =>
      getCircularCityPosition(index, 40, `dev-${index}`),
    );
    const expandedWave = Array.from({ length: 40 }, (_, index) =>
      getCircularCityPosition(index, 140, `dev-${index}`),
    );

    for (let i = 0; i < firstWave.length; i++) {
      expect(Math.round(firstWave[i].x)).toBe(Math.round(expandedWave[i].x));
      expect(Math.round(firstWave[i].z)).toBe(Math.round(expandedWave[i].z));
      expect(firstWave[i].ring).toBe(expandedWave[i].ring);
    }
  });

  it("expands platform radius as new rings are needed", () => {
    expect(getCircularCityRadius(500)).toBeGreaterThan(getCircularCityRadius(50));
    expect(getCircularCityRadius(5_000)).toBeGreaterThan(getCircularCityRadius(500));
  });

  it("generates a circular city with a clear central landmark and ring plazas", () => {
    const layout = generateCityLayout(Array.from({ length: 120 }, (_, index) => makeDev(index)));

    expect(layout.buildings).toHaveLength(120);
    expect(layout.plazas.length).toBeGreaterThan(6);
    expect(layout.decorations.length).toBeGreaterThan(40);
    expect(layout.plazas[0].position).toEqual([0, 0, 0]);
    expect(
      layout.decorations.some(
        (decoration) =>
          decoration.type === "fountain" &&
          decoration.position[0] === 0 &&
          decoration.position[2] === 0,
      ),
    ).toBe(false);

    const nearestBuildingRadius = Math.min(
      ...layout.buildings.map((building) =>
        Math.hypot(building.position[0], building.position[2]),
      ),
    );
    expect(nearestBuildingRadius).toBeGreaterThan(130);

    const farthestBuildingRadius = Math.max(
      ...layout.buildings.map((building) =>
        Math.hypot(building.position[0], building.position[2]),
      ),
    );
    expect(farthestBuildingRadius).toBeGreaterThan(260);
  });
});
