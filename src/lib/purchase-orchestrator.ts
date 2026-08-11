import type { SupabaseClient } from "@supabase/supabase-js";
import { autoEquipIfSolo, fulfillItemPurchase } from "@/lib/items";
import { sendPurchaseNotification, sendGiftSentNotification } from "@/lib/notification-senders/purchase";
import { sendGiftReceivedNotification } from "@/lib/notification-senders/gift";
import { InfrastructureError } from "@/lib/errors";

/**
 * Supported payment provider identifier.
 */
export type PurchaseProvider = "stripe" | "cashfree" | "nowpayments" | "abacatepay" | string;

/**
 * Result returned after attempting to claim a pending purchase.
 */
export interface ClaimPendingPurchaseResult {
  ok: boolean;
  purchase_id?: string;
  error_code?: string;
  already_claimed?: boolean;
  reason?: string;
}

/**
 * Context required to claim a pending purchase.
 */
export interface PurchaseClaimContext {
  provider: PurchaseProvider;
  transactionId: string;
  developerId: number;
  itemId: string;
  purchaseId?: string;
  supabaseClient: SupabaseClient;
}

/**
 * Function type used to atomically claim a pending purchase.
 *
 * @param ctx Purchase claim context.
 * @returns Result of the claim operation.
 */
export type ClaimPendingPurchaseFn = (ctx: PurchaseClaimContext) => Promise<ClaimPendingPurchaseResult>;

/**
 * Options required to orchestrate a purchase fulfillment.
 */
export interface PurchaseOrchestrationOptions {
  provider: PurchaseProvider;
  transactionId: string;
  purchaseId?: string;
  developerId: number;
  itemId: string;
  githubLogin?: string | null;
  giftedTo?: number | null;
  idempotencyKey?: string | null;
  updatePurchaseFields?: Record<string, unknown>;
  supabaseClient: SupabaseClient;
  claimPendingPurchase: ClaimPendingPurchaseFn;
}

/**
 * Result returned after completing purchase orchestration.
 */
export interface PurchaseOrchestrationResult {
  kind: "completed" | "duplicate" | "sold_out" | "not_found" | "failed";
  purchaseId?: string;
  status?: "completed" | "delivered" | "processing" | "pending" | "expired" | "failed" | "refunded";
  ownerId?: number;
  reason?: string;
}

/**
 * Claims, fulfills, equips, and records a completed purchase.
 *
 * @param options Purchase orchestration options.
 * @returns The final purchase orchestration result.
 */
