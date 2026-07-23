import { describe, it, expect, vi } from "vitest";
import { countGifts } from "../achievements";

// Builds a minimal chainable mock that mirrors the subset of the Supabase
// query builder used by countGifts: .from().select().eq().eq().not()
function buildMockAdmin(count: number | null, error: { message: string } | null = null) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => Promise.resolve({ count, error })),
  };
  const from = vi.fn(() => builder);
  return { from, __builder: builder } as unknown as Parameters<typeof countGifts>[0] & {
    __builder: typeof builder;
  };
}

describe("countGifts", () => {
  it("counts gifts sent using the developer_id column", async () => {
    const admin = buildMockAdmin(3);

    const result = await countGifts(admin, 42, "sent");

    expect(result).toBe(3);
    expect(admin.from).toHaveBeenCalledWith("purchases");
    expect(admin.__builder.eq).toHaveBeenNthCalledWith(1, "developer_id", 42);
    expect(admin.__builder.eq).toHaveBeenNthCalledWith(2, "status", "completed");
  });

  it("counts gifts received using the gifted_to column", async () => {
    const admin = buildMockAdmin(5);

    const result = await countGifts(admin, 42, "received");

    expect(result).toBe(5);
    expect(admin.__builder.eq).toHaveBeenNthCalledWith(1, "gifted_to", 42);
  });

  it("returns 0 when Supabase returns a null count with no error", async () => {
    const admin = buildMockAdmin(null);

    const result = await countGifts(admin, 1, "sent");

    expect(result).toBe(0);
  });

  it("throws instead of silently returning 0 when the query errors", async () => {
    const admin = buildMockAdmin(null, { message: "connection timeout" });

    await expect(countGifts(admin, 1, "sent")).rejects.toThrow(
      "countGifts(sent) query failed: connection timeout"
    );
  });
});