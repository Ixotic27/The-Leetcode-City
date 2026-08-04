import { getSupabaseAdmin } from "./supabase";

/**
 * Represents a developer's pixel wallet balance and lifetime statistics.
 */
export interface WalletBalance {
  /** Current spendable pixel balance */
  balance: number;
  /** Total pixels earned through all activities */
  lifetime_earned: number;
  /** Total pixels purchased with real money */
  lifetime_bought: number;
  /** Total pixels spent on purchases and upgrades */
  lifetime_spent: number;
}

/**
 * Retrieves the pixel wallet balance for a given developer.
 *
 * @param developerId - The unique ID of the developer
 * @returns Promise resolving to the developer's WalletBalance, or zeroed balance if not found
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
 * Awards pixels to a developer via the `earn_pixels` RPC function.
 * Supports idempotency to prevent double-credits on retry.
 *
 * @param developerId - The unique ID of the developer to credit
 * @param earnRuleId  - The rule identifier defining how many pixels to award
 * @param referenceId - Optional reference ID (e.g., contribution ID) for audit trail
 * @param idempotencyKey - Optional key to prevent duplicate credits on retries
 * @returns Promise resolving to success status, earned amount, or error message
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
