import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  checkInMock: vi.fn(),
  resolveAuthenticatedDeveloperMock: vi.fn(),
  rateLimitMock: vi.fn(),
}));

vi.mock("@/lib/authenticated-developer", () => ({
  resolveAuthenticatedDeveloper: mocks.resolveAuthenticatedDeveloperMock,
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimitMock,
}));

vi.mock("@/services/dailyMissionService", () => ({
  DailyMissionService: vi.fn().mockImplementation(function DailyMissionServiceMock() {
    return {
      checkIn: mocks.checkInMock,
    };
  }),
}));

import { POST } from "./route";

describe("POST /api/checkin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.resolveAuthenticatedDeveloperMock.mockResolvedValue({ ok: true, user: { id: "user-1" } });
    mocks.rateLimitMock.mockResolvedValue({ ok: true });
    mocks.checkInMock.mockResolvedValue({
      checked_in: true,
      already_today: false,
      streak: 8,
      longest: 8,
      was_frozen: false,
      new_achievements: ["streak_8"],
      unseen_count: 2,
      kudos_since_last: 1,
      raids_since_last: [],
      streak_reward: null,
      xp: { granted: 10, new_total: 110, new_level: 3 },
    });
  });

  it("delegates to the daily service and returns its payload", async () => {
    const response = await POST();
    const payload = await response.json();

    expect(mocks.resolveAuthenticatedDeveloperMock).toHaveBeenCalledWith({ loadDeveloper: false });
    expect(mocks.rateLimitMock).toHaveBeenCalledWith("checkin:user-1", 3, 30_000);
    expect(mocks.checkInMock).toHaveBeenCalledWith("user-1");
    expect(payload).toEqual({
      checked_in: true,
      already_today: false,
      streak: 8,
      longest: 8,
      was_frozen: false,
      new_achievements: ["streak_8"],
      unseen_count: 2,
      kudos_since_last: 1,
      raids_since_last: [],
      streak_reward: null,
      xp: { granted: 10, new_total: 110, new_level: 3 },
    });
  });
});
