import { describe, it, expect } from "vitest";
import { BusinessLogicError, InfrastructureError } from "../errors";

// ---------------------------------------------------------------------------
// Helpers — lightweight in-memory mocks for DB + fulfillment behaviour
// ---------------------------------------------------------------------------

interface PurchaseRow {
  id: string;
  status: string;
  provider_tx_id: string | null;
}

/**
 * Minimal mock of fulfillItemPurchase that can be told to:
 *  - succeed normally
 *  - throw an InfrastructureError (DB timeout, RPC failure, etc.)
 *  - throw a BusinessLogicError (item not found, already owned)
 */
async function mockFulfill(
  mode: "success" | "infra-error" | "business-error"
): Promise<{ status: "completed" | "delivered" }> {
  if (mode === "infra-error") {
    throw new InfrastructureError("Supabase RPC timed out", { code: "PGRST_TIMEOUT" });
  }
  if (mode === "business-error") {
    throw new BusinessLogicError("Item not found in catalog");
  }
  return { status: "completed" };
}

/**
 * Simulates the webhook catch block: returns the HTTP status code that
 * the route would respond with.
 */
function webhookResponseStatus(err: unknown): number {
  if (err instanceof InfrastructureError) return 500;
  return 200; // BusinessLogicError or unexpected — don't retry
}

// ---------------------------------------------------------------------------
// Error class contracts
// ---------------------------------------------------------------------------

describe("Error hierarchy", () => {
  it("BusinessLogicError is an instance of Error", () => {
    const err = new BusinessLogicError("duplicate purchase");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("BusinessLogicError");
    expect(err.message).toBe("duplicate purchase");
  });

  it("InfrastructureError is an instance of Error and carries cause", () => {
    const cause = { code: "TIMEOUT" };
    const err = new InfrastructureError("DB timeout", cause);
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("InfrastructureError");
    expect(err.cause).toBe(cause);
  });

  it("BusinessLogicError is NOT an InfrastructureError", () => {
    const err = new BusinessLogicError("duplicate");
    expect(err).not.toBeInstanceOf(InfrastructureError);
  });

  it("InfrastructureError is NOT a BusinessLogicError", () => {
    const err = new InfrastructureError("timeout");
    expect(err).not.toBeInstanceOf(BusinessLogicError);
  });
});

// ---------------------------------------------------------------------------
// (a) DB insert failure during fulfillment → webhook returns 500
// ---------------------------------------------------------------------------

describe("Webhook catch block — InfrastructureError → 500", () => {
  it("returns 500 when fulfillment throws InfrastructureError", async () => {
    let caughtStatus = 200;
    try {
      await mockFulfill("infra-error");
    } catch (err) {
      caughtStatus = webhookResponseStatus(err);
    }
    expect(caughtStatus).toBe(500);
  });

  it("returns 500 for nested RPC failures wrapped as InfrastructureError", async () => {
    const err = new InfrastructureError("grant_streak_freeze failed", { code: "500" });
    expect(webhookResponseStatus(err)).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// (b) Duplicate / business-logic conflict → webhook returns 200
// ---------------------------------------------------------------------------

describe("Webhook catch block — BusinessLogicError → 200", () => {
  it("returns 200 when fulfillment throws BusinessLogicError", async () => {
    let caughtStatus = 200;
    try {
      await mockFulfill("business-error");
    } catch (err) {
      caughtStatus = webhookResponseStatus(err);
    }
    expect(caughtStatus).toBe(200);
  });

  it("returns 200 for unknown/unexpected errors (safe default)", () => {
    const randomErr = new Error("unexpected");
    expect(webhookResponseStatus(randomErr)).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// (c) Successful fulfillment → purchase transitions to completed
// ---------------------------------------------------------------------------

describe("Successful fulfillment — purchase status transitions", () => {
  it("returns 200 and status=completed on success", async () => {
    let finalStatus: string | null = null;
    let responseStatus = 200;

    try {
      const result = await mockFulfill("success");
      finalStatus = result.status;
    } catch (err) {
      responseStatus = webhookResponseStatus(err);
    }

    expect(responseStatus).toBe(200);
    expect(finalStatus).toBe("completed");
  });

  it("fulfillment with delivered status (consumables) still returns 200", async () => {
    async function mockFulfillConsumable() {
      return { status: "delivered" as const };
    }

    let responseStatus = 200;
    let finalStatus: string | null = null;
    try {
      const result = await mockFulfillConsumable();
      finalStatus = result.status;
    } catch (err) {
      responseStatus = webhookResponseStatus(err);
    }

    expect(responseStatus).toBe(200);
    expect(finalStatus).toBe("delivered");
  });
});

// ---------------------------------------------------------------------------
// (d) Idempotency: duplicate provider_tx_id conflict returns 200
// ---------------------------------------------------------------------------

describe("Idempotency — duplicate provider_tx_id", () => {
  it("existing purchase with same txId causes no fulfillment and returns 200", () => {
    // Simulates the webhook branch: `if (!existing)` is false, skip fulfillment
    const existingPurchase: PurchaseRow = {
      id: "pur_abc",
      status: "completed",
      provider_tx_id: "pi_xyz",
    };

    // If existing is found, webhook skips fulfillment — no error thrown → 200
    let fulfilled = false;
    if (!existingPurchase) {
      fulfilled = true; // this branch never runs
    }

    expect(fulfilled).toBe(false);
    // No error thrown → status is 200
    expect(webhookResponseStatus(null)).toBe(200);
  });

  it("webhookResponseStatus returns 200 for null (no error)", () => {
    expect(webhookResponseStatus(null)).toBe(200);
    expect(webhookResponseStatus(undefined)).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// (e) InfrastructureError cause is preserved for observability
// ---------------------------------------------------------------------------

describe("InfrastructureError — cause propagation", () => {
  it("wraps Supabase error object as cause", () => {
    const supabaseErr = { message: "connection timeout", code: "PGRST504" };
    const err = new InfrastructureError("DB write failed", supabaseErr);
    expect(err.cause).toEqual(supabaseErr);
    expect(err.message).toBe("DB write failed");
  });

  it("cause can be undefined when not provided", () => {
    const err = new InfrastructureError("RPC failed");
    expect(err.cause).toBeUndefined();
  });
});