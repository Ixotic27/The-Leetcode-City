import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  booleanFlagSchema,
  evmAddressSchema,
  limitParamSchema,
  offsetParamSchema,
  pageParamSchema,
  paginationSchema,
  positiveAmountStringSchema,
  slugSchema,
  sortDirectionSchema,
  usernameSchema,
  uuidSchema,
  validateQuery,
  validationErrorResponse,
} from "../validation";

const parse = (schema: z.ZodSchema<unknown>, value: unknown) => schema.safeParse(value);

describe("reusable validation schemas", () => {
  describe("usernameSchema", () => {
    it("accepts valid GitHub/LeetCode-style usernames", () => {
      expect(parse(usernameSchema, "octocat").success).toBe(true);
      expect(parse(usernameSchema, "my-user_1").success).toBe(true);
      expect(parse(usernameSchema, "  AdaLovelace  ").success).toBe(true);
    });

    it("trims surrounding whitespace", () => {
      const result = usernameSchema.safeParse("  octocat  ");
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe("octocat");
      }
    });

    it("rejects empty, oversized, and invalid-character usernames", () => {
      expect(parse(usernameSchema, "").success).toBe(false);
      expect(parse(usernameSchema, "   ").success).toBe(false);
      expect(parse(usernameSchema, "a".repeat(40)).success).toBe(false);
      expect(parse(usernameSchema, "user name").success).toBe(false);
      expect(parse(usernameSchema, "user%name").success).toBe(false);
      expect(parse(usernameSchema, "user@github").success).toBe(false);
      expect(parse(usernameSchema, 42).success).toBe(false);
    });
  });

  describe("pagination param schemas", () => {
    it("pageParamSchema accepts positive integers, coerces numeric strings", () => {
      expect(parse(pageParamSchema, 1).success).toBe(true);
      expect(parse(pageParamSchema, "3").success).toBe(true);
    });

    it("pageParamSchema rejects 0, negatives, floats, and non-numbers", () => {
      expect(parse(pageParamSchema, 0).success).toBe(false);
      expect(parse(pageParamSchema, -1).success).toBe(false);
      expect(parse(pageParamSchema, 1.5).success).toBe(false);
      expect(parse(pageParamSchema, "abc").success).toBe(false);
    });

    it("limitParamSchema rejects out-of-range and invalid limits", () => {
      expect(parse(limitParamSchema, 1).success).toBe(true);
      expect(parse(limitParamSchema, 100).success).toBe(true);
      expect(parse(limitParamSchema, 0).success).toBe(false);
      expect(parse(limitParamSchema, 101).success).toBe(false);
      expect(parse(limitParamSchema, "abc").success).toBe(false);
    });

    it("offsetParamSchema accepts zero but rejects negatives", () => {
      expect(parse(offsetParamSchema, 0).success).toBe(true);
      expect(parse(offsetParamSchema, 50).success).toBe(true);
      expect(parse(offsetParamSchema, -1).success).toBe(false);
    });

    it("sortDirectionSchema only accepts asc/desc", () => {
      expect(parse(sortDirectionSchema, "asc").success).toBe(true);
      expect(parse(sortDirectionSchema, "desc").success).toBe(true);
      expect(parse(sortDirectionSchema, "ascending").success).toBe(false);
    });

    it("paginationSchema applies sensible defaults when params are missing", () => {
      const result = paginationSchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 1, limit: 20, offset: 0, sort: "desc" });
      }
    });

    it("paginationSchema keeps provided values and validates ranges", () => {
      const result = paginationSchema.safeParse({ page: 2, limit: 50, sort: "asc" });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ page: 2, limit: 50, offset: 0, sort: "asc" });
      }
      expect(paginationSchema.safeParse({ limit: 0 }).success).toBe(false);
    });
  });

  describe("booleanFlagSchema", () => {
    it("coerces accepted string values to booleans", () => {
      expect(booleanFlagSchema.parse("1")).toBe(true);
      expect(booleanFlagSchema.parse("true")).toBe(true);
      expect(booleanFlagSchema.parse("0")).toBe(false);
      expect(booleanFlagSchema.parse("false")).toBe(false);
    });

    it("defaults to false when missing", () => {
      expect(booleanFlagSchema.parse(undefined)).toBe(false);
    });

    it("rejects unknown values", () => {
      expect(parse(booleanFlagSchema, "yes").success).toBe(false);
      expect(parse(booleanFlagSchema, 1).success).toBe(false);
    });
  });

  describe("uuidSchema", () => {
    it("accepts valid UUIDs", () => {
      expect(parse(uuidSchema, "f47ac10b-58cc-4372-a567-0e02b2c3d479").success).toBe(true);
    });

    it("rejects malformed ids", () => {
      expect(parse(uuidSchema, "not-a-uuid").success).toBe(false);
      expect(parse(uuidSchema, "").success).toBe(false);
      expect(parse(uuidSchema, 123).success).toBe(false);
    });
  });

  describe("slugSchema", () => {
    it("accepts lowercase alphanumeric slugs with hyphens and underscores", () => {
      expect(parse(slugSchema, "ixotopia").success).toBe(true);
      expect(parse(slugSchema, "open-map-v2").success).toBe(true);
      expect(parse(slugSchema, "trading_floor").success).toBe(true);
    });

    it("rejects invalid slugs", () => {
      expect(parse(slugSchema, "").success).toBe(false);
      expect(parse(slugSchema, "Ixotopia!").success).toBe(false);
      expect(parse(slugSchema, "has space").success).toBe(false);
    });
  });

  describe("evmAddressSchema", () => {
    it("accepts a well-formed 0x-prefixed address", () => {
      expect(parse(evmAddressSchema, "0x0000000000000000000000000000000000000000").success).toBe(true);
      expect(parse(evmAddressSchema, "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd").success).toBe(true);
    });

    it("rejects malformed addresses", () => {
      expect(parse(evmAddressSchema, "0x123").success).toBe(false);
      expect(parse(evmAddressSchema, "1234567890").success).toBe(false);
      expect(parse(evmAddressSchema, "0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz").success).toBe(false);
    });
  });

  describe("positiveAmountStringSchema", () => {
    it("accepts non-zero digit strings", () => {
      expect(parse(positiveAmountStringSchema, "1").success).toBe(true);
      expect(parse(positiveAmountStringSchema, "1000000000000000000").success).toBe(true);
    });

    it("rejects zero, decimals, and non-digits", () => {
      expect(parse(positiveAmountStringSchema, "0").success).toBe(false);
      expect(parse(positiveAmountStringSchema, "12.5").success).toBe(false);
      expect(parse(positiveAmountStringSchema, "abc").success).toBe(false);
      expect(parse(positiveAmountStringSchema, 123).success).toBe(false);
    });
  });
});

