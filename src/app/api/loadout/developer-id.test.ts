import { parseDeveloperId } from "./developer-id";

describe("parseDeveloperId", () => {
  it("returns null for non-numeric developer IDs", () => {
    expect(parseDeveloperId("abc")).toBeNull();
    expect(parseDeveloperId("123abc")).toBeNull();
    expect(parseDeveloperId("-5")).toBeNull();
    expect(parseDeveloperId("0")).toBeNull();
  });

  it("returns parsed numeric developer IDs", () => {
    expect(parseDeveloperId("42")).toBe(42);
  });
});
