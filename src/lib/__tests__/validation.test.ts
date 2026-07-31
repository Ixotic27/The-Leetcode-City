import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validateBody, validateParams, validateQuery } from "../validation";

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

  describe("validateBody", () => {
    const schema = z.object({
      score: z.number().min(0).max(430),
      collected: z.number().min(0).max(40),
    });

    it("should return typed data for a valid request body", () => {
      const result = validateBody({ score: 120, collected: 8 }, schema);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toEqual({ score: 120, collected: 8 });
      }
    });

    it("should return a 400 response with field details for an invalid body", async () => {
      const result = validateBody({ score: 431, collected: "8" }, schema);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.response.status).toBe(400);
        const json = await result.response.json();
        expect(json.error).toBe("Invalid request parameters");
        expect(json.details).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ path: "score" }),
            expect.objectContaining({ path: "collected" }),
          ])
        );
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
