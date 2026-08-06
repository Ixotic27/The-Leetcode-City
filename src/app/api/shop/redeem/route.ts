import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  // Must be logged in
  const { resolveAuthenticatedDeveloper } = await import("@/lib/authenticated-developer");
  const auth = await resolveAuthenticatedDeveloper({ loadDeveloper: false });
  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = auth.user;

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

  // Call the atomic RPC function `redeem_shop_code`
  const { data: rpcData, error: rpcError } = await sb.rpc("redeem_shop_code", {
    p_code: code,
    p_developer_id: dev.id,
  });

  if (rpcError) {
    console.error("[redeem-shop-code RPC error]:", rpcError);
    if (rpcError.message?.includes("redeem_optimistic_lock_failed")) {
      return NextResponse.json({ error: "This code has already been fully used." }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to redeem code. Please try again." }, { status: 500 });
  }

  const result = rpcData?.[0];

  if (!result || !result.ok) {
    const errorMap: Record<string, { error: string; status: number }> = {
      invalid_code: { error: "Invalid or expired code.", status: 404 },
      expired_code: { error: "This code has expired.", status: 410 },
      fully_used_code: { error: "This code has already been fully used.", status: 409 },
      item_not_available: { error: "The item linked to this code is no longer available.", status: 410 },
      already_owned: { error: `You already own "${result?.item_name || "this item"}".`, status: 409 },
    };
    
    const mapped = errorMap[result?.error_code ?? ""] ?? {
      error: "Code could not be redeemed. Please try again.",
      status: 400,
    };
    return NextResponse.json({ error: mapped.error }, { status: mapped.status });
  }

  return NextResponse.json({
    success: true,
    item_id: result.item_id,
    item_name: result.item_name,
    message: `"${result.item_name}" has been added to your inventory!`,
  });
}
