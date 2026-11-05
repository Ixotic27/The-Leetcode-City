import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { touchLastActive, getDeveloperEmail, getPushTokens } from "../notification-helpers";

const mocks = vi.hoisted(() => ({
  from: vi.fn(), update: vi.fn(), updateEq: vi.fn(), select: vi.fn(),
  eq: vi.fn(), activeEq: vi.fn(), single: vi.fn(), getUserById: vi.fn(),
}));

vi.mock("../supabase", () => ({
  getSupabaseAdmin: () => ({
    from: mocks.from,
    auth: { admin: { getUserById: mocks.getUserById } },
  }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.from.mockReturnValue({ update: mocks.update, select: mocks.select });
  mocks.update.mockReturnValue({ eq: mocks.updateEq });
  mocks.updateEq.mockResolvedValue({ data: null, error: null });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.eq.mockReturnValue({ eq: mocks.activeEq, single: mocks.single });
  mocks.activeEq.mockResolvedValue({ data: [], error: null });
});

afterEach(() => { vi.restoreAllMocks(); });

describe("touchLastActive", () => {
  it("updates the requested developer's last_active_at", async () => {
    touchLastActive(123);
    await Promise.resolve();

    expect(mocks.from).toHaveBeenCalledWith("developers");
    expect(mocks.update).toHaveBeenCalledWith({ last_active_at: expect.any(String) });
    expect(mocks.updateEq).toHaveBeenCalledWith("id", 123);
    expect(Number.isFinite(Date.parse(mocks.update.mock.calls[0][0].last_active_at))).toBe(true);
  });

  it("catches promise rejection and logs via console.error", async () => {
    const error = new Error("Database connection timed out");
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.updateEq.mockRejectedValue(error);

    touchLastActive(456);
    await Promise.resolve();

    expect(errorSpy).toHaveBeenCalledWith("Error updating last active time for developer 456:", error);
  });
});

describe("getDeveloperEmail", () => {
  it("returns email from developers table when available", async () => {
    mocks.single.mockResolvedValue({ data: { email: "alice@example.com", claimed_by: null }, error: null });

    expect(await getDeveloperEmail(42)).toBe("alice@example.com");
    expect(mocks.select).toHaveBeenCalledWith("email, claimed_by");
    expect(mocks.eq).toHaveBeenCalledWith("id", 42);
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });

  it("falls back to auth.users and caches the email on the developer row", async () => {
    mocks.single.mockResolvedValue({ data: { email: null, claimed_by: "auth-user-123" }, error: null });
    mocks.getUserById.mockResolvedValue({ data: { user: { email: "bob@example.com" } } });

    expect(await getDeveloperEmail(99)).toBe("bob@example.com");
    expect(mocks.getUserById).toHaveBeenCalledWith("auth-user-123");
    expect(mocks.update).toHaveBeenCalledWith({ email: "bob@example.com", email_updated_at: expect.any(String) });
    expect(mocks.updateEq).toHaveBeenCalledWith("id", 99);
  });

  it("returns null when no email or claimed auth user exists", async () => {
    mocks.single.mockResolvedValue({ data: { email: null, claimed_by: null }, error: null });

    expect(await getDeveloperEmail(77)).toBeNull();
    expect(mocks.getUserById).not.toHaveBeenCalled();
  });
});

describe("getPushTokens", () => {
  it("returns push tokens for active subscriptions of the requested developer", async () => {
    const tokens = [{ token: "token-abc", platform: "webpush" }, { token: "token-xyz", platform: "fcm" }];
    mocks.activeEq.mockResolvedValue({ data: tokens, error: null });

    expect(await getPushTokens(42)).toEqual(tokens);
    expect(mocks.from).toHaveBeenCalledWith("push_subscriptions");
    expect(mocks.select).toHaveBeenCalledWith("token, platform");
    expect(mocks.eq).toHaveBeenCalledWith("developer_id", 42);
    expect(mocks.activeEq).toHaveBeenCalledWith("active", true);
  });

  it("returns an empty array when no active subscriptions exist", async () => {
    mocks.activeEq.mockResolvedValue({ data: [], error: null });
    expect(await getPushTokens(99)).toEqual([]);
  });
});
