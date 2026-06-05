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

    // Verify the user has a linked developer account
    const { data: dev } = await sb
      .from("developers")
      .select("id, xp_total")
      .eq("claimed_by", user.id)
      .single();

    if (!dev) {
      return NextResponse.json(
        { error: "You must link a LeetCode account first." },
        { status: 403 }
      );
    }

    // Fetch and validate the code
    const { data: redeemCode, error: fetchError } = await sb
      .from("xp_redeem_codes")
      .select("id, xp_amount, max_uses, used_count, expires_at")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (fetchError || !redeemCode) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 404 });
    }

    // Check expiration (safe to do pre-RPC — expiry is immutable)
    if (redeemCode.expires_at && new Date(redeemCode.expires_at) < new Date()) {
      return NextResponse.json({ error: "This code has expired." }, { status: 410 });
    }

    // Check if already exhausted (fast pre-check — avoids RPC call for
    // obviously exhausted codes; DB-level guard is the authoritative check)
    if (redeemCode.max_uses !== -1 && redeemCode.used_count >= redeemCode.max_uses) {
      return NextResponse.json(
        { error: "This code has already reached its maximum usage limit." },
        { status: 410 }
      );
    }

    // ── Atomic redemption via RPC ─────────────────────────────────────
    // redeem_xp_code() does three things atomically:
    //   1. INSERT xp_code_usages ON CONFLICT DO NOTHING — per-user CAS
    //   2. UPDATE xp_redeem_codes SET used_count = used_count + 1
    //      WHERE used_count < max_uses — atomic cap-safe increment
    //   3. Returns ok + error_code so we only grant XP if both passed
    //
    // XP is applied AFTER the RPC succeeds — usage is recorded first,
    // so a failure in XP update cannot leave an unredeemed code slot.
    const { data: rpcResult, error: rpcError } = await sb.rpc("redeem_xp_code", {
      p_code_id:      redeemCode.id,
      p_developer_id: dev.id,
      p_xp_amount:    redeemCode.xp_amount,
      p_max_uses:     redeemCode.max_uses,
    });

    if (rpcError) {
      console.error("[redeem-xp] redeem_xp_code RPC error:", rpcError.message);
      return NextResponse.json(
        { error: "Redemption failed. Please try again later." },
        { status: 500 }
      );
    }

    const result = rpcResult?.[0];

    if (!result?.ok) {
      const errorMap: Record<string, { error: string; status: number }> = {
        already_redeemed: {
          error: "You have already redeemed this code.",
          status: 409,
        },
        exhausted: {
          error: "This code has already reached its maximum usage limit.",
          status: 410,
        },
      };
      const mapped = errorMap[result?.error_code] ?? {
        error: "Code could not be redeemed.",
        status: 409,
      };
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    // ── Apply XP — only reached if RPC won the race ───────────────────
    const xpAmount = result.xp_amount;
    const newXpTotal = (dev.xp_total ?? 0) + xpAmount;
    const newLevel = levelFromXp(newXpTotal);

    const { error: xpError } = await sb
      .from("developers")
      .update({ xp_total: newXpTotal, xp_level: newLevel })
      .eq("id", dev.id);

    if (xpError) {
      // RPC already committed usage + incremented used_count.
      // Log the failure but do not return an error that would let the
      // user retry — the code slot has been consumed.
      console.error("[redeem-xp] XP update failed after successful RPC:", xpError.message);
      return NextResponse.json(
        { error: "Code was redeemed but XP could not be applied. Contact support." },
        { status: 500 }
      );
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