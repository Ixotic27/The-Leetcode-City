/**
 * Structured logging helper for API routes.
 * Outputs consistent JSON to stdout for log aggregation tools.
 */

export interface ApiLogContext {
  route: string;
  reqId?: string;
  userId?: number;
  error?: unknown;
  extra?: Record<string, unknown>;
}

function formatError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

export function apiError(ctx: ApiLogContext): void {
  const entry = {
    level: "error",
    route: ctx.route,
    ...(ctx.reqId && { reqId: ctx.reqId }),
    ...(ctx.userId && { userId: ctx.userId }),
    message: ctx.error ? formatError(ctx.error) : undefined,
    ...ctx.extra,
    ts: new Date().toISOString(),
  };
  console.error(JSON.stringify(entry));
}

export function apiWarn(ctx: ApiLogContext): void {
  const entry = {
    level: "warn",
    route: ctx.route,
    ...(ctx.reqId && { reqId: ctx.reqId }),
    ...(ctx.userId && { userId: ctx.userId }),
    message: ctx.error ? formatError(ctx.error) : undefined,
    ...ctx.extra,
    ts: new Date().toISOString(),
  };
  // console.warn is not captured in all log aggregators, use stderr for consistency
  console.error(JSON.stringify(entry));
}

export function apiInfo(ctx: ApiLogContext & { message: string }): void {
  const entry = {
    level: "info",
    route: ctx.route,
    ...(ctx.reqId && { reqId: ctx.reqId }),
    ...(ctx.userId && { userId: ctx.userId }),
    message: ctx.message,
    ...ctx.extra,
    ts: new Date().toISOString(),
  };
  console.log(JSON.stringify(entry));
}
