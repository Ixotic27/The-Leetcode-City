export const FLY_MISSION_QUOTA_POINTS = 50;

export function hasExceededFlyMissionQuota(score: number): boolean {
  return score > FLY_MISSION_QUOTA_POINTS;
}