describe("validation error response shape", () => {
  it("returns a 400 with field-level details and no stack trace", async () => {
    const schema = z.object({ username: usernameSchema });
    const result = validateQuery(new URLSearchParams("username=%25"), schema);
    expect(result.success).toBe(false);
    if (!result.success) {
      const json = await result.response.json();
      expect(result.response.status).toBe(400);
      expect(json.error).toBe("Invalid request parameters");
      expect(Array.isArray(json.details)).toBe(true);
      expect(json.details[0]).toEqual(
        expect.objectContaining({ path: "username", message: expect.any(String) })
      );
      expect(JSON.stringify(json)).not.toContain("at ");
      expect(json.stack).toBeUndefined();
    }
  });

  it("reports multiple invalid fields at once", async () => {
    const result = validateQuery(
      new URLSearchParams("limit=0&offset=-5"),
      z.object({ limit: limitParamSchema.optional(), offset: offsetParamSchema.optional() })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      const json = await result.response.json();
      expect(json.details.map((d: { path: string }) => d.path).sort()).toEqual(["limit", "offset"]);
    }
  });

  it("produces an identical shape via validationErrorResponse directly", async () => {
    const response = validationErrorResponse(new z.ZodError([]));
    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json).toEqual({ error: "Invalid request parameters", details: [] });
  });
});
