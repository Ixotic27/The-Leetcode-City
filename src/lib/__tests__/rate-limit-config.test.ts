import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseEnvPositiveInt, getRateLimitConfig } from "../rate-limit-config";

describe("rate-limit-config", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("parseEnvPositiveInt", () => {
    it("returns defaultValue when string is undefined or empty", () => {
      expect(parseEnvPositiveInt(undefined, 50)).toBe(50);
      expect(parseEnvPositiveInt("", 50)).toBe(50);
    });

    it("returns defaultValue when string is non-numeric", () => {
      expect(parseEnvPositiveInt("invalid", 50)).toBe(50);
      expect(parseEnvPositiveInt("abc", 50)).toBe(50);
    });

    it("returns defaultValue when string parses to 0 or negative integer", () => {
      expect(parseEnvPositiveInt("0", 50)).toBe(50);
      expect(parseEnvPositiveInt("-10", 50)).toBe(50);
    });

    it("returns parsed integer for valid positive strings", () => {
      expect(parseEnvPositiveInt("100", 50)).toBe(100);
      expect(parseEnvPositiveInt("1", 50)).toBe(1);
    });
  });

  describe("getRateLimitConfig", () => {
    it("uses default values when environment variables are not set", () => {
      delete process.env.RATE_LIMIT_WINDOW_MS;
      delete process.env.RATE_LIMIT_MAX_REQUESTS;
      delete process.env.RATE_LIMIT_DEFAULT_API_MAX;
      delete process.env.RATE_LIMIT_DEFAULT_PAGE_MAX;
      delete process.env.RATE_LIMIT_AUTH_MAX;

      const config = getRateLimitConfig();
      expect(config.windowMs).toBe(60_000);
      expect(config.defaultApiMax).toBe(60);
      expect(config.defaultPageMax).toBe(120);

      const authRoute = config.routeLimits.find(([prefix]) => prefix === "/api/auth");
      expect(authRoute).toBeDefined();
      expect(authRoute?.[1]).toBe(10);
      expect(authRoute?.[2]).toBe(60_000);
    });

    it("overrides values when valid environment variables are supplied", () => {
      process.env.RATE_LIMIT_WINDOW_MS = "120000";
      process.env.RATE_LIMIT_MAX_REQUESTS = "200";
      process.env.RATE_LIMIT_DEFAULT_PAGE_MAX = "500";
      process.env.RATE_LIMIT_AUTH_MAX = "5";

      const config = getRateLimitConfig();
      expect(config.windowMs).toBe(120_000);
      expect(config.defaultApiMax).toBe(200);
      expect(config.defaultPageMax).toBe(500);

      const authRoute = config.routeLimits.find(([prefix]) => prefix === "/api/auth");
      expect(authRoute?.[1]).toBe(5);
      expect(authRoute?.[2]).toBe(120_000);
    });

    it("falls back gracefully when environment variables contain invalid values", () => {
      process.env.RATE_LIMIT_WINDOW_MS = "invalid_number";
      process.env.RATE_LIMIT_MAX_REQUESTS = "-20";
      process.env.RATE_LIMIT_AUTH_MAX = "abc";

      const config = getRateLimitConfig();
      expect(config.windowMs).toBe(60_000);
      expect(config.defaultApiMax).toBe(60);

      const authRoute = config.routeLimits.find(([prefix]) => prefix === "/api/auth");
      expect(authRoute?.[1]).toBe(10);
    });
  });
});
