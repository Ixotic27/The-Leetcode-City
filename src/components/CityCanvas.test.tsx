import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { getCityCanvasAccessibilityText, isCityReadyToDraw, warmUpShaders } from "./CityCanvas";

describe("CityCanvas accessibility text", () => {
  it("returns the expected label for a focused building", () => {
    expect(getCityCanvasAccessibilityText("octocat")).toBe("Viewing octocat's building");
  });

  it("returns the fallback label when no building is focused", () => {
    expect(getCityCanvasAccessibilityText(null)).toBe("No building selected");
  });
});

describe("first-frame gating", () => {
  it("waits for buildings, but lets a loaded empty city draw", () => {
    expect(isCityReadyToDraw(0, false)).toBe(false);
    expect(isCityReadyToDraw(18_000, false)).toBe(true);
    expect(isCityReadyToDraw(0, true)).toBe(true);
  });

  const fakeRenderer = (programs: Array<{ isReady(): boolean | null } | undefined>) => {
    const materials = programs.map(() => new THREE.MeshBasicMaterial());
    const props = new Map(materials.map((m, i) => [m, { currentProgram: programs[i] }]));
    return { compile: () => new Set<THREE.Material>(materials), properties: { get: (m: unknown) => props.get(m as THREE.MeshBasicMaterial) ?? {} } } as never;
  };

  it("resolves for an empty scene", async () => {
    await expect(warmUpShaders(fakeRenderer([]), new THREE.Scene(), new THREE.PerspectiveCamera())).resolves.toBeUndefined();
  });

  it("waits until every program has linked, treating deleted programs as done", async () => {
    let polls = 0;
    const slow = { isReady: () => ++polls >= 3 };
    const deleted = { isReady: () => null };
    await warmUpShaders(fakeRenderer([slow, deleted, undefined]), new THREE.Scene(), new THREE.PerspectiveCamera());
    expect(polls).toBe(3);
  });
});
