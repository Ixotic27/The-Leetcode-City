import { NextResponse } from "next/server";
import { z, type ZodType } from "zod";

type ValidationSuccess<T> = { success: true; data: T };
type ValidationFailure = { success: false; response: NextResponse };

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

type ValidationSource = "params" | "query" | "body";

function formatValidationError(error: z.ZodError, source: ValidationSource) {
  return {
    error: "Validation failed",
    details: error.issues.map((issue) => ({
      field: [source, ...issue.path].filter(Boolean).join("."),
      message: issue.message,
      code: issue.code,
    })),
  };
}

export function validationErrorResponse(error: z.ZodError, source: ValidationSource) {
  return NextResponse.json(formatValidationError(error, source), { status: 400 });
}

function parse<T>(schema: ZodType<T>, input: unknown, source: ValidationSource): ValidationResult<T> {
  const parsed = schema.safeParse(input);
  if (parsed.success) {
    return { success: true, data: parsed.data };
  }
  return { success: false, response: validationErrorResponse(parsed.error, source) };
}

export function validateParams<T>(schema: ZodType<T>, params: unknown): ValidationResult<T> {
  return parse(schema, params, "params");
}

export function validateQuery<T>(
  schema: ZodType<T>,
  searchParams: URLSearchParams,
): ValidationResult<T> {
  const query = Object.fromEntries(searchParams.entries());
  return parse(schema, query, "query");
}

export async function validateJsonBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<ValidationResult<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      success: false,
      response: NextResponse.json(
        {
          error: "Validation failed",
          details: [
            {
              field: "body",
              message: "Request body must be valid JSON.",
              code: "invalid_json",
            },
          ],
        },
        { status: 400 },
      ),
    };
  }

  return parse(schema, body, "body");
}
