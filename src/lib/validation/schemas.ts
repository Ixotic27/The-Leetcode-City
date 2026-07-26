import { z } from "zod";

const queryNumber = (defaultValue: number, min: number, max: number) =>
  z.preprocess(
    (value) => (value === "" || value === undefined || value === null ? undefined : value),
    z.coerce.number().int().min(min).max(max).default(defaultValue),
  );

const queryBoolean = () =>
  z.preprocess(
    (value) => {
      if (value === undefined || value === null || value === "") return undefined;
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        if (value === "true" || value === "1") return true;
        if (value === "false" || value === "0") return false;
      }
      return value;
    },
    z.boolean(),
  );

export const usernameSchema = z
  .string()
  .trim()
  .min(1, "Username is required.")
  .max(39, "Username must be at most 39 characters.")
  .regex(
    /^[A-Za-z0-9](?:[A-Za-z0-9_-]{0,37}[A-Za-z0-9])?$/,
    "Username may only contain letters, numbers, underscores, and hyphens.",
  );

export const usernameParamSchema = z.object({
  username: usernameSchema,
});

export const developerIdParamSchema = z.object({
  developerId: z.coerce.number().int().min(1),
});

export const paginationQuerySchema = z.object({
  page: queryNumber(1, 1, 100000),
  limit: queryNumber(20, 1, 50),
  sort: z.enum(["asc", "desc"]).optional(),
});

export const arcadeRoomsQuerySchema = paginationQuerySchema.extend({
  q: z.string().trim().min(1).max(100).optional(),
  category: z.string().trim().min(1).max(50).optional(),
  featured: queryBoolean().optional(),
});

export const devQuerySchema = z.object({
  refresh: queryBoolean().default(false),
});
