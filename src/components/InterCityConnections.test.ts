import { describe, expect, it } from "vitest";
import { trimToDistricts } from "./InterCityConnections";

describe("trimToDistricts", () => {
  it("runs a Z-axis link from one district's waterfront to the other's", () => {
    expect(trimToDistricts([500, 0, 500], [500, 0, 3000], [400, 360], [900, 800])).toEqual([[500, 0, 860], [500, 0, 2200]]);
  });

  it("uses the X half-extent for an X-axis link", () => {
    expect(trimToDistricts([3000, 0, 0], [0, 0, 0], [1000, 50], [500, 50])).toEqual([[2000, 0, 0], [500, 0, 0]]);
  });

  it("returns null when the districts touch or coincide", () => {
    expect(trimToDistricts([0, 0, 0], [1000, 0, 0], [500, 500], [500, 500])).toBeNull();
    expect(trimToDistricts([0, 0, 0], [0, 0, 0], [10, 10], [10, 10])).toBeNull();
  });
});
