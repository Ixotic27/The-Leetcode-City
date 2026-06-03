import { parseRaidHistoryLimit } from "./limit";

describe("parseRaidHistoryLimit", () => {
  it("defaults invalid limit values to 20", () => {
    expect(parseRaidHistoryLimit("abc")).toBe(20);
  });

  it("defaults missing limit values to 20", () => {
    expect(parseRaidHistoryLimit(null)).toBe(20);
  });

  it("clamps negative and zero limits to the first valid page size", () => {
    expect(parseRaidHistoryLimit("-5")).toBe(1);
    expect(parseRaidHistoryLimit("0")).toBe(1);
  });

  it("caps large limit values at the maximum page size", () => {
    expect(parseRaidHistoryLimit("500")).toBe(50);
  });

  it("keeps valid limit values unchanged", () => {
    expect(parseRaidHistoryLimit("12")).toBe(12);
  });
});
