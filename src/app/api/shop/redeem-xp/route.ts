import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { levelFromXp } from "@/lib/xp";

/**
 * @param {import('next/server').NextRequest} req
 */
export async function POST(req: Request) {
  try {
    const supabase = await createServerSupabase();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { code } = await req.json();
    if (!code || typeof code !== "string") {
      return NextResponse.json({ error: "Valid code is required" }, { status: 400 });
    }

    const sb = getSupabaseAdmin();
    
    // First, verify the user has a linked developer account
    const { data: dev } = await sb
      .from("developers")
      .select("id, xp_total")
      .eq("claimed_by", user.id)
      .single();

    if (!dev) {
      return NextResponse.json({ error: "You must link a LeetCode account first." }, { status: 403 });
    }

    // Attempt to find the code in the xp_redeem_codes table
    const { data: redeemCode, error: fetchError } = await sb
      .from("xp_redeem_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (fetchError || !redeemCode) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 404 });
    }

    // Check expiration
    if (redeemCode.expires_at && new Date(redeemCode.expires_at) < new Date()) {
      return NextResponse.json({ error: "This code has expired." }, { status: 410 });
    }

    // Check usage limits
    if (redeemCode.max_uses !== -1 && redeemCode.used_count >= redeemCode.max_uses) {
      return NextResponse.json({ error: "This code has already reached its maximum usage limit." }, { status: 410 });
    }

    // Check if the user already redeemed this code
    // (We'll store usage in a new table to track who redeemed what if we need strict 1 per user,
    // but for now we just rely on total uses limit or add a simple check in a mapping table)
    const { data: existingUsage } = await sb
      .from("xp_code_usages")
      .select("id")
      .eq("code_id", redeemCode.id)
      .eq("developer_id", dev.id)
      .maybeSingle();

    if (existingUsage) {
       return NextResponse.json({ error: "You have already redeemed this code." }, { status: 409 });
    }

    // Apply XP to developer and recalculate level
    const xpAmount = redeemCode.xp_amount;
    const newXpTotal = (dev.xp_total ?? 0) + xpAmount;
    const newLevel = levelFromXp(newXpTotal);

    const { error: xpError } = await sb
      .from("developers")
      .update({ xp_total: newXpTotal, xp_level: newLevel })
      .eq("id", dev.id);

    if (xpError) {
      return NextResponse.json({ error: "Failed to apply XP. Please try again later." }, { status: 500 });
    }

    // Record the usage for this specific user
    await sb.from("xp_code_usages").insert({
      code_id: redeemCode.id,
      developer_id: dev.id
    });

    // Update the code's global usage count
    const newUsedCount = redeemCode.used_count + 1;
    const fullyUsed = redeemCode.max_uses !== -1 && newUsedCount >= redeemCode.max_uses;

    if (fullyUsed) {
      // If code is exhausted, we can delete it (or keep it as reference)
      // I'll leave it in DB since `xp_code_usages` references it, just rely on used_count check
      await sb.from("xp_redeem_codes").update({ used_count: newUsedCount }).eq("id", redeemCode.id);
    } else {
      await sb.from("xp_redeem_codes").update({ used_count: newUsedCount }).eq("id", redeemCode.id);
    }

    return NextResponse.json({
      success: true,
      xp_granted: xpAmount,
      new_xp_total: newXpTotal,
      new_xp_level: newLevel,
      message: `🎉 You claimed ${xpAmount} XP! Your building has grown stronger.`,
    });
  } catch (error) {
    console.error("[Redeem XP API Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
