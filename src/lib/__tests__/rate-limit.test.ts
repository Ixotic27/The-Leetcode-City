import { rateLimit } from "../rate-limit";

describe("rateLimit", () => {
  it("never reports a negative remaining value", () => {
    const result = rateLimit("rate-limit-clamp-test", 0, 60_000);

    expect(result.remaining).toBe(0);
  });

  it("reports zero remaining after consuming the final allowed request", () => {
    const result = rateLimit("rate-limit-final-request-test", 1, 60_000);

    expect(result).toEqual({
      ok: true,
      remaining: 0,
      reset: expect.any(Number),
    });
  });
});
