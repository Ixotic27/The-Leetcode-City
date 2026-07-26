import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { touchLastActive } from "../notification-helpers";
import { getSupabaseAdmin } from "../supabase";

// Mock the getSupabaseAdmin client to intercept and inspect Supabase calls
vi.mock("../supabase", () => {
  const mockUpdate = vi.fn();
  const mockEq = vi.fn();

  const mockFrom = vi.fn(() => ({
    update: mockUpdate,
  }));

  mockUpdate.mockReturnValue({
    eq: mockEq,
  });

  const mockAdminClient = {
    from: mockFrom,
  };

  return {
    getSupabaseAdmin: () => mockAdminClient,
  };
});

describe("touchLastActive", () => {
  let consoleErrorSpy: { mockRestore: () => void };

  beforeEach(() => {
    vi.clearAllMocks();
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("successfully updates last_active_at and calls then()", async () => {
    const sbAdmin = getSupabaseAdmin();

    // We stub eq to return an object with then() and catch()
    const mockEqResult = {
      then: function (resolve?: (value: { data: Record<string, unknown>; error: null }) => void) {
        if (resolve) resolve({ data: {}, error: null });
        return this;
      },
      catch: function () {
        return this;
      },
    };
    const mockUpdate = sbAdmin.from("developers").update as unknown as () => {
      eq: { mockReturnValue: (val: unknown) => void };
    };
    mockUpdate().eq.mockReturnValue(mockEqResult);

    touchLastActive(123);

    expect(sbAdmin.from).toHaveBeenCalledWith("developers");
    expect(sbAdmin.from("developers").update).toHaveBeenCalledWith(
      expect.objectContaining({ last_active_at: expect.any(String) })
    );
    expect(mockUpdate().eq).toHaveBeenCalledWith("id", 123);
  });

  it("catches promise rejection/errors gracefully and logs them via console.error", async () => {
    const sbAdmin = getSupabaseAdmin();
    const error = new Error("Database connection timed out");

    // We stub eq to return an object with then() and catch() that simulates a failure/rejection
    const mockEqResult = {
      then: function (_resolve?: unknown, reject?: (reason: unknown) => void) {
        if (reject) reject(error);
        return this;
      },
      catch: function (reject?: (reason: unknown) => void) {
        if (reject) reject(error);
        return this;
      },
    };
    const mockUpdate = sbAdmin.from("developers").update as unknown as () => {
      eq: { mockReturnValue: (val: unknown) => void };
    };
    mockUpdate().eq.mockReturnValue(mockEqResult);

    touchLastActive(456);

    // Wait for the Promise.resolve microtask to run
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Error updating last active time for developer 456:",
      error
    );
  });
});