export async function orchestratePurchaseFulfillment({
  provider,
  transactionId,
  purchaseId,
  developerId,
  itemId,
  githubLogin,
  giftedTo,
  idempotencyKey,
  updatePurchaseFields = {},
  supabaseClient,
  claimPendingPurchase,
}: PurchaseOrchestrationOptions): Promise<PurchaseOrchestrationResult> {
  const sb = supabaseClient;

  const claimResult = await claimPendingPurchase({
    provider,
    transactionId,
    developerId,
    itemId,
    purchaseId,
    supabaseClient: sb,
  });

  if (!claimResult.ok) {
    if (claimResult.error_code === "sold_out") {
      return { kind: "sold_out", purchaseId: claimResult.purchase_id, reason: "sold_out" };
    }
    if (claimResult.already_claimed || claimResult.reason === "already_claimed") {
      return { kind: "duplicate", purchaseId: claimResult.purchase_id, reason: "already_claimed" };
    }
    return { kind: "not_found", purchaseId: claimResult.purchase_id, reason: claimResult.reason ?? "claim_failed" };
  }

  const pendingPurchaseId = claimResult.purchase_id;
  if (!pendingPurchaseId) {
    throw new InfrastructureError(`[purchase-orchestrator] Missing purchase_id after claiming ${transactionId}`);
  }

  const ownerId = (giftedTo ?? 0) > 0 ? Number(giftedTo) : Number(developerId);

  console.log(`[purchase-orchestrator] Fulfilling purchase ${pendingPurchaseId} via ${provider}`);
  const { status: purchaseStatus } = await fulfillItemPurchase(ownerId, itemId, sb);

  await sb
    .from("purchases")
    .update({
      status: purchaseStatus,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
      ...updatePurchaseFields,
    })
    .eq("id", pendingPurchaseId);

  await autoEquipIfSolo(ownerId, itemId);

  const { data: dev } = await sb
    .from("developers")
    .select("github_login")
    .eq("id", developerId)
    .single();

  if (giftedTo) {
    const { data: receiver } = await sb
      .from("developers")
      .select("github_login")
      .eq("id", Number(giftedTo))
      .single();

    await sb.from("activity_feed").insert({
      event_type: "gift_sent",
      actor_id: developerId,
      target_id: Number(giftedTo),
      metadata: {
        giver_login: dev?.github_login ?? githubLogin ?? "unknown",
        receiver_login: receiver?.github_login ?? "unknown",
        item_id: itemId,
      },
    });

    sendGiftSentNotification(
      developerId,
      dev?.github_login ?? githubLogin ?? "",
      receiver?.github_login ?? "unknown",
      pendingPurchaseId,
      itemId,
    );
    sendGiftReceivedNotification(
      Number(giftedTo),
      dev?.github_login ?? githubLogin ?? "someone",
      receiver?.github_login ?? "unknown",
      pendingPurchaseId,
      itemId,
    );
  } else {
    await sb.from("activity_feed").insert({
      event_type: "item_purchased",
      actor_id: developerId,
      metadata: {
        login: dev?.github_login ?? githubLogin ?? null,
        item_id: itemId,
      },
    });

    sendPurchaseNotification(
      developerId,
      dev?.github_login ?? githubLogin ?? "",
      pendingPurchaseId,
      itemId,
    );
  }

  return {
    kind: "completed",
    purchaseId: pendingPurchaseId,
    status: purchaseStatus,
    ownerId,
  };
}

/**
 * Atomically claims a pending purchase to prevent duplicate fulfillment.
 *
 * @param ctx Purchase claim context.
 * @returns The result of the claim attempt.
 */
export async function claimPendingPurchaseAtomically({
  provider,
  transactionId,
  developerId,
  itemId,
  purchaseId,
  supabaseClient,
}: PurchaseClaimContext): Promise<ClaimPendingPurchaseResult> {
  if (typeof supabaseClient.rpc === "function") {
    const { data: claimData, error: claimError } = await supabaseClient.rpc("claim_pending_purchase_atomic", {
      p_developer_id: developerId,
      p_item_id: itemId,
      p_provider: provider,
      p_tx_id: transactionId,
      ...(purchaseId ? { p_purchase_id: purchaseId } : {}),
    });

    if (claimError) {
      throw new InfrastructureError(
        `[purchase-orchestrator] Failed to claim pending purchase ${transactionId}: ${claimError.message}`,
        claimError
      );
    }

    const claimResult = Array.isArray(claimData) ? claimData[0] : claimData;
    if (claimResult?.error_code === "sold_out") {
      return { ok: false, purchase_id: claimResult.purchase_id, error_code: "sold_out" };
    }

    if (claimResult?.ok && claimResult.purchase_id) {
      return { ok: true, purchase_id: String(claimResult.purchase_id) };
    }

    return { ok: false, purchase_id: claimResult?.purchase_id, already_claimed: true, reason: "already_claimed" };
  }

  const updateBuilder = supabaseClient.from("purchases").update({ status: "processing" });

  if (purchaseId) {
    updateBuilder.eq("id", purchaseId);
  } else {
    updateBuilder.eq("developer_id", developerId);
    updateBuilder.eq("item_id", itemId);
    updateBuilder.eq("provider", provider);
    updateBuilder.eq("status", "pending");
    if (transactionId) {
      updateBuilder.eq("provider_tx_id", transactionId);
    }
  }

  const { data: claimed, error } = await updateBuilder.select("id").maybeSingle();

  if (error) {
    throw new InfrastructureError(
      `[purchase-orchestrator] Failed to claim pending purchase ${transactionId}: ${error.message}`,
      error
    );
  }

  if (!claimed) {
    return { ok: false, purchase_id: purchaseId, reason: "not_found" };
  }

  return { ok: true, purchase_id: String(claimed.id ?? purchaseId ?? developerId) };
}
