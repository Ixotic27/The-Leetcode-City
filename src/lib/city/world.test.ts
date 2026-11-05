import { describe, expect, it } from "vitest";
import type { CityBuilding, CityDecoration } from "../github";
import { buildDistrictIslands } from "./world";

describe("district terrain bounds", () => {
  it("covers remote building footprints, rotated scenery, and isolated landmarks", () => {
    const building = { district: "creator", position: [500, 0, -7500], width: 80, depth: 60 } as CityBuilding;
    const scenery = { type: "sidewalk", position: [550, 0, -7500], size: [200, 40], rotation: Math.PI / 2 } as CityDecoration;
    const islands = buildDistrictIslands({ buildings: [building], plazas: [], decorations: [scenery], extraPoints: [[9000, 0, 9000]] });
    expect(islands).toHaveLength(2);
    expect(islands[0].bounds.minX).toBeLessThan(460);
    expect(islands[0].bounds.maxX).toBeGreaterThan(570);
    expect(islands[0].bounds.minZ).toBeLessThan(-7600);
    expect(islands[0].bounds.maxZ).toBeGreaterThan(-7400);
    expect(islands[1].center).toEqual([9000, 9000]);
  });

  it("does not invent terrain for an empty world or malformed positions", () => {
    expect(buildDistrictIslands({ buildings: [], plazas: [], decorations: [], extraPoints: [[NaN, 0, 1]] })).toEqual([]);
  });
});
