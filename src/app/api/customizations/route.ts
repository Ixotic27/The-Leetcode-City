import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

/**
 * @param {import('next/server').NextRequest} request
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const developerId = parseInt(searchParams.get("developer_id") ?? "", 10);

  if (!developerId || isNaN(developerId)) {
    return NextResponse.json(
      { error: "developer_id is required" },
      { status: 400 }
    );
  }

  const sb = getSupabaseAdmin();

  const { data } = await sb
    .from("developer_customizations")
    .select("item_id, config")
    .eq("developer_id", developerId)
    .in("item_id", ["custom_color", "billboard", "led_banner"]);

  let customColor: string | null = null;
  let billboardImages: string[] = [];
  let ledBannerText: string | null = null;

  for (const row of data ?? []) {
    const config = row.config as Record<string, unknown>;
    if (row.item_id === "custom_color" && typeof config?.color === "string") {
      customColor = config.color;
    }
    if (row.item_id === "billboard") {
      if (Array.isArray(config?.images)) {
        billboardImages = config.images as string[];
      } else if (typeof config?.image_url === "string") {
        billboardImages = [config.image_url];
      }
    }
    if (row.item_id === "led_banner" && typeof config?.text === "string") {
      ledBannerText = config.text;
    }
  }

  return NextResponse.json({
    custom_color: customColor,
    billboard_images: billboardImages,
    led_banner_text: ledBannerText,
  });
}

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  // Auth required
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();

  // Validate developer
  const { data: dev } = await sb
    .from("developers")
    .select("id, github_login, claimed, claimed_by")
    .eq("claimed_by", user.id)
    .single();

  const githubLogin = dev?.github_login ?? "";

  if (!dev || !dev.claimed || dev.claimed_by !== user.id) {
    return NextResponse.json(
      { error: "Building not found or not yours" },
      { status: 403 }
    );
  }

  // Parse body
  let body: { item_id: string; color?: string | null; text?: string | null };
  try {
    body = await request.json();
  } catch (err) { console.warn("[app/api/customizations/route.ts] error:", err); return NextResponse.json({ error: "Invalid body" }, { status: 400 });
   }
  const { item_id, color, text } = body;

  if (item_id !== "custom_color" && item_id !== "led_banner") {
    return NextResponse.json(
      { error: "Use /api/customizations/upload for billboard" },
      { status: 400 }
    );
  }

  // Validate ownership
  const { data: purchase } = await sb
    .from("purchases")
    .select("id")
    .eq("developer_id", dev.id)
    .eq("item_id", item_id)
    .eq("status", "completed")
    .maybeSingle();

  if (!purchase) {
    return NextResponse.json(
      { error: "You don't own this item" },
      { status: 403 }
    );
  }

  if (item_id === "custom_color") {
    if (color !== null && color !== undefined) {
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        return NextResponse.json({ error: "Invalid hex color (use #RRGGBB)" }, { status: 400 });
      }
    }

    if (color === null) {
      const { error: deleteError } = await sb.from("developer_customizations")
        .delete().eq("developer_id", dev.id).eq("item_id", "custom_color");
      if (deleteError) return NextResponse.json({ error: "Failed to remove customization" }, { status: 500 });
      return NextResponse.json({ success: true, color: null });
    }

    const { error: upsertError } = await sb.from("developer_customizations").upsert(
      { developer_id: dev.id, item_id: "custom_color", config: { color } },
      { onConflict: "developer_id,item_id" }
    );
    if (upsertError) return NextResponse.json({ error: "Failed to save customization" }, { status: 500 });
    return NextResponse.json({ success: true, color });
  }

  if (item_id === "led_banner") {
    if (!text) {
      const { error: deleteError } = await sb.from("developer_customizations")
        .delete().eq("developer_id", dev.id).eq("item_id", "led_banner");
      if (deleteError) return NextResponse.json({ error: "Failed to remove customization" }, { status: 500 });
      return NextResponse.json({ success: true, text: null });
    }

    const { error: upsertError } = await sb.from("developer_customizations").upsert(
      { developer_id: dev.id, item_id: "led_banner", config: { text: text.substring(0, 100) } },
      { onConflict: "developer_id,item_id" }
    );
    if (upsertError) return NextResponse.json({ error: "Failed to save customization" }, { status: 500 });
    return NextResponse.json({ success: true, text: text.substring(0, 100) });
  }
}
