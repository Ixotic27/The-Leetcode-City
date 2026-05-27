import { describe, it, expect } from "vitest";
import { wrapInBaseTemplate } from "./email-template";

describe("wrapInBaseTemplate", () => {
  it("includes the provided content", () => {
    const result = wrapInBaseTemplate("<p>Hello</p>");

    expect(result).toContain("<p>Hello</p>");
  });

  it("returns valid html structure", () => {
    const result = wrapInBaseTemplate("<p>Test</p>");

    expect(result).toContain("<html");
    expect(result).toContain("</html>");
  });

  it("returns a string", () => {
    const result = wrapInBaseTemplate("<p>Test</p>");

    expect(typeof result).toBe("string");
  });
});