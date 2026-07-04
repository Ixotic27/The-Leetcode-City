import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

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

    const { data: redeemCode, error: fetchError } = await sb
      .from("xp_redeem_codes")
      .select("id, xp_amount, max_uses, used_count, expires_at")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (fetchError || !redeemCode) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 404 });
    }

    if (redeemCode.expires_at && new Date(redeemCode.expires_at) < new Date()) {
      return NextResponse.json({ error: "This code has expired." }, { status: 410 });
    }

    if (redeemCode.max_uses !== -1 && redeemCode.used_count >= redeemCode.max_uses) {
      return NextResponse.json(
        { error: "This code has already reached its maximum usage limit." },
        { status: 410 }
      );
    }

    // ── Atomic redemption + XP grant via RPC ─────────────────────────
    // redeem_xp_code() does everything atomically in one transaction:
    //   1. INSERT xp_code_usages ON CONFLICT DO NOTHING
    //   2. UPDATE xp_redeem_codes SET used_count = used_count + 1
    //   3. Calls grant_xp_atomic() internally — XP is granted in the
    //      same transaction as code consumption. If the XP grant fails,
    //      the entire transaction rolls back (code never consumed).
    //   4. Returns { ok, error_code, xp_amount, new_total, new_level }
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
        grant_failed: {
          error: "Code could not be redeemed. Contact support.",
          status: 500,
        },
      };
      const mapped = errorMap[result?.error_code] ?? {
        error: "Code could not be redeemed.",
        status: 409,
      };
      return NextResponse.json({ error: mapped.error }, { status: mapped.status });
    }

    return NextResponse.json({
      success: true,
      xp_granted: result.xp_amount,
      new_xp_total: result.new_total,
      new_xp_level: result.new_level,
      message: `🎉 You claimed ${result.xp_amount} XP! Your building has grown stronger.`,
    });
  } catch (error) {
    console.error("[Redeem XP API Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}