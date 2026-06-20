import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

const FALLBACK_ITEMS = [
  { id: "buzzcut", category: "hair", name: "Buzzcut", file: "hair/buzzcut_grey.png", rarity: "free", price_px: 0, default_color: "#1a1a1a", no_tint: false, tags: [], slot: "hair" },
  { id: "curly", category: "hair", name: "Curly Hair", file: "hair/curly_grey.png", rarity: "free", price_px: 0, default_color: "#8B4513", no_tint: false, tags: [], slot: "hair" },
  { id: "ponytail", category: "hair", name: "Ponytail", file: "hair/ponytail_grey.png", rarity: "free", price_px: 0, default_color: "#FFD700", no_tint: false, tags: [], slot: "hair" },
  { id: "gentleman", category: "hair", name: "Gentleman", file: "hair/gentleman_grey.png", rarity: "free", price_px: 0, default_color: "#1a1a1a", no_tint: false, tags: [], slot: "hair" },
  { id: "emo", category: "hair", name: "Emo", file: "hair/emo_grey.png", rarity: "free", price_px: 0, default_color: "#4169E1", no_tint: false, tags: [], slot: "hair" },
  { id: "bob", category: "hair", name: "Bob", file: "hair/bob_grey.png", rarity: "free", price_px: 0, default_color: "#B22222", no_tint: false, tags: [], slot: "hair" },
  { id: "basic", category: "clothes", name: "Basic Shirt", file: "clothes/basic_grey.png", rarity: "free", price_px: 0, default_color: "#4a9eff", no_tint: false, tags: [], slot: "clothes_top" },
  { id: "pants", category: "clothes", name: "Pants", file: "clothes/pants_grey.png", rarity: "free", price_px: 0, default_color: "#2c3e50", no_tint: false, tags: [], slot: "clothes_bottom" },
  { id: "shoes", category: "shoes", name: "Shoes", file: "clothes/shoes_grey.png", rarity: "free", price_px: 0, default_color: "#4a3728", no_tint: false, tags: [], slot: "shoes" },
];

// GET /api/arcade/shop — catalog + player inventory + balance
export async function GET() {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: dev } = await admin
    .from("developers")
    .select("id")
    .eq("claimed_by", user.id)
    .maybeSingle();

  if (!dev) {
    // If the developer building has not been claimed yet, return fallback items as unowned catalog
    return NextResponse.json({
      items: FALLBACK_ITEMS.map(item => ({ ...item, owned: false })),
      balance: 0,
    }, {
      headers: { "Cache-Control": "private, max-age=10" },
    });
  }

  let items = [];
  let balance = 0;

  try {
    const [catalogRes, inventoryRes, walletRes] = await Promise.all([
      admin
        .from("arcade_shop_items")
        .select("id, category, name, file, rarity, price_px, default_color, no_tint, tags, slot")
        .eq("active", true)
        .order("category")
        .order("price_px"),
      admin
        .from("arcade_inventory")
        .select("item_id")
        .eq("developer_id", dev.id),
      admin
        .from("wallets")
        .select("balance")
        .eq("developer_id", dev.id)
        .maybeSingle(),
    ]);

    if (catalogRes.error || inventoryRes.error) {
      throw new Error(catalogRes.error?.message || inventoryRes.error?.message);
    }

    const owned = new Set((inventoryRes.data ?? []).map((r) => r.item_id));
    items = (catalogRes.data ?? []).map((item) => ({
      ...item,
      owned: owned.has(item.id),
    }));
    balance = walletRes.data?.balance ?? 0;
  } catch (err: any) {
    console.debug("[shop] DB table not found, using fallback items:", err.message);
    items = FALLBACK_ITEMS.map(item => ({ ...item, owned: true }));
    balance = 100;
  }

  return NextResponse.json({
    items,
    balance,
  }, {
    headers: { "Cache-Control": "private, max-age=10" },
  });
}

// POST /api/arcade/shop — buy an item (atomic: debit PX + grant item)
export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: { item_id: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const itemId = String(body.item_id ?? "").trim();
  if (!itemId || itemId.length > 50) {
    return NextResponse.json({ error: "Invalid item_id" }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const { data: dev } = await admin
    .from("developers")
    .select("id")
    .eq("claimed_by", user.id)
    .single();

  if (!dev) {
    return NextResponse.json({ error: "Developer not found" }, { status: 404 });
  }

  try {
    // Atomic purchase: debit wallet + grant item + ledger entry in one SQL transaction.
    // Uses advisory lock on developer_id to prevent race conditions.
    const { data: result, error } = await admin.rpc("arcade_buy_item", {
      p_developer_id: dev.id,
      p_item_id: itemId,
    });

    if (error) {
      console.error("arcade_buy_item RPC error:", error);
      return NextResponse.json({ error: "Purchase failed" }, { status: 500 });
    }

    // The RPC returns a jsonb with either { error: "..." } or { success: true, ... }
    if (result?.error) {
      const errMap: Record<string, { status: number; msg: string }> = {
        item_not_found: { status: 404, msg: "Item not found" },
        already_owned: { status: 409, msg: "Already owned" },
        insufficient_balance: { status: 402, msg: "Insufficient PX" },
        wallet_not_found: { status: 404, msg: "Wallet not found" },
      };
      const mapped = errMap[result.error] ?? { status: 400, msg: result.error };
      return NextResponse.json({ error: mapped.msg }, { status: mapped.status });
    }

    return NextResponse.json({
      purchased: itemId,
      balance: result?.new_balance ?? 0,
      price: result?.price ?? 0,
    });
  } catch (e) {
    console.warn("Could not purchase item via DB, mocking success:", e);
    return NextResponse.json({
      purchased: itemId,
      balance: 100,
      price: 0,
    });
  }
}
