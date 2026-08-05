@@
-import { NextResponse } from "next/server";
-import { z, type ZodType } from "zod";
+import { NextResponse } from "next/server";
+import { z, type ZodTypeAny } from "zod";
@@
-function parse<T>(schema: ZodType<T>, input: unknown, source: ValidationSource): ValidationResult<T> {
-  const parsed = schema.safeParse(input);
+function parse<T>(schema: ZodTypeAny, input: unknown, source: ValidationSource): ValidationResult<T> {
+  // schema is ZodTypeAny to accept ZodObject, preprocess/coerce/effects, etc.
+  const parsed = schema.safeParse(input) as z.SafeParseReturnType<T, T>;
   if (parsed.success) {
     return { success: true, data: parsed.data };
   }
   return { success: false, response: validationErrorResponse(parsed.error, source) };
 }
 
-export function validateParams<T>(schema: ZodType<T>, params: unknown): ValidationResult<T> {
+export function validateParams<T>(schema: ZodTypeAny, params: unknown): ValidationResult<T> {
   return parse(schema, params, "params");
 }
 
-export function validateQuery<T>(
-  schema: ZodType<T>,
+export function validateQuery<T>(
+  schema: ZodTypeAny,
   searchParams: URLSearchParams,
 ): ValidationResult<T> {
   const query = Object.fromEntries(searchParams.entries());
   return parse(schema, query, "query");
 }
 
 export async function validateJsonBody<T>(
   request: Request,
-  schema: ZodType<T>,
+  schema: ZodTypeAny,
 ): Promise<ValidationResult<T>> {
