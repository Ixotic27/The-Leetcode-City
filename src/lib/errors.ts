/**
 * Typed error hierarchy for webhook fulfillment.
 *
 * BusinessLogicError  → return 200 (don't retry; outcome is deterministic)
 * InfrastructureError → return 500 (retry; transient failure)
 * LeetCodeApiError    → return 500 (retry for network/rate-limit; don't retry for invalid-response)
 */

export class BusinessLogicError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessLogicError";
  }
}

export class InfrastructureError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "InfrastructureError";
  }
}

/** Discriminators for LeetCodeApiError sub-types. */
export type LeetCodeApiErrorKind = "network" | "rate_limit" | "invalid_response" | "unknown";

export class LeetCodeApiError extends Error {
  /** Whether the operation is safe to retry. */
  readonly retryable: boolean;

  constructor(
    message: string,
    public readonly kind: LeetCodeApiErrorKind,
    public readonly statusCode?: number,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LeetCodeApiError";
    // Rate-limit and network errors are retryable; invalid-response is not.
    this.retryable = kind === "network" || kind === "rate_limit";
  }
}