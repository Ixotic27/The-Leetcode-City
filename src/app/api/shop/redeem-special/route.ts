import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

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
      .select("id, github_login")
      .eq("claimed_by", user.id)
      .single();

    if (!dev) {
      return NextResponse.json({ error: "You must link a LeetCode account first." }, { status: 403 });
    }

    // Look up the code
    const { data: specialCode, error: fetchError } = await sb
      .from("special_codes")
      .select("*")
      .eq("code", code.trim().toUpperCase())
      .single();

    if (fetchError || !specialCode) {
      return NextResponse.json({ error: "Invalid or expired code." }, { status: 404 });
    }

    // Check expiry
    if (specialCode.expires_at && new Date(specialCode.expires_at) < new Date()) {
      return NextResponse.json({ error: "This code has expired." }, { status: 410 });
    }

    // Check max uses
    if (specialCode.max_uses !== -1 && specialCode.used_count >= specialCode.max_uses) {
      return NextResponse.json({ error: "This code has reached its maximum usage limit." }, { status: 410 });
    }

    // Check if this user already redeemed this code
    const { data: existingUsage } = await sb
      .from("special_code_usages")
      .select("id")
      .eq("code_id", specialCode.id)
      .eq("developer_id", dev.id)
      .maybeSingle();

    if (existingUsage) {
      return NextResponse.json({ error: "You have already redeemed this code." }, { status: 409 });
    }

    // ── Handle "all_items" type ──────────────────────────────
    if (specialCode.type === "all_items") {
      // Fetch all active items
      const { data: allItems } = await sb
        .from("items")
        .select("id, name")
        .eq("is_active", true);

      if (!allItems || allItems.length === 0) {
        return NextResponse.json({ error: "No items found to grant." }, { status: 500 });
      }

      // Find items user doesn't already own
      const { data: ownedRows } = await sb
        .from("purchases")
        .select("item_id")
        .eq("developer_id", dev.id)
        .is("gifted_to", null)
        .eq("status", "completed");

      const alreadyOwned = new Set((ownedRows ?? []).map(r => r.item_id));
      const toGrant = allItems.filter(i => !alreadyOwned.has(i.id));

      if (toGrant.length > 0) {
        const inserts = toGrant.map(item => ({
          developer_id: dev.id,
          item_id: item.id,
          provider: "free",
          provider_tx_id: `special_code_${specialCode.id}_${dev.id}_${item.id}`,
          amount_cents: 0,
          currency: "usd",
          status: "completed",
        }));

        const { error: insertErr } = await sb.from("purchases").insert(inserts);
        if (insertErr) {
          console.error("[redeem-special] insert error:", insertErr);
          return NextResponse.json({ error: "Failed to grant items. Please try again." }, { status: 500 });
        }
      }

      // Record the usage
      await sb.from("special_code_usages").insert({
        code_id: specialCode.id,
        developer_id: dev.id,
      });

      // Bump used_count
      await sb
        .from("special_codes")
        .update({ used_count: specialCode.used_count + 1 })
        .eq("id", specialCode.id);

      const grantedIds = toGrant.map(i => i.id);

      return NextResponse.json({
        success: true,
        type: "all_items",
        granted_items: grantedIds,
        message: toGrant.length > 0
          ? `🎁 Unlocked ${toGrant.length} item${toGrant.length !== 1 ? "s" : ""}! Head to your shop to equip them.`
          : `✅ You already own everything in the shop!`,
      });
    }

    return NextResponse.json({ error: "Unknown code type." }, { status: 400 });

  } catch (error) {
    console.error("[redeem-special API Error]", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
