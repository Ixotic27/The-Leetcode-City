import { NextResponse } from "next/server";
import { z, ZodSchema } from "zod";

export * from "./schemas";
export type { ZodSchema };

/**
 * Formats Zod validation errors into a standard 400 Bad Request response.
 */
export function validationErrorResponse(error: z.ZodError) {
  return NextResponse.json(
    {
      error: "Invalid request parameters",
      details: error.issues.map((e) => ({
        path: e.path.join("."),
        message: e.message,
      })),
    },
    { status: 400 }
  );
}

/**
 * Validates route parameters or arbitrary objects against a Zod schema.
 */
export function validateParams<T>(
  data: unknown,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      response: validationErrorResponse(result.error),
    };
  }
  return { success: true, data: result.data };
}

/**
 * Validates a parsed request body against a Zod schema.
 */
export function validateBody<T>(
  data: unknown,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      success: false,
      response: validationErrorResponse(result.error),
    };
  }
  return { success: true, data: result.data };
}

/**
 * Converts URLSearchParams into an object and validates against a Zod schema.
 */
export function validateQuery<T>(
  searchParams: URLSearchParams,
  schema: ZodSchema<T>
): { success: true; data: T } | { success: false; response: NextResponse } {
  const queryObj: Record<string, string | string[]> = {};
  searchParams.forEach((value, key) => {
    if (queryObj[key] !== undefined) {
      if (Array.isArray(queryObj[key])) {
        (queryObj[key] as string[]).push(value);
      } else {
        queryObj[key] = [queryObj[key] as string, value];
      }
    } else {
      queryObj[key] = value;
    }
  });

  const result = schema.safeParse(queryObj);
  if (!result.success) {
    return {
      success: false,
      response: validationErrorResponse(result.error),
    };
  }
  return { success: true, data: result.data };
}
