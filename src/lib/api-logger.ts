/**
 * Structured JSON logging for API routes.
 *
 * Bare `console.error("...", error)` calls are hard to parse and lack
 * context (which request, which user, which route). This helper emits a
 * single JSON line to stdout so logs can be correlated and analyzed in
 * log aggregation tools (Datadog, Vercel Logs, Grafana, etc.).
 *
 * Usage:
 *   import { logApiError, newReqId } from "@/lib/api-logger";
 *
 *   export async function GET(request: NextRequest) {
 *     const reqId = newReqId(); // generate once per request
 *     try {
 *       // ...
 *     } catch (error) {
 *       logApiError({ reqId, route: "/api/stats", error });
 *     }
 *   }
 *
 * Output shape (single line):
 *   {"level":"error","ts":"2026-08-08T12:00:00.000Z","reqId":"...","route":"/api/stats","message":"...","error":{"name":"Error","message":"..."}}
 */

export interface ApiLogErrorInput {
  /** Request ID used to correlate all log lines for a single request. */
  reqId?: string;
  /** Authenticated user id, when available. Omitted from the log if absent. */
  userId?: string | number | null;
  /** Route identifier, e.g. "/api/stats" or "/api/dev/[username]". */
  route: string;
  /** The error to log (Error instance, message string, or any value). */
  error: unknown;
  /** Optional human-readable summary of what failed. */
  message?: string;
  /** Any additional context fields to include (status, username, ...). */
  [key: string]: unknown;
}

/**
 * Returns a fresh request ID. Call once at the top of a route handler and
 * reuse it across every log call so all lines for a request share the same
 * `reqId`.
 */
export function newReqId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for environments without the Web Crypto API.
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function serializeError(error: unknown): unknown {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      ...(error.stack ? { stack: error.stack } : {}),
      ...(error.cause !== undefined ? { cause: serializeError(error.cause) } : {}),
    };
  }
  if (typeof error === "string") {
    return { name: "Error", message: error };
  }
  return error;
}

/**
 * Logs an API error as a single structured JSON line to stdout.
 * A `reqId` is generated automatically when not provided.
 */
export function logApiError(input: ApiLogErrorInput): void {
  const { reqId = newReqId(), userId, route, error, message, ...extra } = input;

  const entry: Record<string, unknown> = {
    level: "error",
    ts: new Date().toISOString(),
    reqId,
    ...(userId !== undefined && userId !== null ? { userId: String(userId) } : {}),
    route,
    ...(message ? { message } : {}),
    error: serializeError(error),
    ...extra,
  };

  try {
    process.stdout.write(`${JSON.stringify(entry)}\n`);
  } catch {
    // Never let logging itself take down the request — fall back to a
    // minimal, still-structured line and flag the serialization failure.
    process.stdout.write(
      `${JSON.stringify({ level: "error", ts: new Date().toISOString(), reqId, route, serializationFailed: true })}\n`
    );
  }
}
