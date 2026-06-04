import { describe, expect, it } from "vitest";
import {
  FLY_MISSION_QUOTA_POINTS,
  hasExceededFlyMissionQuota,
} from "./fly-quota";

describe("hasExceededFlyMissionQuota", () => {
  it("does not match the mission quota at exactly 50 PX", () => {
    expect(hasExceededFlyMissionQuota(FLY_MISSION_QUOTA_POINTS)).toBe(false);
  });

  it("matches the mission quota only after the player exceeds 50 PX", () => {
    expect(hasExceededFlyMissionQuota(FLY_MISSION_QUOTA_POINTS + 1)).toBe(true);
  });

  it("keeps lower fly scores below the mission quota", () => {
    expect(hasExceededFlyMissionQuota(FLY_MISSION_QUOTA_POINTS - 1)).toBe(false);
  });
});
