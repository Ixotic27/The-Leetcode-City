import { describe, it, expect, vi, beforeEach } from "vitest";
import { touchLastActive, getDeveloperEmail, getPushTokens } from "../notification-helpers";
import { getSupabaseAdmin } from "../supabase";

// Mutable refs to hold mock functions so tests can configure them
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockGetUserById = vi.fn();

vi.mock("../supabase", () => ({
  getSupabaseAdmin: () => ({
    from: vi.fn((table: string) => ({
      update: mockUpdate,
      select: table === "developers"
        ? Object.assign(mockSelect, { single: mockSingle })
        : mockSelect,
      eq: mockEq,
    })),
    auth: {
      admin: {
        getUserById: mockGetUserById,
      },
    },
  }),
}));

describe("touchLastActive", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy?.mockRestore();
  });

  it("successfully updates last_active_at", () => {
    const sbAdmin = getSupabaseAdmin();
    const mockEqResult = {
      then: function (resolve?: (v: { data: unknown; error: null }) => void) {
        if (resolve) resolve({ data: {}, error: null });
        return this;
      },
      catch: function () { return this; },
    };
    const mockUpdate2 = sbAdmin.from("developers").update as unknown as () => { eq: ReturnType<typeof vi.fn> };
    mockUpdate2().eq.mockReturnValue(mockEqResult);

    touchLastActive(123);

    expect(sbAdmin.from).toHaveBeenCalledWith("developers");
    expect(sbAdmin.from("developers").update).toHaveBeenCalledWith(
      expect.objectContaining({ last_active_at: expect.any(String) })
    );
  });

  it("catches promise rejection and logs via console.error", async () => {
    const error = new Error("Database connection timed out");
    const mockEqResult = {
      then: function (_resolve?: unknown, reject?: (r: unknown) => void) {
        if (reject) reject(error);
        return this;
      },
      catch: function (reject?: (r: unknown) => void) {
        if (reject) reject(error);
        return this;
      },
    };
    const sbAdmin = getSupabaseAdmin();
    const mockUpdate2 = sbAdmin.from("developers").update as unknown as () => { eq: ReturnType<typeof vi.fn> };
    mockUpdate2().eq.mockReturnValue(mockEqResult);

    touchLastActive(456);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error updating last active time for developer 456:",
      error
    );
  });
});

describe("getDeveloperEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns email from developers table when available", async () => {
    mockSelect.mockResolvedValue({
      data: { email: "alice@example.com", claimed_by: null },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: { email: "alice@example.com", claimed_by: null },
      error: null,
    });

    const result = await getDeveloperEmail(42);
    expect(result).toBe("alice@example.com");
    expect(mockSelect).toHaveBeenCalledWith("email, claimed_by");
  });

  it("falls back to auth.users when dev has no email but has claimed_by", async () => {
    mockSelect.mockResolvedValue({
      data: { email: null, claimed_by: "auth-user-123" },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: { email: null, claimed_by: "auth-user-123" },
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: { user: { email: "bob@example.com" } },
    });
    mockEq.mockResolvedValue({});

    const result = await getDeveloperEmail(99);
    expect(result).toBe("bob@example.com");
    expect(mockGetUserById).toHaveBeenCalledWith("auth-user-123");
  });

  it("returns null when no email found in any source", async () => {
    mockSelect.mockResolvedValue({
      data: { email: null, claimed_by: null },
      error: null,
    });
    mockSingle.mockResolvedValue({
      data: { email: null, claimed_by: null },
      error: null,
    });
    mockGetUserById.mockResolvedValue({
      data: { user: { email: null } },
    });

    const result = await getDeveloperEmail(77);
    expect(result).toBeNull();
  });
});

describe("getPushTokens", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns push tokens for active subscriptions", async () => {
    mockSelect.mockResolvedValue({
      data: [
        { token: "token-abc", platform: "webpush" },
        { token: "token-xyz", platform: "fcm" },
      ],
      error: null,
    });

    const result = await getPushTokens(42);
    expect(result).toEqual([
      { token: "token-abc", platform: "webpush" },
      { token: "token-xyz", platform: "fcm" },
    ]);
    expect(mockSelect).toHaveBeenCalledWith("token, platform");
  });

  it("returns empty array when no active subscriptions exist", async () => {
    mockSelect.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await getPushTokens(99);
    expect(result).toEqual([]);
  });
});
