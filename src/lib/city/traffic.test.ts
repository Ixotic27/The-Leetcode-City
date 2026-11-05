import { describe, expect, it } from "vitest";
import { CAR_HALF_LENGTH, CAR_HALF_WIDTH, laneOffsets, planTraffic, wrapAlong, type TrafficRoad } from "./traffic";

describe("traffic lanes", () => {
  it("leaves streets and boulevard carriageways to parked cars", () => {
    expect(laneOffsets(14)).toEqual([]);
    expect(laneOffsets(16)).toEqual([]);
  });

  it.each([40, 90])("keeps width-%i lanes on the road and out of the curb lane", (w) => {
    const lanes = laneOffsets(w);
    expect(lanes.length).toBeGreaterThan(0);
    for (const o of lanes) {
      expect(Math.abs(o) + CAR_HALF_WIDTH).toBeLessThan(w / 2);
      expect(Math.abs(o)).toBeLessThanOrEqual(w / 2 - 3);
      expect(Math.abs(o)).toBeGreaterThan(CAR_HALF_WIDTH); // never straddles the centerline
    }
    // Both directions get the same number of lanes.
    expect(lanes.filter((o) => o > 0).length).toBe(lanes.filter((o) => o < 0).length);
  });

  it("wraps positions back into the segment", () => {
    for (const s of [-500, -10, 0, 9.99, 10, 37, 1e4]) {
      const w = wrapAlong(s, 10);
      expect(w).toBeGreaterThanOrEqual(-10);
      expect(w).toBeLessThan(10);
    }
  });

  it("plans a capped, deterministic fleet that never leaves its segment", () => {
    const roads: TrafficRoad[] = [];
    for (let i = 0; i < 60; i++) {
      roads.push({ position: [i * 200, 0.05, 0], rotation: 0, size: [14, 300] });
      roads.push({ position: [0, 0.05, i * 200], rotation: Math.PI / 2, size: [i % 5 ? 40 : 90, 500] });
    }
    const plan = planTraffic(roads, 400);
    expect(plan.count).toBeGreaterThan(50);
    expect(plan.count).toBeLessThanOrEqual(400);
    expect(Array.from(planTraffic(roads, 400).s)).toEqual(Array.from(plan.s));

    for (let i = 0; i < plan.count; i++) {
      expect(plan.half[i]).toBeGreaterThan(0);
      let s = plan.s[i];
      for (let t = 0; t < 200; t++) {
        s = wrapAlong(s + plan.speed[i] * 0.1, plan.half[i]);
        expect(Math.abs(s) + CAR_HALF_LENGTH).toBeLessThanOrEqual(plan.half[i] + CAR_HALF_LENGTH + 1e-3);
      }
      // Travel direction is parallel to the road axis.
      expect(Math.hypot(plan.dx[i], plan.dz[i])).toBeCloseTo(1);
    }
  });
});
