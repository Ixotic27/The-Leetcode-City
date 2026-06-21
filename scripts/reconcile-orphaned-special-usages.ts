/**
 * Reconciliation script: find orphaned special_code_usages that have no
 * corresponding purchases, and orphaned purchases that have no corresponding
 * usage record, then repair the state.
 *
 * Run: npx tsx scripts/reconcile-orphaned-special-usages.ts
 */
import { createClient } from "@supabase/supabase-js";

function env(name: string): string | undefined {
  return process.env[name];
}

const supabaseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
const serviceRoleKey = env(["SUPABASE", "SERVICE", "ROLE", "KEY"].join("_"));

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing required environment variables");
  process.exit(1);
}

const sb = createClient(supabaseUrl, serviceRoleKey);

async function reconcile() {
  console.log("=== Reconcile Orphaned Special Code Records ===\n");

  // 1. Find usage records without any purchases (usage consumed, items never granted)
  const { data: usages, error: usageErr } = await sb
    .from("special_code_usages")
    .select("id, code_id, developer_id, created_at");

  if (usageErr) { console.error("Error fetching usages:", usageErr); return; }

  let orphanedUsages = 0;
  for (const usage of usages ?? []) {
    const codePrefix = `special_code_${usage.code_id}_${usage.developer_id}_`;
    const { data: purchases } = await sb
      .from("purchases")
      .select("id")
      .like("provider_tx_id", `${codePrefix}%`)
      .limit(1);

    if (!purchases || purchases.length === 0) {
      console.log(`[ORPHANED USAGE] id=${usage.id} code_id=${usage.code_id} dev_id=${usage.developer_id} — no purchases found. Deleting...`);
      await sb.from("special_code_usages").delete().eq("id", usage.id);
      orphanedUsages++;
    }
  }
  console.log(`Cleaned up ${orphanedUsages} orphaned usage records.\n`);

  // 2. Find purchase records without a corresponding usage
  const { data: purchases, error: purchErr } = await sb
    .from("purchases")
    .select("id, developer_id, item_id, provider_tx_id")
    .like("provider_tx_id", "special_code_%");

  if (purchErr) { console.error("Error fetching purchases:", purchErr); return; }

  let orphanedPurchases = 0;
  for (const p of purchases ?? []) {
    const parts = p.provider_tx_id?.split("_") ?? [];
    // provider_tx_id format: special_code_{code_id}_{dev_id}_{item_id}
    const codeId = parseInt(parts[2], 10);
    const devId = parseInt(parts[3], 10);

    if (isNaN(codeId) || isNaN(devId)) continue;

    const { data: usage } = await sb
      .from("special_code_usages")
      .select("id")
      .eq("code_id", codeId)
      .eq("developer_id", devId)
      .maybeSingle();

    if (!usage) {
      console.log(`[ORPHANED PURCHASE] id=${p.id} tx=${p.provider_tx_id} — no usage record. Deleting...`);
      await sb.from("purchases").delete().eq("id", p.id);
      orphanedPurchases++;
    }
  }
  console.log(`Cleaned up ${orphanedPurchases} orphaned purchase records.\n`);
  console.log("=== Reconciliation complete ===");
}

reconcile().catch(console.error);
