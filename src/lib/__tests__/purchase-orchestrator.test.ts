import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimPendingPurchaseAtomically, orchestratePurchaseFulfillment } from "../purchase-orchestrator";

const mockFulfillItemPurchase = vi.fn();
const mockAutoEquipIfSolo = vi.fn();
const mockSendPurchaseNotification = vi.fn();
const mockSendGiftSentNotification = vi.fn();
const mockSendGiftReceivedNotification = vi.fn();

vi.mock("../items", () => ({
  autoEquipIfSolo: (...args: unknown[]) => mockAutoEquipIfSolo(...args),
  fulfillItemPurchase: (...args: unknown[]) => mockFulfillItemPurchase(...args),
}));

vi.mock("../notification-senders/purchase", () => ({
  sendPurchaseNotification: (...args: unknown[]) => mockSendPurchaseNotification(...args),
  sendGiftSentNotification: (...args: unknown[]) => mockSendGiftSentNotification(...args),
}));

vi.mock("../notification-senders/gift", () => ({
  sendGiftReceivedNotification: (...args: unknown[]) => mockSendGiftReceivedNotification(...args),
}));

function createQueryBuilder(result: unknown) {
  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: result, error: null }),
    single: async () => ({ data: result, error: null }),
    insert: async () => ({ data: result, error: null }),
    update: () => ({
      eq: async () => ({ data: result, error: null }),
    }),
  };
  return builder;
}

function createSupabaseMock(purchaseRow: Record<string, unknown>) {
  return {
    from: (table: string) => {
      if (table === "purchases") {
        return createQueryBuilder(purchaseRow);
      }
      if (table === "developers") {
        return createQueryBuilder({ github_login: "tester" });
      }
      if (table === "activity_feed") {
        return createQueryBuilder({ id: "feed-1" });
      }
      throw new Error(`Unexpected table ${table}`);
    },
  };
}

describe("orchestratePurchaseFulfillment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFulfillItemPurchase.mockResolvedValue({ status: "completed" });
  });

  it.each(["not_found", "item_not_found"])("keeps RPC %s distinct from an already claimed payment", async (errorCode) => {
    const result = await claimPendingPurchaseAtomically({
      provider: "stripe", transactionId: "pi_missing", developerId: 7, itemId: "flag",
      supabaseClient: { rpc: vi.fn().mockResolvedValue({
        data: [{ ok: false, error_code: errorCode, purchase_id: null }], error: null,
      }) } as never,
    });
    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect(result.already_claimed).not.toBe(true);
  });

  it("keeps an already claimed RPC result idempotent", async () => {
    const sb = { rpc: vi.fn().mockResolvedValue({
      data: [{ ok: false, error_code: "already_claimed", purchase_id: "purchase-1" }], error: null,
    }) };
    const result = await orchestratePurchaseFulfillment({
      provider: "stripe", transactionId: "pi_duplicate", developerId: 7, itemId: "flag",
      supabaseClient: sb as never,
      claimPendingPurchase: claimPendingPurchaseAtomically,
    });
    expect(result.kind).toBe("duplicate");
    expect(mockFulfillItemPurchase).not.toHaveBeenCalled();
  });

  it("finalizes a standard purchase and dispatches notifications", async () => {
    const sb = createSupabaseMock({
      id: "purchase-1",
      status: "pending",
      developer_id: 7,
      item_id: "flag",
      gifted_to: null,
    });

    const result = await orchestratePurchaseFulfillment({
      provider: "stripe",
      transactionId: "pi_123",
      purchaseId: "purchase-1",
      developerId: 7,
      itemId: "flag",
      githubLogin: "tester",
      supabaseClient: sb as never,
      claimPendingPurchase: async () => ({ ok: true, purchase_id: "purchase-1" }),
    });

    expect(result.kind).toBe("completed");
    expect(mockFulfillItemPurchase).toHaveBeenCalledWith(7, "flag", sb);
    expect(mockAutoEquipIfSolo).toHaveBeenCalledWith(7, "flag");
    expect(mockSendPurchaseNotification).toHaveBeenCalledWith(7, "tester", "purchase-1", "flag");
    expect(mockSendGiftSentNotification).not.toHaveBeenCalled();
    expect(mockSendGiftReceivedNotification).not.toHaveBeenCalled();
  });
});
