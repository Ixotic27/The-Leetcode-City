/**
 * Pixel (PX) currency module.
 * Handles developer wallet balance queries and earning pixels via RPC calls.
 */

import { getSupabaseAdmin } from "./supabase";

/**
 * A developer's pixel wallet balance.
 */
export interface WalletBalance {
  /** Current spendable pixel balance. */
  balance: number;
  /** Total pixels earned over the lifetime of the account. */
  lifetime_earned: number;
  /** Total pixels purchased over the lifetime of the account. */
  lifetime_bought: number;
  /** Total pixels spent over the lifetime of the account. */
  lifetime_spent: number;
}

/**
 * Fetch the current pixel wallet balance for a developer.
 *
 * @param developerId - The database ID of the developer.
 * @returns A {@link WalletBalance} object, or all-zero defaults if no wallet exists.
 */
export async function getBalance(developerId: number): Promise<WalletBalance> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("wallets")
    .select("balance, lifetime_earned, lifetime_bought, lifetime_spent")
    .eq("developer_id", developerId)
    .maybeSingle();

  return data ?? { balance: 0, lifetime_earned: 0, lifetime_bought: 0, lifetime_spent: 0 };
}

/**
 * Award pixels to a developer for a given earn rule.
 * Uses the `earn_pixels` database RPC which handles idempotency via the optional key.
 *
 * @param developerId - The database ID of the developer earning pixels.
 * @param earnRuleId  - The earn rule identifier (e.g. "checkin", "dailies").
 * @param referenceId - Optional reference ID linking this earn to an event (e.g. checkin date).
 * @param idempotencyKey - Optional key to prevent duplicate pixel awards from retried calls.
 * @returns An object indicating success and, if successful, the number of pixels earned.
 */
export async function earnPixels(
  developerId: number,
  earnRuleId: string,
  referenceId?: string,
  idempotencyKey?: string,
): Promise<{ success: boolean; earned?: number; error?: string }> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.rpc("earn_pixels", {
    p_developer_id: developerId,
    p_earn_rule_id: earnRuleId,
    p_reference_id: referenceId ?? null,
    p_reference_type: null,
    p_idempotency_key: idempotencyKey ?? null,
  });

  if (error) return { success: false, error: error.message };
  const result = data as { success?: boolean; error?: string; earned?: number };
  if (result.error) return { success: false, error: result.error };
  return { success: true, earned: result.earned };
}
