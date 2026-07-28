import { describe, it, expect, vi } from "vitest";
import { createAtomicCheckoutPurchase } from "../items";
import { InfrastructureError } from "../errors";

describe("createAtomicCheckoutPurchase", () => {
  it("returns the purchase id and status when the atomic RPC succeeds", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [{ purchase_id: 42, status: "completed" }],
      error: null,
    });

    const result = await createAtomicCheckoutPurchase({
      developerId: 7,
      recipientId: 7,
      itemId: "flag",
      provider: "free",
      idempotencyKey: "checkout-1",
      amountCents: 0,
      currency: "usd",
      supabaseClient: { rpc } as never,
    });

    expect(rpc).toHaveBeenCalledWith("create_checkout_purchase_and_fulfill", {
      p_developer_id: 7,
      p_recipient_id: 7,
      p_item_id: "flag",
      p_provider: "free",
      p_idempotency_key: "checkout-1",
      p_amount_cents: 0,
      p_currency: "usd",
      p_gifted_to: null,
    });
    expect(result).toEqual({ purchaseId: "42" });
  });

  it("throws InfrastructureError when the atomic fulfillment step fails", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "fulfillment failed" },
    });

    await expect(
      createAtomicCheckoutPurchase({
        developerId: 7,
        recipientId: 7,
        itemId: "streak_freeze",
        provider: "free",
        idempotencyKey: "checkout-2",
        amountCents: 0,
        currency: "usd",
        supabaseClient: { rpc } as never,
      }),
    ).rejects.toMatchObject({ name: "InfrastructureError" });
  });

  it("throws InfrastructureError when the atomic purchase insert fails", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "purchase insert failed" },
    });

    await expect(
      createAtomicCheckoutPurchase({
        developerId: 7,
        recipientId: 7,
        itemId: "flag",
        provider: "free",
        idempotencyKey: "checkout-3",
        amountCents: 0,
        currency: "usd",
        supabaseClient: { rpc } as never,
      }),
    ).rejects.toBeInstanceOf(InfrastructureError);
  });
});
