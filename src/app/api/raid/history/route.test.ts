import { parsePagination } from "../../../../lib/parse-pagination";

describe("raid history pagination parsing", () => {
  it("defaults invalid limit values to 20", () => {
    expect(parsePagination("abc", null).limit).toBe(20);
  });

  it("defaults missing limit values to 20", () => {
    expect(parsePagination(null, null).limit).toBe(20);
  });

  it("clamps negative and zero limits to the first valid page size", () => {
    expect(parsePagination("-5", null).limit).toBe(1);
    expect(parsePagination("0", null).limit).toBe(1);
  });

  it("caps large limit values at the maximum page size", () => {
    expect(parsePagination("500", null).limit).toBe(50);
  });

  it("keeps valid limit values unchanged", () => {
    expect(parsePagination("12", null).limit).toBe(12);
  });

  it("defaults invalid offsets to 0", () => {
    expect(parsePagination("12", "oops").offset).toBe(0);
    expect(parsePagination("12", "-10").offset).toBe(0);
  });
});
