import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  // Must be logged in
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Must have a claimed building
  const sb = getSupabaseAdmin();
  const { data: dev } = await sb
    .from("developers")
    .select("id, github_login, claimed, xp_total")
    .eq("claimed_by", user.id)
    .single();

  if (!dev?.claimed) {
    return NextResponse.json(
      { error: "You must claim your building first to redeem codes." },
      { status: 403 }
    );
  }

  // Parse body
  let code: string;
  try {
    const body = await request.json();
    code = (body.code ?? "").trim().toUpperCase();
  } catch (err) { console.warn("[app/api/shop/redeem/route.ts] error:", err); return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
   }
  if (!code) {
    return NextResponse.json({ error: "No code provided" }, { status: 400 });
  }

  // Look up the code (use service role — public can't read codes table)
  const { data: redeemCode } = await sb
    .from("redeem_codes")
    .select("id, item_id, max_uses, used_count, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!redeemCode) {
    return NextResponse.json({ error: "Invalid or expired code." }, { status: 404 });
  }

  // Check expiry
  if (redeemCode.expires_at && new Date(redeemCode.expires_at) < new Date()) {
    // Delete expired code to clean up
    await sb.from("redeem_codes").delete().eq("id", redeemCode.id);
    return NextResponse.json({ error: "This code has expired." }, { status: 410 });
  }

  // Check uses remaining (max_uses = -1 means unlimited)
  if (redeemCode.max_uses !== -1 && redeemCode.used_count >= redeemCode.max_uses) {
    // All uses exhausted — clean up
    await sb.from("redeem_codes").delete().eq("id", redeemCode.id);
    return NextResponse.json({ error: "This code has already been fully used." }, { status: 409 });
  }

  const itemId = redeemCode.item_id;

  // Fetch item details
  const { data: item } = await sb
    .from("items")
    .select("id, name, is_active")
    .eq("id", itemId)
    .single();

  if (!item || !item.is_active) {
    return NextResponse.json({ error: "The item linked to this code is no longer available." }, { status: 410 });
  }

  // Check user doesn't already own it
  const { data: existing } = await sb
    .from("purchases")
    .select("id")
    .eq("developer_id", dev.id)
    .eq("item_id", itemId)
    .eq("status", "completed")
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ error: `You already own "${item.name}".` }, { status: 409 });
  }

  // Grant the item — insert a completed purchase with amount 0
  const { error: purchaseError } = await sb.from("purchases").insert({
    developer_id: dev.id,
    item_id: itemId,
    provider: "redeem_code",
    amount_cents: 0,
    currency: "usd",
    status: "completed",
    provider_tx_id: code, // store which code was used
  });

  if (purchaseError) {
    return NextResponse.json({ error: "Failed to grant item. Please try again." }, { status: 500 });
  }

  // Update or delete the code
  const newUsedCount = redeemCode.used_count + 1;
  const fullyUsed = redeemCode.max_uses !== -1 && newUsedCount >= redeemCode.max_uses;

  if (fullyUsed) {
    // Single-use or fully exhausted → DELETE to keep table clean
    await sb.from("redeem_codes").delete().eq("id", redeemCode.id);
  } else {
    // Multi-use → just increment
    await sb.from("redeem_codes").update({ used_count: newUsedCount }).eq("id", redeemCode.id);
  }

  return NextResponse.json({
    success: true,
    item_id: itemId,
    item_name: item.name,
    message: `🎉 "${item.name}" has been added to your inventory!`,
  });
}
