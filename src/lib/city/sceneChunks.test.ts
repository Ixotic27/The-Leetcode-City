import { describe, expect, it } from "vitest";
import * as THREE from "three";
import type { CityBuilding } from "@/lib/github";
import { chunkHasFocus, createBuildingChunks, isChunkWithinRange } from "./sceneChunks";

const building = (login: string, x: number, z: number, height = 40) => ({
  login, position: [x, 0, z], width: 20, depth: 30, height,
}) as CityBuilding;

describe("building chunks", () => {
  it("keeps grid keys stable when residents move within a cell or new residents arrive", () => {
    const original = createBuildingChunks([building("alice", 10, 20), building("bob", -10, 20)]);
    const updated = createBuildingChunks([building("alice", 100, 20), building("bob", -10, 20), building("carol", 500, 600)]);
    expect(original.map((chunk) => chunk.key)).toEqual(["0,0", "-1,0"]);
    expect(updated.map((chunk) => chunk.key)).toEqual(original.map((chunk) => chunk.key));
    expect(updated[0].buildings.map((resident) => resident.login)).toEqual(["alice", "carol"]);
  });

  it("includes the entire width, depth and height in bounds", () => {
    const [chunk] = createBuildingChunks([building("tower", 100, -100, 1000)]);
    expect(chunk.bounds.distanceToPoint(new THREE.Vector3(110, 1000, -85))).toBeLessThan(1e-8);
    expect(chunk.bounds.distanceToPoint(new THREE.Vector3(90, 0, -115))).toBeLessThan(1e-8);
    expect(isChunkWithinRange(chunk, new THREE.Vector3(100, 1300, -100), 400)).toBe(true);
    expect(isChunkWithinRange(chunk, new THREE.Vector3(10000, 0, 0), 400)).toBe(false);
  });

  it("finds either focused profile even when its chunk is outside the initial mount batch", () => {
    const chunks = createBuildingChunks([building("Alice", 20000, 0), building("bob", -20000, 0)]);
    expect(chunkHasFocus(chunks[0], "alice", null)).toBe(true);
    expect(chunkHasFocus(chunks[1], null, "bob")).toBe(true);
    expect(chunkHasFocus(chunks[0], null, null)).toBe(false);
    expect(chunkHasFocus(chunks[0], "missing", "bob")).toBe(false);
  });
});
