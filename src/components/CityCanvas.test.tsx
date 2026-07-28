import { describe, expect, it } from "vitest";
import { getCityCanvasAccessibilityText } from "./CityCanvas";

describe("CityCanvas accessibility text", () => {
  it("returns the expected label for a focused building", () => {
    expect(getCityCanvasAccessibilityText("octocat")).toBe(
      "Viewing octocat's building",
    );
  });

  it("returns the fallback label when no building is focused", () => {
    expect(getCityCanvasAccessibilityText(null)).toBe("No building selected");
  });
});
