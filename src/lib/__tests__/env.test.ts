import { getEnvNumber } from "@/lib/env";

describe("getEnvNumber", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.TEST_ENV_NUM;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it("returns valid numeric value", () => {
    process.env.TEST_ENV_NUM = "42";
    expect(getEnvNumber("TEST_ENV_NUM", 10)).toBe(42);
  });

  it("returns fallback when env var is missing", () => {
    expect(getEnvNumber("TEST_ENV_NUM", 10)).toBe(10);
  });

  it("returns fallback for invalid numeric input", () => {
    process.env.TEST_ENV_NUM = "abc";
    expect(getEnvNumber("TEST_ENV_NUM", 10)).toBe(10);
  });

  it("returns fallback when below min (fallback mode)", () => {
    process.env.TEST_ENV_NUM = "0";
    expect(getEnvNumber("TEST_ENV_NUM", 10, { min: 1 })).toBe(10);
  });

  it("returns fallback when above max (fallback mode)", () => {
    process.env.TEST_ENV_NUM = "100";
    expect(getEnvNumber("TEST_ENV_NUM", 10, { max: 50 })).toBe(10);
  });

  it("clamps to min/max in clamp mode", () => {
    process.env.TEST_ENV_NUM = "0";
    expect(getEnvNumber("TEST_ENV_NUM", 10, { min: 1, max: 50, outOfRange: "clamp" })).toBe(1);

    process.env.TEST_ENV_NUM = "100";
    expect(getEnvNumber("TEST_ENV_NUM", 10, { min: 1, max: 50, outOfRange: "clamp" })).toBe(50);
  });
});
