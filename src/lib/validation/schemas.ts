import { z } from "zod";

/**
 * Reusable Zod schemas for common API input patterns.
 *
 * These keep route handlers focused on business logic: malformed params,
 * query strings and bodies are rejected at the boundary with a consistent
 * 400 response (see `validationErrorResponse` in ./index.ts).
 *
 * Constraint-only schemas (no defaults) are composed per-route with
 * `.optional().default(...)` so each endpoint decides its own defaults.
 */

/** GitHub/LeetCode-style username: trimmed, 1–39 chars, no spaces or LIKE wildcards. */
export const usernameSchema = z
  .string({ message: "Username must be a string" })
  .trim()
  .min(1, "Username is required")
  .max(39, "Username must be 39 characters or fewer")
  .regex(
    /^[a-zA-Z0-9_-]+$/,
    "Username may only contain letters, numbers, hyphens and underscores"
  );

/** Positive integer page number (starts at 1). */
export const pageParamSchema = z.coerce
  .number({ message: "Invalid page parameter: must be a number" })
  .int("page must be an integer")
  .min(1, "page must be at least 1");

/** Result count per request/page. */
export const limitParamSchema = z.coerce
  .number({ message: "Invalid limit parameter: must be a number" })
  .int("limit must be an integer")
  .min(1, "limit must be at least 1")
  .max(100, "limit must be 100 or fewer");

/** Zero-based skip offset. */
export const offsetParamSchema = z.coerce
  .number({ message: "Invalid offset parameter: must be a number" })
  .int("offset must be an integer")
  .min(0, "offset must be 0 or greater");

/** Sort direction for list endpoints. */
export const sortDirectionSchema = z.enum(["asc", "desc"], {
  message: "sort must be 'asc' or 'desc'",
});

/** Standard pagination query object with sensible defaults. */
export const paginationSchema = z.object({
  page: pageParamSchema.optional().default(1),
  limit: limitParamSchema.optional().default(20),
  offset: offsetParamSchema.optional().default(0),
  sort: sortDirectionSchema.optional().default("desc"),
});

/**
 * Boolean-ish query flag ("0" | "1" | "true" | "false") coerced to a real
 * boolean. Missing values default to `false`.
 */
export const booleanFlagSchema = z
  .enum(["0", "1", "true", "false"], {
    message: "flag must be '0', '1', 'true' or 'false'",
  })
  .optional()
  .default("0")
  .transform((value) => value === "1" || value === "true");

/** UUID route/query param (e.g. `id`, cursors). */
export const uuidSchema = z.string().uuid("Invalid id: must be a valid UUID");

/** Lowercase alphanumeric slug with hyphens/underscores (e.g. room slugs). */
export const slugSchema = z
  .string({ message: "Slug must be a string" })
  .trim()
  .min(1, "Slug is required")
  .max(64, "Slug must be 64 characters or fewer")
  .regex(
    /^[a-z0-9_-]+$/,
    "Slug may only contain lowercase letters, numbers, hyphens and underscores"
  );

/** EVM address: `0x` followed by 40 hex chars. */
export const evmAddressSchema = z
  .string({ message: "Address must be a string" })
  .regex(
    /^0x[a-fA-F0-9]{40}$/,
    "Address must be a 0x-prefixed, 40-hex-character address"
  );

/** Non-zero whole number expressed as a decimal digit string (e.g. wei amounts). */
export const positiveAmountStringSchema = z
  .string({ message: "Amount must be a string" })
  .regex(/^\d+$/, "Amount must be a string of digits")
  .refine((value) => value !== "0", "Amount must be greater than zero");
