import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { sanitizeLedBannerText } from "@/lib/sanitize-led-banner";
import { EntitlementService } from "@/services/entitlementService";

export const dynamic = "force-dynamic";

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
    .in("item_id", ["custom_color", "billboard", "led_banner", "selected_title"]);

  let customColor: string | null = null;
  let billboardImages: string[] = [];
  let ledBannerText: string | null = null;
  let selectedTitle: string | null = null;

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
     if (row.item_id === "selected_title" && typeof config?.slug === "string") {
       selectedTitle = config.slug;
     }
  }

  return NextResponse.json({
    custom_color: customColor,
    billboard_images: billboardImages,
    led_banner_text: ledBannerText,
    selected_title: selectedTitle,
  });
}

/**
 * @param {import('next/server').NextRequest} request
 */
export async function POST(request: Request) {
  const { resolveAuthenticatedDeveloper } = await import("@/lib/authenticated-developer");
  const auth = await resolveAuthenticatedDeveloper({});

  if (!auth.ok || !auth.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const sb = getSupabaseAdmin();
  const entitlementService = new EntitlementService();

  const { data: dev } = await sb
    .from("developers")
    .select("id, github_login, claimed, claimed_by")
    .eq("claimed_by", auth.user.id)
    .single();

  const githubLogin = dev?.github_login ?? "";

  if (!dev || !dev.claimed || dev.claimed_by !== auth.user.id) {
    return NextResponse.json(
      { error: "Building not found or not yours" },
      { status: 403 }
    );
  }

  let body: { item_id: string; color?: string | null; text?: string | null; slug?: string | null; dev_mode?: boolean };
  try {
    body = await request.json();
  } catch (err) {
    console.warn("[app/api/customizations/route.ts] error:", err);
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { item_id, color, text, slug, dev_mode } = body;

  if (item_id !== "custom_color" && item_id !== "led_banner" && item_id !== "selected_title") {
    return NextResponse.json(
      { error: "Invalid item_id" },
      { status: 400 }
    );
  }

  const isDeveloper = ["ishant_27", "ixotic", "ixotic27"].includes(githubLogin.toLowerCase());
  const isDev = isDeveloper && dev_mode === true;

  if (item_id !== "selected_title") {
    if (!isDev) {
      const ownsReal = await entitlementService.ownsItem(dev.id, item_id);

      if (!ownsReal) {
        return NextResponse.json(
          { error: "You don't own this item" },
          { status: 403 }
        );
      }
    }
  }

  if (item_id === "selected_title") {
    if (!slug || slug === "auto") {
      const { error: deleteError } = await sb.from("developer_customizations")
        .delete().eq("developer_id", dev.id).eq("item_id", "selected_title");
      if (deleteError) return NextResponse.json({ error: "Failed to remove customization" }, { status: 500 });
      return NextResponse.json({ success: true, slug: null });
    }

    const isDevTitle = ["title_creator", "title_lead_dev", "title_sys_op"].includes(slug);

    if (isDevTitle && !isDeveloper) {
      return NextResponse.json({ error: "This title is reserved for LeetCode City developers" }, { status: 403 });
    }

    if (!isDevTitle) {
      if (!isDev) {
        // Resolve item UUID from slug (arena items)
        const { data: itemData } = await sb
          .from("arena_items")
          .select("id")
          .eq("slug", slug)
          .maybeSingle();

        if (itemData) {
          const ownsArenaItem = await entitlementService.ownsInventoryItem(dev.id, itemData.id, {
            inventoryTable: "arena_inventory",
            ownerColumn: "user_id",
          });

          if (!ownsArenaItem) {
            return NextResponse.json({ error: "You must unlock this title badge in the Arena first" }, { status: 403 });
          }
        } else {
          const ownsShopItem = await entitlementService.ownsItem(dev.id, slug);

          if (!ownsShopItem) {
            return NextResponse.json({ error: "Invalid title slug or you don't own this title" }, { status: 403 });
          }
        }
      }
    }

    const { error: upsertError } = await sb.from("developer_customizations").upsert(
      { developer_id: dev.id, item_id: "selected_title", config: { slug } },
      { onConflict: "developer_id,item_id" }
    );
    if (upsertError) return NextResponse.json({ error: "Failed to save customization" }, { status: 500 });
    return NextResponse.json({ success: true, slug });
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
    if (upsertError) {
      console.error("[custom_color upsert] error:", upsertError);
      // In local dev, pretend it succeeded so localStorage overrides still apply
      if (process.env.NODE_ENV === "development") {
        return NextResponse.json({ success: true, color, mocked: true });
      }
      return NextResponse.json({ error: "Failed to save customization" }, { status: 500 });
    }
    return NextResponse.json({ success: true, color });
  }

  if (item_id === "led_banner") {
    // Sanitize before checking emptiness — a string of only control chars
    // should be treated the same as an explicit clear request.
    const sanitized = text ? sanitizeLedBannerText(text) : null;

    if (!sanitized) {
      const { error: deleteError } = await sb.from("developer_customizations")
        .delete().eq("developer_id", dev.id).eq("item_id", "led_banner");
      if (deleteError) return NextResponse.json({ error: "Failed to remove customization" }, { status: 500 });
      return NextResponse.json({ success: true, text: null });
    }

    const { error: upsertError } = await sb.from("developer_customizations").upsert(
      { developer_id: dev.id, item_id: "led_banner", config: { text: sanitized } },
      { onConflict: "developer_id,item_id" }
    );
    if (upsertError) return NextResponse.json({ error: "Failed to save customization" }, { status: 500 });
    return NextResponse.json({ success: true, text: sanitized });
  }
}