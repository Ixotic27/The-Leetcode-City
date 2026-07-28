import { beforeEach, describe, expect, it, vi } from "vitest";
import { orchestratePurchaseFulfillment } from "../purchase-orchestrator";

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
  sendPurchaseNotification: (...args: unknown[]) =>
    mockSendPurchaseNotification(...args),
  sendGiftSentNotification: (...args: unknown[]) =>
    mockSendGiftSentNotification(...args),
}));

vi.mock("../notification-senders/gift", () => ({
  sendGiftReceivedNotification: (...args: unknown[]) =>
    mockSendGiftReceivedNotification(...args),
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
      claimPendingPurchase: async () => ({
        ok: true,
        purchase_id: "purchase-1",
      }),
    });

    expect(result.kind).toBe("completed");
    expect(mockFulfillItemPurchase).toHaveBeenCalledWith(7, "flag", sb);
    expect(mockAutoEquipIfSolo).toHaveBeenCalledWith(7, "flag");
    expect(mockSendPurchaseNotification).toHaveBeenCalledWith(
      7,
      "tester",
      "purchase-1",
      "flag",
    );
    expect(mockSendGiftSentNotification).not.toHaveBeenCalled();
    expect(mockSendGiftReceivedNotification).not.toHaveBeenCalled();
  });
});
