import { describe, it, expect } from "vitest";

// ─── Unit tests for the NOWPayments provider_tx_id fix (#352) ─
//
// The bug: provider_tx_id was set to the static string
//   "${dev.id}:${item_id}"
// making two concurrent purchases of the same consumable item share
// the same key. The webhook's .maybeSingle() then resolved the wrong row.
//
// The fix: use purchase.id (a UUID unique per row) as both the NOWPayments
// order_id and the provider_tx_id stored in the DB.
//
// These tests verify the invariants of the new scheme in isolation.

// ─── Helpers mirroring the fixed logic ───────────────────────

/** Old (broken) key format */
function oldProviderTxId(developerId: number, itemId: string): string {
  return `${developerId}:${itemId}`;
}

/** New (fixed) key format */
function newProviderTxId(purchaseId: string): string {
  return purchaseId; // purchase UUID used directly
}

/** Simulate resolving a purchase from a webhook order_id */
function resolveByProviderTxId(
  purchases: Array<{ id: string; provider_tx_id: string; status: string }>,
  orderId: string,
): Array<{ id: string; provider_tx_id: string; status: string }> {
  return purchases.filter(
    (p) => p.provider_tx_id === orderId && p.status === "pending"
  );
}

// ─── Tests ───────────────────────────────────────────────────

describe("old key format — collision on same consumable", () => {
  it("two purchases of the same item share a provider_tx_id", () => {
    const devId = 42;
    const itemId = "streak_freeze";
    const keyA = oldProviderTxId(devId, itemId);
    const keyB = oldProviderTxId(devId, itemId);
    expect(keyA).toBe(keyB); // ← the bug
  });

  it("webhook resolves arbitrarily when two rows share the key", () => {
    const key = "42:streak_freeze";
    const purchases = [
      { id: "purchase-A", provider_tx_id: key, status: "pending" },
      { id: "purchase-B", provider_tx_id: key, status: "pending" },
    ];
    const matches = resolveByProviderTxId(purchases, key);
    expect(matches.length).toBe(2); // both match — wrong, only 1 should
  });

  it("second webhook silently drops if first already completed", () => {
    const key = "42:streak_freeze";
    const purchases = [
      { id: "purchase-A", provider_tx_id: key, status: "completed" }, // first webhook already ran
      { id: "purchase-B", provider_tx_id: key, status: "pending" },
    ];
    // Webhook filters by status=pending, so it finds purchase-B — but only
    // because purchase-A happened to complete first. If both arrive together
    // the outcome is non-deterministic (maybeSingle picks one arbitrarily).
    const matches = resolveByProviderTxId(purchases, key);
    expect(matches.length).toBe(1); // seems fine but only by accident
    expect(matches[0].id).toBe("purchase-B");
    // The point: without a unique key, correctness depends on timing — unreliable.
  });
});

describe("new key format — purchase UUID, unique per row", () => {
  it("two purchases of the same item get distinct provider_tx_ids", () => {
    const purchaseIdA = "uuid-aaaa-1111";
    const purchaseIdB = "uuid-bbbb-2222";
    const keyA = newProviderTxId(purchaseIdA);
    const keyB = newProviderTxId(purchaseIdB);
    expect(keyA).not.toBe(keyB); // ← the fix
  });

  it("first webhook resolves exactly purchase A", () => {
    const purchases = [
      { id: "uuid-aaaa-1111", provider_tx_id: "uuid-aaaa-1111", status: "pending" },
      { id: "uuid-bbbb-2222", provider_tx_id: "uuid-bbbb-2222", status: "pending" },
    ];
    const matches = resolveByProviderTxId(purchases, "uuid-aaaa-1111");
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe("uuid-aaaa-1111");
  });

  it("second webhook resolves exactly purchase B", () => {
    const purchases = [
      { id: "uuid-aaaa-1111", provider_tx_id: "uuid-aaaa-1111", status: "completed" },
      { id: "uuid-bbbb-2222", provider_tx_id: "uuid-bbbb-2222", status: "pending" },
    ];
    const matches = resolveByProviderTxId(purchases, "uuid-bbbb-2222");
    expect(matches.length).toBe(1);
    expect(matches[0].id).toBe("uuid-bbbb-2222");
  });

  it("each webhook delivers exactly one item — neither is lost", () => {
    const purchases = [
      { id: "uuid-aaaa-1111", provider_tx_id: "uuid-aaaa-1111", status: "pending" },
      { id: "uuid-bbbb-2222", provider_tx_id: "uuid-bbbb-2222", status: "pending" },
    ];

    // Simulate both webhooks arriving
    const resolvedA = resolveByProviderTxId(purchases, "uuid-aaaa-1111");
    const resolvedB = resolveByProviderTxId(purchases, "uuid-bbbb-2222");

    expect(resolvedA.length).toBe(1);
    expect(resolvedB.length).toBe(1);
    expect(resolvedA[0].id).not.toBe(resolvedB[0].id); // different rows
  });

  it("completed purchase is not re-fulfilled by a duplicate webhook", () => {
    const purchases = [
      { id: "uuid-aaaa-1111", provider_tx_id: "uuid-aaaa-1111", status: "completed" },
    ];
    // Duplicate webhook for same purchase (NOWPayments can retry)
    const matches = resolveByProviderTxId(purchases, "uuid-aaaa-1111");
    expect(matches.length).toBe(0); // status=pending filter rejects it
  });

  it("unknown order_id resolves nothing (no crash, no ghost fulfillment)", () => {
    const purchases = [
      { id: "uuid-aaaa-1111", provider_tx_id: "uuid-aaaa-1111", status: "pending" },
    ];
    const matches = resolveByProviderTxId(purchases, "uuid-unknown-9999");
    expect(matches.length).toBe(0);
  });
});

describe("provider_tx_id uniqueness across items and users", () => {
  it("same user, different items → different keys (new format)", () => {
    const keyFreeze  = newProviderTxId("uuid-freeze-purchase");
    const keyMissile = newProviderTxId("uuid-missile-purchase");
    expect(keyFreeze).not.toBe(keyMissile);
  });

  it("different users, same item → different keys (new format)", () => {
    const keyUser1 = newProviderTxId("uuid-user1-purchase");
    const keyUser2 = newProviderTxId("uuid-user2-purchase");
    expect(keyUser1).not.toBe(keyUser2);
  });

  it("old format: different users same item produce different keys (was safe for non-consumables)", () => {
    // This was the only case the old format handled correctly
    expect(oldProviderTxId(1, "streak_freeze")).not.toBe(oldProviderTxId(2, "streak_freeze"));
  });

  it("old format: same user different items produce different keys (was safe for non-consumables)", () => {
    expect(oldProviderTxId(1, "streak_freeze")).not.toBe(oldProviderTxId(1, "anti_missile_system"));
  });
});