import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateParams, validateQuery } from "../validation";

describe("validation library", () => {
  describe("validateParams", () => {
    const schema = z.object({
      username: z.string().min(1, "Username is required"),
    });

    it("should successfully validate valid params", () => {
      const result = validateParams({ username: "octocat" }, schema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.username).toBe("octocat");
      }
    });

    it("should return 400 error response for invalid params", async () => {
      const result = validateParams({ username: "" }, schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const json = await result.response.json();
        expect(json.error).toBe("Invalid request parameters");
        expect(json.details.length).toBeGreaterThan(0);
      }
    });
  });

  describe("validateQuery", () => {
    const schema = z.object({
      lat: z.coerce.number(),
      lon: z.coerce.number(),
    });

    it("should parse and validate URLSearchParams", () => {
      const searchParams = new URLSearchParams("lat=12.34&lon=56.78");
      const result = validateQuery(searchParams, schema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.lat).toBe(12.34);
        expect(result.data.lon).toBe(56.78);
      }
    });

    it("should return error response for invalid query values", async () => {
      const searchParams = new URLSearchParams("lat=abc&lon=56.78");
      const result = validateQuery(searchParams, schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
      }
    });
  });
});
