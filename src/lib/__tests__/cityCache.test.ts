import { getCityCache, setCityCache, clearCityCache } from "../cityCache";

const mockData = {
  buildings: [],
  plazas: [],
  decorations: [],
  river: null,
  bridges: [],
  districtZones: [],
  stats: { total_developers: 0, total_contributions: 0 },
};

describe("cityCache", () => {
  beforeEach(() => {
    clearCityCache();
  });

  it("returns null before anything is set", () => {
    expect(getCityCache()).toBeNull();
  });

  it("returns data immediately after set", () => {
    setCityCache(mockData);
    const cached = getCityCache();
    expect(cached).not.toBeNull();
    expect(cached?.stats.total_developers).toBe(0);
  });

  it("clearCityCache invalidates immediately", () => {
    setCityCache(mockData);
    clearCityCache();
    expect(getCityCache()).toBeNull();
  });

  it("returns null after TTL expires", () => {
    const realNow = Date.now;
    setCityCache(mockData);

    // Advance time past the 5-minute TTL
    Date.now = () => realNow() + 5 * 60 * 1000 + 1;

    expect(getCityCache()).toBeNull();

    Date.now = realNow;
  });

  it("returns cached data within TTL", () => {
    const realNow = Date.now;
    setCityCache(mockData);

    // Advance time just under the TTL
    Date.now = () => realNow() + 4 * 60 * 1000;

    expect(getCityCache()).not.toBeNull();

    Date.now = realNow;
  });

  it("overwrites previous cache on second set", () => {
    setCityCache(mockData);
    setCityCache({ ...mockData, stats: { total_developers: 99, total_contributions: 500 } });
    expect(getCityCache()?.stats.total_developers).toBe(99);
  });
});