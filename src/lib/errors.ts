/**
 * Typed error hierarchy for webhook fulfillment.
 *
 * BusinessLogicError  → return 200 (don't retry; outcome is deterministic)
 * InfrastructureError → return 500 (retry; transient failure)
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